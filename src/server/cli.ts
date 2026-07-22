import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createRaceBroadcaster } from './broadcaster.js';
import { createRaceSession } from './race-session.js';
import { startServer } from './server.js';
import { createHerdrClient, defaultSocketPath, type HerdrClient } from './herdr/client.js';
import { FIXTURE_NAMES, loadFixture } from './fixtures.js';

export interface CliOptions {
  port: number;
  open: boolean;
  fixture: string | null;
  socket: string;
}

const USAGE = `Usage: herdr-f1 [start] [--port <n>] [--no-open] [--fixture <${FIXTURE_NAMES.join('|')}>] [--socket <path>]`;
class UsageError extends Error {}

export function parseArgs(argv: string[]): CliOptions {
  const rest = argv[0] === 'start' ? argv.slice(1) : argv;
  const options: CliOptions = { port: 4158, open: true, fixture: null, socket: defaultSocketPath };
  for (let index = 0; index < rest.length; index += 1) {
    switch (rest[index]) {
      case '--port': {
        const value = Number(rest[++index]);
        if (!Number.isInteger(value) || value <= 0 || value > 65535) throw new UsageError(USAGE);
        options.port = value;
        break;
      }
      case '--no-open':
        options.open = false;
        break;
      case '--fixture': {
        const name = rest[++index];
        if (!name || !(FIXTURE_NAMES as readonly string[]).includes(name)) throw new UsageError(USAGE);
        options.fixture = name;
        break;
      }
      case '--socket': {
        const value = rest[++index];
        if (!value) throw new UsageError(USAGE);
        options.socket = value;
        break;
      }
      default:
        throw new UsageError(USAGE);
    }
  }
  return options;
}

/** Monotonic seconds since process start — the session's time base. Fixtures
 *  pre-drive the session with their own larger timestamps; RaceSession clamps
 *  the backwards/oversized first step, so mixing the two is safe. */
export const monotonicSeconds = (): number => performance.now() / 1000;

export async function run(argv: string[]): Promise<void> {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(error.message);
      process.exitCode = 2;
      return;
    }
    throw error;
  }

  const session = createRaceSession();
  const broadcaster = createRaceBroadcaster(session, monotonicSeconds);
  let client: HerdrClient | null = null;
  if (options.fixture) {
    loadFixture(options.fixture, session);
  } else {
    client = createHerdrClient({ socketPath: options.socket });
    client.start(update => session.apply(update, monotonicSeconds()));
  }

  // dist/server/cli.js → ../web = dist/web (built by `vite build`).
  const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');
  const dashboard = await startServer({
    port: options.port,
    webRoot,
    broadcaster,
    onFocus: terminalID => {
      // Focus failure must not fabricate an agent state transition.
      client?.focus(terminalID).catch(() => {});
    },
  });
  broadcaster.start();

  const url = `http://127.0.0.1:${dashboard.port}`;
  console.log(`Herdr F1 · ${url}${options.fixture ? ` · fixture: ${options.fixture}` : ''}`);
  console.log('Press Ctrl+C to stop.');
  if (options.open) openBrowser(url);

  const shutdown = () => {
    broadcaster.stop();
    client?.stop();
    void dashboard.close().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function openBrowser(url: string): void {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(command, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref();
}
