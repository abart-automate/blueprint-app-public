/* ============================================================
   INIT & PWA LIFECYCLE
   Depends on: db.js, state.js, utils.js, entity-config.js,
   events.js (wireEvents), app.js (navigate, esc)
   ============================================================ */

async function init() {
  try {
    await initDB();
    wireEvents();
    const hash = window.location.hash.replace('#', '') || 'home';
    const startPage = (ENTITY[hash] || hash === 'home' || hash === 'plc') ? hash : 'home';
    navigate(startPage);
    initInstallPrompt();
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

/* ============================================================
   PWA INSTALL PROMPT (Android / Chrome only)
   ============================================================ */

function initInstallPrompt() {
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', () => {
    hideInstallBanner();
    deferredPrompt = null;
  });

  function showInstallBanner() {
    if (document.getElementById('install-banner')) return;
    const el = document.createElement('div');
    el.id = 'install-banner';
    el.className = 'install-banner';
    el.innerHTML = `<span>Install blueprint</span>
      <div class="install-banner-btns">
        <button id="install-now-btn">Install</button>
        <button id="install-skip-btn">Not now</button>
      </div>`;
    document.getElementById('bottom-nav').before(el);
    document.getElementById('install-now-btn').onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') hideInstallBanner();
    };
    document.getElementById('install-skip-btn').onclick = hideInstallBanner;
  }

  function hideInstallBanner() {
    document.getElementById('install-banner')?.remove();
  }
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
    '<span>A new version is available.</span>' +
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
