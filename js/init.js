/* ============================================================
   INIT & PWA LIFECYCLE
   Depends on: db.js, state.js, utils.js, entity-config.js,
   events.js (wireEvents), app.js (navigate, esc)
   ============================================================ */

async function init() {
  try {
    await initDB();

    /* Detect viewport size and stamp body[data-layout] before any rendering
       so CSS and JS branches are consistent from the very first paint. */
    initLayoutDetection();

    /* Restore the user's last-saved list-pane width (desktop only).
       Must run before wireEvents so the CSS custom property is set
       before the resize handle listener is attached. */
    await applyPersistedListPaneWidth();

    wireEvents();

    const hash = window.location.hash.replace('#', '') || 'home';
    const startPage = (ENTITY[hash] || hash === 'home' || hash === 'checklist') ? hash : 'home';
    navigate(startPage);
    initInstallPrompt();
    initOfflineIndicator();
  } catch (err) {
    console.error('Init failed:', err);
    document.querySelector('#app-main').innerHTML = `
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
async function applyPersistedListPaneWidth() {
  const w = await getSetting('listPaneWidth');
  if (w && Number.isFinite(Number(w))) {
    document.documentElement.style.setProperty('--list-pane-w', Number(w) + 'px');
  }
}

/* ============================================================
   PWA INSTALL PROMPT (Android / Chrome only)
   ============================================================ */

let _deferredInstallPrompt = null;

function initInstallPrompt() {
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredInstallPrompt = e;
    if (state.page === 'home') renderHome();
  });

  window.addEventListener('appinstalled', () => {
    _deferredInstallPrompt = null;
    if (state.page === 'home') renderHome();
  });
}

/* ============================================================
   OFFLINE INDICATOR
   ============================================================ */

function initOfflineIndicator() {
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
  document.getElementById('app-header').before(bar);
  const update = () => { bar.style.display = navigator.onLine ? 'none' : 'flex'; };
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
}

/* ============================================================
   PWA UPDATE BANNER
   ============================================================ */

function initUpdateBanner() {
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
  document.getElementById('app-header').before(banner);
  document.getElementById('update-now-btn').onclick = function () {
    window.location.reload();
  };
  document.getElementById('update-later-btn').onclick = function () {
    banner.remove();
  };
}

window.addEventListener('pwa-updated', initUpdateBanner);

init();
