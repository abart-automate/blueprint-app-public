import type { DbRecord } from '../db.js';
import type { EntityConfig, EntityType, FieldDef, FormType } from '../entity-config.js';
import type { EditHistoryEntry } from '../state.js';
import type { NormalizedMediaItem } from '../utils.js';

import { getById, setSetting, upsert } from '../db.js';
import { ASSET_CLASS_NETWORK_PORTS, ASSIGN_STORE_MAP, CARD_TYPE_IO_TYPES, CARD_TYPE_NET_TYPES, CARD_TYPE_TERMINAL_TYPES, ENTITY, FORM_TYPE, ICON_BACK, ICON_CHEVRON, ICON_CHEVRON_DOWN, ICON_CHEVRON_UP, ICON_DUPLICATE, ICON_GRIP, ICON_PLUS, ICON_RM, PLC_CARD_TYPE_FIELDS } from '../entity-config.js';
import { confirm, el, refreshAll, showToast, state } from '../state.js';
import { attachFieldEmptyToggle, buildDetailCompletenessHtml, buildEnumOptions, buildLegacyNetworkPortRow, buildRefOptions, debounce, entityIcon, esc, formatNetworkPortLabels, freshenMediaItems, getCardThumbSrc, getEffectiveFields, getEntityNetworkPorts, isSwitchAsset, itemTables, normalizeMediaItems, renumberSlots, resolveFieldOptions, resolveRefName, revokeBlobUrlsInContainer, sortByName } from '../utils.js';
import { IO_SIGNAL_OPTS, IO_WIRING_OPTS, renderItemTableDetail, renderMediaGallery, renderMediaSlot, renderNetworkPortsTableDetail, renderPowerBusTableDetail, renderSwitchNetworksTableDetail, renderSwitchPortsTableDetail } from './tables.js';
import { deleteItem, duplicateItem, validateRequiredFields, validateUniqueIp, validateUniqueName } from '../operations.js';
import { cardHTML, closeDetail, openAssignOrCreate, openDetail, openSheet, openSlotDetail, openSlotForm, refreshHistoryUi } from '../app.js';
/* ============================================================
   DETAIL VIEW RENDERERS
   Depends on: entity-config.js, state.js, utils.js, db.js, app.js (openDetail,
   closeDetail, openSheet, openSlotForm, openSlotDetail, openAssignOrCreate,
   cardHTML, duplicateItem, deleteItem, upsert, refreshHistoryUi),
   operations.js (validateRequiredFields, validateUniqueIp, validateUniqueName —
   reused here so detail-panel autosave applies the same validation as the
   bottom-sheet form; see B2/B3 of the autosave plan)
   ============================================================ */

// preserveScroll: re-renders in place after a slot edit; saves/restores scroll to avoid jump.
export async function renderDetail({ preserveScroll = false }: { preserveScroll?: boolean } = {}): Promise<void> {
  const { detailType: type, detailId: id } = state;
  if (!type || !id) return;
  // Scroll lives on the inner .det-panel-scroll container, not el.detail itself.
  const scrollEl   = el.detail.querySelector('.det-panel-scroll');
  const savedScroll = preserveScroll ? (scrollEl?.scrollTop ?? 0) : 0;
  if (type === FORM_TYPE.PLC_SLOT) return renderSlotDetail(savedScroll);
  return renderEntityDetail(savedScroll);
}

export async function renderSlotDetail(savedScroll: number): Promise<void> {
  const id = state.detailId as string;
  await refreshAll();
  const rack = state.refs.assets?.[id];
  if (!rack) { closeDetail(); return; }
  const slotNumber = state.detailSlotNumber;
  const slot = rack.slots?.find((s: any) => s.slotNumber === slotNumber);
  if (!slot) { closeDetail(); return; } // empty slot — shouldn't normally reach here

  /* ------------------------------------------------------------------
     Reset all detail edit state from the saved slot data.
     ------------------------------------------------------------------ */
  state.detailChanges      = {};
  state.detailMediaDirty   = false;
  resetAutosaveSession();
  state.detailSlotIoPoints = (slot.ioPoints  || []).map((r: any) => ({ ...r }));
  state.detailSlotPowerBus = (slot.powerBus  || []).map((e: any) => ({
    type:   e.type   || 'Power',
    refId:  e.refId  || '',
    wiring: (e.wiring || []).map((w: any) => ({ ...w })),
  }));
  // Initialize terminal wiring edit state for Analog/Digital/Specialty cards.
  // detailItemTables is reset to {} by _clearDetailEditState, so set the key here
  // before the HTML build so renderItemTable can hydrate the table with existing rows.
  if (CARD_TYPE_TERMINAL_TYPES.has(slot.cardType)) {
    state.detailItemTables.terminalWiring = (slot.terminalWiring || []).map((r: any) => ({ ...r }));
  }
  // Network ports state is always reset (Controller/Communication cards) — safe to do unconditionally.
  state.detailSlotNetworkPorts = (slot.networkPorts || []).map((p: any) => ({ ...p }));

  /* ------------------------------------------------------------------
     Build editable field rows.
     Base fields (part number, firmware) + card-type-specific + network address.
     Reuses buildEditableFieldHtml so text/enum/ref types all work.
     ------------------------------------------------------------------ */
  const mkField = (f: FieldDef, src: any): string => `
    <div class="det-field">
      <div class="det-flabel">${esc(f.label)}</div>
      ${buildEditableFieldHtml(f, src)}
    </div>`;

  const BASE_SLOT_FIELDS: FieldDef[] = [
    { key: 'partNumber',      label: 'Part Number',      type: 'text' },
    { key: 'firmwareVersion', label: 'Firmware Version', type: 'text' },
  ];

  let fieldsHtml = BASE_SLOT_FIELDS.map(f => mkField(f, slot)).join('');

  // Card-type-specific fields (IO Point Count, Voltage, Network ref, etc.)
  for (const f of (PLC_CARD_TYPE_FIELDS[slot.cardType] || [])) {
    fieldsHtml += mkField(f, slot);
  }


  /* ------------------------------------------------------------------
     IO Points table — inline editable rows for Analog/Digital cards.
     Changes are written into state.detailSlotIoPoints; a sentinel key in
     state.detailChanges is kept for readability alongside the armAutosave()
     call that actually drives the debounced autosave (see AUTOSAVE section).
     ------------------------------------------------------------------ */
  let ioCard = '';
  if (CARD_TYPE_IO_TYPES.has(slot.cardType)) {
    const isAnalog = slot.cardType === 'Analog';
    const pts = state.detailSlotIoPoints;
    const rowsHtml = pts.length
      ? `<table class="wiring-det-table io-points-det-table">
           <thead><tr>
             <th>IO Point</th>
             ${isAnalog ? '<th>Signal</th><th>Wiring</th>' : ''}
             <th>Description</th>
           </tr></thead>
           <tbody>${pts.map((r, i) => `
             <tr>
               <td>${i}</td>
               ${isAnalog ? `
                 <td><select class="det-inline-select${!r.signalType ? ' field-empty' : ''}" data-io-idx="${i}" data-io-field="signalType">
                   <option value=""></option>
                   ${IO_SIGNAL_OPTS.map(o => `<option value="${esc(o)}"${r.signalType === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}
                 </select></td>
                 <td><select class="det-inline-select${!r.wiringType ? ' field-empty' : ''}" data-io-idx="${i}" data-io-field="wiringType">
                   <option value=""></option>
                   ${IO_WIRING_OPTS.map(o => `<option value="${esc(o)}"${r.wiringType === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}
                 </select></td>` : ''}
               <td><input type="text" class="det-inline-input${!r.label ? ' field-empty' : ''}" data-io-idx="${i}" data-io-field="label" value="${esc(r.label || '')}" placeholder="Description"></td>
             </tr>`).join('')}
           </tbody>
         </table>`
      : `<div class="wiring-empty">No IO points — update IO Point Count and save to add rows.</div>`;
    ioCard = buildCollapsibleCard('IO Points', rowsHtml, { expanded: true });
  }

  /* ------------------------------------------------------------------
     Power bus — editable via the parameterised renderPowerBusTable.
     Renders a placeholder here; table is mounted after innerHTML is set.
     ------------------------------------------------------------------ */
  const powerBusCard = CARD_TYPE_IO_TYPES.has(slot.cardType)
    ? buildCollapsibleCard('Power Bus', `<div id="det-power-bus-container"></div>`, { expanded: true })
    : '';

  /* ------------------------------------------------------------------
     Terminal Block Wiring card — Analog, Digital, Specialty.
     Renders a placeholder; table is mounted via renderItemTable after innerHTML is set.
     ------------------------------------------------------------------ */
  const terminalWiringCard = CARD_TYPE_TERMINAL_TYPES.has(slot.cardType)
    ? buildCollapsibleCard(
        'Terminal Block Wiring',
        `<div id="det-terminal-wiring-container" class="wiring-table"></div>`,
        { expanded: true }
      )
    : '';

  /* ------------------------------------------------------------------
     Network Ports card — Controller, Communication.
     Renders a placeholder; table is mounted via renderNetworkPortsTable after innerHTML is set.
     ------------------------------------------------------------------ */
  const networkPortsCard = CARD_TYPE_NET_TYPES.has(slot.cardType)
    ? buildCollapsibleCard(
        'Network Ports',
        `<div id="det-network-ports-container"></div>`,
        { expanded: true }
      )
    : '';

  /* ------------------------------------------------------------------
     Render HTML.
     Name is an always-editable input; edit button is removed.
     Save bar is position:fixed (relative to the panel transform) so it
     always sits above the nav bar regardless of content height.
     ------------------------------------------------------------------ */
  el.detail.innerHTML = `
    <div class="det-panel-scroll">
      <div class="det-header">
        <button class="det-back-btn" id="det-back" aria-label="Back">${ICON_BACK}</button>
      </div>
      <div class="det-card">
        <div class="det-name-row">
          <input class="det-name-input" id="det-name-input" type="text"
                 value="${esc(slot.name || '')}" data-edit-field="name" aria-label="Card Name">
        </div>
        <div class="det-badges">
          <span class="badge badge-asset">Slot ${slotNumber}</span>
          ${slot.cardType ? `<span class="badge badge-asset">${esc(slot.cardType)}</span>` : ''}
          <span class="badge badge-panel">${esc(rack.name)}</span>
        </div>
        <div class="det-fields">${fieldsHtml}</div>
      </div>
      ${ioCard}
      ${powerBusCard}
      ${terminalWiringCard}
      ${networkPortsCard}
    </div>
  `;

  /* ------------------------------------------------------------------
     Mount editable power bus table into its placeholder container.
     Uses the parameterised renderPowerBusTable so it reads/writes
     state.detailSlotPowerBus instead of state.formPowerBus.
     ------------------------------------------------------------------ */
  if (CARD_TYPE_IO_TYPES.has(slot.cardType)) {
    const rerenderPB = () => renderPowerBusTableDetail(
      'det-power-bus-container',
      state.detailSlotPowerBus,
      rerenderPB,
      () => { state.detailChanges._pbDirty = true; armAutosave(); }
    );
    rerenderPB();
  }

  /* ------------------------------------------------------------------
     Mount terminal block wiring table into its placeholder container.
     Uses renderItemTable in detail mode: reads/writes state.detailItemTables['terminalWiring'].
     The onDirty callback arms autosave so terminal-wiring edits are saved even
     when the user never touches any standard field.
     ------------------------------------------------------------------ */
  if (CARD_TYPE_TERMINAL_TYPES.has(slot.cardType)) {
    renderItemTableDetail('terminalWiring', 'Terminal Block Wiring', 'Terminal', 'Wire Label',
      'det-terminal-wiring-container',
      state.detailItemTables,
      () => { state.detailChanges._termWiringDirty = true; armAutosave(); },
    );
  }

  /* ------------------------------------------------------------------
     Mount network ports table into its placeholder container.
     Uses renderNetworkPortsTable in detail mode: reads/writes state.detailSlotNetworkPorts.
     The rerenderNP closure is self-referencing so add/remove operations can
     trigger a full table re-render (same pattern as rerenderPB above).
     ------------------------------------------------------------------ */
  if (CARD_TYPE_NET_TYPES.has(slot.cardType)) {
    const rerenderNP = () => renderNetworkPortsTableDetail(
      'det-network-ports-container',
      state.detailSlotNetworkPorts,
      rerenderNP,
      () => { state.detailChanges._netPortsDirty = true; armAutosave(); }
    );
    rerenderNP();
  }

  /* ------------------------------------------------------------------
     Wire all [data-edit-field] inputs → state.detailChanges, autosaved
     via the debounced armAutosave() (see AUTOSAVE section below).
     ------------------------------------------------------------------ */
  el.detail.querySelectorAll('[data-edit-field]').forEach(control0 => {
    const control = control0 as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const key = control.dataset.editField as string;
    const ev  = control.tagName === 'SELECT' ? 'change' : 'input';
    control.addEventListener(ev, () => {
      state.detailChanges[key] = control.value;
      control.classList.remove('field-invalid');
      armAutosave();
    });
  });

  /* ------------------------------------------------------------------
     Wire IO point cells → state.detailSlotIoPoints.
     _ioDirty sentinel is kept (harmless, stripped before persist) mainly
     so a reader can see at a glance that IO edits are tracked, same as
     the other table sentinels below.
     ------------------------------------------------------------------ */
  el.detail.querySelectorAll('[data-io-idx]').forEach(control0 => {
    const control = control0 as HTMLInputElement | HTMLSelectElement;
    const idx   = Number(control.dataset.ioIdx);
    const field = control.dataset.ioField as string;
    const ev    = control.tagName === 'SELECT' ? 'change' : 'input';
    control.addEventListener(ev, () => {
      if (state.detailSlotIoPoints[idx]) {
        (state.detailSlotIoPoints[idx] as Record<string, any>)[field] = control.value;
        state.detailChanges._ioDirty = true; // sentinel, retained for readability
        armAutosave();
      }
    });
  });

  /* Delegated toggle for .field-empty — covers all field and IO controls */
  attachFieldEmptyToggle(el.detail, '[data-edit-field], [data-io-idx]');

  /* ------------------------------------------------------------------
     Button wiring
     ------------------------------------------------------------------ */
  (el.detail.querySelector('#det-back') as HTMLElement).addEventListener('click', closeDetail);

  // Collapsible section toggles
  el.detail.querySelectorAll('.det-section-toggle').forEach(btn0 => {
    const btn = btn0 as HTMLElement;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const body     = btn.closest('.det-collapsible')?.querySelector('.det-section-body') as HTMLElement;
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      body.style.display = expanded ? 'none' : 'block';
    });
  });

  // Scroll is on the inner .det-panel-scroll, not el.detail itself.
  const scrollEl = el.detail.querySelector('.det-panel-scroll');
  if (scrollEl) scrollEl.scrollTop = savedScroll;
}

/**
 * Builds a single PLC slot row for the Cards section of the PLC detail panel.
 *
 * @param rackId     - ID of the parent PLC asset
 * @param slotNumber - Array index (= display number) of this slot
 * @param slot          - Slot data object, or null for an empty placeholder
 */
export function buildSlotRow(rackId: string, slotNumber: number, slot: any, { isFirst = false, isLast = false }: { isFirst?: boolean, isLast?: boolean } = {}): string {
  // Defensive fallback for data-inconsistency edge cases — normal path never reaches this.
  if (!slot) {
    return `<div class="sn-det-row rack-slot-row" data-rack-id="${rackId}" data-slot-num="${slotNumber}" style="cursor:pointer">
      <div class="rack-slot-hdr"><span class="sn-det-name">Slot ${slotNumber}</span></div>
      <div class="sn-det-fields" style="color:var(--muted)">Empty</div>
    </div>`;
  }
  const typeTag = slot.cardType   ? `<span class="sn-det-field">${esc(slot.cardType)}</span>` : '';
  const pnTag   = slot.partNumber ? `<span class="sn-det-field">PN<strong>${esc(slot.partNumber)}</strong></span>` : '';
  const revTag  = slot.revision   ? `<span class="sn-det-field">Rev<strong>${esc(slot.revision)}</strong></span>` : '';
  let ioTag = '';
  if (CARD_TYPE_IO_TYPES.has(slot.cardType)) {
    const total = parseInt(slot.ioPointCount) || (slot.ioPoints?.length ?? 0);
    const inUse = (slot.ioPoints || []).filter((p: any) => p.label && p.label !== 'Spare').length;
    ioTag = `<span class="sn-det-field">IO<strong>${inUse}/${total}</strong></span>`;
  }
  let ipTag = '';
  if (CARD_TYPE_NET_TYPES.has(slot.cardType)) {
    const portCount = slot.networkPorts?.length || 0;
    if (portCount > 0) ipTag = `<span class="sn-det-field">Ports<strong>${portCount}</strong></span>`;
  }
  return `<div class="sn-det-row rack-slot-row" data-rack-id="${rackId}" data-slot-num="${slotNumber}" style="cursor:pointer">
    <div class="rack-slot-hdr">
      <button class="rack-slot-grip slot-action-btn" data-rack-id="${rackId}" data-slot-num="${slotNumber}" aria-label="Drag to reorder" title="Drag to reorder">${ICON_GRIP}</button>
      <span class="sn-det-name">Slot ${slotNumber}</span>
      <div class="rack-slot-actions">
        <button class="rack-slot-up slot-action-btn" data-rack-id="${rackId}" data-slot-num="${slotNumber}" aria-label="Move slot up" title="Move up"${isFirst ? ' disabled' : ''}>${ICON_CHEVRON_UP}</button>
        <button class="rack-slot-dn slot-action-btn" data-rack-id="${rackId}" data-slot-num="${slotNumber}" aria-label="Move slot down" title="Move down"${isLast ? ' disabled' : ''}>${ICON_CHEVRON_DOWN}</button>
        <button class="rack-slot-dup slot-action-btn" data-rack-id="${rackId}" data-slot-num="${slotNumber}" aria-label="Duplicate slot" title="Duplicate slot">${ICON_DUPLICATE}</button>
        <button class="rack-slot-clear wiring-rm-btn" data-rack-id="${rackId}" data-slot-num="${slotNumber}" aria-label="Delete slot">${ICON_RM}</button>
      </div>
    </div>
    <div class="sn-det-fields"><span class="sn-det-field"><strong>${esc(slot.name || '—')}</strong></span>${typeTag}${pnTag}${revTag}${ioTag}${ipTag}</div>
  </div>`;
}

/* ============================================================
   DETAIL EDITABLE FIELD BUILDER
   ============================================================ */

/**
 * Builds the editable control HTML for a single field.
 * All standard field types (text, textarea, enum, ref) become live inputs;
 * unknown types fall back to a read-only text display.
 *
 * @param f    - Field config from entity-config (key, label, type, options, refStore)
 * @param item      - Current entity data (provides the initial value)
 * @returns HTML string for the control, wrapped in .det-fval
 */
export function buildEditableFieldHtml(f: FieldDef, item: any): string {
  const rawVal   = item[f.key] ?? '';
  const isEmpty  = rawVal === '' || rawVal == null;
  const emptyCls = isEmpty ? ' field-empty' : '';

  if (f.type === 'text') {
    return `<input type="text" class="det-inline-input${emptyCls}" data-edit-field="${f.key}" value="${esc(String(rawVal))}" placeholder="${esc(f.label)}">`;
  }

  if (f.type === 'textarea') {
    return `<textarea class="det-inline-textarea${emptyCls}" data-edit-field="${f.key}" placeholder="${esc(f.label)}">${esc(String(rawVal))}</textarea>`;
  }

  if (f.type === 'enum') {
    // resolveFieldOptions handles assetSubclass whose options are dynamic (driven by assetClass)
    return `<select class="det-inline-select${emptyCls}" data-edit-field="${f.key}">
      <option value="">— Select —</option>
      ${buildEnumOptions(resolveFieldOptions(f, item), rawVal)}
    </select>`;
  }

  if (f.type === 'ref') {
    return `<select class="det-inline-select${emptyCls}" data-edit-field="${f.key}">
      <option value="">— Unassigned —</option>
      ${buildRefOptions(state.cache[f.refStore] || [], rawVal)}
    </select>`;
  }

  // Fallback: show value read-only (assign-type, assign-id, and any future types)
  const displayVal = String(rawVal);
  return `<div class="det-fval${!displayVal ? ' det-fval-empty' : ''}">${displayVal ? esc(displayVal) : '—'}</div>`;
}

/* ============================================================
   ENTITY DETAIL RENDERER
   ============================================================ */

/**
 * Renders the full entity detail panel.  All standard fields are rendered as live
 * editable inputs from the start — no "Edit" button or click-to-activate required.
 * A persistent Save/Cancel bar floats above the nav bar.
 *
 * Edit state is freshly initialised on every render call (pending field changes are
 * reset; media and wiring state are re-loaded from the saved item).  Navigation away
 * from the panel while changes are pending triggers an unsaved-changes prompt.
 */
export async function renderEntityDetail(savedScroll: number): Promise<void> {
  const type = state.detailType as EntityType;
  const id   = state.detailId as string;
  const cfg  = ENTITY[type];
  const item = await getById(type, id);
  if (!item) { state.detailStack = []; closeDetail(); return; }
  await refreshAll();

  /* ------------------------------------------------------------------
     Reset all detail edit state from the saved item.
     This runs on every render (including re-renders after slot/child ops)
     so that the displayed inputs always reflect the on-disk state.
     ------------------------------------------------------------------ */
  state.detailChanges   = {};
  state.detailMediaDirty = false;
  resetAutosaveSession();

  // Load editable media state from the saved item
  state.detailImages = normalizeMediaItems(item.images);
  state.detailNamedPhotos = {};
  if (cfg.requiredPhotoSlots) {
    for (const slot of cfg.requiredPhotoSlots) {
      state.detailNamedPhotos[slot] = normalizeMediaItems(item.namedPhotos?.[slot]);
    }
  }

  // Load editable wiring table state from the saved item
  state.detailItemTables = {};
  for (const t of itemTables(type, item)) {
    state.detailItemTables[t.key] = (item[t.key] || []).map((r: any) => ({ ...r }));
  }

  // Load switch table state for managed switch assets
  const showSwitchTables = type === 'assets' && isSwitchAsset(item.assetClass, item.assetSubclass);
  if (showSwitchTables) {
    state.detailSwitchNetworks = (item.switchNetworks || []).map((r: any) => ({ ...r }));
    state.detailSwitchPorts    = (item.switchPorts    || []).map((r: any) => ({ ...r }));
  }

  // Load network ports table state for asset classes with a Network Ports UI
  // (Field Device, HMI — see ASSET_CLASS_NETWORK_PORTS). Legacy records with
  // only a scalar networkId get a synthesized "Port 1" row so the value isn't
  // silently dropped (see buildLegacyNetworkPortRow).
  const showAssetNetworkPorts = type === 'assets' && ASSET_CLASS_NETWORK_PORTS.has(item.assetClass);
  if (showAssetNetworkPorts) {
    state.detailAssetNetworkPorts = item.networkPorts?.length
      ? item.networkPorts.map((r: any) => ({ ...r }))
      : (item.networkId ? [buildLegacyNetworkPortRow(item)] : []);
  }

  /* ------------------------------------------------------------------
     Build field rows grouped by section.
     Fields are rendered as live editable inputs instead of read-only divs.
     ------------------------------------------------------------------ */
  const skipKeys = new Set(['id','createdAt','updatedAt','images','namedPhotos','assignedToType','assignedToId','name']);
  const sectionMap = new Map<string | null, string[]>();

  for (const f of getEffectiveFields(type, item)) {
    // 'assign-type'/'assign-id' aren't part of FieldDef's current discriminated
    // union — same defensive dead-code pattern as form.js/operations.js; no
    // current entity-config.js field def produces them.
    const fType = f.type as string;
    if (skipKeys.has(f.key) || fType === 'assign-type' || fType === 'assign-id') continue;
    if (f.key === 'assetSubclass' && !(ENTITY.assets.classSubclasses?.[item.assetClass]?.length)) continue;

    // Each field is a label + an editable control (input, select, or textarea)
    const fieldHtml = `
      <div class="det-field">
        <div class="det-flabel">${esc(f.label)}</div>
        ${buildEditableFieldHtml(f, item)}
      </div>`;

    const sectionKey = f.section || null;
    if (!sectionMap.has(sectionKey)) sectionMap.set(sectionKey, []);
    (sectionMap.get(sectionKey) as string[]).push(fieldHtml);
  }

  const generalFields = (sectionMap.get(null) || []).join('');

  // Categorise sections: physical/clearance collapse separately from named sections
  const PHYSICAL_SECTIONS = new Set(['Physical Sizing', 'Backpanel Sizing', 'Clearance']);
  let detailSectionCards  = '';
  let physicalSectionCards = '';
  for (const [section, rows] of sectionMap) {
    if (!section) continue;
    if (PHYSICAL_SECTIONS.has(section)) {
      physicalSectionCards += buildCollapsibleCard(section, rows.join(''));
    } else {
      detailSectionCards += buildCollapsibleCard(section, rows.join(''));
    }
  }

  /* ------------------------------------------------------------------
     Wiring item tables — editable inline via renderItemTable().
     Placeholders are rendered here; the actual table UI is mounted after
     innerHTML is set (DOM must exist before calling renderItemTable).
     ------------------------------------------------------------------ */
  let wiringCards = '';
  for (const t of itemTables(type, item)) {
    // Use det-wiring-table-{key} to avoid ID conflicts with form's wiring-table-{key}
    wiringCards += buildCollapsibleCard(
      t.label,
      `<div id="det-wiring-table-${t.key}" class="wiring-table"></div>`,
      { expanded: true }  // expand by default since they are now editable
    );
  }

  /* ------------------------------------------------------------------
     Required media slots — placeholders mounted after innerHTML set
     ------------------------------------------------------------------ */
  let requiredPhotosCard = '';
  if (cfg.requiredPhotoSlots) {
    const slotsHtml = cfg.requiredPhotoSlots.map(slot => {
      const slotId = `det-slot-${slot.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
      return `
        <div class="named-photo-det-item">
          <div class="named-photo-det-label">${esc(slot)}</div>
          <div id="${slotId}" class="img-grid"></div>
        </div>`;
    }).join('');
    requiredPhotosCard = buildCollapsibleCard('Required Media', slotsHtml, { expanded: true });
  }

  // Other media gallery placeholder
  let otherPhotosCard = '';
  if (!cfg.noImages) {
    otherPhotosCard = buildCollapsibleCard('Other Media', `<div id="det-gallery" class="img-grid"></div>`, { expanded: true });
  }

  /* ------------------------------------------------------------------
     Switch/Router tables — editable inline via the parameterised renderers.
     Placeholders are rendered here; tables are mounted after innerHTML set.
     ------------------------------------------------------------------ */
  let switchNetworksCard = '';
  let switchPortsCard    = '';
  if (showSwitchTables) {
    switchNetworksCard = buildCollapsibleCard(
      'VLANs',
      `<div id="det-switch-networks-container"></div>`,
      { expanded: true }
    );
    switchPortsCard = buildCollapsibleCard(
      'Port Assignments',
      `<div id="det-switch-ports-container"></div>`,
      { expanded: true }
    );
  }

  let networkPortsCard = '';
  if (showAssetNetworkPorts) {
    networkPortsCard = buildCollapsibleCard(
      'Network Ports',
      `<div id="det-asset-network-ports-container"></div>`,
      { expanded: true }
    );
  }

  // Assignment badge (read-only display — not editable inline)
  let assignBadge = '';
  if (item.assignedToType) {
    if (item.assignedToType === 'Plant') {
      assignBadge = `<span class="badge badge-plant">Plant-wide</span>`;
    } else {
      const s   = (ASSIGN_STORE_MAP as Record<string, string | null>)[item.assignedToType];
      const ref = s ? (state.refs as Record<string, Record<string, DbRecord>>)[s]?.[item.assignedToId] : null;
      const bc  = ({ Area:'badge-area', Panel:'badge-panel', Power:'badge-power', 'Safety Circuit':'badge-safety', Network:'badge-network' } as Record<string, string>)[item.assignedToType] || 'badge-asset';
      assignBadge = `<span class="badge ${bc}">${esc(item.assignedToType)}: ${esc(ref?.name || '—')}</span>`;
    }
  }

  // PLC rack slots card — slots are managed dynamically (add/reorder/duplicate/delete).
  // slotNumber always equals array index; no fixed slot count field is required.
  let rackSlotsCard = '';
  if (type === 'assets' && item.assetClass === 'PLC') {
    const slots     = item.slots || [];
    const last      = slots.length - 1;
    const cardCount = slots.length;
    const title     = cardCount > 0 ? `Cards (${cardCount})` : 'Cards';
    const slotRows  = slots.length === 0
      ? `<div style="font-size:14px;color:var(--muted)">No slots — use Add Slot to begin.</div>`
      : slots.map((s: any, i: number) => buildSlotRow(item.id as string, i, s, { isFirst: i === 0, isLast: i === last })).join('');
    const addBtn    = `<button class="wiring-add-btn rack-add-slot-btn" data-rack-id="${item.id}" style="margin-top:8px">+ Add Slot</button>`;

    rackSlotsCard = buildCollapsibleCard(
      title,
      `<div class="sn-det-list">${slotRows}</div>${addBtn}`,
      { expanded: true }
    );
  }

  const childSections = await buildChildSections(type, id, item);

  /* ------------------------------------------------------------------
     Render HTML.
     The name field is always an editable input (areas were previously
     readonly; all types now use the same pattern).
     The "Edit" button (opens bottom-sheet form) is removed — all editing
     happens inline.  The "Duplicate" button is kept.
     ------------------------------------------------------------------ */
  // Revoke all blob URLs in the current detail panel before replacing its HTML.
  // Gallery <img>/<video> elements created by createMediaUrl() are tracked in _mediaUrls;
  // child-section card thumbnails from getCardThumbSrc() are untracked. Both are destroyed
  // by the innerHTML replacement — without this call they accumulate on every Save re-render
  // and eventually exhaust the browser's per-page blob URL cap, breaking all thumbnails.
  revokeBlobUrlsInContainer(el.detail);
  // All scrollable content goes inside .det-panel-scroll; the save bar sits
  // outside as a sibling so the flex column pins it above the nav bar.
  el.detail.innerHTML = `
    <div class="det-panel-scroll">
      <div class="det-header">
        <button class="det-back-btn" id="det-back" aria-label="Back">
          ${ICON_BACK}
        </button>
      </div>
      ${buildDetailCompletenessHtml(type, item)}
      <div class="det-card">
        ${type === 'areas'
          ? `<input class="det-name-input" id="det-name-input" type="text"
                 value="${esc(item.name)}" data-edit-field="name"
                 aria-label="Name">`
          : `<div class="det-name-row">
               <input class="det-name-input" id="det-name-input" type="text"
                      value="${esc(item.name)}" data-edit-field="name"
                      aria-label="Name">
               <button class="det-edit-btn" id="det-duplicate" aria-label="Duplicate">
                 ${ICON_DUPLICATE}
               </button>
             </div>`
        }
        <div class="det-badges">
          <span class="badge ${cfg.badgeClass}">${esc(cfg.label)}</span>
          ${assignBadge}
        </div>
        ${generalFields || ''}
      </div>
      ${detailSectionCards}
      ${wiringCards}
      ${rackSlotsCard}
      ${switchNetworksCard}
      ${switchPortsCard}
      ${networkPortsCard}
      ${physicalSectionCards}
      ${requiredPhotosCard}
      ${otherPhotosCard}
      ${childSections}
    </div>
  `;

  /* ------------------------------------------------------------------
     Mount editable wiring tables into their placeholder containers.
     renderItemTable is called with detail-specific opts so it reads/writes
     state.detailItemTables and uses det-wiring-table-{key} container ids.
     ------------------------------------------------------------------ */
  for (const t of itemTables(type, item)) {
    const containerId = `det-wiring-table-${t.key}`;
    if (document.getElementById(containerId)) {
      renderItemTableDetail(t.key, t.label, t.placeholder1 || 'Terminal', t.placeholder2 || 'Label',
        containerId,
        state.detailItemTables,
        () => armAutosave(),
      );
    }
  }

  /* ------------------------------------------------------------------
     Mount editable switch network / port tables for managed switches.
     The rerenderSwitch closure keeps both tables in sync after mutations
     without the detail re-rendering the entire panel.
     ------------------------------------------------------------------ */
  if (showSwitchTables) {
    const rerenderSwitch = () => {
      renderSwitchNetworksTableDetail(
        'det-switch-networks-container',
        state.detailSwitchNetworks,
        state.detailSwitchPorts,
        rerenderSwitch,
        () => { state.detailChanges._switchDirty = true; armAutosave(); }, // sentinel, retained for readability
        item.assetSubclass
      );
      renderSwitchPortsTableDetail(
        'det-switch-ports-container',
        state.detailSwitchNetworks,
        state.detailSwitchPorts,
        rerenderSwitch,
        () => { state.detailChanges._switchDirty = true; armAutosave(); },
        item.id,           // exclude the switch itself from device options
        item.assetSubclass // drives Unmanaged auto-assignment logic
      );
    };
    rerenderSwitch();
  }

  if (showAssetNetworkPorts) {
    const rerenderNetPorts = () => {
      renderNetworkPortsTableDetail(
        'det-asset-network-ports-container',
        state.detailAssetNetworkPorts,
        rerenderNetPorts,
        () => { state.detailChanges._netPortsDirty = true; armAutosave(); } // sentinel, retained for readability
      );
    };
    rerenderNetPorts();
  }

  /* ------------------------------------------------------------------
     Mount editable media galleries.
     Unlike text fields, media add/remove commits immediately via
     persistDetailMedia() rather than waiting on the autosave debounce —
     see B3 of the autosave plan: a photo just taken should never be lost
     to a closed tab, and undo (editHistory) deliberately never covers
     images/namedPhotos, so there is nothing gained by delaying the write.
     ------------------------------------------------------------------ */
  if (cfg.requiredPhotoSlots) {
    for (const slot of cfg.requiredPhotoSlots) {
      const slotId    = `det-slot-${slot.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
      const container = document.getElementById(slotId);
      if (container) {
        // Self-referencing closure mirrors renderEntityForm's reSlot() pattern so
        // thumbnails appear immediately without waiting for a save round-trip.
        const reSlot = () => renderMediaSlot(container, slot, state.detailNamedPhotos[slot], {
          onAdd:    items => { state.detailNamedPhotos[slot].push(...items); reSlot(); void persistDetailMedia(type, id); },
          onRemove: i     => { state.detailNamedPhotos[slot].splice(i, 1);   reSlot(); void persistDetailMedia(type, id); },
        });
        reSlot();
      }
    }
  }
  if (!cfg.noImages) {
    const gallery = document.getElementById('det-gallery');
    if (gallery) {
      // Self-referencing closure mirrors renderEntityForm's reGallery() pattern —
      // same reason: immediate thumbnail visibility without a save round-trip.
      const reGallery = () => renderMediaGallery(gallery, state.detailImages, {
        onAdd:    items => { state.detailImages.push(...items); reGallery(); void persistDetailMedia(type, id); },
        onRemove: i     => { state.detailImages.splice(i, 1);  reGallery(); void persistDetailMedia(type, id); },
      });
      reGallery();
    }
  }

  /* ------------------------------------------------------------------
     Wire all [data-edit-field] inputs (text, textarea, select, name input).
     Any change records the value in state.detailChanges.
     The panelId → areaId cascade is handled specially below.
     ------------------------------------------------------------------ */
  el.detail.querySelectorAll('[data-edit-field]').forEach(control0 => {
    const control = control0 as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const key = control.dataset.editField as string;
    const ev  = control.tagName === 'SELECT' ? 'change' : 'input';
    control.addEventListener(ev, () => {
      state.detailChanges[key] = control.value;
      control.classList.remove('field-invalid');
      armAutosave();
    });
  });

  /* Delegated toggle for .field-empty — covers all editable field controls */
  attachFieldEmptyToggle(el.detail, '[data-edit-field]');

  // When the user changes the panel, auto-fill the area to match the panel's area.
  // This mirrors the cascade logic previously in activateInlineEdit.
  const panelSel = el.detail.querySelector('[data-edit-field="panelId"]') as HTMLSelectElement | null;
  if (panelSel) {
    panelSel.addEventListener('change', () => {
      const panel = state.refs.panels?.[panelSel.value];
      if (panel?.areaId) {
        state.detailChanges['areaId'] = panel.areaId;
        const areaSel = el.detail.querySelector('[data-edit-field="areaId"]') as HTMLSelectElement | null;
        if (areaSel) areaSel.value = panel.areaId;
      }
    });
  }

  /* ------------------------------------------------------------------
     Button wiring
     ------------------------------------------------------------------ */
  (el.detail.querySelector('#det-back') as HTMLElement).addEventListener('click', closeDetail);
  el.detail.querySelector('#det-duplicate')?.addEventListener('click', () => duplicateItem(type, id));

  // Child-entity card clicks / delete buttons
  el.detail.querySelectorAll('.child-card-list').forEach(list0 => {
    const list = list0 as HTMLElement;
    const childStore = list.dataset.childStore as string;
    list.querySelectorAll('.card').forEach(card0 => {
      const card = card0 as HTMLElement;
      card.addEventListener('click', () => openDetail(childStore as EntityType, card.dataset.id as string));
    });
    list.querySelectorAll('.card-delete-btn').forEach(btn0 => {
      const btn = btn0 as HTMLElement;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        deleteItem(childStore as EntityType, btn.dataset.id as string, btn.dataset.name as string);
      });
    });
  });

  // ---- PLC rack slot interactions ----

  // Row click — all rows are populated, so always open the slot detail.
  // Guard against clicks on any of the action buttons inside the row.
  el.detail.querySelectorAll('.rack-slot-row').forEach(row0 => {
    const row = row0 as HTMLElement;
    row.addEventListener('click', e => {
      if ((e.target as Element | null)?.closest('.slot-action-btn, .wiring-rm-btn, .rack-slot-grip')) return;
      openSlotDetail(row.dataset.rackId as string, Number(row.dataset.slotNum));
    });
  });

  // Add Slot button — opens the slot card form for a new slot appended at the end.
  el.detail.querySelectorAll('.rack-add-slot-btn').forEach(btn0 => {
    const btn = btn0 as HTMLElement;
    btn.addEventListener('click', () => {
      const rack = state.refs.assets?.[btn.dataset.rackId as string];
      openSlotForm(btn.dataset.rackId as string, rack?.slots?.length ?? 0);
    });
  });

  // Delete slot — remove from array, renumber remaining slots so indices stay sequential.
  el.detail.querySelectorAll('.rack-slot-clear').forEach(btn0 => {
    const btn = btn0 as HTMLElement;
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const rackId  = btn.dataset.rackId;
      const slotNum = Number(btn.dataset.slotNum);
      const rack    = state.refs.assets?.[rackId as string];
      if (!rack) return;
      const slot = rack.slots?.[slotNum];
      const ok = await confirm('Delete slot?', `Remove "${slot?.name || 'card'}" from Slot ${slotNum}? This cannot be undone.`, { yesLabel: 'Delete' });
      if (!ok) return;
      const slots = renumberSlots((rack.slots || []).filter((_: any, i: number) => i !== slotNum));
      await upsert('assets', { ...rack, slots });
      await refreshAll();
      renderDetail({ preserveScroll: true });
    });
  });

  // Move slot up — swap with predecessor, renumber, persist.
  el.detail.querySelectorAll('.rack-slot-up').forEach(btn0 => {
    const btn = btn0 as HTMLElement;
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const rackId  = btn.dataset.rackId;
      const idx     = Number(btn.dataset.slotNum);
      const rack    = state.refs.assets?.[rackId as string];
      if (!rack || idx <= 0) return;
      const slots = [...(rack.slots || [])];
      [slots[idx - 1], slots[idx]] = [slots[idx], slots[idx - 1]];
      await upsert('assets', { ...rack, slots: renumberSlots(slots) });
      await refreshAll();
      renderDetail({ preserveScroll: true });
    });
  });

  // Move slot down — swap with successor, renumber, persist.
  el.detail.querySelectorAll('.rack-slot-dn').forEach(btn0 => {
    const btn = btn0 as HTMLElement;
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const rackId  = btn.dataset.rackId;
      const idx     = Number(btn.dataset.slotNum);
      const rack    = state.refs.assets?.[rackId as string];
      if (!rack || idx >= (rack.slots?.length ?? 0) - 1) return;
      const slots = [...(rack.slots || [])];
      [slots[idx], slots[idx + 1]] = [slots[idx + 1], slots[idx]];
      await upsert('assets', { ...rack, slots: renumberSlots(slots) });
      await refreshAll();
      renderDetail({ preserveScroll: true });
    });
  });

  // Duplicate slot — deep-copy the card, clear networkPorts (keep safety/power/terminals),
  // append at the end, renumber, persist.
  el.detail.querySelectorAll('.rack-slot-dup').forEach(btn0 => {
    const btn = btn0 as HTMLElement;
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const rackId  = btn.dataset.rackId;
      const idx     = Number(btn.dataset.slotNum);
      const rack    = state.refs.assets?.[rackId as string];
      const src     = rack?.slots?.[idx];
      if (!src) return;
      const copy = {
        ...src,
        ioPoints:       (src.ioPoints       || []).map((p: any) => ({ ...p })),
        powerBus:       (src.powerBus       || []).map((b: any) => ({ ...b, wiring: (b.wiring || []).map((w: any) => ({ ...w })) })),
        terminalWiring: (src.terminalWiring || []).map((t: any) => ({ ...t })),
        // Network port assignments are specific to one physical card — clear them on copy.
        networkPorts:   [],
      };
      const slots = renumberSlots([...(rack.slots || []), copy]);
      await upsert('assets', { ...rack, slots });
      await refreshAll();
      renderDetail({ preserveScroll: true });
    });
  });

  // Drag-to-reorder via Pointer Events API — same approach as the detail-pane resize handle.
  // The grip icon on each slot row acts as the drag handle; setPointerCapture keeps events
  // routing to the grip even when the pointer moves outside it during a fast drag.
  el.detail.querySelectorAll('.rack-slot-grip').forEach(grip0 => {
    const grip = grip0 as HTMLElement;
    grip.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const rackId      = grip.dataset.rackId;
      const rack        = state.refs.assets?.[rackId as string];
      if (!rack?.slots?.length) return;

      const draggedIdx  = Number(grip.dataset.slotNum);
      const rows        = [...el.detail.querySelectorAll(`.rack-slot-row[data-rack-id="${rackId}"]`)] as HTMLElement[];
      if (rows.length < 2) return; // Nothing to reorder with a single slot.

      // Snapshot each row's vertical midpoint at drag-start so we can determine the
      // insertion position without querying the DOM on every pointermove.
      const rowMids = rows.map(r => {
        const rect = r.getBoundingClientRect();
        return rect.top + rect.height / 2;
      });

      // Ghost: a semi-transparent clone that follows the pointer.
      const srcRow   = rows[draggedIdx];
      const srcRect  = srcRow.getBoundingClientRect();
      const ghost    = srcRow.cloneNode(true) as HTMLElement;
      ghost.classList.add('rack-slot-ghost');
      ghost.style.width  = `${srcRect.width}px`;
      ghost.style.height = `${srcRect.height}px`;
      ghost.style.top    = `${srcRect.top}px`;
      ghost.style.left   = `${srcRect.left}px`;
      document.body.appendChild(ghost);

      // Drop indicator: a horizontal line shown between rows.
      const indicator = document.createElement('div');
      indicator.className = 'rack-slot-drop-indicator';
      document.body.appendChild(indicator);

      srcRow.classList.add('rack-slot-dragging');
      grip.setPointerCapture(e.pointerId);

      let currentDropIdx = draggedIdx;

      function computeDropIdx(clientY: number): number {
        // Find the first row whose midpoint is below the pointer — insert before it.
        const after = rowMids.findIndex(mid => clientY < mid);
        if (after === -1) return rows.length - 1; // below all rows → last position
        return Math.max(0, after > draggedIdx ? after - 1 : after);
      }

      function positionIndicator(dropIdx: number): void {
        // Place the indicator line below row dropIdx (or above row 0 when dropping before it).
        const refRow  = rows[dropIdx];
        const refRect = refRow.getBoundingClientRect();
        // If dropping BEFORE the dragged index, show line above refRow; otherwise below.
        const y = dropIdx < draggedIdx ? refRect.top : refRect.bottom;
        indicator.style.top   = `${y + window.scrollY}px`;
        indicator.style.left  = `${refRect.left}px`;
        indicator.style.width = `${refRect.width}px`;
      }

      function onMove(ev: PointerEvent): void {
        ghost.style.top = `${srcRect.top + (ev.clientY - e.clientY)}px`;
        currentDropIdx  = computeDropIdx(ev.clientY);
        positionIndicator(currentDropIdx);
      }

      async function onUp() {
        grip.removeEventListener('pointermove', onMove);
        grip.removeEventListener('pointerup',   onUp);
        ghost.remove();
        indicator.remove();
        srcRow.classList.remove('rack-slot-dragging');

        if (currentDropIdx !== draggedIdx) {
          const slots  = [...(rack as any).slots];
          const [moved] = slots.splice(draggedIdx, 1);
          // computeDropIdx already adjusts for the index shift caused by removing the
          // dragged element (returns after-1 when dropping past the original position),
          // so insertAt is always the final currentDropIdx with no additional offset needed.
          slots.splice(currentDropIdx, 0, moved);
          await upsert('assets', { ...rack, slots: renumberSlots(slots) });
          await refreshAll();
          renderDetail({ preserveScroll: true });
        }
      }

      grip.addEventListener('pointermove', onMove);
      grip.addEventListener('pointerup',   onUp);
    });
  });

  // Add-child buttons (shown in child-section headers)
  el.detail.querySelectorAll('[data-add-child]').forEach(btn0 => {
    const btn = btn0 as HTMLElement;
    btn.addEventListener('click', () => {
      const childType    = btn.dataset.addChild;
      const presetField  = btn.dataset.presetField;
      const presetVal    = btn.dataset.presetVal;
      const extraPresets = btn.dataset.extraPresets ? JSON.parse(btn.dataset.extraPresets) : {};
      if (childType === 'assets' || childType === 'power' || childType === 'safety' || childType === 'panels') {
        openAssignOrCreate(childType, presetField as string, presetVal as string);
      } else {
        openSheet(childType as EntityType, undefined, { field: presetField, value: presetVal, extra: extraPresets });
      }
    });
  });

  // Collapsible section toggles
  el.detail.querySelectorAll('.det-section-toggle').forEach(btn0 => {
    const btn = btn0 as HTMLElement;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const body     = btn.closest('.det-collapsible')?.querySelector('.det-section-body') as HTMLElement;
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      body.style.display = expanded ? 'none' : 'block';
    });
  });

  // Scroll is on the inner .det-panel-scroll, not el.detail itself.
  const scrollEl = el.detail.querySelector('.det-panel-scroll');
  if (scrollEl) scrollEl.scrollTop = savedScroll;
}

export function buildCollapsibleCard(title: string, bodyHtml: string, { expanded = false }: { expanded?: boolean } = {}): string {
  const chevron = ICON_CHEVRON;
  return `
    <div class="det-card det-collapsible">
      <button class="det-section-toggle" aria-expanded="${expanded}">
        <span class="section-label" style="margin:0">${esc(title)}</span>
        ${chevron}
      </button>
      <div class="det-section-body" style="${expanded ? '' : 'display:none'}">
        ${bodyHtml}
      </div>
    </div>
  `;
}

export function getSlotLinkedRacks(parentType: string, parentId: string): Array<{ rack: any, slots: any[] }> {
  return (state.cache.assets || [])
    .filter(a => a.assetClass === 'PLC' && a.slots?.length)
    .map(rack => {
      const slots = rack.slots.filter((slot: any) => {
        if (parentType === 'networks')
          return CARD_TYPE_NET_TYPES.has(slot.cardType) &&
            getEntityNetworkPorts(slot).some(p => p.networkId === parentId);
        if (parentType === 'power')
          return slot.powerBus?.some((pb: any) => pb.type === 'Power' && pb.refId === parentId);
        if (parentType === 'safety')
          return slot.powerBus?.some((pb: any) => pb.type === 'Safety Circuit' && pb.refId === parentId);
        return false;
      });
      return slots.length ? { rack, slots } : null;
    })
    .filter((x): x is { rack: any, slots: any[] } => Boolean(x));
}

export function slotLinkedRackCardHTML(rack: any, slots: any[], contextNetworkId?: string): string {
  const cfg = ENTITY.assets;
  const firstMedia = rack.images?.[0] || (rack.namedPhotos && Object.values(rack.namedPhotos)[0]) || null;
  const thumbSrc = getCardThumbSrc(firstMedia);
  const thumb = thumbSrc
    ? `<img class="card-thumb" src="${thumbSrc}" alt="">`
    : `<div class="card-thumb-ph" style="color:${cfg.color};background:${cfg.bgColor}">${entityIcon('assets', 24)}</div>`;
  const panelName = resolveRefName('panels', rack.panelId);
  const slotLines = slots.map(s => {
    const label = `Slot ${s.slotNumber}${s.name ? ` (${s.name})` : ''}`;
    const netParts = formatNetworkPortLabels(getEntityNetworkPorts(s), contextNetworkId);
    const netPart = netParts.length ? ` — ${netParts.join(', ')}` : '';
    return esc(label + netPart);
  });
  return `
    <div class="card" data-id="${rack.id}">
      <div class="card-row">
        ${thumb}
        <div class="card-body">
          <div class="card-name-row">
            <div class="card-name">${esc(rack.name)} <span class="card-class-inline">PLC Rack</span></div>
          </div>
          ${panelName ? `<div class="card-location">${esc(panelName)}</div>` : ''}
          ${slotLines.map(l => `<div class="card-location" style="color:var(--primary);font-weight:500">${l}</div>`).join('')}
        </div>
      </div>
    </div>`;
}

export async function buildChildSections(type: EntityType, id: string, item: any): Promise<string> {
  const cfg = ENTITY[type];
  const allChildren = [
    ...(cfg.getChildren || []),
    ...(cfg.subclassChildren?.[item?.assetSubclass] || []),
  ];
  if (!allChildren.length) return '';

  const plusIcon = ICON_PLUS;
  const chevron  = ICON_CHEVRON;

  let html = '';
  for (const child of allChildren) {
    const all      = (state.cache as Record<string, DbRecord[]>)[child.store] || [];
    // filter/extraPresets aren't part of EntityConfig['getChildren']'s current
    // typedef — same defensive dead-code pattern as rel.filter in operations.js
    // and refFilter/readOnly in form.js; no current entity-config.js entry sets
    // either, but the checks are kept via a cast rather than widening the typedef.
    const childFilter = (child as any).filter;
    const filtered = (childFilter
      ? all.filter(i => i[child.field] === id && childFilter(i))
      : all.filter(i => i[child.field] === id)
    ).concat(
      // Also include switch assets connected to this network via switchNetworks
      type === 'networks' && child.store === 'assets'
        ? all.filter(a => a[child.field] !== id && a.switchNetworks?.some((sn: any) => sn.networkId === id))
        : []
    ).concat(
      // Also include assets connected to this network via their networkPorts
      // table (Field Device, HMI — see ASSET_CLASS_NETWORK_PORTS)
      type === 'networks' && child.store === 'assets'
        ? all.filter(a => a[child.field] !== id && a.networkPorts?.some((p: any) => p.networkId === id))
        : []
    // sortByName's { name?: string } param triggers TS's weak-type-detection against
    // DbRecord's index signature ("no properties in common") — a structural quirk, not
    // a real mismatch (DbRecord[] genuinely has a name field); cast around it.
    ).sort(sortByName as (a: DbRecord, b: DbRecord) => number);

    const slotLinked = (['networks', 'power', 'safety'].includes(type) && child.store === 'assets')
      ? getSlotLinkedRacks(type, id).filter(({ rack }) => !filtered.some(f => f.id === rack.id)).sort((a, b) => sortByName(a.rack, b.rack))
      : [];

    const cardOpts = type === 'networks' && child.store === 'assets' ? { contextNetworkId: id } : {};
    const rows = [
      ...filtered.map(ci => cardHTML(child.store, ci, cardOpts)),
      ...slotLinked.map(({ rack, slots }) => slotLinkedRackCardHTML(rack, slots, (cardOpts as any).contextNetworkId)),
    ].join('');
    const count = filtered.length + slotLinked.length;
    const title   = count > 0 ? `${esc(child.label)} (${count})` : esc(child.label);
    const bodyHtml = rows
      ? `<div class="card-list child-card-list" data-child-store="${child.store}">${rows}</div>`
      : `<div style="font-size:14px;color:var(--muted)">None added yet.</div>`;

    html += `
      <div class="det-card det-collapsible">
        <div class="det-collapsible-hdr">
          <button class="det-section-toggle" aria-expanded="false">
            <span class="section-label" style="margin:0">${title}</span>
            ${chevron}
          </button>
          <button class="det-add-child-btn" data-add-child="${child.store}" data-preset-field="${child.field}" data-preset-val="${id}" data-extra-presets="${esc(JSON.stringify((child as any).extraPresets || {}))}" aria-label="Add ${esc(child.label)}">${plusIcon}</button>
        </div>
        <div class="det-section-body" style="display:none">
          ${bodyHtml}
        </div>
      </div>
    `;
  }
  return html;
}

/* ============================================================
   DETAIL AUTOSAVE — replaces the old det-save-bar Save/Discard flow.
   Field/table edits (wired above) call armAutosave(), which arms a
   debounced tick (runAutosaveTick). Each tick rebuilds the record from
   state.detailChanges/state.detail* (buildDetailItem/buildSlotDetailItem —
   pure, DOM-free, unit-tested), validates it (validateDetailItem — reuses
   operations.js's validateRequiredFields/validateUniqueIp/validateUniqueName,
   per Risk 3 of the autosave plan), and if valid, persists it (persistDetailItem)
   without a full refreshAll() (Risk 4) — only patching state.cache/state.refs.
   Media (images/namedPhotos) is handled separately by persistDetailMedia(),
   called immediately from the gallery/slot onAdd/onRemove callbacks above.
   ============================================================ */

export type DetailValidationResult =
  | { ok: true }
  | { ok: false, kind: 'required' | 'conflict', field: FieldDef | null, message: string };

/**
 * Pure builder: merges state.detailChanges + the state.detail* wiring/switch/
 * network-port tables over the stored item. Does not touch images/namedPhotos
 * (media commits separately and immediately — see persistDetailMedia below).
 */
export function buildDetailItem(type: EntityType, item: DbRecord): DbRecord {
  const updatedItem: DbRecord = { ...item, ...state.detailChanges };

  // Remove the internal sentinels used only to mark state.detailChanges non-empty.
  delete updatedItem._switchDirty;
  delete updatedItem._netPortsDirty;

  for (const [key, rows] of Object.entries(state.detailItemTables)) {
    updatedItem[key] = rows;
  }

  if (type === 'assets' && isSwitchAsset(item.assetClass, item.assetSubclass)) {
    updatedItem.switchNetworks = state.detailSwitchNetworks.filter(r => r.networkId);
    updatedItem.switchPorts    = state.detailSwitchPorts.filter(
      r => r.portName || r.networkId || r.assetId
    );
  }

  if (type === 'assets' && ASSET_CLASS_NETWORK_PORTS.has(item.assetClass)) {
    updatedItem.networkPorts = state.detailAssetNetworkPorts.map(p => ({ ...p }));
    ['networkId', 'ipAddress', 'subnetMask', 'gateway', 'nodeAddress'].forEach(k => delete updatedItem[k]);
  }

  return updatedItem;
}

/**
 * Pure validator: required-field check (as before) PLUS unique-name/IP checks
 * reused from operations.js — the detail panel never ran these before autosave
 * (a pre-existing gap noted in the plan's Risk 3), so this closes it rather than
 * carrying it forward with autosave giving it more exposure.
 */
export function validateDetailItem(type: EntityType, item: DbRecord): DetailValidationResult {
  if (type === 'assets') {
    const ipError = validateUniqueIp(item, state.cache.assets || []);
    if (ipError) {
      const field = getEffectiveFields(type, item).find(f => f.key === 'ipAddress') || null;
      return { ok: false, kind: 'conflict', field, message: ipError };
    }
  }

  const nameError = validateUniqueName(type, item);
  if (nameError) {
    const field = getEffectiveFields(type, item).find(f => f.key === 'name') || null;
    return { ok: false, kind: 'conflict', field, message: nameError };
  }

  const missing = validateRequiredFields(type, item);
  if (missing) {
    return { ok: false, kind: 'required', field: missing, message: `${missing.label} is required` };
  }

  return { ok: true };
}

/** Patches the single changed record into state.cache/state.refs — no full refreshAll(). */
function patchCacheRecord(type: EntityType, saved: DbRecord): void {
  const arr = state.cache[type] || [];
  const idx = arr.findIndex(i => i.id === saved.id);
  state.cache[type] = idx === -1 ? [...arr, saved] : arr.map((r, i) => (i === idx ? saved : r));
  if (!state.refs[type]) state.refs[type] = {};
  (state.refs[type] as Record<string, DbRecord>)[saved.id as string] = saved;
}

/** upsert() + patch cache — the thin persist step used by every autosave tick. */
export async function persistDetailItem(type: EntityType, item: DbRecord): Promise<DbRecord> {
  const saved = await upsert(type, item);
  patchCacheRecord(type, saved);
  return saved;
}

/**
 * Pure builder for a PLC slot card: merges state.detailChanges + the
 * state.detailSlotIoPoints/PowerBus/NetworkPorts + detailItemTables.terminalWiring
 * state over the stored slot. Mirrors buildDetailItem's role but returns the
 * whole updated slots array (a slot has no id of its own — the parent rack
 * asset is what gets upserted).
 */
export function buildSlotDetailItem(rack: DbRecord, slotNumber: number): { updatedSlot: Record<string, any>, slots: any[] } | null {
  const slotIdx = (rack.slots || []).findIndex((s: any) => s.slotNumber === slotNumber);
  if (slotIdx === -1) return null;

  const slot        = rack.slots[slotIdx];
  const updatedSlot: Record<string, any> = { ...slot, ...state.detailChanges };

  delete updatedSlot._ioDirty;
  delete updatedSlot._pbDirty;
  delete updatedSlot._termWiringDirty;
  delete updatedSlot._netPortsDirty;

  if (CARD_TYPE_IO_TYPES.has(slot.cardType)) {
    const count = parseInt(updatedSlot.ioPointCount ?? slot.ioPointCount) || 0;
    const pts   = state.detailSlotIoPoints.slice(0, count);
    while (pts.length < count) pts.push({ label: 'Spare', signalType: '', wiringType: '' });
    updatedSlot.ioPoints = pts;
    updatedSlot.powerBus = state.detailSlotPowerBus.filter(e => e.refId);
  }

  if (CARD_TYPE_TERMINAL_TYPES.has(slot.cardType)) {
    updatedSlot.terminalWiring = (state.detailItemTables.terminalWiring || [])
      .filter(r => r.terminal || r.label);
  }

  if (CARD_TYPE_NET_TYPES.has(slot.cardType)) {
    updatedSlot.networkPorts = state.detailSlotNetworkPorts.map(p => ({ ...p }));
    ['networkId', 'protocol', 'ipAddress', 'subnetMask', 'gateway', 'nodeAddress']
      .forEach(k => delete updatedSlot[k]);
  }

  const slots = [...rack.slots];
  slots[slotIdx] = updatedSlot;
  return { updatedSlot, slots };
}

/**
 * Commits the detail panel's current media state (images + namedPhotos) to
 * IndexedDB immediately — called from the gallery/slot onAdd/onRemove
 * callbacks, independent of the text-field autosave debounce (see B3).
 * Re-normalizes state.detailImages/detailNamedPhotos from the freshened,
 * saved result so a later add doesn't re-freshen already-fresh blobs.
 */
export async function persistDetailMedia(type: EntityType, id: string): Promise<void> {
  const item = await getById(type, id);
  if (!item) return;
  const cfg = ENTITY[type];

  const updatedItem: DbRecord = { ...item };
  updatedItem.images = await freshenMediaItems(state.detailImages);
  if (cfg.requiredPhotoSlots) {
    const freshNamedPhotos: Record<string, NormalizedMediaItem[]> = {};
    for (const [slotKey, items] of Object.entries(state.detailNamedPhotos)) {
      freshNamedPhotos[slotKey] = await freshenMediaItems(items);
    }
    updatedItem.namedPhotos = freshNamedPhotos;
  }

  const saved = await persistDetailItem(type, updatedItem);
  state.detailImages = normalizeMediaItems(saved.images);
  if (cfg.requiredPhotoSlots) {
    state.detailNamedPhotos = {};
    for (const slotKey of cfg.requiredPhotoSlots) {
      state.detailNamedPhotos[slotKey] = normalizeMediaItems(saved.namedPhotos?.[slotKey]);
    }
  }
}

/* ---- Field-invalid UI feedback (Risk 2/3's mitigation) ---- */

function showPendingLabel(control: HTMLElement): void {
  const parent = control.parentElement;
  if (!parent || parent.querySelector('.det-field-pending-msg')) return;
  const label = document.createElement('div');
  label.className = 'det-field-pending-msg';
  label.textContent = 'Not saved yet';
  parent.appendChild(label);
}

function clearAllFieldInvalidMarks(): void {
  el.detail.querySelectorAll('.field-invalid').forEach(n => n.classList.remove('field-invalid'));
  el.detail.querySelectorAll('.det-field-pending-msg').forEach(n => n.remove());
}

function applyValidationUiFeedback(result: DetailValidationResult): void {
  if (result.ok) return;
  const control = result.field
    ? (el.detail.querySelector(`[data-edit-field="${result.field.key}"]`) as HTMLElement | null)
    : null;
  if (control) {
    control.classList.add('field-invalid');
    showPendingLabel(control);
  }
  // A conflict is a definite, actionable error — surface it loudly (toast), unlike
  // a required-field-still-empty state, which is quietly marked inline (Risk 2 vs 3).
  if (result.kind === 'conflict') showToast(result.message, 'error');
}

/* ---- Per-field undo history (B4, refined by plan Part D) ---- */

/**
 * Maximum number of undoable entries kept in state.editHistory (oldest dropped
 * first). Single source of truth for the cap — bump this one constant to
 * change how much history is kept; nothing else needs editing (see plan Part D4).
 */
export const EDIT_HISTORY_LIMIT = 5;

/** Explicit allowlist of an entity's own field/table values — never images/namedPhotos (Risk 7). */
export function buildEntityEditSnapshot(type: EntityType, item: DbRecord): Record<string, any> {
  const snap: Record<string, any> = {};
  for (const f of getEffectiveFields(type, item)) snap[f.key] = item[f.key];
  for (const t of itemTables(type, item)) snap[t.key] = (item[t.key] || []).map((r: any) => ({ ...r }));
  if (type === 'assets' && isSwitchAsset(item.assetClass, item.assetSubclass)) {
    snap.switchNetworks = (item.switchNetworks || []).map((r: any) => ({ ...r }));
    snap.switchPorts    = (item.switchPorts    || []).map((r: any) => ({ ...r }));
  }
  if (type === 'assets' && ASSET_CLASS_NETWORK_PORTS.has(item.assetClass)) {
    snap.networkPorts = (item.networkPorts || []).map((r: any) => ({ ...r }));
  }
  return snap;
}

/** Same idea as buildEntityEditSnapshot, adapted for a PLC slot's own field/table shape. */
export function buildSlotEditSnapshot(slot: Record<string, any>): Record<string, any> {
  const snap: Record<string, any> = {
    name: slot.name, cardType: slot.cardType,
    partNumber: slot.partNumber, firmwareVersion: slot.firmwareVersion,
  };
  for (const f of (PLC_CARD_TYPE_FIELDS[slot.cardType] || [])) snap[f.key] = slot[f.key];
  if (CARD_TYPE_IO_TYPES.has(slot.cardType)) {
    snap.ioPoints = (slot.ioPoints || []).map((r: any) => ({ ...r }));
    snap.powerBus = (slot.powerBus || []).map((e: any) => ({ ...e, wiring: (e.wiring || []).map((w: any) => ({ ...w })) }));
  }
  if (CARD_TYPE_TERMINAL_TYPES.has(slot.cardType)) {
    snap.terminalWiring = (slot.terminalWiring || []).map((r: any) => ({ ...r }));
  }
  if (CARD_TYPE_NET_TYPES.has(slot.cardType)) {
    snap.networkPorts = (slot.networkPorts || []).map((p: any) => ({ ...p }));
  }
  return snap;
}

/** Scalar `===`, falling back to JSON comparison for the array/object-valued table keys. */
function _valuesEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

/**
 * Pure: diffs two entity records over the undo-eligible allowlist (the same
 * keys buildEntityEditSnapshot enumerates), returning one {field, prevValue}
 * per key that actually changed. Used by runAutosaveTick() to turn "what did
 * this tick write" into one undo entry per changed field/table, instead of one
 * whole-record snapshot per edit session (plan Part D).
 */
export function diffEntityEditableKeys(type: EntityType, before: DbRecord, after: DbRecord): Array<{ field: string, prevValue: any }> {
  const beforeSnap = buildEntityEditSnapshot(type, before);
  const afterSnap  = buildEntityEditSnapshot(type, after);
  const diffs: Array<{ field: string, prevValue: any }> = [];
  for (const key of Object.keys(afterSnap)) {
    if (!_valuesEqual(beforeSnap[key], afterSnap[key])) diffs.push({ field: key, prevValue: beforeSnap[key] });
  }
  return diffs;
}

/** Same idea as diffEntityEditableKeys, adapted for a PLC slot's own field/table shape. */
export function diffSlotEditableKeys(before: Record<string, any>, after: Record<string, any>): Array<{ field: string, prevValue: any }> {
  const beforeSnap = buildSlotEditSnapshot(before);
  const afterSnap  = buildSlotEditSnapshot(after);
  const diffs: Array<{ field: string, prevValue: any }> = [];
  for (const key of Object.keys(afterSnap)) {
    if (!_valuesEqual(beforeSnap[key], afterSnap[key])) diffs.push({ field: key, prevValue: beforeSnap[key] });
  }
  return diffs;
}

/** Display names for the hardcoded table keys not covered by a FieldDef/ItemTableDef label. */
const TABLE_KEY_LABELS: Record<string, string> = {
  switchNetworks: 'Switch Networks',
  switchPorts:    'Switch Ports',
  networkPorts:   'Network Ports',
  ioPoints:       'IO Points',
  powerBus:       'Power Bus',
  terminalWiring: 'Terminal Wiring',
};

/** Resolves a changed key to its display label for an entity's history-entry text. */
function resolveEntityFieldLabel(type: EntityType, item: DbRecord, field: string): string {
  const f = getEffectiveFields(type, item).find(fd => fd.key === field);
  if (f) return f.label;
  const t = itemTables(type, item).find(td => td.key === field);
  if (t) return t.label;
  return TABLE_KEY_LABELS[field] || field;
}

/** Resolves a changed key to its display label for a PLC slot's history-entry text. */
function resolveSlotFieldLabel(slot: Record<string, any>, field: string): string {
  if (field === 'name')             return 'Card Name';
  if (field === 'partNumber')       return 'Part Number';
  if (field === 'firmwareVersion')  return 'Firmware Version';
  if (field === 'cardType')         return 'Card Type';
  const f = (PLC_CARD_TYPE_FIELDS[slot.cardType] || []).find(fd => fd.key === field);
  if (f) return f.label;
  return TABLE_KEY_LABELS[field] || field;
}

/**
 * Pure: builds one EditHistoryEntry per {field, prevValue} diff and appends
 * them to `history` in place, capping it at EDIT_HISTORY_LIMIT (oldest
 * dropped first). Split out from pushEditHistoryEntries() below so the
 * cap/append logic is unit-testable without the setSetting/refreshHistoryUi
 * side effects (mirrors persistDetailItem vs the pure builders in B2).
 */
export function appendEditHistoryEntries(
  history: EditHistoryEntry[],
  type: FormType,
  id: string,
  recordLabel: string,
  diffs: Array<{ field: string, prevValue: any }>,
  fieldLabelFor: (field: string) => string,
  slotNumber?: number,
): void {
  for (const { field, prevValue } of diffs) {
    history.push({
      type, id, field, prevValue,
      label: `${recordLabel} — ${fieldLabelFor(field)}`,
      ts: new Date().toISOString(),
      slotNumber,
    });
  }
  while (history.length > EDIT_HISTORY_LIMIT) history.shift();
}

/**
 * Pushes one EditHistoryEntry per changed field/table key onto state.editHistory
 * (via appendEditHistoryEntries), then persists the updated history via
 * setSetting and refreshes the header badge/panel. Called from runAutosaveTick()
 * with the diff between the pre-tick and about-to-be-written record.
 */
function pushEditHistoryEntries(
  type: FormType,
  id: string,
  recordLabel: string,
  diffs: Array<{ field: string, prevValue: any }>,
  fieldLabelFor: (field: string) => string,
  slotNumber?: number,
): void {
  if (!diffs.length) return;
  appendEditHistoryEntries(state.editHistory, type, id, recordLabel, diffs, fieldLabelFor, slotNumber);
  void setSetting('editHistory', state.editHistory);
  refreshHistoryUi();
}

/* ---- Debounced autosave tick ---- */

/**
 * Rebuilds + validates + (if valid) persists the currently-open detail
 * panel's pending edit. Used both as the debounced tick's target and,
 * directly, by flushOrBlockPendingAutosave() when navigating away.
 * Does not re-render the panel or call refreshAll() — see Risk 4.
 */
async function runAutosaveTick(): Promise<DetailValidationResult> {
  const type = state.detailType;
  const id   = state.detailId;
  if (!type || !id) { state.hasPendingAutosave = false; return { ok: true }; }

  if (type === FORM_TYPE.PLC_SLOT) {
    const rack = await getById('assets', id);
    if (!rack) { state.hasPendingAutosave = false; return { ok: true }; }
    const slotNumber = state.detailSlotNumber as number;
    const beforeSlot  = rack.slots?.find((s: any) => s.slotNumber === slotNumber);
    const built = buildSlotDetailItem(rack, slotNumber);
    if (!built) { state.hasPendingAutosave = false; return { ok: true }; }
    const saved = await upsert('assets', { ...rack, slots: built.slots });
    patchCacheRecord('assets', saved);
    if (beforeSlot) {
      const diffs      = diffSlotEditableKeys(beforeSlot, built.updatedSlot);
      const recordLabel = `${rack.name || 'PLC Rack'} — Slot ${slotNumber}${built.updatedSlot.name ? ` (${built.updatedSlot.name})` : ''}`;
      pushEditHistoryEntries(type, id, recordLabel, diffs, f => resolveSlotFieldLabel(built.updatedSlot, f), slotNumber);
    }
    state.hasPendingAutosave = false;
    return { ok: true };
  }

  const entityType = type as EntityType;
  const item = await getById(entityType, id);
  if (!item) { state.hasPendingAutosave = false; return { ok: true }; }

  const built  = buildDetailItem(entityType, item);
  const result = validateDetailItem(entityType, built);
  clearAllFieldInvalidMarks();
  if (!result.ok) {
    applyValidationUiFeedback(result);
    return result; // Nothing written — state.hasPendingAutosave stays true.
  }

  const diffs = diffEntityEditableKeys(entityType, item, built);
  await persistDetailItem(entityType, built);
  const recordLabel = built.name || item.name || ENTITY[entityType].label;
  pushEditHistoryEntries(type, id, recordLabel, diffs, f => resolveEntityFieldLabel(entityType, built, f));
  state.hasPendingAutosave = false;
  return { ok: true };
}

const scheduleAutosave = debounce(() => { void runAutosaveTick(); }, 1100);

/** Called by every field/table edit handler wired above. */
function armAutosave(): void {
  state.hasPendingAutosave = true;
  scheduleAutosave();
}

/**
 * Cancels any pending autosave timer and clears session-scoped autosave
 * state. Called whenever the detail panel's edit buffers are reset (panel
 * opened, re-rendered from a fresh record, or closed) so a stale timer from
 * a previous record can never fire against the wrong one.
 */
export function resetAutosaveSession(): void {
  scheduleAutosave.cancel();
  state.hasPendingAutosave = false;
}

/**
 * Called by closeDetail()/navigate() (js/app.js) before leaving the detail
 * panel. If nothing is pending, resolves immediately. If a pending edit is
 * currently valid, flushes it synchronously and proceeds with no dialog. If
 * it's currently invalid, shows the narrow 2-option "Fix it / Discard this
 * edit" dialog (Risk 2's mitigation) and returns false (stay) unless the
 * user chooses to discard.
 */
export async function flushOrBlockPendingAutosave(): Promise<boolean> {
  if (!state.hasPendingAutosave) return true;
  scheduleAutosave.cancel();

  const result = await runAutosaveTick();
  if (result.ok) return true;

  const discard = await confirm(
    'Fix Before Leaving',
    result.message,
    { yesLabel: 'Discard this edit', noLabel: 'Fix it', yesClass: 'btn-danger' }
  );
  if (discard) {
    state.hasPendingAutosave = false;
    clearAllFieldInvalidMarks();
    await renderDetail();
    return true;
  }

  const control = result.field
    ? (el.detail.querySelector(`[data-edit-field="${result.field.key}"]`) as HTMLElement | null)
    : null;
  control?.focus();
  return false;
}
