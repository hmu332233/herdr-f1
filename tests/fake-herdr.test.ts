import net from 'node:net';
import { describe, expect, it } from 'vitest';
import { FakeHerdr, rawSnapshot, waitUntil } from './helpers/fake-herdr.js';

function requestOnce(socketPath: string, payload: object): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath, () => {
      socket.write(JSON.stringify(payload) + '\n');
    });
    let buffer = '';
    socket.on('data', chunk => { buffer += chunk.toString('utf8'); });
    socket.on('close', () => resolve(buffer.trim()));
    socket.on('error', reject);
  });
}

describe('FakeHerdr', () => {
  it('answers session.snapshot once and closes the connection', async () => {
    const fake = await FakeHerdr.start(rawSnapshot([]));
    try {
      const line = await requestOnce(fake.socketPath, { id: 's1', method: 'session.snapshot', params: {} });
      const envelope = JSON.parse(line);
      expect(envelope.id).toBe('s1');
      expect(envelope.result.type).toBe('session_snapshot');
      expect(fake.snapshotRequests).toBe(1);
    } finally {
      await fake.close();
    }
  });

  it('records focus requests', async () => {
    const fake = await FakeHerdr.start(rawSnapshot([]));
    try {
      await requestOnce(fake.socketPath, { id: 'f1', method: 'agent.focus', params: { target: 't1' } });
      expect(fake.focusRequests).toHaveLength(1);
      expect(fake.focusRequests[0].params.target).toBe('t1');
    } finally {
      await fake.close();
    }
  });

  it('acknowledges one subscribe, streams events, kills a second subscribe', async () => {
    const fake = await FakeHerdr.start(rawSnapshot([]));
    try {
      const received: string[] = [];
      let closed = false;
      const socket = net.createConnection(fake.socketPath, () => {
        socket.write(JSON.stringify({ id: 'sub1', method: 'events.subscribe', params: { subscriptions: [{ type: 'pane.created' }] } }) + '\n');
      });
      let buffer = '';
      socket.on('data', chunk => {
        buffer += chunk.toString('utf8');
        let index;
        while ((index = buffer.indexOf('\n')) >= 0) {
          received.push(buffer.slice(0, index));
          buffer = buffer.slice(index + 1);
        }
      });
      socket.on('close', () => { closed = true; });

      await waitUntil(() => received.length >= 1);
      expect(JSON.parse(received[0]).result.type).toBe('subscription_started');
      expect(fake.subscribeRequests).toHaveLength(1);

      fake.emit('pane_created', { pane_id: 'p9' });
      await waitUntil(() => received.length >= 2);
      expect(JSON.parse(received[1])).toEqual({ event: 'pane_created', data: { pane_id: 'p9' } });

      // Second subscribe on the same connection → herdr closes it.
      socket.write(JSON.stringify({ id: 'sub2', method: 'events.subscribe', params: { subscriptions: [] } }) + '\n');
      await waitUntil(() => closed);
    } finally {
      await fake.close();
    }
  });
});
