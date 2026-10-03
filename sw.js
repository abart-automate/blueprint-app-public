// SW_BUILD is stamped at BUILD time as "<UTC timestamp>-<short commit>"
// (e.g. '20261003T1432Z-f4aef4f') by the swBuildStamp plugin in
// vite.config.mjs, which replaces the '__SW_BUILD__' placeholder below. Do
// not hand-edit it. The commit is GITHUB_SHA in CI (the commit actually
// deployed) or `git rev-parse --short HEAD` locally (+ "-dirty" for
// uncommitted changes). Stamping at build time, not commit time, means no
// per-clone git-hook setup can be forgotten: an earlier pre-commit-hook
// design silently stopped stamping on a clone without
// `core.hooksPath` configured, freezing this value for weeks.
//
// It exists because the browser's service-worker update check only detects
// a new version by byte-diffing THIS file's own content against what's
// currently registered — it does not look inside files this script imports.
// A new stamp per build guarantees the bytes change, so the "Update Now"
// banner (index.html's registration script -> init.js's initUpdateBanner)
// fires, and CACHE_NAME changes, so the previous build's cache is dropped
// on activation.
//
// This is also the app's only version concept shown to humans: the
// home-page footer and export metadata both read it straight out of Cache
// Storage (see js/app.js's getRunningBuild()) rather than duplicating it in
// a separately maintained constant.
//
// The app's shell assets (this list, below) are all precached, including
// the lazily imported lightbox chunks, so a new worker silently taking over
// mid-session has always been low-risk here. The gated-activation pattern
// below (waiting worker + SKIP_WAITING message on user consent) is adopted
// for predictability of *when* control transfers, not because that was an
// active bug for this app's architecture.
const SW_BUILD = '__SW_BUILD__';

const CACHE_NAME = `plant-asset-${SW_BUILD}`;

// The app shell — every hashed build asset (JS/CSS bundle, HTML, icons,
// manifest, vendor scripts) plus its precache revision. Injected at build
// time by vite-plugin-pwa's `injectManifest` strategy, which replaces this
// exact placeholder expression with a literal array derived from the real
// Vite output — so unlike the hand-maintained list this used to be, it can
// never drift out of sync with what actually got built.
const APP_SHELL = self.__WB_MANIFEST.map(entry => (typeof entry === 'string' ? entry : entry.url));

// Pre-cache the full app shell on install. Deliberately does NOT call
// self.skipWaiting() here — a new worker parks in the `waiting` state until
// the page's "Update Now" banner sends it a SKIP_WAITING message (see the
// 'message' handler below), so activation only happens once the user has
// actually consented. (A first-ever install, with no existing controller in
// scope, still activates immediately on its own — skipWaiting() only matters
// for forcing takeover while an old worker is still controlling open tabs.)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});

// Delete caches from previous SW versions on activate. clients.claim() here
// is what makes 'controllerchange' fire promptly on an already-open tab once
// this worker activates — without it the reload-on-consent flow in
// index.html would have nothing reliable to hook into until the tab's next
// navigation. Under the gated-activation pattern this only runs after the
// user has consented (via SKIP_WAITING below) or all old-version tabs have
// closed, so it's no longer "taking control before consent."
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// The page's "Update Now" button sends this once the user has consented to
// activating a waiting update (see index.html's registration script and
// js/init.js's initUpdateBanner).
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
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
