import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('npm package', () => {
  it('ships the herdr-f1 executable and runtime files', () => {
    const packagePath = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as Record<string, unknown>;

    expect(pkg.name).toBe('herdr-f1');
    expect(pkg.bin).toEqual({ 'herdr-f1': 'bin/herdr-f1.js' });
    expect(pkg.files).toEqual(['bin', 'dist', 'README.md']);
    expect(pkg.private).toBeUndefined();
  });
});
