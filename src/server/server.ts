import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { setImmediate as nextImmediate } from 'node:timers/promises';
import { WebSocketServer } from 'ws';
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
}

export async function startServer(options: ServerOptions): Promise<DashboardServer> {
  const webRoot = path.resolve(options.webRoot);
  const server = http.createServer((request, response) => serveStatic(webRoot, request, response));
  const port = await listenOnFreePort(server, options.port);

  const sockets = new WebSocketServer({ server, path: '/ws' });
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
    'content-type': MIME[path.extname(filePath)] ?? 'application/octet-stream', connection: 'close',
  });
  fs.createReadStream(filePath).pipe(response);
}

/** Binds 127.0.0.1 only. Tries preferred..preferred+19 on EADDRINUSE. */
async function listenOnFreePort(server: http.Server, preferred: number): Promise<number> {
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
        server.listen(port, '127.0.0.1');
      });
      return port;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
      await nextImmediate();
    }
  }
  throw new Error(`no free port between ${preferred} and ${preferred + 19}`);
}
