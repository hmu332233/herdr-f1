import fs from 'node:fs';
import net from 'node:net';
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
  onCircuit: (totalLaps: number) => void = () => {},
): Promise<Dashboard> {
  webRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'herdr-f1-web-'));
  fs.writeFileSync(path.join(webRoot, 'index.html'), '<!doctype html><title>Herdr F1</title>');
  fs.writeFileSync(path.join(webRoot, 'app.js'), 'console.log(1)');
  fs.writeFileSync(path.join(webRoot, 'manifest.webmanifest'), '{"name":"Herdr F1"}');
  const session = createRaceSession();
  loadFixture('grid', session);
  const broadcaster = createRaceBroadcaster(session, () => 1000);
  dashboard = await startServer({ port: 4990, webRoot, broadcaster, onFocus, onCircuit });
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

  it('serves the web manifest as application/manifest+json', async () => {
    // Under the octet-stream fallback the browser ignores the manifest and the
    // dashboard silently stops being installable, so the type is load-bearing.
    const { port } = await makeServer();
    const manifest = await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`);
    expect(manifest.status).toBe(200);
    expect(manifest.headers.get('content-type')).toBe('application/manifest+json');
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

  it('refuses /join upgrades when no join handler is configured', async () => {
    // Local mode must not expose the multiplayer join channel at all; only
    // `herdr-f1 host` passes onJoin.
    const { port } = await makeServer();
    const socket = new WebSocket(`ws://127.0.0.1:${port}/join`);
    const status = await new Promise<number | undefined>((resolve, reject) => {
      socket.once('unexpected-response', (_request, response) => {
        response.resume();
        resolve(response.statusCode);
      });
      socket.once('open', () => reject(new Error('local mode accepted a join socket')));
      socket.once('error', () => {});
    });
    expect(status).toBe(403);
  });

  it('probes the next port when the preferred one is taken', async () => {
    const first = await makeServer();
    const session = createRaceSession();
    const broadcaster = createRaceBroadcaster(session, () => 0);
    const second = await startServer({
      port: first.port, webRoot, broadcaster, onFocus: () => {}, onCircuit: () => {},
    });
    try {
      expect(second.port).toBe(first.port + 1);
    } finally {
      await second.close();
    }
  });

  it('skips a port whose wildcard side is held when binding loopback', async () => {
    // The mirror case: a multiplayer host owns 0.0.0.0:<port>, then a
    // local-mode daemon starts. Its 127.0.0.1 bind would succeed on macOS/BSD
    // and steal the host's loopback traffic, so the daemon must move on.
    const wildcard = net.createServer();
    await new Promise<void>(resolve => wildcard.listen(4985, '0.0.0.0', resolve));
    const first = await makeServer(); // provides the temp webRoot
    const session = createRaceSession();
    const broadcaster = createRaceBroadcaster(session, () => 0);
    try {
      const local = await startServer({
        port: 4985, webRoot, broadcaster, onFocus: () => {}, onCircuit: () => {},
      });
      try {
        expect(local.port).toBe(4986);
      } finally {
        await local.close();
      }
    } finally {
      await first.close();
      dashboard = null;
      await new Promise(resolve => wildcard.close(resolve));
    }
  });

  it('skips a port whose loopback side is held when binding the wildcard', async () => {
    // On macOS/BSD a 0.0.0.0 bind coexists with another process's 127.0.0.1
    // bind (a local-mode daemon, say), and loopback traffic goes to the more
    // specific listener — the wrong server. The probe must treat such a port
    // as taken even though listen() on the wildcard succeeds.
    const daemon = net.createServer();
    await new Promise<void>(resolve => daemon.listen(4995, '127.0.0.1', resolve));
    const first = await makeServer(); // provides the temp webRoot
    const session = createRaceSession();
    const broadcaster = createRaceBroadcaster(session, () => 0);
    try {
      const host = await startServer({
        port: 4995, webRoot, broadcaster, bindHost: '0.0.0.0',
        onFocus: () => {}, onCircuit: () => {},
      });
      try {
        expect(host.port).toBe(4996);
        // Loopback now reaches the host itself on the port it reports.
        expect((await fetch(`http://127.0.0.1:${host.port}/`)).status).toBe(200);
      } finally {
        await host.close();
      }
    } finally {
      await first.close();
      dashboard = null;
      await new Promise(resolve => daemon.close(resolve));
    }
  });
});
