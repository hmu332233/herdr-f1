import { spawn } from 'node:child_process';
import net from 'node:net';
import { parseArgs as parseNodeArgs } from 'node:util';
import { ensureDaemon, runDaemon, statusDaemon, stopDaemon } from './daemon.js';
import { FIXTURE_NAMES, type FixtureName } from './fixtures.js';
import { defaultSocketPath } from './herdr/client.js';
import { runHost } from './multiplayer/host.js';
import { runJoin } from './multiplayer/join.js';
import { normalizeParticipantName } from './multiplayer/wire.js';
import { isVenueID, VENUE_IDS, type VenueID } from '../shared/venues.js';
import { targetLabel, type InstanceTarget } from './target.js';
import type { RaceMode } from '../shared/presentation.js';

export type CliCommand =
  | { kind: 'start'; target: InstanceTarget; port: number; open: boolean; bindHost?: string }
  | { kind: 'stop'; target: InstanceTarget }
  | { kind: 'status'; target: InstanceTarget }
  | { kind: 'daemon'; target: InstanceTarget; port: number; bindHost?: string }
  | { kind: 'host'; port: number; circuit?: VenueID; raceMode: RaceMode; bindHost?: string }
  | { kind: 'join'; host: string; port: number; name: string; socketPath: string };

const USAGE = `Usage:
  herdr-f1 [start] [--port <n>] [--bind <host>] [--open] [--fixture <${FIXTURE_NAMES.join('|')}>] [--socket <path>]
  herdr-f1 stop [--fixture <${FIXTURE_NAMES.join('|')}>] [--socket <path>]
  herdr-f1 status [--fixture <${FIXTURE_NAMES.join('|')}>] [--socket <path>]
  herdr-f1 host [--port <n>] [--bind <host>] [--circuit <${VENUE_IDS.join('|')}>] [--race-mode <classic|continuous>]
  herdr-f1 join <host[:port]> --name <name> [--socket <path>]`;
class UsageError extends Error {}

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): CliCommand {
  try {
    const { values, positionals } = parseNodeArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        port: { type: 'string' },
        bind: { type: 'string' },
        open: { type: 'boolean' },
        socket: { type: 'string' },
        fixture: { type: 'string' },
        name: { type: 'string' },
        circuit: { type: 'string' },
        'race-mode': { type: 'string' },
      },
    });
    const command = positionals[0] ?? 'start';
    if (!['start', 'stop', 'status', '__daemon', 'host', 'join'].includes(command)) throw new UsageError(USAGE);
    if (positionals.length > (command === 'join' ? 2 : 1)) throw new UsageError(USAGE);
    if (values.name !== undefined && command !== 'join') throw new UsageError(USAGE);
    // The venue is the host launcher's choice alone (design decision 8, revised).
    if (values.circuit !== undefined && command !== 'host') throw new UsageError(USAGE);
    if (values['race-mode'] !== undefined && command !== 'host') throw new UsageError(USAGE);
    // `join` takes its port from <host[:port]>, so --port belongs to the
    // commands that bind a server.
    const starts = command === 'start' || command === '__daemon' || command === 'host';
    if ((!starts && values.port !== undefined) || (command !== 'start' && values.open)) throw new UsageError(USAGE);
    const port = Number(values.port ?? 4158);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new UsageError(USAGE);
    // The lifecycle commands only read the instance record, so --bind belongs
    // to the commands that actually open a listening socket.
    if (values.bind !== undefined && !starts) throw new UsageError(USAGE);
    if (values.bind !== undefined && net.isIP(values.bind) === 0) throw new UsageError(USAGE);
    const bindHost = values.bind;
    if (command === 'host') {
      if (values.fixture || values.socket) throw new UsageError(USAGE);
      if (values.circuit !== undefined && !isVenueID(values.circuit)) throw new UsageError(USAGE);
      const raceMode = values['race-mode'] ?? 'classic';
      if (raceMode !== 'classic' && raceMode !== 'continuous') throw new UsageError(USAGE);
      const host: Extract<CliCommand, { kind: 'host' }> = values.circuit === undefined
        ? { kind: 'host', port, raceMode }
        : { kind: 'host', port, circuit: values.circuit, raceMode };
      return bindHost === undefined ? host : { ...host, bindHost };
    }
    if (command === 'join') {
      if (positionals.length !== 2 || values.fixture) throw new UsageError(USAGE);
      const name = normalizeParticipantName(values.name ?? '');
      if (name === null) throw new UsageError(USAGE);
      const address = parseHostAddress(positionals[1]);
      return {
        kind: 'join',
        ...address,
        name,
        socketPath: values.socket ?? env.HERDR_SOCKET_PATH ?? defaultSocketPath,
      };
    }
    if (values.fixture && !(FIXTURE_NAMES as readonly string[]).includes(values.fixture)) throw new UsageError(USAGE);
    if (values.fixture && values.socket) throw new UsageError(USAGE);
    const target: InstanceTarget = values.fixture
      ? { kind: 'fixture', name: values.fixture as FixtureName }
      : { kind: 'herdr', socketPath: values.socket ?? env.HERDR_SOCKET_PATH ?? defaultSocketPath };
    if (command === 'stop' || command === 'status') return { kind: command, target };
    if (command === '__daemon') return bindHost === undefined
      ? { kind: 'daemon', target, port }
      : { kind: 'daemon', target, port, bindHost };
    const start = { kind: 'start' as const, target, port, open: values.open ?? false };
    return bindHost === undefined ? start : { ...start, bindHost };
  } catch (error) {
    if (error instanceof UsageError) throw error;
    throw new UsageError(USAGE);
  }
}

/** `<host[:port]>`, defaulting to 4158. IPv6 works bracketed (`[::1]:4200`)
 *  or bare with the default port. */
function parseHostAddress(raw: string): { host: string; port: number } {
  const bracketed = /^\[([^\]]+)\](?::(\d{1,5}))?$/.exec(raw);
  if (bracketed) return validatedAddress(bracketed[1], bracketed[2]);
  const parts = raw.split(':');
  if (parts.length > 2) return validatedAddress(raw, undefined); // bare IPv6
  return validatedAddress(parts[0], parts[1]);
}

function validatedAddress(host: string, portText: string | undefined): { host: string; port: number } {
  const port = portText === undefined ? 4158 : Number(portText);
  if (host.length === 0 || !Number.isInteger(port) || port <= 0 || port > 65535) throw new UsageError(USAGE);
  return { host, port };
}

export async function run(argv: string[]): Promise<void> {
  let command: CliCommand;
  try { command = parseArgs(argv); }
  catch (error) {
    if (error instanceof UsageError) { console.error(error.message); process.exitCode = 2; return; }
    throw error;
  }
  if (command.kind === 'daemon') { await runDaemon(command.target, command.port, command.bindHost); return; }
  // Multiplayer commands run in the foreground (design decision 9): party
  // sessions are transient, so there is no daemon to manage.
  if (command.kind === 'host') { await runHost(command.port, command.circuit, command.raceMode, command.bindHost); return; }
  if (command.kind === 'join') { await runJoin(command); return; }
  if (command.kind === 'stop') {
    const stopped = await stopDaemon(command.target);
    console.log(stopped ? 'Herdr F1 stopped.' : 'Herdr F1 is not running.');
    return;
  }
  if (command.kind === 'status') {
    const record = await statusDaemon(command.target);
    if (!record) { console.log(`Herdr F1 is stopped · ${targetLabel(command.target)}`); process.exitCode = 1; return; }
    console.log(`Herdr F1 is running · ${record.url}`);
    printExtraURLs(record);
    console.log(`PID ${record.pid} · ${targetLabel(record.target)}`);
    console.log(`Log ${record.logPath}`);
    return;
  }
  const result = await ensureDaemon({ target: command.target, port: command.port, bindHost: command.bindHost });
  console.log(`Herdr F1 · ${result.record.url}${result.reused ? ' · already running' : ''}`);
  printExtraURLs(result.record);
  if (command.open) openBrowser(result.record.url);
  else console.log(`Open ${result.record.url} in your browser.`);
}

/** A wildcard bind answers on more than the loopback URL reported first, and
 *  those are the addresses another device would use. */
function printExtraURLs(record: { url: string; urls?: string[] }): void {
  const extra = (record.urls ?? []).filter(url => url !== record.url);
  for (const url of extra) console.log(`Also on ${url}`);
}

function openBrowser(url: string): void {
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(command, [url], { stdio: 'ignore', detached: true });
  child.once('error', () => console.error(`Could not open a browser. Open ${url} manually.`));
  child.unref();
}
