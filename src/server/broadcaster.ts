import type { RaceSession } from './race-session.js';
import type { SyncMessage } from '../shared/protocol.js';

/**
 * Owns the server-side tick: advances the race session on a fixed cadence and
 * fans full sync messages out to connected browsers.
 */
export function createRaceBroadcaster(
  session: RaceSession,
  clock: () => number,
  tickMs = 250,
  /** Multiplayer only: the venue pinned at host launch, stamped on every sync
   *  so viewers render it and lock their selector. Local mode leaves the
   *  circuit to each browser and omits it. */
  pinnedCircuitID?: string,
) {
  let timer: ReturnType<typeof setInterval> | null = null;
  const clients = new Set<(json: string) => void>();

  function start(): void {
    if (timer) return;
    timer = setInterval(tick, tickMs);
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function addClient(send: (json: string) => void): void {
    clients.add(send);
    const now = clock();
    session.advance(now);
    const sync = buildSync();
    send(JSON.stringify(sync));
  }

  function removeClient(send: (json: string) => void): void {
    clients.delete(send);
  }

  /** One cadence step. Public so tests can drive it with a manual clock. */
  function tick(): void {
    const now = clock();
    session.advance(now);
    if (clients.size === 0) return; // race continues; nothing to fan out
    const json = JSON.stringify(buildSync());
    for (const send of clients) send(json);
  }

  function buildSync(): SyncMessage {
    return pinnedCircuitID === undefined
      ? { type: 'sync', ...session.presentation() }
      : { type: 'sync', circuitID: pinnedCircuitID, ...session.presentation() };
  }

  return { start, stop, addClient, removeClient, tick, buildSync };
}

export type RaceBroadcaster = ReturnType<typeof createRaceBroadcaster>;
