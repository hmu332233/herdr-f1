import { afterEach, describe, expect, it } from 'vitest';
import { createHerdrClient, type HerdrClient } from '../src/server/herdr/client.js';
import type { HerdrUpdate } from '../src/server/herdr/types.js';
import { FakeHerdr, rawAgent, rawSnapshot, waitUntil } from './helpers/fake-herdr.js';

type Collector = { updates: HerdrUpdate[]; push: (update: HerdrUpdate) => void };
function collector(): Collector {
  const updates: HerdrUpdate[] = [];
  return { updates, push: update => updates.push(update) };
}
const kinds = (c: Collector) => c.updates.map(u => (u.kind === 'connection' ? u.state.kind : 'snapshot'));

let fake: FakeHerdr | null = null;
let client: HerdrClient | null = null;
afterEach(async () => {
  client?.stop();
  client = null;
  await fake?.close();
  fake = null;
});

function makeClient(socketPath: string): HerdrClient {
  client = createHerdrClient({ socketPath, initialReconnectDelayMs: 20, maximumReconnectDelayMs: 100 });
  return client;
}

describe('HerdrClient', () => {
  it('bootstraps: waiting → snapshot → live → authoritative refresh', async () => {
    fake = await FakeHerdr.start(rawSnapshot([rawAgent('t1', 'working')]));
    const c = collector();
    makeClient(fake.socketPath).start(c.push);
    await waitUntil(() => kinds(c).join(',').includes('waiting,snapshot,live,snapshot'));
    const refresh = c.updates[3];
    if (refresh.kind !== 'snapshot') throw new Error('expected snapshot');
    expect(refresh.snapshot.teams[0].agents[0].terminalID).toBe('t1');
    // Per-pane agent-status subscriptions are part of the subscribe payload.
    const subscriptions = fake.subscribeRequests[0].params.subscriptions as Array<{ type: string; pane_id?: string }>;
    expect(subscriptions.some(s => s.type === 'pane.agent_status_changed' && s.pane_id === 'pane-t1')).toBe(true);
    expect(subscriptions.some(s => s.type === 'pane.updated')).toBe(false); // never subscribed
    expect(subscriptions.some(s => s.type === 'pane.agent_detected')).toBe(true);
  });

  it('refreshes the snapshot on an invalidation event', async () => {
    fake = await FakeHerdr.start(rawSnapshot([rawAgent('t1', 'working')]));
    const c = collector();
    makeClient(fake.socketPath).start(c.push);
    await waitUntil(() => fake!.snapshotRequests >= 2);
    fake.snapshot = rawSnapshot([rawAgent('t1', 'done')]);
    fake.emit('pane.agent_status_changed', { pane_id: 'pane-t1', agent_status: 'done' });
    await waitUntil(() => {
      const last = c.updates.at(-1);
      return last?.kind === 'snapshot' && last.snapshot.teams[0]?.agents[0]?.status === 'done';
    });
  });

  it('resubscribes with a fresh connection when the agent-pane set changes', async () => {
    fake = await FakeHerdr.start(rawSnapshot([rawAgent('t1', 'working')]));
    const c = collector();
    makeClient(fake.socketPath).start(c.push);
    await waitUntil(() => fake!.subscribeRequests.length >= 1);
    fake.snapshot = rawSnapshot([rawAgent('t1', 'working'), rawAgent('t2', 'working')]);
    fake.emit('pane_agent_detected', { pane_id: 'pane-t2' });
    await waitUntil(() => fake!.subscribeRequests.length >= 2);
    const latest = fake.subscribeRequests.at(-1)!.params.subscriptions as Array<{ type: string; pane_id?: string }>;
    expect(latest.some(s => s.type === 'pane.agent_status_changed' && s.pane_id === 'pane-t2')).toBe(true);
  });

  it('reports offline after having been live, then reconnects', async () => {
    fake = await FakeHerdr.start(rawSnapshot([rawAgent('t1', 'working')]));
    const c = collector();
    makeClient(fake.socketPath).start(c.push);
    await waitUntil(() => kinds(c).includes('live'));
    fake.dropAllConnections();
    await waitUntil(() => kinds(c).includes('offline'));
    await waitUntil(() => kinds(c).lastIndexOf('live') > kinds(c).indexOf('offline'));
  });

  it('stays waiting when the socket does not exist', async () => {
    const c = collector();
    makeClient('/tmp/definitely-not-a-herdr.sock').start(c.push);
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(kinds(c)).toContain('waiting');
    expect(kinds(c)).not.toContain('live');
    expect(kinds(c)).not.toContain('offline');
  });

  it('surfaces protocol problems as protocolError', async () => {
    fake = await FakeHerdr.start(rawSnapshot([], { protocol: 999 }));
    const c = collector();
    makeClient(fake.socketPath).start(c.push);
    await waitUntil(() => c.updates.some(u => u.kind === 'connection' && u.state.kind === 'protocolError'));
    const fault = c.updates.find(u => u.kind === 'connection' && u.state.kind === 'protocolError');
    if (fault?.kind !== 'connection' || fault.state.kind !== 'protocolError') throw new Error('unreachable');
    expect(fault.state.detail).toContain('Unsupported Herdr protocol 999');
  });

  it('surfaces server error responses as protocolError', async () => {
    fake = await FakeHerdr.start(rawSnapshot([]));
    fake.rawResponses.set('session.snapshot', JSON.stringify({ id: '', error: { code: 'invalid_request', message: 'nope' } }));
    const c = collector();
    makeClient(fake.socketPath).start(c.push);
    await waitUntil(() => c.updates.some(u => u.kind === 'connection' && u.state.kind === 'protocolError'));
  });

  it('sends agent.focus targeting the terminal\'s current pane', async () => {
    fake = await FakeHerdr.start(rawSnapshot([rawAgent('t1', 'working')]));
    const c = collector();
    const herdrClient = makeClient(fake.socketPath);
    herdrClient.start(c.push);
    await waitUntil(() => kinds(c).includes('live'));
    await herdrClient.focus('t1');
    expect(fake.focusRequests).toHaveLength(1);
    expect(fake.focusRequests[0].method).toBe('agent.focus');
    // herdr focuses by pane; the client maps the durable terminal id (t1) to
    // its current pane id (pane-t1) from the latest snapshot.
    expect(fake.focusRequests[0].params).toEqual({ target: 'pane-t1' });
  });
});
