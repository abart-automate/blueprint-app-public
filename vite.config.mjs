// @ts-check
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    target: 'es2022',
  },
  plugins: [
    VitePWA({
      // Our own hand-written sw.js (see that file for why: a specific
      // gated-activation update flow, and a git-tree-hash build stamp
      // applied by a pre-commit hook) — injectManifest only substitutes
      // the self.__WB_MANIFEST placeholder inside it, nothing else.
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'sw.js',
      injectManifest: {
        // Vite's own hashed filenames already bust the cache on every
        // change, so no build asset needs a separate revision id (workbox's
        // default here is to content-hash everything itself, which is
        // redundant work on top of what Vite already did).
        globPatterns: ['**/*.{js,css,html,png,json,svg}'],
      },
      // index.html already registers sw.js itself, with a custom gated
      // update flow (see index.html's registration script and
      // js/init.js's initUpdateBanner) — don't let the plugin inject its
      // own registration script or manage the manifest link tag.
      injectRegister: false,
      manifest: false,
      // Without this, `vite dev` serves sw.js with its self.__WB_MANIFEST
      // placeholder still literally in the source (only `vite build`
      // resolves it), which throws on registration. Enabling this makes
      // the plugin serve a real, working dev-mode worker instead.
      devOptions: {
        enabled: true,
        type: 'classic',
      },
    }),
  ],
});
