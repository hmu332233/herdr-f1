import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRaceBroadcaster } from './broadcaster.js';
import { loadFixture } from './fixtures.js';
import { createHerdrClient, type HerdrClient } from './herdr/client.js';
import { createRaceSession } from './race-session.js';
import { startServer } from './server.js';
import type { InstanceTarget } from './target.js';

const monotonicSeconds = (): number => performance.now() / 1000;

const WILDCARD = new Set(['0.0.0.0', '::']);

/** Every URL the dashboard actually answers on. A wildcard bind has no single
 *  address to report, so it is expanded to the interfaces it covers rather
 *  than printed as the loopback it merely includes. Loopback leads: it is the
 *  address that always works from this machine, and `--open` uses it. */
export function reachableURLs(bindHost: string, port: number): string[] {
  const withPort = (host: string): string => `http://${host.includes(':') ? `[${host}]` : host}:${port}`;
  if (!WILDCARD.has(bindHost)) return [withPort(bindHost)];
  const family = bindHost === '0.0.0.0' ? 'IPv4' : 'IPv6';
  const others = Object.values(os.networkInterfaces())
    .flatMap(entries => entries ?? [])
    .filter(entry => entry.family === family && !entry.internal)
    .map(entry => withPort(entry.address));
  return [withPort(family === 'IPv4' ? '127.0.0.1' : '::1'), ...new Set(others)];
}

/** The built web bundle, resolved relative to this module so it works both
 *  from source (src/web) and from the ncc bundle (dist/web). */
export function webRootPath(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');
}

export async function startDashboard(options: {
  target: InstanceTarget;
  port: number;
  /** Interface to bind. Defaults to loopback; `0.0.0.0` exposes the dashboard
   *  to anything that can route to this host. */
  bindHost?: string;
}) {
  const session = createRaceSession();
  const broadcaster = createRaceBroadcaster(session, monotonicSeconds);
  let client: HerdrClient | null = null;
  if (options.target.kind === 'fixture') {
    loadFixture(options.target.name, session);
  } else {
    client = createHerdrClient({ socketPath: options.target.socketPath });
    client.start(update => session.apply(update, monotonicSeconds()));
  }
  const webRoot = webRootPath();
  const bindHost = options.bindHost ?? '127.0.0.1';
  const server = await startServer({
    port: options.port,
    webRoot,
    broadcaster,
    bindHost,
    // A non-loopback bind is reached under whatever address the browser used
    // (a forwarded `localhost`, a LAN address), which the exact-origin policy
    // would reject on the WebSocket upgrade. Same-origin either way.
    viewerOrigin: bindHost === '127.0.0.1' ? 'loopback' : 'host',
    onFocus: terminalID => { client?.focus(terminalID).catch(() => {}); },
    onCircuit: totalLaps => { session.setTotalLaps(totalLaps, monotonicSeconds()); },
  });
  broadcaster.start();
  const urls = reachableURLs(bindHost, server.port);
  return {
    url: urls[0]!,
    /** Every URL the server answers on, `url` first. */
    urls,
    bindHost,
    port: server.port,
    close: async () => {
      broadcaster.stop();
      client?.stop();
      await server.close();
    },
  };
}
