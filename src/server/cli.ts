import { spawn } from 'node:child_process';
import { parseArgs as parseNodeArgs } from 'node:util';
import { ensureDaemon, runDaemon, statusDaemon, stopDaemon } from './daemon.js';
import { FIXTURE_NAMES, type FixtureName } from './fixtures.js';
import { defaultSocketPath } from './herdr/client.js';
import { targetLabel, type InstanceTarget } from './target.js';

export type CliCommand =
  | { kind: 'start'; target: InstanceTarget; port: number; open: boolean }
  | { kind: 'stop'; target: InstanceTarget }
  | { kind: 'status'; target: InstanceTarget }
  | { kind: 'daemon'; target: InstanceTarget; port: number };

const USAGE = `Usage:
  herdr-f1 [start] [--port <n>] [--open] [--fixture <${FIXTURE_NAMES.join('|')}>] [--socket <path>]
  herdr-f1 stop [--fixture <${FIXTURE_NAMES.join('|')}>] [--socket <path>]
  herdr-f1 status [--fixture <${FIXTURE_NAMES.join('|')}>] [--socket <path>]`;
class UsageError extends Error {}

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): CliCommand {
  try {
    const { values, positionals } = parseNodeArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        port: { type: 'string' },
        open: { type: 'boolean' },
        socket: { type: 'string' },
        fixture: { type: 'string' },
      },
    });
    const command = positionals[0] ?? 'start';
    if (positionals.length > 1 || !['start', 'stop', 'status', '__daemon'].includes(command)) throw new UsageError(USAGE);
    const starts = command === 'start' || command === '__daemon';
    if ((!starts && values.port !== undefined) || (command !== 'start' && values.open)) throw new UsageError(USAGE);
    const port = Number(values.port ?? 4158);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new UsageError(USAGE);
    if (values.fixture && !(FIXTURE_NAMES as readonly string[]).includes(values.fixture)) throw new UsageError(USAGE);
    if (values.fixture && values.socket) throw new UsageError(USAGE);
    const target: InstanceTarget = values.fixture
      ? { kind: 'fixture', name: values.fixture as FixtureName }
      : { kind: 'herdr', socketPath: values.socket ?? env.HERDR_SOCKET_PATH ?? defaultSocketPath };
    if (command === 'stop' || command === 'status') return { kind: command, target };
    if (command === '__daemon') return { kind: 'daemon', target, port };
    return { kind: 'start', target, port, open: values.open ?? false };
  } catch (error) {
    if (error instanceof UsageError) throw error;
    throw new UsageError(USAGE);
  }
}

export async function run(argv: string[]): Promise<void> {
  let command: CliCommand;
  try { command = parseArgs(argv); }
  catch (error) {
    if (error instanceof UsageError) { console.error(error.message); process.exitCode = 2; return; }
    throw error;
  }
  if (command.kind === 'daemon') { await runDaemon(command.target, command.port); return; }
  if (command.kind === 'stop') {
    const stopped = await stopDaemon(command.target);
    console.log(stopped ? 'Herdr F1 stopped.' : 'Herdr F1 is not running.');
    return;
  }
  if (command.kind === 'status') {
    const record = await statusDaemon(command.target);
    if (!record) { console.log(`Herdr F1 is stopped · ${targetLabel(command.target)}`); process.exitCode = 1; return; }
    console.log(`Herdr F1 is running · ${record.url}`);
    console.log(`PID ${record.pid} · ${targetLabel(record.target)}`);
    console.log(`Log ${record.logPath}`);
    return;
  }
  const result = await ensureDaemon({ target: command.target, port: command.port });
  console.log(`Herdr F1 · ${result.record.url}${result.reused ? ' · already running' : ''}`);
  if (command.open) openBrowser(result.record.url);
  else console.log(`Open ${result.record.url} in your browser.`);
}

function openBrowser(url: string): void {
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(command, [url], { stdio: 'ignore', detached: true });
  child.once('error', () => console.error(`Could not open a browser. Open ${url} manually.`));
  child.unref();
}
