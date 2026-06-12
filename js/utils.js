/* ============================================================
   UTILITIES
   Pure helper functions with no side effects beyond what they
   explicitly return or render. Depends on: state, ENTITY.
   ============================================================ */

/* ---- MEDIA TYPE CONSTANTS ---- */

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4','video/quicktime'];
const ACCEPTED_MEDIA_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];
const ACCEPTED_MEDIA_ACCEPT = ACCEPTED_MEDIA_TYPES.join(',');

/* ---- HTML ESCAPING ---- */

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---- REF RESOLUTION ---- */

// Consolidated from 4+ duplicated patterns scattered across app.js.
function resolveRef(storeName, id) {
  return state.refs?.[storeName]?.[id] ?? null;
}

function resolveRefName(storeName, id) {
  return resolveRef(storeName, id)?.name ?? '';
}

/* ---- SORTING ---- */

// Case-insensitive alphabetical comparator for items with a name field.
// Used by list views and child sections to ensure consistent A→Z display.
const sortByName = (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });

/* ---- FIELD / ENTITY HELPERS ---- */

function getEffectiveFields(type, item) {
  const cfg           = ENTITY[type];
  const base          = cfg.fields || [];
  const proto         = cfg.protocolFields?.[item?.networkType] || [];
  const classF        = cfg.classFields?.[item?.assetClass] || [];
  const subclassF     = cfg.subclassFields?.[item?.assetSubclass] || [];
  const cardTypeF     = cfg.cardTypeFields?.[item?.cardType] || [];
  const linkedNetType = state.refs?.networks?.[item?.networkId]?.networkType;
  const networkTypeF  = type === 'assets' ? (cfg.networkTypeFields?.[linkedNetType] || []) : [];
  return [...base, ...proto, ...classF, ...subclassF, ...cardTypeF, ...networkTypeF];
}

function itemTables(type, item) {
  const cfg = ENTITY[type];
  return [
    ...(cfg.itemTables || []),
    ...(cfg.classItemTables?.[item?.assetClass] || []),
  ];
}

function isManagedSwitch(assetClass, subclass) {
  return assetClass === 'Network Switch' && (subclass === 'Managed' || subclass === 'Router');
}

// Returns the networkTypeFields config for the network with the given id.
function getNetworkAddrFields(networkId) {
  const net = state.refs.networks?.[networkId];
  return ENTITY.assets.networkTypeFields?.[net?.networkType] || [];
}

function getIpPrefix(ipRange) {
  if (!ipRange) return '';
  const parts = ipRange.split('/')[0].split('.');
  return parts.length >= 3 ? parts.slice(0, 3).join('.') + '.' : '';
}

/* ---- COMPLETENESS ---- */

const COMPLETION_THRESHOLD = 75;

function completenessColor(pct) {
  return pct >= COMPLETION_THRESHOLD ? 'var(--success)' : 'var(--danger)';
}

function calcCompleteness(type, item) {
  const cfg = ENTITY[type];
  let total = 0, filled = 0;
  for (const f of getEffectiveFields(type, item)) {
    if (f.type === 'assign-type' || f.type === 'assign-id') continue; // UI-only; exclude from score
    total++;
    const val = item[f.key];
    if (val !== undefined && val !== null && String(val).trim() !== '') filled++;
  }
  if (cfg.requiredPhotoSlots) {
    for (const slot of cfg.requiredPhotoSlots) {
      total++;
      const sv = item.namedPhotos?.[slot];
      if (Array.isArray(sv) ? sv.length > 0 : !!sv) filled++;
    }
  }
  for (const t of itemTables(type, item)) {
    total++;
    if ((item[t.key] || []).some(r => r.terminal || r.label)) filled++;
  }
  return total === 0 ? 100 : Math.round((filled / total) * 100);
}

function calcAreaCompleteness(area) {
  const panelItems = (state.cache.panels || []).filter(p => p.areaId === area.id);
  const panelIds = new Set(panelItems.map(p => p.id));
  const allItems = [
    ...panelItems.map(p => ({ type: 'panels', item: p })),
    ...(state.cache.power    || []).filter(p => panelIds.has(p.panelId)).map(p => ({ type: 'power',    item: p })),
    ...(state.cache.safety   || []).filter(s => panelIds.has(s.panelId)).map(s => ({ type: 'safety',   item: s })),
    ...(state.cache.networks || []).filter(n => n.assignedToType === 'Area' && n.assignedToId === area.id).map(n => ({ type: 'networks', item: n })),
    ...(state.cache.assets   || []).filter(a => panelIds.has(a.panelId)).map(a => ({ type: 'assets',   item: a })),
  ];
  if (!allItems.length) return 0;
  return Math.round(allItems.reduce((sum, { type, item }) => sum + calcCompleteness(type, item), 0) / allItems.length);
}

function calcPanelDevicesCompleteness(panelId) {
  const allItems = [
    ...(state.cache.power    || []).filter(p => p.panelId === panelId).map(p => ({ type: 'power',    item: p })),
    ...(state.cache.safety   || []).filter(s => s.panelId === panelId).map(s => ({ type: 'safety',   item: s })),
    ...(state.cache.networks || []).filter(n => n.assignedToType === 'Panel' && n.assignedToId === panelId).map(n => ({ type: 'networks', item: n })),
    ...(state.cache.assets   || []).filter(a => a.panelId === panelId).map(a => ({ type: 'assets',   item: a })),
  ];
  if (!allItems.length) return null;
  return Math.round(allItems.reduce((sum, { type, item }) => sum + calcCompleteness(type, item), 0) / allItems.length);
}

function buildDetailCompletenessHtml(type, item) {
  if (type === 'areas') {
    const pct = calcAreaCompleteness(item);
    const color = completenessColor(pct);
    return `
      <div class="det-card det-completeness-card">
        <div class="det-completeness-row">
          <span class="det-completeness-label">Area Completeness</span>
          <span class="det-completeness-pct" style="color:${color}">${pct}%</span>
        </div>
        <div class="det-progress-wrap"><div class="det-progress-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
  }
  if (type === 'panels') {
    const panelPct = calcCompleteness('panels', item);
    const panelColor = completenessColor(panelPct);
    const devPct = calcPanelDevicesCompleteness(item.id);
    const devColor = devPct !== null ? completenessColor(devPct) : 'var(--muted)';
    const devRow = devPct !== null
      ? `<div class="det-completeness-row" style="margin-top:12px">
           <span class="det-completeness-label">Devices</span>
           <span class="det-completeness-pct" style="color:${devColor}">${devPct}%</span>
         </div>
         <div class="det-progress-wrap"><div class="det-progress-fill" style="width:${devPct}%;background:${devColor}"></div></div>`
      : `<div class="det-completeness-row" style="margin-top:12px">
           <span class="det-completeness-label">Devices</span>
           <span style="font-size:13px;color:var(--muted)">None assigned</span>
         </div>`;
    return `
      <div class="det-card det-completeness-card">
        <div class="det-completeness-row">
          <span class="det-completeness-label">Panel</span>
          <span class="det-completeness-pct" style="color:${panelColor}">${panelPct}%</span>
        </div>
        <div class="det-progress-wrap"><div class="det-progress-fill" style="width:${panelPct}%;background:${panelColor}"></div></div>
        ${devRow}
      </div>`;
  }
  const pct = calcCompleteness(type, item);
  const color = completenessColor(pct);
  return `
    <div class="det-card det-completeness-card">
      <div class="det-completeness-row">
        <span class="det-completeness-label">Completeness</span>
        <span class="det-completeness-pct" style="color:${color}">${pct}%</span>
      </div>
      <div class="det-progress-wrap"><div class="det-progress-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
}

function calcChecklistAutoItems() {
  const items = [];
  for (const [type, cfg] of Object.entries(ENTITY)) {
    if (type === 'assets' || type === 'areas') continue;
    const all = state.cache[type] || [];
    if (!all.length) continue;
    const done = all.filter(i => calcCompleteness(type, i) >= COMPLETION_THRESHOLD).length;
    items.push({ key: type, label: cfg.plural, done, total: all.length });
  }
  const assetClassOptions = ENTITY.assets.fields.find(f => f.key === 'assetClass').options;
  const allAssets = state.cache.assets || [];
  const subItems = [];
  for (const cls of assetClassOptions) {
    const clsItems = allAssets.filter(a => a.assetClass === cls);
    if (!clsItems.length) continue;
    const done = clsItems.filter(a => calcCompleteness('assets', a) >= COMPLETION_THRESHOLD).length;
    subItems.push({ key: `asset-${cls}`, label: cls, done, total: clsItems.length });
  }
  if (subItems.length) {
    const totalDone = subItems.reduce((s, i) => s + i.done, 0);
    const totalAll  = subItems.reduce((s, i) => s + i.total, 0);
    items.push({ key: 'assets', label: ENTITY.assets.plural, done: totalDone, total: totalAll, subItems });
  }
  return items;
}

/* ---- ENTITY ICONS ---- */

function entityIcon(type, size = 22) {
  const icons = {
    areas:    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    panels:   `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    power:    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    safety:   `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    networks: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="6" rx="1"/><rect x="1" y="16" width="6" height="6" rx="1"/><rect x="17" y="16" width="6" height="6" rx="1"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="4" y1="16" x2="12" y2="14"/><line x1="20" y1="16" x2="12" y2="14"/></svg>`,
    assets:   `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
  };
  return icons[type] || '';
}

/* ---- MEDIA PROCESSING ---- */

// Validates file type and returns { blob, mimeType }.
// Images are resized to max 1400px and re-encoded as JPEG blobs.
// Throws a user-readable Error for unsupported types.
async function processMediaFile(file) {
  if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
    throw new Error(
      `Unsupported file: ${file.name} (${file.type || 'unknown type'})\n` +
      `Accepted images: JPEG, PNG, WebP\nAccepted videos: MP4, MOV`
    );
  }
  if (ACCEPTED_VIDEO_TYPES.includes(file.type)) {
    return { blob: file, mimeType: file.type };
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const maxPx = 1400;
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => resolve({ blob, mimeType: 'image/jpeg' }), 'image/jpeg', 0.82);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Converts a legacy base64 data URL to a { blob, mimeType } media item.
function base64ToMediaItem(dataUrl) {
  const [header, b64] = dataUrl.split(',');
  const mimeType = (header.match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return { blob: new Blob([arr], { type: mimeType }), mimeType };
}

/* ---- OBJECT URL LIFECYCLE ---- */

const _mediaUrls = [];

// Creates and tracks a blob object URL. Call revokeAllMediaUrls() when done.
// If mediaItem has a _legacySrc (base64 string), returns it directly without creating a URL.
function createMediaUrl(mediaItem) {
  if (mediaItem._legacySrc) return mediaItem._legacySrc;
  const url = URL.createObjectURL(mediaItem.blob);
  _mediaUrls.push(url);
  return url;
}

function revokeAllMediaUrls() {
  _mediaUrls.forEach(u => URL.revokeObjectURL(u));
  _mediaUrls.length = 0;
}

// Returns a displayable src string for use in card thumbnail <img> elements.
// Handles legacy base64 strings, new {blob,mimeType} items, and arrays (namedPhotos slots).
// Object URLs created here are untracked — acceptable for short-lived card list renders.
function getCardThumbSrc(mediaValue) {
  const item = Array.isArray(mediaValue) ? mediaValue[0] : mediaValue;
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (item._legacySrc) return item._legacySrc;
  if (item.mimeType?.startsWith('video/')) return null;
  return URL.createObjectURL(item.blob);
}

// Normalises a stored media value into Array<{blob,mimeType}>.
// Handles: undefined, legacy base64 string, single blob item, or array of either.
function normalizeMediaItems(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.map(x => (typeof x === 'string' ? { _legacySrc: x, mimeType: 'image/jpeg' } : x));
}

/* ---- LIGHTBOX ---- */

// Opens a fullscreen lightbox for an image or video media item.
// Accepts { blob, mimeType } or a legacy { _legacySrc } item.
function openMediaLightbox(mediaItem) {
  let lb = document.querySelector('.lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.className = 'lightbox';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'lightbox-close';
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => _closeLightbox(lb);
    lb.onclick = e => { if (e.target === lb) _closeLightbox(lb); };
    lb.appendChild(closeBtn);
    document.querySelector('#app').appendChild(lb);
  }
  lb.querySelectorAll('img, video').forEach(el => el.remove());

  const src = createMediaUrl(mediaItem);
  const isVideo = mediaItem.mimeType?.startsWith('video/');
  if (isVideo) {
    const video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.autoplay = true;
    lb.insertBefore(video, lb.firstChild);
  } else {
    const img = document.createElement('img');
    img.src = src;
    lb.insertBefore(img, lb.firstChild);
  }
  lb.classList.add('open');
}

function _closeLightbox(lb) {
  const video = lb.querySelector('video');
  if (video) video.pause();
  lb.remove();
}
