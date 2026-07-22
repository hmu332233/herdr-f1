import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/server/cli.js';
import { defaultSocketPath } from '../src/server/herdr/client.js';

describe('parseArgs', () => {
  it('defaults to a background start against the default Herdr socket', () => {
    expect(parseArgs([], {})).toEqual({ kind: 'start', target: { kind: 'herdr', socketPath: defaultSocketPath }, port: 4158, open: false });
  });
  it('uses HERDR_SOCKET_PATH and explicit socket precedence', () => {
    expect(parseArgs(['start'], { HERDR_SOCKET_PATH: '/tmp/named.sock' })).toMatchObject({ target: { kind: 'herdr', socketPath: '/tmp/named.sock' } });
    expect(parseArgs(['start', '--socket', '/tmp/explicit.sock'], { HERDR_SOCKET_PATH: '/tmp/named.sock' })).toMatchObject({ target: { kind: 'herdr', socketPath: '/tmp/explicit.sock' } });
  });
  it('parses isolated fixtures and lifecycle commands', () => {
    expect(parseArgs(['start', '--port', '5000', '--open', '--fixture', 'podium'], {})).toEqual({ kind: 'start', target: { kind: 'fixture', name: 'podium' }, port: 5000, open: true });
    expect(parseArgs(['stop'], { HERDR_SOCKET_PATH: '/tmp/work.sock' })).toEqual({ kind: 'stop', target: { kind: 'herdr', socketPath: '/tmp/work.sock' } });
    expect(parseArgs(['status'], { HERDR_SOCKET_PATH: '/tmp/work.sock' })).toEqual({ kind: 'status', target: { kind: 'herdr', socketPath: '/tmp/work.sock' } });
    expect(parseArgs(['__daemon', '--socket', '/tmp/work.sock', '--port', '5001'], {})).toEqual({ kind: 'daemon', target: { kind: 'herdr', socketPath: '/tmp/work.sock' }, port: 5001 });
  });
  it('rejects incompatible targets, command flags, bad ports, and unknown input', () => {
    for (const argv of [['start', '--socket', '/tmp/a', '--fixture', 'grid'], ['stop', '--port', '5000'], ['status', '--open'], ['start', '--no-open'], ['start', '--port', '0'], ['start', '--fixture', 'nope'], ['serve']]) {
      expect(() => parseArgs(argv, {})).toThrowError(/^Usage:/);
    }
  });
});
