import { defineConfig } from 'vite';

// base './' so the build works from a GitHub Pages sub-path.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
});
