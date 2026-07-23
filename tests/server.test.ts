import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import { createRaceBroadcaster } from '../src/server/broadcaster.js';
import { createRaceSession } from '../src/server/race-session.js';
import { loadFixture } from '../src/server/fixtures.js';
import { startServer } from '../src/server/server.js';
import type { SyncMessage } from '../src/shared/protocol.js';
import { waitUntil } from './helpers/fake-herdr.js';

type Dashboard = Awaited<ReturnType<typeof startServer>>;
let dashboard: Dashboard | null = null;
let webRoot = '';

async function makeServer(
  onFocus: (id: string) => void = () => {},
): Promise<Dashboard> {
  webRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'herdr-f1-web-'));
  fs.writeFileSync(path.join(webRoot, 'index.html'), '<!doctype html><title>Herdr F1</title>');
  fs.writeFileSync(path.join(webRoot, 'app.js'), 'console.log(1)');
  const session = createRaceSession();
  loadFixture('grid', session);
  const broadcaster = createRaceBroadcaster(session, () => 1000);
  dashboard = await startServer({ port: 4990, webRoot, broadcaster, onFocus });
  return dashboard;
}

afterEach(async () => {
  await dashboard?.close();
  dashboard = null;
  if (webRoot) fs.rmSync(webRoot, { recursive: true, force: true });
});

describe('startServer', () => {
  it('serves index.html at / and assets by extension', async () => {
    const { port } = await makeServer();
    const home = await fetch(`http://127.0.0.1:${port}/`);
    expect(home.status).toBe(200);
    expect(home.headers.get('content-type')).toContain('text/html');
    expect(home.headers.get('cache-control')).toBe('no-store');
    expect(await home.text()).toContain('Herdr F1');
    const js = await fetch(`http://127.0.0.1:${port}/app.js`);
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toContain('text/javascript');
  });

  it('404s missing files and refuses path traversal', async () => {
    const { port } = await makeServer();
    expect((await fetch(`http://127.0.0.1:${port}/nope.js`)).status).toBe(404);
    expect((await fetch(`http://127.0.0.1:${port}/..%2f..%2fetc%2fpasswd`)).status).toBe(404);
  });

  it('sends a sync to every new websocket client and routes focus messages', async () => {
    const focused: string[] = [];
    const { port } = await makeServer(id => focused.push(id));
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      origin: `http://127.0.0.1:${port}`,
    });
    const messages: SyncMessage[] = [];
    socket.on('message', raw => messages.push(JSON.parse(String(raw))));
    await waitUntil(() => messages.length >= 1);
    expect(messages[0].type).toBe('sync');
    expect(messages[0].teams.length).toBe(4);
    socket.send(JSON.stringify({ type: 'focus', terminalID: 't6' }));
    await waitUntil(() => focused.length === 1);
    expect(focused[0]).toBe('t6');
    socket.send('not json'); // must not crash the server
    socket.close();
  });

  it('rejects websocket connections from other origins', async () => {
    const { port } = await makeServer();
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      origin: 'https://example.com',
    });
    const status = await new Promise<number | undefined>((resolve, reject) => {
      socket.once('unexpected-response', (_request, response) => {
        response.resume();
        resolve(response.statusCode);
      });
      socket.once('open', () => reject(new Error('cross-origin websocket was accepted')));
      socket.once('error', () => {});
    });
    expect(status).toBe(403);
  });

  it('probes the next port when the preferred one is taken', async () => {
    const first = await makeServer();
    const session = createRaceSession();
    const broadcaster = createRaceBroadcaster(session, () => 0);
    const second = await startServer({ port: first.port, webRoot, broadcaster, onFocus: () => {} });
    try {
      expect(second.port).toBe(first.port + 1);
    } finally {
      await second.close();
    }
  });
});
