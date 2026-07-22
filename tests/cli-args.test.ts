import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/server/cli.js';
import { defaultSocketPath } from '../src/server/herdr/client.js';

describe('parseArgs', () => {
  it('defaults: start on 4158, open browser, live herdr', () => {
    expect(parseArgs([])).toEqual({
      port: 4158, open: true, fixture: null, socket: defaultSocketPath,
    });
  });

  it('parses direct options', () => {
    expect(parseArgs(['--port', '5000', '--no-open', '--fixture', 'podium', '--socket', '/tmp/h.sock']))
      .toEqual({ port: 5000, open: false, fixture: 'podium', socket: '/tmp/h.sock' });
  });

  it('retains start as a compatibility alias', () => {
    expect(parseArgs(['start', '--no-open'])).toEqual({
      port: 4158, open: false, fixture: null, socket: defaultSocketPath,
    });
  });

  it('rejects unknown commands, bad ports, unknown fixtures and flags', () => {
    expect(() => parseArgs(['serve'])).toThrowError(/^Usage:/);
    expect(() => parseArgs(['--port', 'abc'])).toThrowError(/^Usage:/);
    expect(() => parseArgs(['--port', '0'])).toThrowError(/^Usage:/);
    expect(() => parseArgs(['--fixture', 'nope'])).toThrowError(/^Usage:/);
    expect(() => parseArgs(['--wat'])).toThrowError(/^Usage:/);
  });
});
