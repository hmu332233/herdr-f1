import os from 'node:os';
import type { WebSocket } from 'ws';
import { createRaceBroadcaster } from '../broadcaster.js';
import { webRootPath } from '../dashboard.js';
import { createRaceSession } from '../race-session.js';
import { multiplayerPace } from '../rules.js';
import { startServer } from '../server.js';
import { DEFAULT_VENUE_ID, venueLaps, type VenueID } from '../../shared/venues.js';
import { createParticipantRegistry, type ParticipantRegistry } from './registry.js';
import { decodeJoinMessage, MULTIPLAYER_PROTOCOL, type HostMessage } from './wire.js';

const monotonicSeconds = (): number => performance.now() / 1000;

export interface HostOptions {
  port: number;
  /** The venue for the whole hosting session, chosen by whoever launches the
   *  host. Pins the race distance and every viewer's drawing; viewers cannot
   *  change it — they are anonymous, so a viewer write to shared race state
   *  would be an open griefing channel (same reasoning that disables focus). */
  circuit?: VenueID;
  /** Overridable so tests can host on loopback. Production hosts every
   *  interface — that is the whole point of the mode. */
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
  const circuit = options.circuit ?? DEFAULT_VENUE_ID;
  // Multiplayer rank is earned through uptime (M3/M4); the seeded dice stay
  // as flavor only, so the session gets the narrowed pace source.
  const session = createRaceSession(multiplayerPace);
  const broadcaster = createRaceBroadcaster(session, monotonicSeconds, undefined, circuit);
  // The venue is fixed for the whole hosting session; its published distance
  // is the race distance from the first Grand Prix on.
  session.setTotalLaps(venueLaps(circuit), monotonicSeconds());
  // There is no herdr connection whose liveness could gate the clock; the
  // host's sources are the participants, so race time always flows.
  session.applyConnection({ kind: 'live' }, monotonicSeconds());

  const registry = createParticipantRegistry();
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
    // the same reason — the venue was pinned above, at launch.
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
    log(`${name} disconnected — cars to the pit lane (rejoin with the same name to resume)`);
  });
  socket.on('error', () => {}); // 'close' always follows; nothing extra to do
}

/** Foreground CLI runner (design decision 9): prints where to point browsers
 *  and join clients, then hosts until Ctrl+C. */
export async function runHost(port: number, circuit: VenueID): Promise<void> {
  const host = await startHost({ port, circuit, log: line => console.log(line) });
  console.log(`Herdr F1 multiplayer host · port ${host.port} · circuit ${circuit} (${venueLaps(circuit)} laps)`);
  for (const address of viewerAddresses()) {
    console.log(`  view    http://${address}:${host.port}`);
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

/** Non-internal IPv4 addresses, loopback last, so the printed URLs cover both
 *  the LAN and a browser on the host machine itself. */
function viewerAddresses(): string[] {
  const addresses: string[] = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const entry of interfaces ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
    }
  }
  addresses.push('127.0.0.1');
  return addresses;
}
