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
  it('parses --bind and forwards it to the daemon', () => {
    expect(parseArgs(['start', '--bind', '0.0.0.0'], { HERDR_SOCKET_PATH: '/tmp/w.sock' }))
      .toEqual({ kind: 'start', target: { kind: 'herdr', socketPath: '/tmp/w.sock' }, port: 4158, open: false, bindHost: '0.0.0.0' });
    expect(parseArgs(['__daemon', '--socket', '/tmp/w.sock', '--bind', '::'], {}))
      .toEqual({ kind: 'daemon', target: { kind: 'herdr', socketPath: '/tmp/w.sock' }, port: 4158, bindHost: '::' });
    // Absent by default, so the loopback bind and its exact-origin policy stand.
    expect(parseArgs(['start'], {})).not.toHaveProperty('bindHost');
  });

  it('rejects incompatible targets, command flags, bad ports, and unknown input', () => {
    for (const argv of [['start', '--socket', '/tmp/a', '--fixture', 'grid'], ['stop', '--port', '5000'], ['status', '--open'], ['start', '--no-open'], ['start', '--port', '0'], ['start', '--fixture', 'nope'], ['serve'], ['start', '--bind', 'everywhere'], ['stop', '--bind', '0.0.0.0'], ['host', '--bind', '0.0.0.0']]) {
      expect(() => parseArgs(argv, {})).toThrowError(/^Usage:/);
    }
  });
  it('parses the multiplayer host command', () => {
    expect(parseArgs(['host'], {})).toEqual({ kind: 'host', port: 4158, raceMode: 'classic' });
    expect(parseArgs(['host', '--port', '5000'], {})).toEqual({ kind: 'host', port: 5000, raceMode: 'classic' });
    expect(parseArgs(['host', '--circuit', 'suzuka'], {})).toEqual({ kind: 'host', port: 4158, circuit: 'suzuka', raceMode: 'classic' });
    expect(parseArgs(['host', '--race-mode', 'continuous'], {}))
      .toEqual({ kind: 'host', port: 4158, raceMode: 'continuous' });
  });
  it('parses join targets, names, and socket precedence', () => {
    expect(parseArgs(['join', '192.168.0.5', '--name', ' mark '], {})).toEqual({
      kind: 'join', host: '192.168.0.5', port: 4158, name: 'mark', socketPath: defaultSocketPath,
    });
    expect(parseArgs(['join', 'party.local:4200', '--name', 'woo'], {})).toMatchObject({
      host: 'party.local', port: 4200,
    });
    expect(parseArgs(['join', '[::1]:4200', '--name', 'woo'], {})).toMatchObject({ host: '::1', port: 4200 });
    expect(parseArgs(['join', 'fe80::1', '--name', 'woo'], {})).toMatchObject({ host: 'fe80::1', port: 4158 });
    expect(parseArgs(['join', 'h', '--name', 'woo', '--socket', '/tmp/x.sock'], { HERDR_SOCKET_PATH: '/tmp/env.sock' }))
      .toMatchObject({ socketPath: '/tmp/x.sock' });
    expect(parseArgs(['join', 'h', '--name', 'woo'], { HERDR_SOCKET_PATH: '/tmp/env.sock' }))
      .toMatchObject({ socketPath: '/tmp/env.sock' });
  });
  it('rejects malformed multiplayer invocations', () => {
    for (const argv of [
      ['host', '--socket', '/tmp/a'], ['host', '--fixture', 'grid'], ['host', '--open'], ['host', '--name', 'x'],
      ['join'], ['join', 'h'], ['join', 'h', '--name', ''], ['join', 'h', '--name', '   '],
      ['join', 'h', '--name', 'x'.repeat(25)], ['join', 'h:99999', '--name', 'x'], ['join', 'h:', '--name', 'x'],
      ['join', 'h', 'extra', '--name', 'x'], ['join', 'h', '--name', 'x', '--port', '4200'],
      ['join', 'h', '--name', 'x', '--fixture', 'grid'], ['start', '--name', 'x'],
      ['host', '--circuit', 'nope'], ['host', '--race-mode', 'endless'], ['start', '--race-mode', 'continuous'],
      ['start', '--circuit', 'suzuka'], ['join', 'h', '--name', 'x', '--circuit', 'suzuka'],
    ]) {
      expect(() => parseArgs(argv, {}), argv.join(' ')).toThrowError(/^Usage:/);
    }
  });
});
