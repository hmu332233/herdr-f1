import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('npm package', () => {
  it('ships the herdr-f1 executable and runtime files', () => {
    const packagePath = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as Record<string, unknown>;

    expect(pkg.name).toBe('herdr-f1');
    expect(pkg.bin).toEqual({ 'herdr-f1': 'bin/herdr-f1.js' });
    expect(pkg.files).toEqual(['bin', 'dist', 'README.md', 'herdr-plugin.toml']);
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.private).toBeUndefined();

    expect(fs.readFileSync(new URL('../bin/herdr-f1.js', import.meta.url), 'utf8'))
      .toContain("import('../dist/server/index.js')");
    expect(fs.existsSync(new URL('../dist/server/index.js', import.meta.url))).toBe(true);
    expect(fs.existsSync(new URL('../dist/server/licenses.txt', import.meta.url))).toBe(true);
    expect(fs.existsSync(new URL('../dist/web/index.html', import.meta.url))).toBe(true);
  });
  it('ships a prebuilt Herdr plugin manifest with lifecycle actions', () => {
    const root = new URL('../', import.meta.url);
    const manifest = fs.readFileSync(new URL('herdr-plugin.toml', root), 'utf8');
    expect(manifest).toContain('id = "dev.minung.herdr-f1"');
    expect(manifest).toContain('min_herdr_version = "0.7.4"');
    expect(manifest).toContain('platforms = ["macos", "linux"]');
    expect(manifest).not.toContain('[[build]]');
    expect(manifest.match(/\[\[actions\]\]/g)).toHaveLength(2);
    expect(manifest).toContain('id = "open"');
    expect(manifest).toContain('title = "Open F1 Dashboard"');
    expect(manifest).toContain('command = ["node", "bin/herdr-f1.js", "start", "--open"]');
    expect(manifest).toContain('id = "stop"');
    expect(manifest).toContain('title = "Stop F1 Dashboard"');
    expect(manifest).toContain('command = ["node", "bin/herdr-f1.js", "stop"]');
  });
});
