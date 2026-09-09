// SW_BUILD is auto-stamped with the current git commit hash by a pre-commit
// hook (scripts/git-hooks/pre-commit -> scripts/stamp-sw-build.js) whenever
// a commit touches an app-shell file (index.html, manifest.json, css/, js/,
// icons/) — do not hand-edit this value, it's overwritten on the next
// relevant commit.
//
// It exists because the browser's service-worker update check only detects
// a new version by byte-diffing THIS file's own content against what's
// currently registered — it does not look inside files this script imports.
// An earlier version of this file computed CACHE_NAME from APP_VERSION via
// importScripts('./js/version.js'); since that never changed sw.js's own
// bytes, the browser always concluded "no update" and the "Update Now"
// banner (wired in index.html's registration script -> init.js's
// initUpdateBanner) never appeared, no matter how many times APP_VERSION
// was bumped. Deriving this from the commit hash instead of a manually
// maintained number means there's nothing to remember to bump, and it can
// never silently drift out of sync the way a hand-edited value can.
//
// One-time setup per clone: `git config core.hooksPath scripts/git-hooks`.
// js/version.js's APP_VERSION is unrelated to this — it's the human-facing
// version shown in the app footer and export metadata, untouched by this
// mechanism.
const SW_BUILD = 'dbb0ef0';

const CACHE_NAME = `plant-asset-${SW_BUILD}`;

// All static files that make up the app shell — must stay in sync with
// index.html's <script> tags (the stamping script above only fires when a
// commit touches one of these paths, so this list itself doesn't need a
// manual version bump — just keep it matching index.html).
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/version.js',
  './js/db.js',
  './js/entity-config.js',
  './js/state.js',
  './js/utils.js',
  './js/renderers/tables.js',
  './js/renderers/form.js',
  './js/renderers/detail.js',
  './js/events.js',
  './js/operations.js',
  './js/parts-library.js',
  './js/app.js',
  './js/export.js',
  './js/import.js',
  './js/json-merge.js',
  './js/init.js',
  './js/vendor/jszip.min.js',
  './js/vendor/xlsx.full.min.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Pre-cache the full app shell on install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Delete caches from previous SW versions on activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Cache-first with background revalidation (stale-while-revalidate)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const networkFetch = fetch(event.request)
          .then(response => {
            if (response && response.status === 200)
              cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => null);
        return cached || networkFetch;
      })
    )
  );
});
