import type { ItemTableRow, NetworkPortRow, UntypedTableRow } from '../state.js';
import type { BlobMediaItem, NetworkPortEntry, NormalizedMediaItem } from '../utils.js';

import { CARD_TYPE_NET_TYPES, ENTITY, ICON_RM } from '../entity-config.js';
import { $, showToast, state } from '../state.js';
import { ACCEPTED_MEDIA_ACCEPT, buildNetworkOptions, createMediaUrl, esc, getEntityNetworkPorts, getIpPrefix, getNetworkAddrFields, openMediaLightbox, processMediaFile, revokeBlobUrlsInContainer } from '../utils.js';
/* ============================================================
   TABLE & MEDIA RENDERERS
   All dynamic table UIs rendered into the form sheet.
   Depends on: state, ENTITY, esc, getIpPrefix,
               processMediaFile, createMediaUrl, openMediaLightbox (utils.js).
   ============================================================ */

/* ---- SHARED MEDIA RENDERER ---- */

export const _CAMERA_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;

/**
 * Returns a .img-thumb DOM element for one media item.
 */
export function renderMediaThumb(mediaItem: NormalizedMediaItem, { onRemove, onClick }: { onRemove?: (() => void) | null, onClick?: () => void } = {}): HTMLElement {
  const div = document.createElement('div');
  div.className = 'img-thumb';
  const src = createMediaUrl(mediaItem);
  const isVideo = mediaItem.mimeType?.startsWith('video/');
  const media = document.createElement(isVideo ? 'video' : 'img') as HTMLVideoElement | HTMLImageElement;
  if (isVideo) {
    const video = media as HTMLVideoElement;
    video.muted = true;
    video.preload = 'metadata';
    video.addEventListener('loadedmetadata', () => { video.currentTime = 0.001; });
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

/**
 * Private: creates a file input label that validates files via processMediaFile.
 * @param multiple - Allow multiple file selection.
 */
export function _makeUploadInput(multiple: boolean, onFiles: (items: BlobMediaItem[]) => void): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'named-photo-upload';
  label.innerHTML = `<input type="file" accept="${ACCEPTED_MEDIA_ACCEPT}"${multiple ? ' multiple' : ''}>${_CAMERA_ICON}<span>Tap to add</span>`;
  const input = label.querySelector('input') as HTMLInputElement;
  input.addEventListener('change', async () => {
    const files = Array.from(input.files ?? []);
    input.value = '';
    const results: BlobMediaItem[] = [];
    for (const file of files) {
      try { results.push(await processMediaFile(file)); }
      catch (err) { showToast(err instanceof Error ? err.message : String(err), 'error'); }
    }
    if (results.length) onFiles(results);
  });
  return label;
}

/**
 * Shared core: renders media thumbs into containerEl.
 */
export function _renderMediaItems(
  containerEl: HTMLElement,
  mediaItems: NormalizedMediaItem[],
  { onAdd, onRemove, readonly, emptyHtml, uploadLabel }: { onAdd?: (items: BlobMediaItem[]) => void, onRemove?: (i: number) => void, readonly?: boolean, emptyHtml?: string, uploadLabel?: string } = {}
): void {
  // Revoke outgoing blob URLs before clearing — see revokeBlobUrlsInContainer() in utils.js.
  revokeBlobUrlsInContainer(containerEl);
  containerEl.innerHTML = '';
  if (!mediaItems.length && readonly) {
    containerEl.innerHTML = emptyHtml ?? '';
    return;
  }
  mediaItems.forEach((item, i) => {
    containerEl.appendChild(renderMediaThumb(item, {
      onRemove: readonly ? null : () => onRemove?.(i),
      onClick:  () => openMediaLightbox(item),
    }));
  });
  if (!readonly) {
    const upload = _makeUploadInput(true, items => onAdd?.(items));
    if (uploadLabel) {
      const span = upload.querySelector('span');
      if (span) span.textContent = uploadLabel;
    }
    containerEl.appendChild(upload);
  }
}

/**
 * Renders a scrollable grid of media thumbs into containerEl.
 */
export function renderMediaGallery(
  containerEl: HTMLElement,
  mediaItems: NormalizedMediaItem[],
  { onAdd, onRemove, readonly }: { onAdd?: (items: BlobMediaItem[]) => void, onRemove?: (i: number) => void, readonly?: boolean } = {}
): void {
  _renderMediaItems(containerEl, mediaItems, {
    onAdd, onRemove, readonly,
    emptyHtml: `<div style="color:var(--muted);font-size:14px;padding:4px 0">No media added.</div>`,
    uploadLabel: 'Tap to add media',
  });
}

/**
 * Renders media items for one named slot into containerEl.
 */
export function renderMediaSlot(
  containerEl: HTMLElement,
  slotName: string,
  mediaItems: NormalizedMediaItem[],
  { onAdd, onRemove, readonly }: { onAdd?: (items: BlobMediaItem[]) => void, onRemove?: (i: number) => void, readonly?: boolean } = {}
): void {
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
 * @param row - Data row; existing field values are read as row[f.key]
 * @param networkId - ID of the currently selected network
 * @param idx       - Row index; embedded as data-idx on every generated element
 * @returns HTML fragment; empty string when no address fields apply to this network type
 */
export function buildNetworkAddrFieldsHtml(row: Record<string, any>, networkId: string | undefined, idx: number): string {
  const net    = state.refs.networks?.[networkId ?? ''];
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
 * Shared implementation for the editable switch-network-connections table.
 * Not called directly — use renderSwitchNetworksTableForm() from the entity
 * form or renderSwitchNetworksTableDetail(...) from the detail panel, which
 * give the two calling conventions this used to share under one overloaded
 * signature separate, explicit names instead.
 *
 * @param containerId   - DOM id of the container element
 * @param networks - Mutable array of network row objects
 * @param ports    - Mutable array of port row objects (cross-referenced)
 * @param rerender - Callback that re-renders both switch tables; null in form mode
 * @param onDirty  - Called whenever data changes; null in form mode
 * @param assetSubclass - Asset subclass string used for Router-max-2 enforcement
 */
export function _renderSwitchNetworksTable(
  containerId: string,
  networks: UntypedTableRow[],
  ports: UntypedTableRow[],
  rerender: (() => void) | null,
  onDirty: (() => void) | null,
  assetSubclass: string | null | undefined
): void {
  const container = $(containerId);
  if (!container) return;
  const rows = networks;
  const takenNetIds = new Set(rows.map(r => r.networkId).filter(Boolean));
  const makeNetOpts = (selectedId: string) => buildNetworkOptions(
    selectedId,
    (state.cache.networks || []).filter(n => n.networkType === 'Ethernet' && (!takenNetIds.has(n.id) || n.id === selectedId))
  );
  const rmIcon = ICON_RM;

  // Subclass-based VLAN limits:
  //   Router    → max 2 VLANs (WAN + LAN)
  //   Unmanaged → max 1 VLAN  (single network assignment only)
  //   Managed   → unlimited
  const resolvedSubclass = assetSubclass ?? ($('f-assetSubclass') as HTMLInputElement | null)?.value;
  const isRouter       = resolvedSubclass === 'Router';
  const isUnmanaged    = resolvedSubclass === 'Unmanaged';
  const atRouterMax    = isRouter    && rows.length >= 2;
  const atUnmanagedMax = isUnmanaged && rows.length >= 1;
  const atVlanMax      = atRouterMax || atUnmanagedMax;

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
  if (!atVlanMax) html += `<button type="button" class="wiring-add-btn sn-add">+ Add Network</button>`;
  container.innerHTML = html;

  // Helper: trigger a full re-render of both tables (detail mode uses closure; form mode calls directly)
  const doRerender = rerender ?? (() => (renderSwitchNetworksTableForm(), renderSwitchPortsTableForm()));

  container.querySelectorAll('.sn-network').forEach(sel0 => {
    const sel = sel0 as HTMLSelectElement;
    sel.addEventListener('change', () => {
      const idx  = Number(sel.dataset.idx);
      // Clear address fields when network changes — they are network-specific
      const keys = Object.keys(networks[idx]).filter(k => k !== 'networkId');
      keys.forEach(k => delete networks[idx][k]);
      networks[idx].networkId = sel.value;
      // Unmanaged: cascade the VLAN change to all ports so they stay in sync with the single VLAN
      if (isUnmanaged) {
        ports.forEach(p => { p.networkId = sel.value; });
      }
      onDirty?.();
      doRerender();
    });
  });

  container.querySelectorAll('.sn-addr').forEach(addrEl0 => {
    const addrEl = addrEl0 as HTMLInputElement | HTMLSelectElement;
    const ev = addrEl.tagName === 'SELECT' ? 'change' : 'input';
    addrEl.addEventListener(ev, () => {
      networks[Number(addrEl.dataset.idx)][addrEl.dataset.key as string] = addrEl.value;
      onDirty?.();
    });
  });

  container.querySelectorAll('.sn-rm').forEach(btn0 => {
    const btn = btn0 as HTMLElement;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const removedNetId = networks[Number(btn.dataset.idx)].networkId;
      networks.splice(Number(btn.dataset.idx), 1);
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
    renderSwitchPortsTableForm();
  }
}

/** Form mode: reads/writes state.formSwitchNetworks/Ports into '#switch-networks-container'. */
export function renderSwitchNetworksTableForm(): void {
  const assetSubclass = ($('f-assetSubclass') as HTMLInputElement | null)?.value ?? null;
  _renderSwitchNetworksTable(
    'switch-networks-container',
    state.formSwitchNetworks,
    state.formSwitchPorts,
    null,
    null,
    assetSubclass
  );
}

/**
 * Detail mode: reads/writes the caller-supplied arrays into an explicit container.
 * @param rerender      - Re-renders both switch tables (required in detail mode)
 * @param onDirty       - Called whenever data changes
 * @param assetSubclass - Asset subclass string used for Router-max-2 enforcement
 */
export function renderSwitchNetworksTableDetail(
  containerId: string,
  networks: UntypedTableRow[],
  ports: UntypedTableRow[],
  rerender: () => void,
  onDirty: () => void,
  assetSubclass: string | null | undefined
): void {
  _renderSwitchNetworksTable(containerId, networks, ports, rerender, onDirty, assetSubclass);
}

/* ---- SWITCH PORTS TABLE ---- */

/**
 * Shared implementation for the editable switch-port-assignment table.
 * Not called directly — use renderSwitchPortsTableForm() from the entity
 * form or renderSwitchPortsTableDetail(...) from the detail panel.
 *
 * Unmanaged switches receive special treatment:
 *   - Ports show no per-row network picker — they are auto-assigned to the single configured VLAN
 *   - Adding a port pre-populates its networkId with that VLAN's id
 *   - Existing port rows are silently normalised to the single VLAN before render
 *
 * @param containerId   - DOM id of the container element
 * @param networks - Network rows (read-only reference for VLAN option lists)
 * @param ports    - Mutable array of port row objects
 * @param rerender - Re-render callback (detail mode); null in form mode
 * @param onDirty  - Called on any data change; null in form mode
 * @param selfId        - Entity id to exclude from device options (the switch itself)
 * @param assetSubclass - Asset subclass; drives Unmanaged auto-assignment logic
 */
export function _renderSwitchPortsTable(
  containerId: string,
  networks: UntypedTableRow[],
  ports: UntypedTableRow[],
  rerender: (() => void) | null,
  onDirty: (() => void) | null,
  selfId: string | null | undefined,
  assetSubclass: string | null | undefined
): void {
  const container = $(containerId);
  if (!container) return;
  const rows   = ports;
  const rmIcon = ICON_RM;

  // Resolve the entity to exclude from device options
  const excludeId = selfId ?? state.formId;

  // For Unmanaged: resolve the single auto-assigned VLAN id so ports can omit the network picker
  const resolvedSubclass = assetSubclass ?? ($('f-assetSubclass') as HTMLInputElement | null)?.value;
  const isUnmanaged      = resolvedSubclass === 'Unmanaged';
  const autoNetId        = isUnmanaged
    ? (networks.find(n => n.networkId)?.networkId || '')
    : null;

  // Silently normalise existing Unmanaged ports to the single VLAN before rendering.
  // This is a data normalisation step (not a user edit) so no dirty flag is set.
  if (isUnmanaged && autoNetId) {
    rows.forEach(p => { p.networkId = autoNetId; });
  }

  const assignedNetIds = new Set(networks.map(r => r.networkId).filter(Boolean));
  const assignedNets   = (state.cache.networks || []).filter(n => assignedNetIds.has(n.id));

  const makeNetOpts = (selectedId: string) => buildNetworkOptions(selectedId, assignedNets);

  const isEthernetMatch = (ports: NetworkPortEntry[], networkId: string | null) => ports.some(p =>
    state.refs.networks?.[p.networkId]?.networkType === 'Ethernet' &&
    (!networkId || p.networkId === networkId)
  );

  const makeDeviceOpts = (networkId: string | null, selectedId: string | undefined) => {
    const opts: string[] = [];
    for (const a of (state.cache.assets || [])) {
      if (a.id === excludeId) continue;
      if (a.assetClass === 'PLC') {
        const matchingSlots = ((a.slots || []) as any[]).filter(s =>
          CARD_TYPE_NET_TYPES.has(s.cardType) && isEthernetMatch(getEntityNetworkPorts(s), networkId)
        );
        for (const s of matchingSlots) {
          const val   = `${a.id}|${s.slotNumber}`;
          const label = `${a.name} — Slot ${s.slotNumber}${s.name ? ` (${s.name})` : ''}`;
          opts.push(`<option value="${val}"${val === selectedId ? ' selected' : ''}>${esc(label)}</option>`);
        }
      } else {
        if (!isEthernetMatch(getEntityNetworkPorts(a), networkId)) continue;
        opts.push(`<option value="${a.id}"${a.id === selectedId ? ' selected' : ''}>${esc(a.name)}</option>`);
      }
    }
    return opts.join('');
  };

  let html = rows.map((r, i) => {
    const selId = (r.assetId && r.slotNumber != null) ? `${r.assetId}|${r.slotNumber}` : r.assetId;
    // Unmanaged ports are auto-assigned to the single VLAN; no per-row network picker is shown.
    // Managed/Router ports show a picker so the user can assign each port to a specific VLAN.
    const effectiveNetId  = isUnmanaged ? autoNetId : r.networkId;
    const networkPickerHtml = isUnmanaged
      ? ''
      : `<select class="f-select sp-network" data-idx="${i}">
          <option value="">— Network —</option>
          ${makeNetOpts(r.networkId)}
        </select>`;
    return `
    <div class="sp-port-row">
      <div class="sp-port-row-top">
        <input class="f-input sp-port" type="text" placeholder="Port ${i + 1}" data-idx="${i}" value="${esc(r.portName || '')}">
        <button type="button" class="wiring-rm-btn sp-rm" data-idx="${i}">${rmIcon}</button>
      </div>
      ${networkPickerHtml}
      <select class="f-select sp-device" data-idx="${i}">
        <option value="">— No Connection —</option>
        ${makeDeviceOpts(effectiveNetId, selId)}
      </select>
    </div>`;
  }).join('');
  html += `<button type="button" class="wiring-add-btn sp-add">+ Add Port</button>`;
  container.innerHTML = html;

  // Helper: re-render ports table (detail mode uses closure; form mode calls directly)
  const doRerender = rerender ?? (() => renderSwitchPortsTableForm());

  container.querySelectorAll('.sp-port').forEach(inp0 => {
    const inp = inp0 as HTMLInputElement;
    inp.addEventListener('change', () => {
      ports[Number(inp.dataset.idx)].portName = inp.value;
      onDirty?.();
    });
  });

  // Managed/Router only: per-port network picker — not rendered for Unmanaged
  container.querySelectorAll('.sp-network').forEach(sel0 => {
    const sel = sel0 as HTMLSelectElement;
    sel.addEventListener('change', () => {
      const idx      = Number(sel.dataset.idx);
      const newNetId = sel.value;
      const p        = ports[idx];
      // Clear the device selection when network changes and it no longer matches.
      // Only acts when we have positive evidence of a mismatch (the asset/slot
      // has network ports and none of them match) — if it has no port info at
      // all, leave the assignment alone rather than guessing.
      if (p.assetId) {
        const asset = state.refs.assets?.[p.assetId];
        if (asset?.assetClass === 'PLC') {
          const slot = ((asset.slots || []) as any[]).find(s => s.slotNumber === p.slotNumber);
          const slotPorts = slot ? getEntityNetworkPorts(slot) : [];
          if (slotPorts.length && !slotPorts.some(sp => sp.networkId === newNetId)) {
            p.assetId    = '';
            p.slotNumber = null;
          }
        } else if (asset) {
          const assetPorts = getEntityNetworkPorts(asset);
          if (assetPorts.length && !assetPorts.some(ap => ap.networkId === newNetId)) {
            p.assetId = '';
          }
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

  container.querySelectorAll('.sp-device').forEach(sel0 => {
    const sel = sel0 as HTMLSelectElement;
    sel.addEventListener('change', () => {
      const idx = Number(sel.dataset.idx);
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

  container.querySelectorAll('.sp-rm').forEach(btn0 => {
    const btn = btn0 as HTMLElement;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      ports.splice(Number(btn.dataset.idx), 1);
      onDirty?.();
      doRerender();
    });
  });

  container.querySelector('.sp-add')?.addEventListener('click', () => {
    const num = ports.length + 1;
    // Unmanaged: pre-assign the single VLAN; Managed/Router: leave blank for the user to pick
    ports.push({ portName: `Port ${num}`, networkId: autoNetId || '', assetId: '', slotNumber: null });
    onDirty?.();
    doRerender();
    const inputs = container.querySelectorAll('.sp-port') as NodeListOf<HTMLInputElement>;
    inputs[inputs.length - 1]?.select();
  });
}

/** Form mode: reads/writes state.formSwitchNetworks/Ports into '#switch-ports-container'. */
export function renderSwitchPortsTableForm(): void {
  const assetSubclass = ($('f-assetSubclass') as HTMLInputElement | null)?.value ?? null;
  _renderSwitchPortsTable(
    'switch-ports-container',
    state.formSwitchNetworks,
    state.formSwitchPorts,
    null,
    null,
    null,
    assetSubclass
  );
}

/**
 * Detail mode: reads/writes the caller-supplied arrays into an explicit container.
 * @param rerender      - Re-render callback (required in detail mode)
 * @param onDirty       - Called on any data change
 * @param selfId        - Entity id to exclude from device options (the switch itself)
 * @param assetSubclass - Asset subclass; drives Unmanaged auto-assignment logic
 */
export function renderSwitchPortsTableDetail(
  containerId: string,
  networks: UntypedTableRow[],
  ports: UntypedTableRow[],
  rerender: () => void,
  onDirty: () => void,
  selfId: string | null | undefined,
  assetSubclass: string | null | undefined
): void {
  _renderSwitchPortsTable(containerId, networks, ports, rerender, onDirty, selfId, assetSubclass);
}

/* ---- IO POINTS TABLE ---- */

export const IO_SIGNAL_OPTS = ['1-5V','0-10V','0-20mA','4-20mA','RTD','Other'] as const;
export const IO_WIRING_OPTS = ['2-Wire','3-Wire','4-Wire'] as const;

/** Reads f-ioPointCount, resizes state.formIoPoints to match, then re-renders. */
export function syncIoPointCount(): void {
  const count    = parseInt(($('f-ioPointCount') as HTMLInputElement | null)?.value ?? '') || 0;
  const cardType = ($('f-cardType') as HTMLInputElement | null)?.value;
  while (state.formIoPoints.length < count)
    state.formIoPoints.push(cardType === 'Analog'
      ? { label: 'Spare', signalType: '', wiringType: '' }
      : { label: 'Spare' });
  state.formIoPoints.length = count;
  renderIoPointsTable();
}

export function renderIoPointsTable(): void {
  const container = $('io-points-container');
  if (!container) return;
  const rows     = state.formIoPoints;
  const isAnalog = ($('f-cardType') as HTMLInputElement | null)?.value === 'Analog';
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

  container.querySelectorAll('.io-point-row input, .io-point-row select').forEach(el0 => {
    const el = el0 as HTMLInputElement | HTMLSelectElement;
    el.addEventListener('change', () => {
      state.formIoPoints[Number(el.dataset.idx)][el.dataset.field as string] = el.value;
    });
  });
}

/* ---- POWER BUS TABLE ---- */

/**
 * Shared implementation for the power bus editor.
 * Not called directly — use renderPowerBusTableForm() from the entity form
 * or renderPowerBusTableDetail(...) from the detail panel.
 *
 * @param containerId - DOM id of the target container
 * @param powerBus - Mutable array of power-bus entries to read/write
 * @param rerender - Called after any mutation to re-render the table; null in form mode
 * @param onDirty  - Called after any mutation so callers can set dirty flags
 */
export function _renderPowerBusTable(
  containerId: string,
  powerBus: UntypedTableRow[],
  rerender: (() => void) | null,
  onDirty: (() => void) | null
): void {
  const container = $(containerId);
  if (!container) return;
  const rmIcon = ICON_RM;

  // Re-render closure: if a custom rerender was provided use it, otherwise
  // fall back to the form-mode renderer.
  const doRerender = rerender ?? (() => renderPowerBusTableForm());

  const makeDeviceOpts = (type: string, selectedId: string | undefined) => {
    const store = type === 'Safety Circuit' ? 'safety' : 'power';
    return (state.cache[store] || [])
      .map(item => `<option value="${item.id}"${item.id === selectedId ? ' selected' : ''}>${esc(item.name)}</option>`)
      .join('');
  };

  const makeWiringRows = (ei: number, wiring: any[]) => wiring.map((w, wi) => `
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

  container.querySelectorAll('.pb-type').forEach(sel0 => {
    const sel = sel0 as HTMLSelectElement;
    sel.addEventListener('change', () => {
      powerBus[Number(sel.dataset.idx)].type  = sel.value;
      powerBus[Number(sel.dataset.idx)].refId = '';
      onDirty?.();
      doRerender();
    });
  });
  container.querySelectorAll('.pb-device').forEach(sel0 => {
    const sel = sel0 as HTMLSelectElement;
    sel.addEventListener('change', () => {
      powerBus[Number(sel.dataset.idx)].refId = sel.value;
      onDirty?.();
    });
  });
  container.querySelectorAll('.pb-wiring-row input').forEach(input0 => {
    const input = input0 as HTMLInputElement;
    input.addEventListener('change', () => {
      powerBus[Number(input.dataset.entry)].wiring[Number(input.dataset.widx)][input.dataset.field as string] = input.value;
      onDirty?.();
    });
  });
  container.querySelectorAll('.wiring-rm-btn[data-widx]').forEach(btn0 => {
    const btn = btn0 as HTMLElement;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      powerBus[Number(btn.dataset.entry)].wiring.splice(Number(btn.dataset.widx), 1);
      onDirty?.();
      doRerender();
    });
  });
  container.querySelectorAll('.pb-wrow-add').forEach(btn0 => {
    const btn = btn0 as HTMLElement;
    btn.addEventListener('click', () => {
      powerBus[Number(btn.dataset.entry)].wiring.push({ terminal: '', label: '' });
      onDirty?.();
      doRerender();
    });
  });
  container.querySelectorAll('.pb-entry-rm').forEach(btn0 => {
    const btn = btn0 as HTMLElement;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      powerBus.splice(Number(btn.dataset.idx), 1);
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

/** Form mode: reads/writes state.formPowerBus into '#power-bus-container'. */
export function renderPowerBusTableForm(): void {
  _renderPowerBusTable('power-bus-container', state.formPowerBus, null, null);
}

/**
 * Detail mode: reads/writes the caller-supplied array into an explicit container.
 * @param rerender - Called after any mutation to re-render the table (required)
 * @param onDirty  - Called after any mutation so callers can set dirty flags
 */
export function renderPowerBusTableDetail(containerId: string, powerBus: UntypedTableRow[], rerender: () => void, onDirty: () => void): void {
  _renderPowerBusTable(containerId, powerBus, rerender, onDirty);
}

/* ---- NETWORK PORTS TABLE ---- */

/**
 * Shared implementation for the editable network-ports list.
 * Not called directly — use renderNetworkPortsTableForm() from the entity
 * form or renderNetworkPortsTableDetail(...) from the detail panel.
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
 * @param containerId - DOM id of the target container
 * @param ports - Mutable array of { portNumber, networkId, ...addrFields }
 * @param rerender - Called after structural changes (add/remove); null in form mode
 * @param onDirty  - Called after any mutation so callers can set dirty flags
 */
export function _renderNetworkPortsTable(
  containerId: string,
  ports: NetworkPortRow[],
  rerender: (() => void) | null,
  onDirty: (() => void) | null
): void {
  const container = $(containerId);
  if (!container) return;

  // Self-referencing closure so add/remove/network-change can trigger a full re-render
  const doRerender = rerender ?? (() => renderNetworkPortsTableForm());

  // All network types are offered — Controller/Communication cards can use any protocol
  const makeNetOpts = (selectedId: string) => buildNetworkOptions(selectedId, state.cache.networks || []);

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
  container.querySelectorAll('.np-network').forEach(sel0 => {
    const sel = sel0 as HTMLSelectElement;
    sel.addEventListener('change', () => {
      const idx = Number(sel.dataset.idx);
      const row = ports[idx] as Record<string, any>;
      Object.keys(row).filter(k => k !== 'networkId' && k !== 'portNumber')
            .forEach(k => delete row[k]);
      row.networkId = sel.value;
      onDirty?.();
      doRerender();
    });
  });

  // Address field input — write the keyed value directly into the port object (no re-render needed)
  container.querySelectorAll('.sn-addr').forEach(el0 => {
    const el = el0 as HTMLInputElement | HTMLSelectElement;
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      (ports[Number(el.dataset.idx)] as Record<string, any>)[el.dataset.key as string] = el.value;
      onDirty?.();
    });
  });

  // Remove port — splice entry, notify dirty, re-render
  container.querySelectorAll('.np-port-rm').forEach(btn0 => {
    const btn = btn0 as HTMLElement;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      ports.splice(Number(btn.dataset.idx), 1);
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

/** Form mode: reads/writes state.formSlotNetworkPorts into '#network-ports-container'. */
export function renderNetworkPortsTableForm(): void {
  _renderNetworkPortsTable('network-ports-container', state.formSlotNetworkPorts, null, null);
}

/**
 * Detail mode: reads/writes the caller-supplied array into an explicit container.
 * @param rerender - Called after structural changes (add/remove) (required)
 * @param onDirty  - Called after any mutation so callers can set dirty flags
 */
export function renderNetworkPortsTableDetail(containerId: string, ports: NetworkPortRow[], rerender: () => void, onDirty: () => void): void {
  _renderNetworkPortsTable(containerId, ports, rerender, onDirty);
}

/* ---- CLASS-SPECIFIC ITEM TABLES (wiring, parameters) ---- */

export function renderClassItemTables(assetClass: string): void {
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
  for (const t of tables) renderItemTableForm(t.key, t.label, t.placeholder1 || 'Terminal', t.placeholder2 || 'Label');
}

/**
 * Shared implementation for the editable terminal/label wiring table.
 * Not called directly — use renderItemTableForm() from the entity form or
 * renderItemTableDetail(...) from the detail panel, which give the two
 * calling conventions this used to share under one overloaded signature
 * (positional args + a defaults-filled opts object) separate, explicit
 * names instead — matching the split already done for the other table
 * renderers in this file (switch networks/ports, power bus, network ports).
 *
 * @param key          - Table key (e.g. 'inputWiring')
 * @param label        - Human-readable table label (used internally for re-renders)
 * @param placeholder1 - Column 1 placeholder text
 * @param placeholder2 - Column 2 placeholder text
 * @param containerId  - DOM element id
 * @param tablesState - Object with rows at [key]
 * @param onDirty - Called after any mutation; null in form mode
 */
export function _renderItemTable(
  key: string,
  label: string,
  placeholder1: string,
  placeholder2: string,
  containerId: string,
  tablesState: Record<string, ItemTableRow[]>,
  onDirty: (() => void) | null
): void {
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
  container.querySelectorAll('.wiring-form-row input').forEach(input0 => {
    const input = input0 as HTMLInputElement;
    input.addEventListener('change', () => {
      const wkey  = input.dataset.wkey as string;
      const field = input.dataset.field as string;
      (tablesState[wkey][Number(input.dataset.idx)] as Record<string, any>)[field] = input.value;
      // Notify caller so the detail panel navigation guard fires on cell edits.
      // In form mode onDirty is null and this is a no-op.
      onDirty?.();
    });
  });
  container.querySelectorAll('.wiring-rm-btn').forEach(btn0 => {
    const btn = btn0 as HTMLElement;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wkey = btn.dataset.wkey as string;
      tablesState[wkey].splice(Number(btn.dataset.idx), 1);
      onDirty?.();
      // Re-render with the same containerId/tablesState/onDirty this call was made with
      _renderItemTable(wkey, label, placeholder1, placeholder2, containerId, tablesState, onDirty);
    });
  });
  (container.querySelector('.wiring-add-btn') as HTMLElement).addEventListener('click', () => {
    tablesState[key].push({ terminal: '', label: '' });
    onDirty?.();
    _renderItemTable(key, label, placeholder1, placeholder2, containerId, tablesState, onDirty);
    const inputs = container.querySelectorAll('.wiring-terminal') as NodeListOf<HTMLInputElement>;
    inputs[inputs.length - 1]?.focus();
  });
}

/**
 * Form mode: reads/writes state.formItemTables into '#wiring-table-{key}'.
 */
export function renderItemTableForm(key: string, label: string, placeholder1: string = 'Terminal', placeholder2: string = 'Label'): void {
  _renderItemTable(key, label, placeholder1, placeholder2, `wiring-table-${key}`, state.formItemTables, null);
}

/**
 * Detail mode: reads/writes the caller-supplied state object into an explicit container.
 */
export function renderItemTableDetail(
  key: string,
  label: string,
  placeholder1: string,
  placeholder2: string,
  containerId: string,
  tablesState: Record<string, ItemTableRow[]>,
  onDirty?: () => void
): void {
  _renderItemTable(key, label, placeholder1, placeholder2, containerId, tablesState, onDirty ?? null);
}
