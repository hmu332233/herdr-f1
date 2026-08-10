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
  /** Multiplayer only: the host-owned venue stamped on every sync so viewers
   *  render it and lock their selector. A getter lets the host rotate venues
   *  between Grands Prix. Local mode omits it. */
  circuitID?: string | (() => string),
  /** Called once after the session advances onto a new Grand Prix. Multiplayer
   *  uses this boundary to choose the next venue and update its race distance
   *  before the first sync for that Grand Prix is built. */
  onGrandPrixStart?: (grandPrix: number, now: number) => void,
) {
  let timer: ReturnType<typeof setInterval> | null = null;
  const clients = new Set<(json: string) => void>();
  let observedGrandPrix = session.presentation().grandPrix;

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
    observeGrandPrix(now);
    const sync = buildSync(now);
    send(JSON.stringify(sync));
  }

  function removeClient(send: (json: string) => void): void {
    clients.delete(send);
  }

  /** One cadence step. Public so tests can drive it with a manual clock. */
  function tick(): void {
    const now = clock();
    session.advance(now);
    observeGrandPrix(now);
    if (clients.size === 0) return; // race continues; nothing to fan out
    const json = JSON.stringify(buildSync(now));
    for (const send of clients) send(json);
  }

  function observeGrandPrix(now: number): void {
    const grandPrix = session.presentation().grandPrix;
    if (grandPrix === observedGrandPrix) return;
    observedGrandPrix = grandPrix;
    onGrandPrixStart?.(grandPrix, now);
  }

  function buildSync(now = clock()): SyncMessage {
    // buildSync is public for diagnostics/tests and may be called after some
    // other session input crossed the boundary between broadcaster ticks.
    observeGrandPrix(now);
    const currentCircuitID = typeof circuitID === 'function' ? circuitID() : circuitID;
    return currentCircuitID === undefined
      ? { type: 'sync', ...session.presentation() }
      : { type: 'sync', circuitID: currentCircuitID, ...session.presentation() };
  }

  return { start, stop, addClient, removeClient, tick, buildSync };
}

export type RaceBroadcaster = ReturnType<typeof createRaceBroadcaster>;
