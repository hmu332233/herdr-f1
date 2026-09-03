import type { WebSocket } from 'ws';
import { createRaceBroadcaster } from '../broadcaster.js';
import { reachableURLs, webRootPath } from '../dashboard.js';
import { createRaceSession } from '../race-session.js';
import { continuousMultiplayerPace, multiplayerPace } from '../rules.js';
import { startServer } from '../server.js';
import { DEFAULT_VENUE_ID, VENUES, venueLaps, type VenueID } from '../../shared/venues.js';
import { createParticipantRegistry, type ParticipantRegistry } from './registry.js';
import { decodeJoinMessage, MULTIPLAYER_PROTOCOL, type HostMessage } from './wire.js';
import type { RaceMode } from '../../shared/presentation.js';

const monotonicSeconds = (): number => performance.now() / 1000;

export interface HostOptions {
  port: number;
  /** The opening venue, when explicitly chosen by whoever launches the host.
   *  Continuous mode otherwise starts randomly and rotates through a shuffle
   *  bag. Classic keeps its original default venue. */
  circuit?: VenueID;
  /** Random source injection for deterministic tests. */
  random?: () => number;
  raceMode?: RaceMode;
  /** Defaults to every interface — that is the whole point of the mode.
   *  `--bind` narrows it, and tests use it to host on loopback. */
  bindHost?: string;
  /** Participant comings and goings, for the host terminal. */
  log?: (line: string) => void;
}

export interface HostHandle {
  port: number;
  close(): Promise<void>;
}

/**
 * The multiplayer aggregation server. Pure aggregator (design decision 10): it
 * never connects to a herdr — participants push anonymized snapshots over
 * /join, and this process owns the one race session every viewer watches.
 */
export async function startHost(options: HostOptions): Promise<HostHandle> {
  const log = options.log ?? (() => {});
  const raceMode = options.raceMode ?? 'classic';
  let circuit = options.circuit ?? (raceMode === 'continuous' ? randomVenue(options.random) : DEFAULT_VENUE_ID);
  const venues = createVenueShuffleBag(circuit, options.random);
  // Multiplayer rank is earned through uptime (M3/M4); the seeded dice stay
  // as flavor only, so the session gets the narrowed pace source.
  const session = createRaceSession(
    raceMode === 'continuous' ? continuousMultiplayerPace : multiplayerPace,
    undefined,
    { raceMode },
  );
  const broadcaster = createRaceBroadcaster(
    session,
    monotonicSeconds,
    undefined,
    () => circuit,
    (grandPrix, now) => {
      if (raceMode !== 'continuous') return;
      circuit = venues.next();
      session.setTotalLaps(venueLaps(circuit), now);
      log(`Grand Prix ${grandPrix} · circuit ${circuit} (${venueLaps(circuit)} laps)`);
    },
  );
  // The opening venue's published distance is race state from the first Grand
  // Prix on. The broadcaster swaps both the drawing and distance at each later
  // Grand Prix boundary.
  session.setTotalLaps(venueLaps(circuit), monotonicSeconds());
  // There is no herdr connection whose liveness could gate the clock; the
  // host's sources are the participants, so race time always flows.
  session.applyConnection({ kind: 'live' }, monotonicSeconds());

  const registry = createParticipantRegistry(raceMode);
  // publish runs inside join-socket message handlers, where a throw would be
  // an uncaught exception taking the whole party down. The known overflow is
  // the race grid's 99 car numbers (4+ participants at the per-participant
  // cap): the session refuses the excess cars, the host keeps racing the
  // ones already on the grid, and the terminal says why.
  const publish = () => {
    try {
      session.applySnapshot(registry.snapshot(), monotonicSeconds());
    } catch (error) {
      log(`Snapshot rejected: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const server = await startServer({
    port: options.port,
    webRoot: webRootPath(),
    broadcaster,
    bindHost: options.bindHost ?? '0.0.0.0',
    viewerOrigin: 'host',
    // Focus is inactive in multiplayer (design decision 4): the host cannot
    // know whose browser clicked, and relaying would let anyone on the
    // network shake someone else's terminal. Circuit writes are ignored for
    // the same reason — venue rotation belongs to the host.
    onFocus: () => {},
    onCircuit: () => {},
    onJoin: socket => attachParticipant(socket, registry, publish, log),
  });
  broadcaster.start();

  // The momentum loop (M4): rolling uptime changes with the passage of time
  // alone, so car speeds are refreshed on a cadence, not just on snapshots.
  const paceTimer = setInterval(() => {
    const now = monotonicSeconds();
    for (const { terminalID, factor } of registry.paceFactors(now)) {
      session.setExternalPace(terminalID, factor, now);
    }
  }, 250);

  return {
    port: server.port,
    close: async () => {
      clearInterval(paceTimer);
      broadcaster.stop();
      await server.close();
    },
  };
}

/** Venue rotation for continuous mode: every circuit appears once per cycle,
 * and the first circuit of a new cycle cannot repeat the previous one. */
export function createVenueShuffleBag(opening: VenueID, random: () => number = Math.random) {
  let previous = opening;
  let bag = shuffle(VENUES.map(venue => venue.id).filter(id => id !== opening), random);

  function next(): VenueID {
    if (bag.length === 0) {
      bag = shuffle(VENUES.map(venue => venue.id), random);
      if (bag[0] === previous && bag.length > 1) [bag[0], bag[1]] = [bag[1], bag[0]];
    }
    previous = bag.shift()!;
    return previous;
  }
  return { next };
}

/** Backwards-compatible one-shot helper. Rotation itself uses the persistent
 * shuffle bag above so a whole cycle cannot repeat a venue. */
export function randomNextVenue(current: VenueID, random: () => number = Math.random): VenueID {
  return createVenueShuffleBag(current, random).next();
}

function shuffle(values: VenueID[], random: () => number): VenueID[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

/** Picks the opening venue when the host command did not specify one. */
export function randomVenue(random: () => number = Math.random): VenueID {
  const index = Math.min(VENUES.length - 1, Math.max(0, Math.floor(random() * VENUES.length)));
  return VENUES[index].id;
}

/** Per-socket handshake and message pump for one joining participant. */
function attachParticipant(
  socket: WebSocket,
  registry: ParticipantRegistry,
  publish: () => void,
  log: (line: string) => void,
): void {
  let name: string | null = null;
  const reply = (message: HostMessage) => socket.send(JSON.stringify(message));

  socket.on('message', raw => {
    const message = decodeJoinMessage(String(raw));
    if (name === null) {
      // The first message must be a valid hello; anything else is a client
      // this host cannot reason with, so fail loudly instead of guessing.
      if (message?.type !== 'hello') {
        reply({ type: 'reject', reason: 'Expected a protocol handshake. Update herdr-f1 on both sides.' });
        socket.close();
        return;
      }
      if (message.protocol !== MULTIPLAYER_PROTOCOL) {
        reply({
          type: 'reject',
          reason:
            `This host speaks multiplayer protocol ${MULTIPLAYER_PROTOCOL}, ` +
            `the joining client protocol ${message.protocol}. Update herdr-f1 on the older side.`,
        });
        socket.close();
        return;
      }
      if (!registry.connect(message.name)) {
        reply({
          type: 'reject',
          reason: `"${message.name}" is already connected. Pick another name, or reuse it after that session disconnects.`,
        });
        socket.close();
        return;
      }
      name = message.name;
      reply({ type: 'welcome' });
      log(`${name} joined the paddock`);
      return;
    }
    // Post-handshake traffic is untrusted network input: malformed frames are
    // dropped, matching the viewer socket's tolerance.
    if (message?.type === 'snapshot') {
      registry.update(name, message.crews, monotonicSeconds());
      publish();
    } else if (message?.type === 'offline') {
      registry.markOffline(name, monotonicSeconds());
      publish();
    }
  });

  socket.on('close', () => {
    if (name === null) return;
    registry.disconnect(name, monotonicSeconds());
    publish();
    log(`${name} disconnected — team telemetry offline (rejoin with the same name to resume)`);
  });
  socket.on('error', () => {}); // 'close' always follows; nothing extra to do
}

/** Foreground CLI runner (design decision 9): prints where to point browsers
 *  and join clients, then hosts until Ctrl+C. */
export async function runHost(
  port: number,
  circuit?: VenueID,
  raceMode: RaceMode = 'classic',
  bindHost: string = '0.0.0.0',
): Promise<void> {
  const openingCircuit = circuit ?? (raceMode === 'continuous' ? randomVenue() : DEFAULT_VENUE_ID);
  const host = await startHost({ port, circuit: openingCircuit, raceMode, bindHost, log: line => console.log(line) });
  console.log(
    `Herdr F1 multiplayer host · ${raceMode} race · port ${host.port} · ` +
    `opening circuit ${openingCircuit} (${venueLaps(openingCircuit)} laps)`,
  );
  for (const url of reachableURLs(bindHost, host.port, 'last')) {
    console.log(`  view    ${url}`);
  }
  console.log(`  join    herdr-f1 join <this-host>:${host.port} --name <your-name>`);
  console.log('No authentication — host on trusted networks (LAN/VPN) only. Ctrl+C to stop.');

  await new Promise<void>(resolve => {
    const requestShutdown = () => resolve();
    process.once('SIGINT', requestShutdown);
    process.once('SIGTERM', requestShutdown);
  });
  console.log('Stopping host…');
  await host.close();
}
