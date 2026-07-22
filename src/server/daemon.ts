import { spawn as spawnChild, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startDashboard } from './dashboard.js';
import { instanceKey, type InstanceTarget } from './target.js';

export interface InstanceRecord {
  pid: number;
  identity: string;
  url: string;
  target: InstanceTarget;
  logPath: string;
}

export interface StartRequest { target: InstanceTarget; port: number; }
export interface StartResult { record: InstanceRecord; reused: boolean; }
export interface InstancePaths { recordPath: string; lockPath: string; logPath: string; }

function stateRoot(): string {
  return process.env.HERDR_F1_STATE_DIR
    ?? path.join(os.tmpdir(), 'herdr-f1');
}

function ensurePrivateDirectory(directory: string): void {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

export function instancePaths(target: InstanceTarget): InstancePaths {
  const root = stateRoot();
  const key = instanceKey(target);
  return {
    recordPath: path.join(root, 'instances', `${key}.json`),
    lockPath: path.join(root, 'locks', `${key}.lock`),
    logPath: path.join(root, 'logs', `${key}.log`),
  };
}

function validRecord(value: unknown): value is InstanceRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<InstanceRecord>;
  return Number.isInteger(record.pid) && (record.pid ?? 0) > 0
    && typeof record.identity === 'string' && record.identity.length > 0
    && typeof record.url === 'string' && record.url.startsWith('http://127.0.0.1:');
}

export function readInstanceRecord(target: InstanceTarget): InstanceRecord | null {
  const { recordPath } = instancePaths(target);
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    if (validRecord(parsed)) return parsed;
  } catch {
    return null;
  }
  fs.rmSync(recordPath, { force: true });
  return null;
}

export function writeInstanceRecord(record: InstanceRecord): void {
  const { recordPath } = instancePaths(record.target);
  ensurePrivateDirectory(path.dirname(recordPath));
  const temp = `${recordPath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(record));
  fs.chmodSync(temp, 0o600);
  fs.renameSync(temp, recordPath);
}

function isProcessAlive(record: InstanceRecord): boolean {
  try { process.kill(record.pid, 0); }
  catch { return false; }
  const processInfo = spawnSync('ps', ['-p', String(record.pid), '-o', 'command='], { encoding: 'utf8' });
  return processInfo.status === 0 && processInfo.stdout.trim() === `herdr-f1:${record.identity}`;
}

function spawnDaemon(target: InstanceTarget, port: number, logPath: string): void {
  const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const binPath = path.join(pluginRoot, 'bin', 'herdr-f1.js');
  const args = [binPath, '__daemon', '--port', String(port)];
  if (target.kind === 'herdr') args.push('--socket', target.socketPath);
  else args.push('--fixture', target.name);
  ensurePrivateDirectory(path.dirname(logPath));
  const log = fs.openSync(logPath, 'a', 0o600);
  try {
    const child = spawnChild(process.execPath, args, {
      cwd: pluginRoot, detached: true, env: { ...process.env, HERDR_F1_STATE_DIR: stateRoot() },
      stdio: ['ignore', log, log],
    });
    child.unref();
  } finally { fs.closeSync(log); }
}

function removeRecord(target: InstanceTarget): void { fs.rmSync(instancePaths(target).recordPath, { force: true }); }

function liveRecord(target: InstanceTarget): InstanceRecord | null {
  const record = readInstanceRecord(target);
  if (!record) return null;
  if (isProcessAlive(record)) return record;
  removeRecord(target);
  return null;
}

function acquireLock(target: InstanceTarget, now: number): boolean {
  const { lockPath } = instancePaths(target);
  ensurePrivateDirectory(path.dirname(lockPath));
  try { fs.closeSync(fs.openSync(lockPath, 'wx', 0o600)); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    try {
      if (now - fs.statSync(lockPath).mtimeMs > 10_000) fs.rmSync(lockPath, { force: true });
    } catch { /* another controller released it */ }
    return false;
  }
}

function releaseLock(target: InstanceTarget): void { fs.rmSync(instancePaths(target).lockPath, { force: true }); }

export async function ensureDaemon(request: StartRequest): Promise<StartResult> {
  const existing = liveRecord(request.target);
  if (existing) return { record: existing, reused: true };
  const deadline = Date.now() + 5_000;
  while (!acquireLock(request.target, Date.now())) {
    const ready = liveRecord(request.target);
    if (ready) return { record: ready, reused: true };
    if (Date.now() >= deadline) throw new Error(`timed out waiting for Herdr F1 lock; log: ${instancePaths(request.target).logPath}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  try {
    const again = liveRecord(request.target);
    if (again) return { record: again, reused: true };
    spawnDaemon(request.target, request.port, instancePaths(request.target).logPath);
    while (Date.now() < deadline) {
      const ready = liveRecord(request.target);
      if (ready) return { record: ready, reused: false };
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Herdr F1 did not become ready; log: ${instancePaths(request.target).logPath}`);
  } finally { releaseLock(request.target); }
}

export function statusDaemon(target: InstanceTarget): InstanceRecord | null {
  return liveRecord(target);
}

export async function stopDaemon(target: InstanceTarget): Promise<boolean> {
  const record = liveRecord(target);
  if (!record) return false;
  process.kill(record.pid, 'SIGTERM');
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline && isProcessAlive(record)) await new Promise(resolve => setTimeout(resolve, 50));
  removeRecord(target);
  return true;
}

export async function runDaemon(target: InstanceTarget, port: number): Promise<void> {
  const identity = randomBytes(8).toString('hex');
  process.title = `herdr-f1:${identity}`;
  let resolveStop!: () => void;
  const stopped = new Promise<void>(resolve => { resolveStop = resolve; });
  const requestShutdown = () => resolveStop();
  const dashboard = await startDashboard({ target, port });
  process.once('SIGINT', requestShutdown);
  process.once('SIGTERM', requestShutdown);
  try {
    const paths = instancePaths(target);
    writeInstanceRecord({ pid: process.pid, identity, url: dashboard.url, target, logPath: paths.logPath });
    await stopped;
  } finally {
    process.removeListener('SIGINT', requestShutdown);
    process.removeListener('SIGTERM', requestShutdown);
    await dashboard.close();
    removeOwnedRecord(target, process.pid);
  }
}

function removeOwnedRecord(target: InstanceTarget, pid: number): void {
  const current = readInstanceRecord(target);
  if (current?.pid !== pid) return;
  removeRecord(target);
}
