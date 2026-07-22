import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureDaemon, instancePaths, readInstanceRecord, statusDaemon, stopDaemon, writeInstanceRecord, type InstanceRecord } from '../src/server/daemon.js';
import type { InstanceTarget } from '../src/server/target.js';

const spawn = vi.hoisted(() => vi.fn());
const inspectProcess = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ spawn, spawnSync: inspectProcess }));

const originalStateDir = process.env.HERDR_F1_STATE_DIR;
let stateDir = '';
const target: InstanceTarget = { kind: 'herdr', socketPath: '/tmp/work.sock' };
function record(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return { pid: 1234, identity: 'test', url: 'http://127.0.0.1:4158', target,
    logPath: path.join(stateDir, 'logs', 'test.log'), ...overrides };
}
function setup(): void { stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'herdr-f1-state-')); process.env.HERDR_F1_STATE_DIR = stateDir; }
afterEach(() => {
  vi.restoreAllMocks(); spawn.mockReset(); inspectProcess.mockReset(); if (stateDir) fs.rmSync(stateDir, { recursive: true, force: true }); stateDir = '';
  if (originalStateDir === undefined) delete process.env.HERDR_F1_STATE_DIR; else process.env.HERDR_F1_STATE_DIR = originalStateDir;
});

describe('daemon registry', () => {
  it('writes private records atomically and reads them back', () => {
    setup(); writeInstanceRecord(record()); expect(readInstanceRecord(target)).toEqual(record());
    expect(fs.statSync(instancePaths(target).recordPath).mode & 0o777).toBe(0o600);
  });
  it('reuses a healthy daemon without spawning another process', async () => {
    setup(); writeInstanceRecord(record()); vi.spyOn(process, 'kill').mockReturnValue(true);
    inspectProcess.mockReturnValue({ status: 0, stdout: 'herdr-f1:test\n' });
    const result = await ensureDaemon({ target, port: 4158 });
    expect(result).toEqual({ record: record(), reused: true }); expect(spawn).not.toHaveBeenCalled();
  });
  it('removes stale state, spawns once, and waits for readiness', async () => {
    setup(); writeInstanceRecord(record()); const ready = record({ pid: 5678, url: 'http://127.0.0.1:4159' });
    vi.spyOn(process, 'kill').mockImplementation(pid => { if (pid === ready.pid) return true; throw new Error('ESRCH'); });
    inspectProcess.mockReturnValue({ status: 0, stdout: 'herdr-f1:test\n' });
    spawn.mockImplementation(() => { writeInstanceRecord(ready); return { unref: vi.fn() }; });
    const result = await ensureDaemon({ target, port: 4158 });
    expect(result).toEqual({ record: ready, reused: false });
  });
  it('treats stop as idempotent and removes a stopped record', async () => {
    setup(); let alive = false;
    const kill = vi.spyOn(process, 'kill').mockImplementation((_pid, signal) => {
      if (signal === 'SIGTERM') { alive = false; return true; }
      if (alive) return true;
      throw new Error('ESRCH');
    });
    inspectProcess.mockReturnValue({ status: 0, stdout: 'herdr-f1:test\n' });
    expect(await stopDaemon(target)).toBe(false); writeInstanceRecord(record()); alive = true;
    expect(await stopDaemon(target)).toBe(true); expect(readInstanceRecord(target)).toBeNull();
    expect(kill).toHaveBeenCalledWith(record().pid, 'SIGTERM');
  });
  it('returns null status for stale records', async () => {
    setup(); writeInstanceRecord(record()); vi.spyOn(process, 'kill').mockImplementation(() => { throw new Error('ESRCH'); });
    expect(await statusDaemon(target)).toBeNull(); expect(readInstanceRecord(target)).toBeNull();
  });
  it('serializes concurrent starts for the same target', async () => {
    setup(); const ready = record({ pid: 5678 }); vi.spyOn(process, 'kill').mockReturnValue(true);
    inspectProcess.mockReturnValue({ status: 0, stdout: 'herdr-f1:test\n' });
    spawn.mockImplementation(() => { writeInstanceRecord(ready); return { unref: vi.fn() }; });
    const [first, second] = await Promise.all([ensureDaemon({ target, port: 4158 }), ensureDaemon({ target, port: 4158 })]);
    expect(spawn).toHaveBeenCalledTimes(1); expect(first.record.pid).toBe(5678); expect(second.record.pid).toBe(5678);
  });
});
