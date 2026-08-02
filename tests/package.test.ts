import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('npm package', () => {
  it('ships the herdr-f1 executable and runtime files', () => {
    const packagePath = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as Record<string, unknown>;

    expect(pkg.name).toBe('herdr-f1');
    expect(pkg.bin).toEqual({ 'herdr-f1': 'bin/herdr-f1.js' });
    expect(new Set(pkg.files as string[])).toEqual(new Set([
      'assets',
      'bin',
      'dist',
      'README.md',
      'herdr-plugin.toml',
    ]));
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.private).toBeUndefined();

    expect(fs.readFileSync(new URL('../bin/herdr-f1.js', import.meta.url), 'utf8'))
      .toContain("import('../dist/server/index.js')");
    expect(fs.existsSync(new URL('../dist/server/index.js', import.meta.url))).toBe(true);
    expect(fs.existsSync(new URL('../dist/server/licenses.txt', import.meta.url))).toBe(true);
    expect(fs.existsSync(new URL('../dist/web/index.html', import.meta.url))).toBe(true);
  });

  it('ships the assets that make the dashboard installable', () => {
    // Any one of these missing costs the install offer without breaking the
    // dashboard, so nothing else would notice.
    const root = new URL('../dist/web/', import.meta.url);
    for (const file of [
      'manifest.webmanifest', 'sw.js',
      'icon-192.png', 'icon-512.png',
      'icon-maskable-192.png', 'icon-maskable-512.png',
    ]) {
      expect(fs.existsSync(new URL(file, root)), `missing ${file}`).toBe(true);
    }

    const html = fs.readFileSync(new URL('index.html', root), 'utf8');
    expect(html).toContain('rel="manifest"');

    const manifest = JSON.parse(
      fs.readFileSync(new URL('manifest.webmanifest', root), 'utf8'),
    ) as {
      display: string;
      start_url: string;
      scope: string;
      icons: { src: string; sizes: string; purpose?: string }[];
    };
    // A standalone display mode is what makes it a window rather than a tab.
    expect(manifest.display).toBe('standalone');
    // Relative, because the daemon binds the first free port from 4158 upward:
    // an absolute start_url or scope breaks as soon as the port differs.
    expect(manifest.start_url.startsWith('.')).toBe(true);
    expect(manifest.scope.startsWith('.')).toBe(true);
    // Chrome requires both a 192px and a 512px icon to offer installation.
    const sizes = new Set(manifest.icons.map(icon => icon.sizes));
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    // Maskable icons must be their own files. Android crops them to its own
    // shape, so the full-bleed artwork would lose the letter's uprights; the
    // maskable variant insets it instead.
    const maskable = manifest.icons.filter(icon => (icon.purpose ?? '').includes('maskable'));
    const anyPurpose = manifest.icons.filter(icon => icon.purpose === 'any');
    expect(maskable.length).toBeGreaterThan(0);
    expect(anyPurpose.length).toBeGreaterThan(0);
    for (const icon of maskable) {
      expect(anyPurpose.map(other => other.src)).not.toContain(icon.src);
    }

    // The worker exists for the install criteria, not for offline: every number
    // here comes from the daemon over a WebSocket, so a cached shell would show
    // an empty grid rather than a disconnection.
    const worker = fs.readFileSync(new URL('sw.js', root), 'utf8');
    expect(worker).toContain('addEventListener');
    expect(worker).toContain('fetch');
    expect(worker).not.toContain('caches.open');
  });
  it('ships a prebuilt Herdr plugin manifest with lifecycle actions', () => {
    const root = new URL('../', import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(new URL('package.json', root), 'utf8')) as {
      version: string;
    };
    const manifest = fs.readFileSync(new URL('herdr-plugin.toml', root), 'utf8');
    expect(manifest).toContain('id = "dev.minung.herdr-f1"');
    expect(manifest).toContain(`version = "${pkg.version}"`);
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
