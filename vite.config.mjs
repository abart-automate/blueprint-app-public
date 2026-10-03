// @ts-check
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Build stamp for sw.js's SW_BUILD: "<UTC YYYYMMDDTHHmmZ>-<short commit>".
 * CI uses GITHUB_SHA (the exact commit being deployed). Locally it falls back
 * to `git rev-parse --short HEAD`, with "-dirty" when the tree has uncommitted
 * changes, so a local build is never mistaken for a deployed one.
 * See the comment above SW_BUILD in sw.js for why the stamp must change on every build.
 */
function computeBuildStamp() {
  const now = new Date();
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  const utc = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}Z`;
  let commit = process.env.GITHUB_SHA?.slice(0, 7);
  if (!commit) {
    try {
      commit = execSync('git rev-parse --short=7 HEAD').toString().trim();
      if (execSync('git status --porcelain').toString().trim()) commit += '-dirty';
    } catch {
      commit = 'unknown';
    }
  }
  return `${utc}-${commit}`;
}

const BUILD_STAMP = computeBuildStamp();

/**
 * Replaces the '__SW_BUILD__' placeholder in sw.js with BUILD_STAMP. Runs inside
 * vite-plugin-pwa's separate service-worker build (injectManifest.buildPlugins).
 * @returns {import('vite').Plugin}
 */
function swBuildStamp() {
  return {
    name: 'sw-build-stamp',
    transform(code, id) {
      if (!id.endsWith('sw.js') || !code.includes('__SW_BUILD__')) return null;
      return { code: code.replace(/'__SW_BUILD__'/g, JSON.stringify(BUILD_STAMP)), map: null };
    },
  };
}

export default defineConfig({
  // GitHub Pages serves this as a project page under /blueprint-app-public/,
  // so built asset URLs must be rooted there, not at '/'. Local dev/preview
  // (no GITHUB_ACTIONS env var) keeps serving from '/'.
  base: process.env.GITHUB_ACTIONS ? '/blueprint-app-public/' : '/',
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
        buildPlugins: { vite: [swBuildStamp()] },
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
