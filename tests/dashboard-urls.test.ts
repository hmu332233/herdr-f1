import os from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reachableURLs } from '../src/server/dashboard.js';

afterEach(() => vi.restoreAllMocks());

describe('reachableURLs', () => {
  it('reports a specific bind as itself', () => {
    expect(reachableURLs('192.168.0.2', 4158)).toEqual(['http://192.168.0.2:4158']);
  });
  it('expands a wildcard bind to loopback plus the external interfaces', () => {
    vi.spyOn(os, 'networkInterfaces').mockReturnValue({
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true } as os.NetworkInterfaceInfo],
      eth0: [
        { address: '192.168.0.2', family: 'IPv4', internal: false } as os.NetworkInterfaceInfo,
        { address: 'fe80::1', family: 'IPv6', internal: false } as os.NetworkInterfaceInfo,
      ],
    });
    expect(reachableURLs('0.0.0.0', 4158)).toEqual(['http://127.0.0.1:4158', 'http://192.168.0.2:4158']);
  });
  it('puts loopback last for a multiplayer host, where the LAN address is the useful one', () => {
    vi.spyOn(os, 'networkInterfaces').mockReturnValue({
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true } as os.NetworkInterfaceInfo],
      eth0: [{ address: '192.168.0.2', family: 'IPv4', internal: false } as os.NetworkInterfaceInfo],
    });
    expect(reachableURLs('0.0.0.0', 4158, 'last')).toEqual(['http://192.168.0.2:4158', 'http://127.0.0.1:4158']);
    // A specific bind is the only address either way.
    expect(reachableURLs('192.168.0.2', 4158, 'last')).toEqual(['http://192.168.0.2:4158']);
  });
  it('brackets IPv6 addresses', () => {
    vi.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: [{ address: 'fd00::2', family: 'IPv6', internal: false } as os.NetworkInterfaceInfo],
    });
    expect(reachableURLs('::', 4158)).toEqual(['http://[::1]:4158', 'http://[fd00::2]:4158']);
  });
});
