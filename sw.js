const APP_VERSION = '1.2.2'; // keep in sync with js/init.js
const CACHE_NAME = `plant-asset-${APP_VERSION}`;

// All static files that make up the app shell.
// Bump APP_VERSION whenever any of these files change.
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/db.js',
  './js/entity-config.js',
  './js/state.js',
  './js/utils.js',
  './js/renderers/tables.js',
  './js/renderers/form.js',
  './js/renderers/detail.js',
  './js/events.js',
  './js/operations.js',
  './js/app.js',
  './js/export.js',
  './js/import.js',
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
