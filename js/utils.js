/* ============================================================
   UTILITIES
   Pure helper functions with no side effects beyond what they
   explicitly return or render. Depends on: state, ENTITY.
   ============================================================ */

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

function getIpPrefix(ipRange) {
  if (!ipRange) return '';
  const parts = ipRange.split('/')[0].split('.');
  return parts.length >= 3 ? parts.slice(0, 3).join('.') + '.' : '';
}

/* ---- COMPLETENESS ---- */

function calcCompleteness(type, item) {
  const cfg = ENTITY[type];
  let total = 0, filled = 0;
  for (const f of getEffectiveFields(type, item)) {
    if (f.type === 'assign-type' || f.type === 'assign-id') continue;
    total++;
    const val = item[f.key];
    if (val !== undefined && val !== null && String(val).trim() !== '') filled++;
  }
  if (cfg.requiredPhotoSlots) {
    for (const slot of cfg.requiredPhotoSlots) {
      total++;
      if (item.namedPhotos?.[slot]) filled++;
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
    const color = pct >= 75 ? 'var(--success)' : 'var(--danger)';
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
    const panelColor = panelPct >= 75 ? 'var(--success)' : 'var(--danger)';
    const devPct = calcPanelDevicesCompleteness(item.id);
    const devColor = devPct !== null ? (devPct >= 75 ? 'var(--success)' : 'var(--danger)') : 'var(--muted)';
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
  const color = pct >= 75 ? 'var(--success)' : 'var(--danger)';
  return `
    <div class="det-card det-completeness-card">
      <div class="det-completeness-row">
        <span class="det-completeness-label">Completeness</span>
        <span class="det-completeness-pct" style="color:${color}">${pct}%</span>
      </div>
      <div class="det-progress-wrap"><div class="det-progress-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
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

/* ---- IMAGE RESIZE ---- */

function resizeImage(file, maxPx = 1400) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---- LIGHTBOX ---- */

function openLightbox(src) {
  let lb = document.querySelector('.lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.className = 'lightbox open';
    lb.innerHTML = `<img src=""><button class="lightbox-close">✕</button>`;
    lb.querySelector('.lightbox-close').onclick = () => lb.remove();
    lb.onclick = e => { if (e.target === lb) lb.remove(); };
    document.querySelector('#app').appendChild(lb);
  }
  lb.querySelector('img').src = src;
  lb.classList.add('open');
}
