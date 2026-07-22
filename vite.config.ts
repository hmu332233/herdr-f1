import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/web',
  base: './',
  build: { outDir: '../../dist/web', emptyOutDir: true },
  // Dev-mode client iteration: `npm run dev:web` proxies /ws to a running
  // `npm run dev:server` (default port 4158).
  server: { proxy: { '/ws': { target: 'ws://127.0.0.1:4158', ws: true } } },
});
