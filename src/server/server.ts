import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { setImmediate as nextImmediate } from 'node:timers/promises';
import { WebSocketServer, type WebSocket } from 'ws';
import type { RaceBroadcaster } from './broadcaster.js';
import type { ClientMessage } from '../shared/protocol.js';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.map': 'application/json',
  '.woff2': 'font/woff2',
  // Required for the install prompt: served as the octet-stream fallback the
  // browser ignores the manifest entirely and the app is not installable.
  '.webmanifest': 'application/manifest+json',
};

export interface DashboardServer {
  port: number;
  close(): Promise<void>;
}

export interface ServerOptions {
  port: number;
  webRoot: string;
  broadcaster: RaceBroadcaster;
  onFocus: (terminalID: string) => void;
  onCircuit: (totalLaps: number) => void;
  /** Interface to bind. Defaults to loopback; the multiplayer host passes
   *  0.0.0.0 — the only code path that ever leaves 127.0.0.1. */
  bindHost?: string;
  /** Viewer WebSocket origin policy. `loopback` (default) pins the exact
   *  127.0.0.1 origin. `host` accepts whichever host the browser actually
   *  connected to — required in multiplayer, where viewers arrive via a LAN or
   *  VPN address the server cannot know in advance. Same-origin either way. */
  viewerOrigin?: 'loopback' | 'host';
  /** When set, /join WebSocket upgrades are accepted and handed over —
   *  participant reporters pushing snapshots in multiplayer mode. */
  onJoin?: (socket: WebSocket) => void;
}

export async function startServer(options: ServerOptions): Promise<DashboardServer> {
  const webRoot = path.resolve(options.webRoot);
  const server = http.createServer((request, response) => serveStatic(webRoot, request, response));
  const port = await listenOnFreePort(server, options.port, options.bindHost ?? '127.0.0.1');

  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 4096,
    perMessageDeflate: false,
  });
  // Join payloads carry a whole agent roster, so they get a larger (but still
  // bounded) frame budget than the tiny viewer messages.
  const joinSockets = options.onJoin
    ? new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false })
    : null;
  const allowedOrigin = `http://127.0.0.1:${port}`;
  const originAllowed = (request: http.IncomingMessage): boolean =>
    options.viewerOrigin === 'host'
      ? typeof request.headers.host === 'string' && request.headers.origin === `http://${request.headers.host}`
      : request.headers.origin === allowedOrigin;
  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/join' && joinSockets && options.onJoin) {
      joinSockets.handleUpgrade(request, socket, head, client => options.onJoin!(client));
      return;
    }
    if (request.url !== '/ws' || !originAllowed(request)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, client => {
      sockets.emit('connection', client, request);
    });
  });
  sockets.on('connection', socket => {
    const send = (json: string) => {
      if (socket.readyState === socket.OPEN) socket.send(json);
    };
    options.broadcaster.addClient(send);
    socket.on('message', raw => {
      try {
        const message = JSON.parse(String(raw)) as ClientMessage;
        if (message?.type === 'focus' && typeof message.terminalID === 'string') {
          options.onFocus(message.terminalID);
        } else if (
          message?.type === 'circuit' && Number.isFinite(message.totalLaps) &&
          // Bounded: the browser is untrusted, and an absurd distance would
          // either end the race at once or make it unfinishable.
          message.totalLaps >= 1 && message.totalLaps <= 200
        ) {
          options.onCircuit(message.totalLaps);
        }
      } catch {
        // Malformed client messages are ignored; the browser is untrusted input.
      }
    });
    socket.on('close', () => options.broadcaster.removeClient(send));
  });

  return {
    port,
    close: () =>
      new Promise(resolve => {
        sockets.close();
        for (const client of sockets.clients) client.terminate();
        if (joinSockets) {
          joinSockets.close();
          for (const client of joinSockets.clients) client.terminate();
        }
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

function serveStatic(webRoot: string, request: http.IncomingMessage, response: http.ServerResponse): void {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const filePath = path.join(webRoot, path.normalize(relative));
  if (!filePath.startsWith(webRoot + path.sep) && filePath !== path.join(webRoot, 'index.html')) {
    response.writeHead(404, { connection: 'close' });
    response.end('not found');
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { connection: 'close' });
    response.end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': MIME[path.extname(filePath)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
    connection: 'close',
  });
  fs.createReadStream(filePath).pipe(response);
}

/** Tries preferred..preferred+19 on EADDRINUSE. */
async function listenOnFreePort(server: http.Server, preferred: number, bindHost: string): Promise<number> {
  for (let port = preferred; port < preferred + 20; port += 1) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: NodeJS.ErrnoException) => {
          server.removeListener('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.removeListener('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, bindHost);
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
      await nextImmediate();
      continue;
    }
    // Linux refuses overlapping binds itself: the listen() above already holds
    // the port against the complement address, so the probe below would always
    // see EADDRINUSE from our own socket and reject every port in the range.
    // There, listen() succeeding is proof enough.
    if (process.platform === 'linux') return port;
    // On macOS/BSD a wildcard bind and another process's specific bind coexist
    // on one port, in either order, so listen() succeeding does not prove the
    // port is ours alone — the more specific listener would take the loopback
    // traffic, and clients on the printed port would silently reach the wrong
    // server. Probing the complement address closes both directions: a
    // loopback bind checks no one holds the wildcard, and a wildcard bind
    // checks no one holds loopback. Our own bind never blocks the probe; only
    // another socket holding the complement exactly does.
    const complement = bindHost === '0.0.0.0' ? '127.0.0.1' : '0.0.0.0';
    if (await canBind(port, complement)) return port;
    await new Promise<void>(resolve => server.close(() => resolve()));
    await nextImmediate();
  }
  throw new Error(`no free port between ${preferred} and ${preferred + 19}`);
}

function canBind(port: number, host: string): Promise<boolean> {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, host, () => probe.close(() => resolve(true)));
  });
}
