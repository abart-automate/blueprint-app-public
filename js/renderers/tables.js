/* ============================================================
   TABLE & MEDIA RENDERERS
   All dynamic table UIs rendered into the form sheet.
   Depends on: state, ENTITY, esc, getIpPrefix,
               processMediaFile, createMediaUrl, openMediaLightbox (utils.js).
   ============================================================ */

/* ---- SHARED MEDIA RENDERER ---- */

const _CAMERA_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;

// Returns a .img-thumb DOM element for one media item.
// onRemove: called when ✕ clicked; onClick: called when media clicked.
function renderMediaThumb(mediaItem, { onRemove, onClick } = {}) {
  const div = document.createElement('div');
  div.className = 'img-thumb';
  const src = createMediaUrl(mediaItem);
  const isVideo = mediaItem.mimeType?.startsWith('video/');
  const media = document.createElement(isVideo ? 'video' : 'img');
  if (isVideo) media.muted = true;
  media.src = src;
  if (onClick) media.addEventListener('click', onClick);
  div.appendChild(media);
  if (onRemove) {
    const btn = document.createElement('button');
    btn.className = 'img-rm';
    btn.type = 'button';
    btn.textContent = '✕';
    btn.addEventListener('click', e => { e.stopPropagation(); onRemove(); });
    div.appendChild(btn);
  }
  return div;
}

// Private: creates a file input label that validates files via processMediaFile.
// multiple: allow multiple file selection. onFiles: called with Array<{blob,mimeType}>.
function _makeUploadInput(multiple, onFiles) {
  const label = document.createElement('label');
  label.className = 'named-photo-upload';
  label.innerHTML = `<input type="file" accept="${ACCEPTED_MEDIA_ACCEPT}"${multiple ? ' multiple' : ''}>${_CAMERA_ICON}<span>Tap to add</span>`;
  const input = label.querySelector('input');
  input.addEventListener('change', async () => {
    const files = Array.from(input.files);
    input.value = '';
    const results = [];
    for (const file of files) {
      try { results.push(await processMediaFile(file)); }
      catch (err) { showToast(err.message, 'error'); }
    }
    if (results.length) onFiles(results);
  });
  return label;
}

// Renders a scrollable grid of media thumbs into containerEl.
// readonly: hides upload button; onAdd(items)/onRemove(index): mutation callbacks.
function renderMediaGallery(containerEl, mediaItems, { onAdd, onRemove, readonly } = {}) {
  containerEl.innerHTML = '';
  if (!mediaItems.length && readonly) {
    containerEl.innerHTML = `<div style="color:var(--muted);font-size:14px;padding:4px 0">No media added.</div>`;
    return;
  }
  mediaItems.forEach((item, i) => {
    containerEl.appendChild(renderMediaThumb(item, {
      onRemove: readonly ? null : () => onRemove(i),
      onClick:  () => openMediaLightbox(item),
    }));
  });
  if (!readonly) {
    const upload = _makeUploadInput(true, onAdd);
    upload.querySelector('span').textContent = 'Tap to add media';
    containerEl.appendChild(upload);
  }
}

// Renders media items for one named slot into containerEl.
// slotName is passed for potential aria/title use by callers.
// readonly: hides upload button; onAdd(items)/onRemove(index): mutation callbacks.
function renderMediaSlot(containerEl, slotName, mediaItems, { onAdd, onRemove, readonly } = {}) {
  containerEl.innerHTML = '';
  if (!mediaItems.length && readonly) {
    containerEl.innerHTML = `<div class="named-photo-det-empty">Not captured</div>`;
    return;
  }
  mediaItems.forEach((item, i) => {
    containerEl.appendChild(renderMediaThumb(item, {
      onRemove: readonly ? null : () => onRemove(i),
      onClick:  () => openMediaLightbox(item),
    }));
  });
  if (!readonly) {
    containerEl.appendChild(_makeUploadInput(true, onAdd));
  }
}

/* ---- SWITCH NETWORKS TABLE ---- */

function renderSwitchNetworksTable() {
  const container = $('switch-networks-container');
  if (!container) return;
  const rows = state.formSwitchNetworks;
  const takenNetIds = new Set(rows.map(r => r.networkId).filter(Boolean));
  const makeNetOpts = (selectedId) =>
    (state.cache.networks || [])
      .filter(n => n.networkType === 'Ethernet' && (!takenNetIds.has(n.id) || n.id === selectedId))
      .map(n => `<option value="${n.id}"${n.id === selectedId ? ' selected' : ''}>${esc(n.name)}</option>`).join('');
  const rmIcon = ICON_RM;

  const buildAddrFields = (r, i) => {
    const net     = state.refs.networks?.[r.networkId];
    const netType = net?.networkType;
    const fields  = ENTITY.assets.networkTypeFields?.[netType] || [];
    return fields.map(f => {
      let val = r[f.key] || '';
      if (!val && f.key === 'ipAddress') val = getIpPrefix(net?.ipRange);
      if (f.type === 'enum') {
        return `<select class="f-select sn-addr" data-idx="${i}" data-key="${f.key}">
          <option value="">— ${esc(f.label)} —</option>
          ${(f.options || []).map(o => `<option value="${o}"${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('')}
        </select>`;
      }
      return `<input class="f-input sn-addr" type="text" placeholder="${esc(f.label)}" data-idx="${i}" data-key="${f.key}" value="${esc(val)}">`;
    }).join('');
  };

  const isRouter = $('f-assetSubclass')?.value === 'Router';
  const atRouterMax = isRouter && rows.length >= 2;

  let html = rows.map((r, i) => `
    <div class="sn-network-row" data-idx="${i}">
      <div class="sn-network-row-top">
        <select class="f-select sn-network" data-idx="${i}">
          <option value="">— Select Network —</option>
          ${makeNetOpts(r.networkId)}
        </select>
        <button type="button" class="wiring-rm-btn sn-rm" data-idx="${i}">${rmIcon}</button>
      </div>
      ${buildAddrFields(r, i)}
    </div>`).join('');
  if (!atRouterMax) html += `<button type="button" class="wiring-add-btn sn-add">+ Add Network</button>`;
  container.innerHTML = html;

  container.querySelectorAll('.sn-network').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = +sel.dataset.idx;
      const keys = Object.keys(state.formSwitchNetworks[idx]).filter(k => k !== 'networkId');
      keys.forEach(k => delete state.formSwitchNetworks[idx][k]);
      state.formSwitchNetworks[idx].networkId = sel.value;
      renderSwitchNetworksTable();
      renderSwitchPortsTable();
    });
  });

  container.querySelectorAll('.sn-addr').forEach(el => {
    const ev = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      state.formSwitchNetworks[+el.dataset.idx][el.dataset.key] = el.value;
    });
  });

  container.querySelectorAll('.sn-rm').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const removedNetId = state.formSwitchNetworks[+btn.dataset.idx].networkId;
      state.formSwitchNetworks.splice(+btn.dataset.idx, 1);
      if (removedNetId) {
        state.formSwitchPorts.forEach(p => { if (p.networkId === removedNetId) p.networkId = ''; });
      }
      renderSwitchNetworksTable();
    });
  });
  container.querySelector('.sn-add')?.addEventListener('click', () => {
    state.formSwitchNetworks.push({ networkId: '' });
    renderSwitchNetworksTable();
  });
  renderSwitchPortsTable();
}

/* ---- SWITCH PORTS TABLE ---- */

function renderSwitchPortsTable() {
  const container = $('switch-ports-container');
  if (!container) return;
  const rows = state.formSwitchPorts;
  const rmIcon = ICON_RM;

  const assignedNetIds = new Set(state.formSwitchNetworks.map(r => r.networkId).filter(Boolean));
  const assignedNets   = (state.cache.networks || []).filter(n => assignedNetIds.has(n.id));

  const makeNetOpts = (selectedId) =>
    assignedNets.map(n =>
      `<option value="${n.id}"${n.id === selectedId ? ' selected' : ''}>${esc(n.name)}</option>`
    ).join('');

  const selfId = state.formId;
  const makeDeviceOpts = (networkId, selectedId) =>
    (state.cache.assets || [])
      .filter(a => {
        if (a.id === selfId) return false;
        if (a.assetClass === 'PLC') {
          return (a.slots || []).some(s =>
            (s.cardType === 'Controller' || s.cardType === 'Communication') &&
            state.refs.networks?.[s.networkId]?.networkType === 'Ethernet' &&
            (!networkId || s.networkId === networkId)
          );
        }
        const assetNet = state.refs.networks?.[a.networkId];
        if (!assetNet || assetNet.networkType !== 'Ethernet') return false;
        return !networkId || a.networkId === networkId;
      })
      .map(a => {
        let label = a.name;
        if (a.assetClass === 'PLC' && networkId) {
          const matchSlot = (a.slots || []).find(s =>
            (s.cardType === 'Controller' || s.cardType === 'Communication') && s.networkId === networkId
          );
          if (matchSlot) label += ` — Slot ${matchSlot.slotNumber}${matchSlot.name ? ` (${matchSlot.name})` : ''}`;
        }
        return `<option value="${a.id}"${a.id === selectedId ? ' selected' : ''}>${esc(label)}</option>`;
      }).join('');

  let html = rows.map((r, i) => `
    <div class="sp-port-row">
      <div class="sp-port-row-top">
        <input class="f-input sp-port" type="text" placeholder="Port ${i + 1}" data-idx="${i}" value="${esc(r.portName || '')}">
        <button type="button" class="wiring-rm-btn sp-rm" data-idx="${i}">${rmIcon}</button>
      </div>
      <select class="f-select sp-network" data-idx="${i}">
        <option value="">— Network —</option>
        ${makeNetOpts(r.networkId)}
      </select>
      <select class="f-select sp-device" data-idx="${i}">
        <option value="">— No Connection —</option>
        ${makeDeviceOpts(r.networkId, r.assetId)}
      </select>
    </div>`).join('');
  html += `<button type="button" class="wiring-add-btn sp-add">+ Add Port</button>`;
  container.innerHTML = html;

  container.querySelectorAll('.sp-port').forEach(inp => {
    inp.addEventListener('change', () => {
      state.formSwitchPorts[+inp.dataset.idx].portName = inp.value;
    });
  });

  container.querySelectorAll('.sp-network').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = +sel.dataset.idx;
      const newNetId = sel.value;
      const currentAssetId = state.formSwitchPorts[idx].assetId;
      if (currentAssetId) {
        const asset = state.refs.assets?.[currentAssetId];
        if (asset?.networkId && asset.networkId !== newNetId) {
          state.formSwitchPorts[idx].assetId = '';
        }
      }
      state.formSwitchPorts[idx].networkId = newNetId;
      const row = container.querySelectorAll('.sp-port-row')[idx];
      const deviceSel = row?.querySelector('.sp-device');
      if (deviceSel) {
        deviceSel.innerHTML = `<option value="">— No Connection —</option>${makeDeviceOpts(newNetId, state.formSwitchPorts[idx].assetId)}`;
      }
    });
  });

  container.querySelectorAll('.sp-device').forEach(sel => {
    sel.addEventListener('change', () => {
      state.formSwitchPorts[+sel.dataset.idx].assetId = sel.value;
    });
  });

  container.querySelectorAll('.sp-rm').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.formSwitchPorts.splice(+btn.dataset.idx, 1);
      renderSwitchPortsTable();
    });
  });

  container.querySelector('.sp-add')?.addEventListener('click', () => {
    const num = state.formSwitchPorts.length + 1;
    state.formSwitchPorts.push({ portName: `Port ${num}`, networkId: '', assetId: '' });
    renderSwitchPortsTable();
    const inputs = container.querySelectorAll('.sp-port');
    inputs[inputs.length - 1]?.select();
  });
}

/* ---- IO POINTS TABLE ---- */

const IO_SIGNAL_OPTS = ['1-5V','0-10V','0-20mA','4-20mA','RTD','Other'];
const IO_WIRING_OPTS = ['2-Wire','3-Wire','4-Wire'];

function syncIoPointCount() {
  const count    = parseInt($('f-ioPointCount')?.value) || 0;
  const cardType = $('f-cardType')?.value;
  while (state.formIoPoints.length < count)
    state.formIoPoints.push(cardType === 'Analog'
      ? { label: 'Spare', signalType: '', wiringType: '' }
      : { label: 'Spare' });
  state.formIoPoints.length = count;
  renderIoPointsTable();
}

function renderIoPointsTable() {
  const container = $('io-points-container');
  if (!container) return;
  const rows     = state.formIoPoints;
  const isAnalog = $('f-cardType')?.value === 'Analog';
  container.classList.toggle('io-analog', isAnalog);

  const rowsHtml = rows.map((r, i) => {
    if (isAnalog) {
      const sigOpts = IO_SIGNAL_OPTS.map(o => `<option value="${o}"${r.signalType === o ? ' selected' : ''}>${o}</option>`).join('');
      const wirOpts = IO_WIRING_OPTS.map(o => `<option value="${o}"${r.wiringType === o ? ' selected' : ''}>${o}</option>`).join('');
      return `
        <div class="wiring-form-row io-point-row">
          <span class="io-point-num">${i}</span>
          <select class="f-select io-signal" data-idx="${i}" data-field="signalType"><option value=""></option>${sigOpts}</select>
          <select class="f-select io-wiring" data-idx="${i}" data-field="wiringType"><option value=""></option>${wirOpts}</select>
          <input  class="f-input io-tag" type="text" placeholder="Label" value="${esc(r.label || '')}" data-idx="${i}" data-field="label">
        </div>`;
    }
    return `
      <div class="wiring-form-row io-point-row">
        <span class="io-point-num">${i}</span>
        <input class="f-input io-tag" type="text" placeholder="Label" value="${esc(r.label || '')}" data-idx="${i}" data-field="label">
      </div>`;
  }).join('');

  container.innerHTML = rows.length
    ? `<div class="io-point-header">
        <span class="io-point-num">#</span>
        ${isAnalog ? '<span>Signal Type</span><span>Wiring Type</span>' : ''}
        <span>Label</span>
       </div>${rowsHtml}`
    : '<div style="font-size:14px;color:var(--muted);padding:8px 0">Set IO Point Count to populate rows.</div>';

  container.querySelectorAll('.io-point-row input, .io-point-row select').forEach(el => {
    el.addEventListener('change', () => {
      state.formIoPoints[Number(el.dataset.idx)][el.dataset.field] = el.value;
    });
  });
}

/* ---- POWER BUS TABLE ---- */

function renderPowerBusTable() {
  const container = $('power-bus-container');
  if (!container) return;
  const rmIcon = ICON_RM;

  const makeDeviceOpts = (type, selectedId) => {
    const store = type === 'Safety Circuit' ? 'safety' : 'power';
    return (state.cache[store] || [])
      .map(item => `<option value="${item.id}"${item.id === selectedId ? ' selected' : ''}>${esc(item.name)}</option>`)
      .join('');
  };

  const makeWiringRows = (ei, wiring) => wiring.map((w, wi) => `
    <div class="wiring-form-row pb-wiring-row">
      <input class="f-input wiring-terminal" type="text" placeholder="Terminal" value="${esc(w.terminal || '')}" data-entry="${ei}" data-widx="${wi}" data-field="terminal">
      <input class="f-input wiring-label"    type="text" placeholder="Label"    value="${esc(w.label    || '')}" data-entry="${ei}" data-widx="${wi}" data-field="label">
      <button class="wiring-rm-btn" type="button" data-entry="${ei}" data-widx="${wi}" aria-label="Remove wiring row">${rmIcon}</button>
    </div>`).join('');

  container.innerHTML = state.formPowerBus.map((entry, i) => `
    <div class="sn-network-row pb-entry" data-pb-idx="${i}">
      <div class="sn-network-row-top">
        <select class="f-select pb-type" data-idx="${i}">
          <option value="Power"${entry.type === 'Power' ? ' selected' : ''}>Power</option>
          <option value="Safety Circuit"${entry.type === 'Safety Circuit' ? ' selected' : ''}>Safety Circuit</option>
        </select>
        <button type="button" class="wiring-rm-btn pb-entry-rm" data-idx="${i}" aria-label="Remove power bus entry">${rmIcon}</button>
      </div>
      <select class="f-select pb-device" data-idx="${i}">
        <option value="">— Select Device —</option>
        ${makeDeviceOpts(entry.type, entry.refId)}
      </select>
      <div class="pb-wiring-wrap" data-entry="${i}">
        ${makeWiringRows(i, entry.wiring)}
        <button type="button" class="wiring-add-btn pb-wrow-add" data-entry="${i}">+ Add Wiring Row</button>
      </div>
    </div>`).join('') +
    `<button type="button" class="wiring-add-btn pb-add">+ Add Power Bus</button>`;

  container.querySelectorAll('.pb-type').forEach(sel => {
    sel.addEventListener('change', () => {
      state.formPowerBus[+sel.dataset.idx].type  = sel.value;
      state.formPowerBus[+sel.dataset.idx].refId = '';
      renderPowerBusTable();
    });
  });
  container.querySelectorAll('.pb-device').forEach(sel => {
    sel.addEventListener('change', () => { state.formPowerBus[+sel.dataset.idx].refId = sel.value; });
  });
  container.querySelectorAll('.pb-wiring-row input').forEach(input => {
    input.addEventListener('change', () => {
      state.formPowerBus[+input.dataset.entry].wiring[+input.dataset.widx][input.dataset.field] = input.value;
    });
  });
  container.querySelectorAll('.wiring-rm-btn[data-widx]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.formPowerBus[+btn.dataset.entry].wiring.splice(+btn.dataset.widx, 1);
      renderPowerBusTable();
    });
  });
  container.querySelectorAll('.pb-wrow-add').forEach(btn => {
    btn.addEventListener('click', () => {
      state.formPowerBus[+btn.dataset.entry].wiring.push({ terminal: '', label: '' });
      renderPowerBusTable();
    });
  });
  container.querySelectorAll('.pb-entry-rm').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.formPowerBus.splice(+btn.dataset.idx, 1);
      renderPowerBusTable();
    });
  });
  container.querySelector('.pb-add')?.addEventListener('click', () => {
    state.formPowerBus.push({ type: 'Power', refId: '', wiring: [] });
    renderPowerBusTable();
  });
}

/* ---- CLASS-SPECIFIC ITEM TABLES (wiring, parameters) ---- */

function renderClassItemTables(assetClass) {
  const tables = ENTITY.assets.classItemTables?.[assetClass] || [];
  const container = $('class-item-tables-container');
  if (!container) return;
  if (!tables.length) {
    container.innerHTML = '';
    return;
  }
  let html = '';
  for (const t of tables) {
    if (!state.formItemTables[t.key]) state.formItemTables[t.key] = [];
    html += `
      <div class="form-section-hdr">${esc(t.label)}</div>
      <div id="wiring-table-${t.key}" class="wiring-table"></div>
    `;
  }
  container.innerHTML = html;
  for (const t of tables) renderItemTable(t.key, t.label, t.placeholder1 || 'Terminal', t.placeholder2 || 'Label');
}

function renderItemTable(key, label, placeholder1 = 'Terminal', placeholder2 = 'Label') {
  const container = $(`wiring-table-${key}`);
  if (!container) return;
  const rows = state.formItemTables[key] || [];
  const rmIcon = ICON_RM;
  const rowsHtml = rows.map((r, i) => `
    <div class="wiring-form-row">
      <input class="f-input wiring-terminal" type="text" placeholder="${esc(placeholder1)}" value="${esc(r.terminal || '')}" data-wkey="${key}" data-idx="${i}" data-field="terminal">
      <input class="f-input wiring-label"    type="text" placeholder="${esc(placeholder2)}" value="${esc(r.label    || '')}" data-wkey="${key}" data-idx="${i}" data-field="label">
      <button class="wiring-rm-btn" data-wkey="${key}" data-idx="${i}" type="button" aria-label="Remove row">${rmIcon}</button>
    </div>
  `).join('');
  container.innerHTML = `
    ${rowsHtml}
    <button class="wiring-add-btn" data-wkey="${key}" type="button">+ Add Row</button>
  `;
  container.querySelectorAll('.wiring-form-row input').forEach(input => {
    input.addEventListener('change', () => {
      const { wkey, idx, field } = input.dataset;
      state.formItemTables[wkey][Number(idx)][field] = input.value;
    });
  });
  container.querySelectorAll('.wiring-rm-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.formItemTables[btn.dataset.wkey].splice(Number(btn.dataset.idx), 1);
      renderItemTable(btn.dataset.wkey, label, placeholder1, placeholder2);
    });
  });
  container.querySelector('.wiring-add-btn').addEventListener('click', () => {
    state.formItemTables[key].push({ terminal: '', label: '' });
    renderItemTable(key, label, placeholder1, placeholder2);
    const inputs = container.querySelectorAll('.wiring-terminal');
    inputs[inputs.length - 1]?.focus();
  });
}
