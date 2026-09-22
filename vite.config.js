import { defineConfig } from 'vite';

// SIsta build config.
// - base: './' so the built asset URLs are RELATIVE. The live site is served
//   from a subpath (gillianhanley.us/sista/), and relative URLs work both there
//   and in local dev / preview.
// - Only index.html is a build entry. sparky.html lives in the same repo but is
//   deployed separately as a static file by the Portfolio workflow, so it is NOT
//   part of this build.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
