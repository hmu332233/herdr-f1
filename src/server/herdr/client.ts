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
 *  output polling. Canonical names use underscores; protocol 17 dot names are
 *  normalized at the event boundary and legacy underscore names still work. */
export const INVALIDATION_EVENTS: ReadonlySet<string> = new Set([
  ...BROADCAST_SUBSCRIPTIONS.map(canonicalEventName),
  'pane_agent_status_changed',
]);

export function subscriptionRequest(id: string, agentPaneIDs: string[]): object {
  const subscriptions: Array<Record<string, string>> = BROADCAST_SUBSCRIPTIONS.map(type => ({ type }));
  // Agent status is a per-pane subscription in the herdr protocol.
  for (const paneID of agentPaneIDs) {
    subscriptions.push({ type: 'pane.agent_status_changed', pane_id: paneID });
  }
  return { id, method: 'events.subscribe', params: { subscriptions } };
}

export interface HerdrClientOptions {
  socketPath?: string;
  initialReconnectDelayMs?: number;
  maximumReconnectDelayMs?: number;
}

/**
 * Event-driven herdr transport. herdr answers exactly one request per
 * connection and then closes it, so session.snapshot and agent.focus each use
 * a short-lived connection. Event subscriptions live on one long-lived
 * connection that accepts a single events.subscribe at connect time; because
 * pane.agent_status_changed is per-pane, the client resubscribes with a fresh
 * connection whenever the set of agent panes changes. Every relevant event
 * triggers an authoritative snapshot refresh — there is no polling.
 */
export function createHerdrClient(options: HerdrClientOptions = {}) {
  const socketPath = options.socketPath ?? defaultSocketPath;
  const initialReconnectDelayMs = options.initialReconnectDelayMs ?? 1000;
  const maximumReconnectDelayMs = options.maximumReconnectDelayMs ?? 30000;
  let requestSequence = 0;
  let started = false;
  let stopped = false;
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
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, maximumReconnectDelayMs);
    }
  }

  /** Runs one connected session until the transport fails. */
  async function connectOnce(onUpdate: (update: HerdrUpdate) => void): Promise<void> {
    let snapshot = await fetchSnapshot();
    onUpdate({ kind: 'snapshot', snapshot });

    // Each pass subscribes with the current agent-pane set; a refresh that
    // changes that set falls through to resubscribe.
    while (true) {
      if (stopped) return;
      const agentPanes = new Set(allAgents(snapshot).map(agent => agent.paneID));

      const socket = await connectSocket(socketPath);
      eventSocket = socket;
      try {
        requestSequence += 1;
        const subscribeID = `subscribe-${requestSequence}`;
        socket.write(JSON.stringify(subscriptionRequest(subscribeID, [...agentPanes].sort())) + '\n');

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
        if (!sameSet(paneSet(snapshot), agentPanes)) continue;

        let resubscribe = false;
        while (!resubscribe) {
          const next = await reader.next();
          if (next.done) throw new Error('connection reset');
          if (stopped) return;
          const envelope = parseEnvelope(next.value);
          if (typeof envelope.event !== 'string' || typeof envelope.data !== 'object' || envelope.data === null) {
            throw new HerdrProtocolFault('Invalid Herdr response: event envelope is incomplete');
          }
          if (!INVALIDATION_EVENTS.has(canonicalEventName(envelope.event))) continue;
          // Refreshes run one at a time on this loop; events arriving
          // meanwhile stay buffered on the socket.
          snapshot = await fetchSnapshot();
          onUpdate({ kind: 'snapshot', snapshot });
          resubscribe = !sameSet(paneSet(snapshot), agentPanes);
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

function paneSet(snapshot: SourceSnapshot): Set<string> {
  return new Set(allAgents(snapshot).map(agent => agent.paneID));
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function canonicalEventName(name: string): string {
  return name.replaceAll('.', '_');
}
