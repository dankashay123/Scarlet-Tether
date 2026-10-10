import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// The page source lives in web/; the built game is written to play/ and
// committed, so GitHub Pages serves a working game whether it deploys from
// the branch or from the Actions workflow. The repo-root index.html simply
// forwards visitors to play/.
export default defineConfig({
  root: 'web',
  base: './',
  publicDir: '../public',
  server: { fs: { allow: ['..'] } },
  // web/index.html loads /src/main.ts; map that onto the real src/ folder.
  resolve: { alias: { '/src': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    outDir: '../play',
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
});
