import type { EntityConfig } from './entity-config.js';

import { getSetting, initDB } from './db.js';
import { ENTITY, assertEntityConfigComplete } from './entity-config.js';
import { initEl, state } from './state.js';
import { esc, initLayoutDetection } from './utils.js';
import { wireEvents } from './events.js';
import { loadEditHistory, navigate, renderHome, renderPage } from './app.js';
/* ============================================================
   INIT & PWA LIFECYCLE
   Depends on: db.js, state.js, utils.js, entity-config.js,
   events.js (wireEvents), app.js (navigate, esc)
   ============================================================ */

export async function init(): Promise<void> {
  try {
    /* Populate the el DOM-reference cache first, before anything else touches
       el.*. See state.js for why this is an explicit call rather than a
       script-load side effect. */
    initEl();

    /* Opt-in dev-mode check for gaps in ENTITY's lookup tables (see
       assertEntityConfigComplete() in entity-config.js). Not run by default
       since it's a config-authoring aid, not a user-facing feature. */
    if (new URLSearchParams(window.location.search).has('debug')) {
      assertEntityConfigComplete();
    }

    await initDB();

    /* Restore the persisted autosave undo history (js/app.js's editHistory —
       see B4 of the autosave plan) so the Recent Changes badge/panel are
       correct from the very first paint. */
    await loadEditHistory();

    /* Detect viewport size and stamp body[data-layout] before any rendering
       so CSS and JS branches are consistent from the very first paint. */
    initLayoutDetection();

    /* Restore the user's last-saved list-pane width (desktop only).
       Must run before wireEvents so the CSS custom property is set
       before the resize handle listener is attached. */
    await applyPersistedListPaneWidth();

    wireEvents();
    initVisibilityRefresh();

    const hash = window.location.hash.replace('#', '') || 'home';
    const startPage = ((ENTITY as Record<string, EntityConfig>)[hash] || hash === 'home' || hash === 'checklist') ? hash : 'home';
    navigate(startPage);
    initInstallPrompt();
    initOfflineIndicator();
  } catch (err) {
    console.error('Init failed:', err);
    (document.querySelector('#app-main') as HTMLElement).innerHTML = `
      <div class="empty">
        <h3>Storage Error</h3>
        <p>Could not open IndexedDB. Please ensure you're using a modern browser and not in private/incognito mode.</p>
        <p style="margin-top:8px;font-family:monospace;font-size:12px">${esc(String(err))}</p>
      </div>
    `;
  }
}

/**
 * Reads the user's saved list-pane width from IndexedDB settings and
 * applies it as a CSS custom property on :root.  Falls back to the
 * CSS default (--list-pane-w-default: 320px) if nothing is stored yet.
 */
export async function applyPersistedListPaneWidth(): Promise<void> {
  const w = await getSetting('listPaneWidth');
  if (w && Number.isFinite(Number(w))) {
    document.documentElement.style.setProperty('--list-pane-w', Number(w) + 'px');
  }
}

/* ============================================================
   VISIBILITY / BFCACHE REFRESH
   ============================================================ */

/**
 * Wires browser lifecycle events that can leave the list pane with stale card data.
 *
 * visibilitychange — fires when the user backgrounds the PWA on mobile, switches to
 *   another browser tab, or returns. On becoming visible, we re-render the current page
 *   so cards reflect any data changes that occurred while the app was hidden.
 *
 * pageshow — fires when the browser restores a page from the back/forward cache (bfcache).
 *   e.persisted === true signals a bfcache restore, which bypasses normal navigation so
 *   the stale in-memory state from the previous load would otherwise remain on screen.
 *
 * Both handlers guard against interrupting an open detail panel or bottom-sheet form;
 * the user's in-progress edits must not be discarded by a background refresh.
 */
export function initVisibilityRefresh(): void {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    // Don't interrupt an in-progress edit in the detail panel or form sheet.
    if (state.detailType || state.formType) return;
    await renderPage();
  });

  window.addEventListener('pageshow', async (e) => {
    // Only re-render when the browser served this page from bfcache, not on a normal load
    // (which already triggers navigate() → renderPage() via init()).
    if (!e.persisted) return;
    if (state.detailType || state.formType) return;
    await renderPage();
  });
}

/* ============================================================
   PWA INSTALL PROMPT (Android / Chrome only)
   ============================================================ */

export function initInstallPrompt(): void {
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    if (state.page === 'home') renderHome();
  });

  window.addEventListener('appinstalled', () => {
    state.deferredInstallPrompt = null;
    if (state.page === 'home') renderHome();
  });
}

/* ============================================================
   OFFLINE INDICATOR
   ============================================================ */

export function initOfflineIndicator(): void {
  const bar = document.createElement('div');
  bar.id = 'offline-bar';
  bar.className = 'offline-bar';
  bar.setAttribute('aria-live', 'polite');
  bar.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <circle cx="12" cy="20" r="1"/>
    </svg>
    <span>Offline</span>`;
  /* Insert before #app-header so the bar sits at the top of .app-content
     on all layout modes (mobile, tablet, desktop sidebar). */
  (document.getElementById('app-header') as HTMLElement).before(bar);
  const update = () => { bar.style.display = navigator.onLine ? 'none' : 'flex'; };
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
}

/* ============================================================
   PWA UPDATE BANNER
   ============================================================ */

export function initUpdateBanner(e: CustomEvent): void {
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner';
  banner.innerHTML =
    '<span>A new version of Blueprint is available.</span>' +
    '<div class="update-banner-btns">' +
    '<button id="update-later-btn">Later</button>' +
    '<button id="update-now-btn">Update Now</button>' +
    '</div>';
  (document.getElementById('app-header') as HTMLElement).before(banner);
  (document.getElementById('update-now-btn') as HTMLElement).onclick = function () {
    // Send consent to the waiting worker; the actual reload happens via the
    // 'controllerchange' listener in index.html once it activates. Re-read
    // reg.waiting at click time (not a captured reference) in case state has
    // moved on since the banner was shown; fall back to a plain reload if
    // there's somehow no waiting worker left (e.g. another tab already
    // updated it).
    const reg = e.detail.registration;
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    else window.location.reload();
  };
  (document.getElementById('update-later-btn') as HTMLElement).onclick = function () {
    banner.remove();
  };
}

window.addEventListener('pwa-updated', initUpdateBanner as EventListener);
