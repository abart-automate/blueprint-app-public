// SW_VERSION must be bumped by hand in lockstep with APP_VERSION in
// js/version.js — it is NOT read via importScripts() from that file, on
// purpose. The browser's service-worker update check only detects a new
// version by byte-diffing THIS file's own content against what's currently
// registered; it does not look inside files this script imports. If
// CACHE_NAME depended only on an imported APP_VERSION, sw.js's bytes would
// never change between releases, the browser would always conclude "no
// update", updatefound would never fire, and the "Update Now" banner
// (wired in index.html's registration script -> init.js's
// initUpdateBanner) would never appear — which is exactly the bug this
// literal fixes. Bump this string on every release, same as APP_VERSION.
const SW_VERSION = '1.17.2';

const CACHE_NAME = `plant-asset-${SW_VERSION}`;

// All static files that make up the app shell.
// Bump SW_VERSION above (and APP_VERSION in js/version.js) whenever any of
// these files change — this list must stay in sync with index.html's
// <script> tags.
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
