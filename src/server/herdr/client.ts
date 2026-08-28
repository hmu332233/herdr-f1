import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as sleep } from 'node:timers/promises';
import { decodeSnapshotResponse, HerdrProtocolFault } from './projector.js';
import { allAgents, type HerdrUpdate, type SourceSnapshot } from './types.js';

export const defaultSocketPath = path.join(os.homedir(), '.config', 'herdr', 'herdr.sock');

export const BROADCAST_SUBSCRIPTIONS: readonly string[] = [
  'workspace.created', 'workspace.updated', 'workspace.metadata_updated',
  'workspace.renamed', 'workspace.moved', 'workspace.closed', 'workspace.focused',
  'tab.created', 'tab.closed', 'tab.focused', 'tab.renamed', 'tab.moved',
  'pane.created', 'pane.closed', 'pane.focused', 'pane.moved', 'pane.exited',
  'pane.agent_detected',
];

/** Every subscribed event invalidates the snapshot. `pane.updated` is
 *  deliberately omitted: it fires on terminal-title churn and would amount to
 *  output polling. Canonical names use underscores; protocol 17+ dot names are
 *  normalized at the event boundary and legacy underscore names still work. */
export const INVALIDATION_EVENTS: ReadonlySet<string> = new Set([
  ...BROADCAST_SUBSCRIPTIONS.map(canonicalEventName),
  'pane_agent_status_changed',
]);

export function subscriptionRequest(id: string, statusPaneIDs: string[]): object {
  const subscriptions: Array<Record<string, string>> = BROADCAST_SUBSCRIPTIONS.map(type => ({ type }));
  // Agent status is a per-pane subscription in the herdr protocol: there is no
  // session-wide variant, so every pane that could ever hold a racing agent
  // has to be named here, not just the ones racing right now.
  for (const paneID of statusPaneIDs) {
    subscriptions.push({ type: 'pane.agent_status_changed', pane_id: paneID });
  }
  return { id, method: 'events.subscribe', params: { subscriptions } };
}

export interface HerdrClientOptions {
  socketPath?: string;
  initialReconnectDelayMs?: number;
  maximumReconnectDelayMs?: number;
  /** Longest accepted gap between authoritative snapshots while subscribed.
   *  Events remain the live path; this only bounds how long a dropped or
   *  unmatched one can leave the race wrong, since nothing else re-reads
   *  herdr. */
  refreshFloorMs?: number;
}

/**
 * Event-driven herdr transport. herdr answers exactly one request per
 * connection and then closes it, so session.snapshot and agent.focus each use
 * a short-lived connection. Event subscriptions live on one long-lived
 * connection that accepts a single events.subscribe at connect time; because
 * pane.agent_status_changed is per-pane, the client resubscribes with a fresh
 * connection whenever the set of panes changes. Every relevant event triggers
 * an authoritative snapshot refresh, with a slow floor refresh underneath it
 * so a single missed event cannot strand the race forever.
 */
export function createHerdrClient(options: HerdrClientOptions = {}) {
  const socketPath = options.socketPath ?? defaultSocketPath;
  const initialReconnectDelayMs = options.initialReconnectDelayMs ?? 1000;
  const maximumReconnectDelayMs = options.maximumReconnectDelayMs ?? 30000;
  const refreshFloorMs = options.refreshFloorMs ?? 60000;
  let requestSequence = 0;
  let started = false;
  let stopped = false;
  const stopController = new AbortController();
  let eventSocket: net.Socket | null = null;
  let reachedLive = false;
  /** Current terminal → pane mapping from the latest snapshot. herdr's focus
   *  request targets the pane, while the durable car identity is the terminal;
   *  this bridges the two. */
  let paneByTerminal = new Map<string, string>();

  function start(onUpdate: (update: HerdrUpdate) => void): void {
    if (started) return;
    started = true;
    onUpdate({ kind: 'connection', state: { kind: 'waiting' } });
    void monitor(onUpdate);
  }

  function stop(): void {
    stopped = true;
    // Aborts a pending reconnect backoff, so a stopped client never keeps the
    // process alive waiting on a sleep timer.
    stopController.abort();
    eventSocket?.destroy();
    eventSocket = null;
  }

  async function focus(terminalID: string): Promise<void> {
    // Only focus terminals present in the latest authoritative snapshot.
    const target = paneByTerminal.get(terminalID);
    if (!target) return;
    requestSequence += 1;
    const envelope = await requestOnce({
      id: `focus-${requestSequence}`,
      method: 'agent.focus',
      params: { target },
    });
    if (envelope.error) throw serverFault(envelope.error);
  }

  async function monitor(onUpdate: (update: HerdrUpdate) => void): Promise<void> {
    let delayMs = initialReconnectDelayMs;
    while (!stopped) {
      reachedLive = false;
      try {
        await connectOnce(onUpdate);
      } catch (error) {
        if (stopped) return;
        if (error instanceof HerdrProtocolFault) {
          onUpdate({ kind: 'connection', state: { kind: 'protocolError', detail: error.message } });
        } else {
          onUpdate({ kind: 'connection', state: { kind: reachedLive ? 'offline' : 'waiting' } });
        }
      }
      if (stopped) return;
      if (reachedLive) delayMs = initialReconnectDelayMs;
      try {
        await sleep(delayMs, undefined, { signal: stopController.signal });
      } catch {
        return; // stop() aborted the backoff
      }
      delayMs = Math.min(delayMs * 2, maximumReconnectDelayMs);
    }
  }

  /** Runs one connected session until the transport fails. */
  async function connectOnce(onUpdate: (update: HerdrUpdate) => void): Promise<void> {
    let snapshot = await fetchSnapshot();
    onUpdate({ kind: 'snapshot', snapshot });

    // Each pass subscribes with the current pane set; a refresh that changes
    // that set falls through to resubscribe.
    while (true) {
      if (stopped) return;
      const statusPanes = paneSet(snapshot);

      const socket = await connectSocket(socketPath);
      eventSocket = socket;
      try {
        requestSequence += 1;
        const subscribeID = `subscribe-${requestSequence}`;
        socket.write(JSON.stringify(subscriptionRequest(subscribeID, [...statusPanes].sort())) + '\n');

        const reader = createInterface({ input: socket, crlfDelay: Infinity })[Symbol.asyncIterator]();
        const first = await reader.next();
        if (first.done) throw new Error('connection reset');
        const ack = parseEnvelope(first.value);
        if (ack.error) throw serverFault(ack.error);
        if (ack.id !== subscribeID || ack.result?.type !== 'subscription_started') {
          throw new HerdrProtocolFault('Unsupported Herdr response: events.subscribe was not acknowledged');
        }
        reachedLive = true;
        onUpdate({ kind: 'connection', state: { kind: 'live' } });

        // Authoritative refresh once the subscription is active, closing the
        // gap between the bootstrap snapshot and the first event.
        snapshot = await fetchSnapshot();
        onUpdate({ kind: 'snapshot', snapshot });
        if (!sameSet(paneSet(snapshot), statusPanes)) continue;

        let resubscribe = false;
        /** Held across iterations: a floor refresh can win the race below
         *  while this is still outstanding, and the same promise must then be
         *  awaited again rather than replaced — a second reader.next() would
         *  drop the line the first one is waiting for. */
        let pendingEvent: Promise<IteratorResult<string>> | null = null;
        while (!resubscribe) {
          if (pendingEvent === null) {
            pendingEvent = reader.next();
            // Abandoning this promise on the way out of the loop must not
            // surface as an unhandled rejection; the awaits below still see it.
            pendingEvent.catch(() => {});
          }
          const floor = floorRefresh(refreshFloorMs);
          let next: IteratorResult<string> | typeof FLOOR;
          try {
            next = await Promise.race([pendingEvent, floor.reached]);
          } finally {
            floor.cancel();
          }
          if (stopped) return;
          if (next !== FLOOR) {
            pendingEvent = null;
            if (next.done) throw new Error('connection reset');
            const envelope = parseEnvelope(next.value);
            if (typeof envelope.event !== 'string' || typeof envelope.data !== 'object' || envelope.data === null) {
              throw new HerdrProtocolFault('Invalid Herdr response: event envelope is incomplete');
            }
            if (!INVALIDATION_EVENTS.has(canonicalEventName(envelope.event))) continue;
          }
          // Refreshes run one at a time on this loop; events arriving
          // meanwhile stay buffered on the socket.
          snapshot = await fetchSnapshot();
          onUpdate({ kind: 'snapshot', snapshot });
          resubscribe = !sameSet(paneSet(snapshot), statusPanes);
        }
      } finally {
        if (eventSocket === socket) eventSocket = null;
        socket.destroy();
      }
    }
  }

  // MARK: - One-shot requests

  async function fetchSnapshot(): Promise<SourceSnapshot> {
    requestSequence += 1;
    const envelope = await requestOnce({
      id: `snapshot-${requestSequence}`,
      method: 'session.snapshot',
      params: {},
    });
    if (envelope.error) throw serverFault(envelope.error);
    const snapshot = decodeSnapshotResponse(envelope);
    paneByTerminal = new Map(allAgents(snapshot).map(agent => [agent.terminalID, agent.paneID]));
    return snapshot;
  }

  async function requestOnce(payload: object): Promise<Record<string, any>> {
    const socket = await connectSocket(socketPath);
    try {
      socket.write(JSON.stringify(payload) + '\n');
      for await (const line of createInterface({ input: socket, crlfDelay: Infinity })) {
        return parseEnvelope(line);
      }
      throw new Error('herdr closed the connection before responding');
    } finally {
      socket.destroy();
    }
  }

  return { start, stop, focus };
}

export type HerdrClient = ReturnType<typeof createHerdrClient>;

// MARK: - Transport helpers

function connectSocket(socketPath: string): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    const onError = (error: Error) => reject(error);
    socket.once('error', onError);
    socket.once('connect', () => {
      socket.removeListener('error', onError);
      resolve(socket);
    });
  });
}

function parseEnvelope(line: string): Record<string, any> {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new HerdrProtocolFault('Invalid Herdr response: expected a JSON object');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HerdrProtocolFault('Invalid Herdr response: expected a JSON object');
  }
  return value as Record<string, any>;
}

function serverFault(error: unknown): HerdrProtocolFault {
  const fault = error as { code?: unknown; message?: unknown };
  if (typeof fault?.code === 'string' && typeof fault?.message === 'string') {
    return new HerdrProtocolFault(`Herdr error ${fault.code}: ${fault.message}`);
  }
  return new HerdrProtocolFault('Invalid Herdr response: invalid error response');
}

/** Panes to watch for status changes. Falls back to the racing agents' panes
 *  when the source carries no pane list of its own. */
function paneSet(snapshot: SourceSnapshot): Set<string> {
  return new Set(snapshot.paneIDs ?? allAgents(snapshot).map(agent => agent.paneID));
}

/** Sentinel for "the floor refresh fired before any event arrived". */
const FLOOR = Symbol('floor');

/** A cancellable deadline. Unreferenced so a quiet subscription never keeps
 *  the process alive on its own. */
function floorRefresh(delayMs: number): { reached: Promise<typeof FLOOR>; cancel: () => void } {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const reached = new Promise<typeof FLOOR>(resolve => {
    handle = setTimeout(() => resolve(FLOOR), delayMs);
    handle.unref?.();
  });
  return { reached, cancel: () => clearTimeout(handle) };
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function canonicalEventName(name: string): string {
  return name.replaceAll('.', '_');
}
