// SW_BUILD is auto-stamped "<UTC timestamp>-<tree hash>" (e.g.
// '20260909T1432Z-dbb0ef0') by a pre-commit hook (scripts/git-hooks/
// pre-commit -> scripts/stamp-sw-build.js) on every commit — do not
// hand-edit this value, it's overwritten on the next commit. The
// timestamp is there so "what build is this install on, and when was it
// published" can be read straight off this value (e.g. in DevTools ->
// Application -> Cache Storage, or console-logged) without a git log
// lookup; the hash is what actually guarantees uniqueness. It's a git
// tree hash (`git write-tree`), not a commit hash — a commit's hash is
// derived from its own tree, so a file can never correctly embed its own
// commit's hash (stamping it in would change the tree, which changes the
// hash). The tree hash is computed just before this file is rewritten, so
// it correctly identifies this commit instead of always lagging one behind
// (see stamp-sw-build.js for the full explanation).
//
// It exists because the browser's service-worker update check only detects
// a new version by byte-diffing THIS file's own content against what's
// currently registered — it does not look inside files this script imports.
// An earlier design derived CACHE_NAME from a hand-maintained version string
// via importScripts(); since that never changed sw.js's own bytes, the
// browser always concluded "no update" and the "Update Now" banner (wired in
// index.html's registration script -> init.js's initUpdateBanner) never
// appeared, no matter how many times that string was bumped. Deriving this
// from the commit hash instead means there's nothing to remember to bump,
// and it can never silently drift out of sync the way a hand-edited value
// can.
//
// One-time setup per clone: `git config core.hooksPath scripts/git-hooks`.
// This is also the app's only version concept shown to humans: the
// home-page footer and export metadata both read it straight out of Cache
// Storage (see js/app.js's getRunningBuild()) rather than duplicating it in
// a separately maintained constant.
//
// The app's shell assets (this list, below) all load once eagerly at
// initial page load and are never re-fetched at runtime, so a new worker
// silently taking over mid-session has always been low-risk here. The
// gated-activation pattern below (waiting worker + SKIP_WAITING message on
// user consent) is adopted for predictability of *when* control transfers,
// not because that was an active bug for this app's architecture.
const SW_BUILD = '20260910T1328Z-6917924';

const CACHE_NAME = `plant-asset-${SW_BUILD}`;

// All static files that make up the app shell — must stay in sync with
// index.html's <script> tags. Keep this list matching index.html by hand;
// nothing auto-derives it.
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
