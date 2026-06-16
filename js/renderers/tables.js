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
  if (isVideo) {
    media.muted = true;
    media.preload = 'metadata';
    media.addEventListener('loadedmetadata', () => { media.currentTime = 0.001; });
  }
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

// Shared core: renders media thumbs into containerEl.
// emptyHtml: markup shown when readonly and no items. uploadLabel: upload button text.
function _renderMediaItems(containerEl, mediaItems, { onAdd, onRemove, readonly, emptyHtml, uploadLabel } = {}) {
  // Revoke and untrack blob URLs from the outgoing thumbs before clearing the container.
  // Without this, every reGallery()/reSlot() re-render adds new URLs to the shared pool
  // while the old ones stay live. iOS Safari (and some other engines) impose a per-page
  // cap on blob URLs; once hit, URL.createObjectURL() starts returning unusable URLs and
  // all subsequent thumbnails render as broken images.
  containerEl.querySelectorAll('img[src^="blob:"], video[src^="blob:"]').forEach(el => {
    revokeTrackedMediaUrl(el.src);
  });
  containerEl.innerHTML = '';
  if (!mediaItems.length && readonly) {
    containerEl.innerHTML = emptyHtml;
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
    if (uploadLabel) upload.querySelector('span').textContent = uploadLabel;
    containerEl.appendChild(upload);
  }
}

// Renders a scrollable grid of media thumbs into containerEl.
// readonly: hides upload button; onAdd(items)/onRemove(index): mutation callbacks.
function renderMediaGallery(containerEl, mediaItems, { onAdd, onRemove, readonly } = {}) {
  _renderMediaItems(containerEl, mediaItems, {
    onAdd, onRemove, readonly,
    emptyHtml: `<div style="color:var(--muted);font-size:14px;padding:4px 0">No media added.</div>`,
    uploadLabel: 'Tap to add media',
  });
}

// Renders media items for one named slot into containerEl.
// readonly: hides upload button; onAdd(items)/onRemove(index): mutation callbacks.
function renderMediaSlot(containerEl, slotName, mediaItems, { onAdd, onRemove, readonly } = {}) {
  _renderMediaItems(containerEl, mediaItems, {
    onAdd, onRemove, readonly,
    emptyHtml: `<div class="named-photo-det-empty">Not captured</div>`,
  });
}

/* ---- SHARED: NETWORK ADDRESS FIELD BUILDER ---- */

/**
 * Builds the HTML string for network-type-specific address fields (IP address,
 * node address, protocol, subnet mask, gateway, etc.) for a single network-connection row.
 *
 * The fields rendered depend on the protocol of the selected network:
 *   Ethernet     → Protocol, IP Address, Subnet Mask, Gateway
 *   ControlNet / DeviceNet / DH+ / Remote-IO / Serial → Node Address (+ type-specific options)
 *
 * This helper is shared between renderSwitchNetworksTable and renderNetworkPortsTable
 * so field definitions and rendering logic live in exactly one place (DRY).
 *
 * @param {Object} row       - Data row; existing field values are read as row[f.key]
 * @param {string} networkId - ID of the currently selected network
 * @param {number} idx       - Row index; embedded as data-idx on every generated element
 * @returns {string} HTML fragment; empty string when no address fields apply to this network type
 */
function buildNetworkAddrFieldsHtml(row, networkId, idx) {
  const net    = state.refs.networks?.[networkId];
  const fields = getNetworkAddrFields(networkId); // utils.js — resolves network type → field defs
  return fields.map(f => {
    let val = row[f.key] || '';
    // Pre-fill the IP address prefix from the network's configured range when the field is empty
    if (!val && f.key === 'ipAddress') val = getIpPrefix(net?.ipRange) || '';
    if (f.type === 'enum') {
      return `<select class="f-select sn-addr" data-idx="${idx}" data-key="${f.key}">
        <option value="">— ${esc(f.label)} —</option>
        ${(f.options || []).map(o => `<option value="${o}"${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('')}
      </select>`;
    }
    return `<input class="f-input sn-addr" type="text" placeholder="${esc(f.label)}" data-idx="${idx}" data-key="${f.key}" value="${esc(val)}">`;
  }).join('');
}

/* ---- SWITCH NETWORKS TABLE ---- */

/**
 * Renders the editable switch-network-connections table into a DOM container.
 *
 * Supports two calling conventions — backwards-compatible via default parameters:
 *   renderSwitchNetworksTable()
 *     → form mode: uses state.formSwitchNetworks/Ports, container id='switch-networks-container'
 *   renderSwitchNetworksTable(containerId, networks, ports, rerender, onDirty, assetSubclass)
 *     → detail mode: uses provided arrays, custom container id, and closure for re-rendering both tables
 *
 * @param {string}   containerId   - DOM id of the container element
 * @param {Array}    networks      - Mutable array of network row objects
 * @param {Array}    ports         - Mutable array of port row objects (cross-referenced)
 * @param {Function} rerender      - Callback that re-renders both switch tables; null in form mode
 * @param {Function} onDirty       - Called whenever data changes; null in form mode
 * @param {string}   assetSubclass - Asset subclass string used for Router-max-2 enforcement
 */
function renderSwitchNetworksTable(
  containerId   = 'switch-networks-container',
  networks      = state.formSwitchNetworks,
  ports         = state.formSwitchPorts,
  rerender      = null,
  onDirty       = null,
  assetSubclass = null
) {
  const container = $(containerId);
  if (!container) return;
  const rows = networks;
  const takenNetIds = new Set(rows.map(r => r.networkId).filter(Boolean));
  const makeNetOpts = (selectedId) =>
    (state.cache.networks || [])
      .filter(n => n.networkType === 'Ethernet' && (!takenNetIds.has(n.id) || n.id === selectedId))
      .map(n => `<option value="${n.id}"${n.id === selectedId ? ' selected' : ''}>${esc(n.name)}</option>`).join('');
  const rmIcon = ICON_RM;

  // Router subclass may only have 2 network connections — resolve subclass from param or form
  const resolvedSubclass = assetSubclass ?? $('f-assetSubclass')?.value;
  const isRouter    = resolvedSubclass === 'Router';
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
      ${buildNetworkAddrFieldsHtml(r, r.networkId, i)}
    </div>`).join('');
  if (!atRouterMax) html += `<button type="button" class="wiring-add-btn sn-add">+ Add Network</button>`;
  container.innerHTML = html;

  // Helper: trigger a full re-render of both tables (detail mode uses closure; form mode calls directly)
  const doRerender = () => rerender ? rerender() : (renderSwitchNetworksTable(), renderSwitchPortsTable());

  container.querySelectorAll('.sn-network').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx  = +sel.dataset.idx;
      // Clear address fields when network changes — they are network-specific
      const keys = Object.keys(networks[idx]).filter(k => k !== 'networkId');
      keys.forEach(k => delete networks[idx][k]);
      networks[idx].networkId = sel.value;
      onDirty?.();
      doRerender();
    });
  });

  container.querySelectorAll('.sn-addr').forEach(addrEl => {
    const ev = addrEl.tagName === 'SELECT' ? 'change' : 'input';
    addrEl.addEventListener(ev, () => {
      networks[+addrEl.dataset.idx][addrEl.dataset.key] = addrEl.value;
      onDirty?.();
    });
  });

  container.querySelectorAll('.sn-rm').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const removedNetId = networks[+btn.dataset.idx].networkId;
      networks.splice(+btn.dataset.idx, 1);
      // Clear ports that referenced the removed network
      if (removedNetId) {
        ports.forEach(p => { if (p.networkId === removedNetId) p.networkId = ''; });
      }
      onDirty?.();
      doRerender();
    });
  });

  container.querySelector('.sn-add')?.addEventListener('click', () => {
    networks.push({ networkId: '' });
    onDirty?.();
    doRerender();
  });

  // Re-render ports table to keep it in sync with network list changes
  if (rerender) {
    // In detail mode the rerender closure already handles ports; skip to avoid double render
  } else {
    renderSwitchPortsTable();
  }
}

/* ---- SWITCH PORTS TABLE ---- */

/**
 * Renders the editable switch-port-assignment table into a DOM container.
 *
 * Supports two calling conventions — backwards-compatible via default parameters:
 *   renderSwitchPortsTable()
 *     → form mode: uses state.formSwitchNetworks/Ports, container id='switch-ports-container'
 *   renderSwitchPortsTable(containerId, networks, ports, rerender, onDirty, selfId)
 *     → detail mode: uses provided arrays, custom container, closure for re-render
 *
 * @param {string}   containerId - DOM id of the container element
 * @param {Array}    networks    - Network rows (read-only reference for option lists)
 * @param {Array}    ports       - Mutable array of port row objects
 * @param {Function} rerender    - Re-render callback (detail mode); null in form mode
 * @param {Function} onDirty     - Called on any data change; null in form mode
 * @param {string}   selfId      - Entity id to exclude from device options (the switch itself)
 */
function renderSwitchPortsTable(
  containerId = 'switch-ports-container',
  networks    = state.formSwitchNetworks,
  ports       = state.formSwitchPorts,
  rerender    = null,
  onDirty     = null,
  selfId      = null
) {
  const container = $(containerId);
  if (!container) return;
  const rows   = ports;
  const rmIcon = ICON_RM;

  // Resolve the entity to exclude from device options
  const excludeId = selfId ?? state.formId;

  const assignedNetIds = new Set(networks.map(r => r.networkId).filter(Boolean));
  const assignedNets   = (state.cache.networks || []).filter(n => assignedNetIds.has(n.id));

  const makeNetOpts = (selectedId) =>
    assignedNets.map(n =>
      `<option value="${n.id}"${n.id === selectedId ? ' selected' : ''}>${esc(n.name)}</option>`
    ).join('');

  const makeDeviceOpts = (networkId, selectedId) => {
    const opts = [];
    for (const a of (state.cache.assets || [])) {
      if (a.id === excludeId) continue;
      if (a.assetClass === 'PLC') {
        const matchingSlots = (a.slots || []).filter(s =>
          CARD_TYPE_NET_TYPES.has(s.cardType) &&
          state.refs.networks?.[s.networkId]?.networkType === 'Ethernet' &&
          (!networkId || s.networkId === networkId)
        );
        for (const s of matchingSlots) {
          const val   = `${a.id}|${s.slotNumber}`;
          const label = `${a.name} — Slot ${s.slotNumber}${s.name ? ` (${s.name})` : ''}`;
          opts.push(`<option value="${val}"${val === selectedId ? ' selected' : ''}>${esc(label)}</option>`);
        }
      } else {
        const assetNet = state.refs.networks?.[a.networkId];
        if (!assetNet || assetNet.networkType !== 'Ethernet') continue;
        if (networkId && a.networkId !== networkId) continue;
        opts.push(`<option value="${a.id}"${a.id === selectedId ? ' selected' : ''}>${esc(a.name)}</option>`);
      }
    }
    return opts.join('');
  };

  let html = rows.map((r, i) => {
    const selId = (r.assetId && r.slotNumber != null) ? `${r.assetId}|${r.slotNumber}` : r.assetId;
    return `
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
        ${makeDeviceOpts(r.networkId, selId)}
      </select>
    </div>`;
  }).join('');
  html += `<button type="button" class="wiring-add-btn sp-add">+ Add Port</button>`;
  container.innerHTML = html;

  // Helper: re-render ports table (detail mode uses closure; form mode calls directly)
  const doRerender = () => rerender ? rerender() : renderSwitchPortsTable();

  container.querySelectorAll('.sp-port').forEach(inp => {
    inp.addEventListener('change', () => {
      ports[+inp.dataset.idx].portName = inp.value;
      onDirty?.();
    });
  });

  container.querySelectorAll('.sp-network').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx      = +sel.dataset.idx;
      const newNetId = sel.value;
      const p        = ports[idx];
      // Clear the device selection when network changes and it no longer matches
      if (p.assetId) {
        const asset = state.refs.assets?.[p.assetId];
        if (asset?.assetClass === 'PLC') {
          const slot = asset.slots?.find(s => s.slotNumber === p.slotNumber);
          if (slot?.networkId && slot.networkId !== newNetId) {
            p.assetId    = '';
            p.slotNumber = null;
          }
        } else if (asset?.networkId && asset.networkId !== newNetId) {
          p.assetId = '';
        }
      }
      p.networkId = newNetId;
      onDirty?.();
      // Update device dropdown in-place without full re-render for snappier UX
      const row       = container.querySelectorAll('.sp-port-row')[idx];
      const deviceSel = row?.querySelector('.sp-device');
      if (deviceSel) {
        const selId = (p.assetId && p.slotNumber != null) ? `${p.assetId}|${p.slotNumber}` : p.assetId;
        deviceSel.innerHTML = `<option value="">— No Connection —</option>${makeDeviceOpts(newNetId, selId)}`;
      }
    });
  });

  container.querySelectorAll('.sp-device').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = +sel.dataset.idx;
      const val = sel.value;
      const sep = val.indexOf('|');
      if (sep !== -1) {
        ports[idx].assetId    = val.slice(0, sep);
        ports[idx].slotNumber = +val.slice(sep + 1);
      } else {
        ports[idx].assetId    = val;
        ports[idx].slotNumber = null;
      }
      onDirty?.();
    });
  });

  container.querySelectorAll('.sp-rm').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      ports.splice(+btn.dataset.idx, 1);
      onDirty?.();
      doRerender();
    });
  });

  container.querySelector('.sp-add')?.addEventListener('click', () => {
    const num = ports.length + 1;
    ports.push({ portName: `Port ${num}`, networkId: '', assetId: '', slotNumber: null });
    onDirty?.();
    doRerender();
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
          <input  class="f-input io-tag" type="text" placeholder="Description" value="${esc(r.label || '')}" data-idx="${i}" data-field="label">
        </div>`;
    }
    return `
      <div class="wiring-form-row io-point-row">
        <span class="io-point-num">${i}</span>
        <input class="f-input io-tag" type="text" placeholder="Description" value="${esc(r.label || '')}" data-idx="${i}" data-field="label">
      </div>`;
  }).join('');

  container.innerHTML = rows.length
    ? `<div class="io-point-header">
        <span class="io-point-num">IO Point</span>
        ${isAnalog ? '<span>Signal Type</span><span>Wiring Type</span>' : ''}
        <span>Description</span>
       </div>${rowsHtml}`
    : '<div style="font-size:14px;color:var(--muted);padding:8px 0">Set IO Point Count to populate rows.</div>';

  container.querySelectorAll('.io-point-row input, .io-point-row select').forEach(el => {
    el.addEventListener('change', () => {
      state.formIoPoints[Number(el.dataset.idx)][el.dataset.field] = el.value;
    });
  });
}

/* ---- POWER BUS TABLE ---- */

/**
 * Renders the power bus editor into a container element.
 *
 * @param {string}   containerId - DOM id of the target container (default: form's container)
 * @param {Array}    powerBus    - Mutable array of power-bus entries to read/write
 * @param {Function} rerender    - Called after any mutation to re-render both the table;
 *                                 pass null to default to calling renderPowerBusTable()
 * @param {Function} onDirty     - Called after any mutation so callers can set dirty flags
 *
 * Existing call sites in form.js pass no arguments and continue to work unchanged
 * (defaults point to the form's container and state.formPowerBus).
 */
function renderPowerBusTable(
  containerId = 'power-bus-container',
  powerBus    = state.formPowerBus,
  rerender    = null,
  onDirty     = null
) {
  const container = $(containerId);
  if (!container) return;
  const rmIcon = ICON_RM;

  // Re-render closure: if a custom rerender was provided use it, otherwise
  // fall back to a bare no-arg call (backwards-compat with form usage).
  const doRerender = rerender ?? (() => renderPowerBusTable(containerId, powerBus, rerender, onDirty));

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

  container.innerHTML = powerBus.map((entry, i) => `
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
      powerBus[+sel.dataset.idx].type  = sel.value;
      powerBus[+sel.dataset.idx].refId = '';
      onDirty?.();
      doRerender();
    });
  });
  container.querySelectorAll('.pb-device').forEach(sel => {
    sel.addEventListener('change', () => {
      powerBus[+sel.dataset.idx].refId = sel.value;
      onDirty?.();
    });
  });
  container.querySelectorAll('.pb-wiring-row input').forEach(input => {
    input.addEventListener('change', () => {
      powerBus[+input.dataset.entry].wiring[+input.dataset.widx][input.dataset.field] = input.value;
      onDirty?.();
    });
  });
  container.querySelectorAll('.wiring-rm-btn[data-widx]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      powerBus[+btn.dataset.entry].wiring.splice(+btn.dataset.widx, 1);
      onDirty?.();
      doRerender();
    });
  });
  container.querySelectorAll('.pb-wrow-add').forEach(btn => {
    btn.addEventListener('click', () => {
      powerBus[+btn.dataset.entry].wiring.push({ terminal: '', label: '' });
      onDirty?.();
      doRerender();
    });
  });
  container.querySelectorAll('.pb-entry-rm').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      powerBus.splice(+btn.dataset.idx, 1);
      onDirty?.();
      doRerender();
    });
  });
  container.querySelector('.pb-add')?.addEventListener('click', () => {
    powerBus.push({ type: 'Power', refId: '', wiring: [] });
    onDirty?.();
    doRerender();
  });
}

/* ---- NETWORK PORTS TABLE ---- */

/**
 * Renders an editable list of network ports into a container element.
 * Each port has a display-only port number and a network assignment dropdown.
 *
 * User interaction mirrors the Power Bus section: a "+ Add Port" button appends
 * entries and each row has a remove button — the same wiring-add-btn / wiring-rm-btn
 * CSS classes are used so styling is consistent.
 *
 * Each port shows a stable port-number label, a network dropdown, and dynamic address
 * fields (IP address, node address, protocol, etc.) that match the selected network's
 * protocol. Address fields are rendered by the shared buildNetworkAddrFieldsHtml() helper
 * so field definitions stay in one place (DRY with switch-network rows).
 *
 * Port numbers are assigned at creation time (1-based ordinal) and are NOT
 * re-sequenced when a middle port is deleted — they serve as stable labels.
 *
 * Port data shape: { portNumber, networkId, ...addressFields } — address keys are dynamic
 * and depend on the selected network's protocol. Old saves without address fields remain valid.
 *
 * Form mode (no args): uses 'network-ports-container' and state.formSlotNetworkPorts.
 * Detail mode: pass all four args explicitly.
 *
 * @param {string}   containerId - DOM id of the target container
 * @param {Array}    ports       - Mutable array of { portNumber, networkId, ...addrFields }
 * @param {Function} rerender    - Called after structural changes (add/remove); defaults to self
 * @param {Function} onDirty     - Called after any mutation so callers can set dirty flags
 */
function renderNetworkPortsTable(
  containerId = 'network-ports-container',
  ports       = state.formSlotNetworkPorts,
  rerender    = null,
  onDirty     = null
) {
  const container = $(containerId);
  if (!container) return;

  // Self-referencing closure so add/remove/network-change can trigger a full re-render
  const doRerender = rerender ?? (() => renderNetworkPortsTable(containerId, ports, rerender, onDirty));

  // All network types are offered — Controller/Communication cards can use any protocol
  const makeNetOpts = (selectedId) =>
    (state.cache.networks || [])
      .map(n => `<option value="${esc(n.id)}"${n.id === selectedId ? ' selected' : ''}>${esc(n.name)}</option>`)
      .join('');

  container.innerHTML = ports.map((port, i) => `
    <div class="sn-network-row np-port-row" data-np-idx="${i}">
      <div class="sn-network-row-top">
        <span class="np-port-label">Port ${port.portNumber || i + 1}</span>
        <button type="button" class="wiring-rm-btn np-port-rm" data-idx="${i}" aria-label="Remove port">${ICON_RM}</button>
      </div>
      <select class="f-select np-network" data-idx="${i}">
        <option value="">— Select Network —</option>
        ${makeNetOpts(port.networkId)}
      </select>
      ${buildNetworkAddrFieldsHtml(port, port.networkId, i)}
    </div>`).join('') +
    `<button type="button" class="wiring-add-btn np-add">+ Add Port</button>`;

  // Network change — clear protocol-specific address fields then update networkId and re-render
  // so the correct address fields for the newly selected network are shown
  container.querySelectorAll('.np-network').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = +sel.dataset.idx;
      Object.keys(ports[idx]).filter(k => k !== 'networkId' && k !== 'portNumber')
            .forEach(k => delete ports[idx][k]);
      ports[idx].networkId = sel.value;
      onDirty?.();
      doRerender();
    });
  });

  // Address field input — write the keyed value directly into the port object (no re-render needed)
  container.querySelectorAll('.sn-addr').forEach(el => {
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      ports[+el.dataset.idx][el.dataset.key] = el.value;
      onDirty?.();
    });
  });

  // Remove port — splice entry, notify dirty, re-render
  container.querySelectorAll('.np-port-rm').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      ports.splice(+btn.dataset.idx, 1);
      onDirty?.();
      doRerender();
    });
  });

  // Add port — assign next stable ordinal (never re-sequences existing port numbers), re-render
  container.querySelector('.np-add')?.addEventListener('click', () => {
    const nextNum = ports.length > 0 ? Math.max(...ports.map(p => p.portNumber || 0)) + 1 : 1;
    ports.push({ portNumber: nextNum, networkId: '' });
    onDirty?.();
    doRerender();
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
  // Form mode — no opts needed; defaults pick state.formItemTables and wiring-table-{key}
  for (const t of tables) renderItemTable(t.key, t.label, t.placeholder1 || 'Terminal', t.placeholder2 || 'Label');
}

/**
 * Renders an editable terminal/label wiring table.
 *
 * Supports two calling conventions — backwards-compatible via default opts:
 *   renderItemTable(key, label, p1, p2)
 *     → form mode: uses state.formItemTables, container id='wiring-table-{key}'
 *   renderItemTable(key, label, p1, p2, { containerId, tablesState })
 *     → detail mode: uses provided state object, custom container id
 *
 * @param {string} key          - Table key (e.g. 'inputWiring')
 * @param {string} label        - Human-readable table label (used internally for re-renders)
 * @param {string} placeholder1 - Column 1 placeholder text (default 'Terminal')
 * @param {string} placeholder2 - Column 2 placeholder text (default 'Label')
 * @param {object} opts
 * @param {string}   opts.containerId  - DOM element id; defaults to wiring-table-{key}
 * @param {object}   opts.tablesState  - Object with rows at [key]; defaults to state.formItemTables
 * @param {Function} opts.onDirty      - Called after any mutation (add/remove/edit) so callers
 *                                       can set dirty flags; only used in detail mode — defaults to null
 */
function renderItemTable(key, label, placeholder1 = 'Terminal', placeholder2 = 'Label', opts = {}) {
  const { containerId = `wiring-table-${key}`, tablesState = state.formItemTables, onDirty = null } = opts;
  const container = $(containerId);
  if (!container) return;
  if (!tablesState[key]) tablesState[key] = [];
  const rows   = tablesState[key];
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
      tablesState[wkey][Number(idx)][field] = input.value;
      // Notify caller so the detail panel navigation guard fires on cell edits.
      // In form mode onDirty is null and this is a no-op.
      onDirty?.();
    });
  });
  container.querySelectorAll('.wiring-rm-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      tablesState[btn.dataset.wkey].splice(Number(btn.dataset.idx), 1);
      onDirty?.();
      // Pass opts through so detail mode keeps its container id, data source, and onDirty callback
      renderItemTable(btn.dataset.wkey, label, placeholder1, placeholder2, opts);
    });
  });
  container.querySelector('.wiring-add-btn').addEventListener('click', () => {
    tablesState[key].push({ terminal: '', label: '' });
    onDirty?.();
    renderItemTable(key, label, placeholder1, placeholder2, opts);
    const inputs = container.querySelectorAll('.wiring-terminal');
    inputs[inputs.length - 1]?.focus();
  });
}
