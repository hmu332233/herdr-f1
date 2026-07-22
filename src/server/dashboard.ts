import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRaceBroadcaster } from './broadcaster.js';
import { loadFixture } from './fixtures.js';
import { createHerdrClient, type HerdrClient } from './herdr/client.js';
import { createRaceSession } from './race-session.js';
import { startServer } from './server.js';
import type { InstanceTarget } from './target.js';

const monotonicSeconds = (): number => performance.now() / 1000;

export async function startDashboard(options: {
  target: InstanceTarget;
  port: number;
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
  const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');
  const server = await startServer({
    port: options.port,
    webRoot,
    broadcaster,
    onFocus: terminalID => { client?.focus(terminalID).catch(() => {}); },
  });
  broadcaster.start();
  return {
    url: `http://127.0.0.1:${server.port}`,
    port: server.port,
    close: async () => {
      broadcaster.stop();
      client?.stop();
      await server.close();
    },
  };
}
