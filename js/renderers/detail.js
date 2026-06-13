/* ============================================================
   DETAIL VIEW RENDERERS
   Depends on: entity-config.js, state.js, utils.js, db.js, app.js (openDetail,
   closeDetail, openSheet, openSlotForm, openSlotDetail, openAssignOrCreate,
   cardHTML, duplicateItem, deleteItem, upsert)
   ============================================================ */

// preserveScroll: re-renders in place after a slot edit; saves/restores scroll to avoid jump.
async function renderDetail({ preserveScroll = false } = {}) {
  const { detailType: type, detailId: id } = state;
  if (!type || !id) return;
  const savedScroll = preserveScroll ? el.detail.scrollTop : 0;
  if (type === '__plc_slot__') return renderSlotDetail(savedScroll);
  return renderEntityDetail(savedScroll);
}

async function renderSlotDetail(savedScroll) {
  const { detailId: id } = state;
  await refreshAll();
    const rack = state.refs.assets?.[id];
    if (!rack) { closeDetail(); return; }
    const slotNumber = state.detailSlotNumber;
    const slot = rack.slots?.find(s => s.slotNumber === slotNumber);
    const network = slot?.networkId ? state.refs.networks?.[slot.networkId] : null;

    const editIcon = ICON_EDIT;
    const backIcon  = ICON_BACK;

    const field = (label, val) => val
      ? `<div class="det-field"><div class="det-flabel">${esc(label)}</div><div class="det-fval">${esc(val)}</div></div>`
      : `<div class="det-field"><div class="det-flabel">${esc(label)}</div><div class="det-fval det-fval-empty">—</div></div>`;

    // IO usage for Analog/Digital
    let ioUsage = '';
    if (CARD_TYPE_IO_TYPES.has(slot?.cardType)) {
      const total = parseInt(slot?.ioPointCount) || (slot?.ioPoints?.length ?? 0);
      const inUse = (slot?.ioPoints || []).filter(p => p.label && p.label !== 'Spare').length;
      ioUsage = `${inUse} / ${total}`;
    }

    // Base fields every card has
    let fieldsHtml = field('Part Number', slot?.partNumber)
      + field('Firmware Version', slot?.firmwareVersion)
      + (ioUsage ? field('IO In Use', ioUsage) : '');

    // Card-type-specific fields
    const ctFields = PLC_CARD_TYPE_FIELDS[slot?.cardType] || [];
    for (const f of ctFields) {
      if (f.type === 'ref') {
        const refItem = f.refStore === 'networks' ? network : state.refs[f.refStore]?.[slot?.[f.key]];
        fieldsHtml += field(f.label, refItem?.name);
      } else {
        fieldsHtml += field(f.label, slot?.[f.key]);
      }
    }

    // Network address fields for Controller and Communication cards
    if (CARD_TYPE_NET_TYPES.has(slot?.cardType) && network) {
      const netFields = ENTITY.assets.networkTypeFields?.[network.networkType] || [];
      for (const f of netFields) fieldsHtml += field(f.label, slot?.[f.key]);
    }

    // IO points table for Analog/Digital
    let ioCard = '';
    if (CARD_TYPE_IO_TYPES.has(slot?.cardType)) {
      const isAnalog = slot.cardType === 'Analog';
      const pts = slot?.ioPoints || [];
      const rowsHtml = pts.length
        ? `<table class="wiring-det-table io-points-det-table">
             <thead><tr>
               <th>#</th>
               ${isAnalog ? '<th>Signal Type</th><th>Wiring Type</th>' : ''}
               <th>Label</th>
             </tr></thead>
             <tbody>${pts.map((r, i) => `
               <tr>
                 <td>${i}</td>
                 ${isAnalog ? `<td>${esc(r.signalType || '')}</td><td>${esc(r.wiringType || '')}</td>` : ''}
                 <td>${esc(r.label || '')}</td>
               </tr>`).join('')}
             </tbody>
           </table>`
        : `<div class="wiring-empty">No IO points configured</div>`;
      ioCard = buildCollapsibleCard('IO Points', rowsHtml, { expanded: true });
    }

    let powerBusCards = '';
    if (CARD_TYPE_IO_TYPES.has(slot?.cardType)) {
      for (const entry of (slot?.powerBus || [])) {
        const store  = entry.type === 'Safety Circuit' ? 'safety' : 'power';
        const device = state.refs[store]?.[entry.refId];
        const wRows  = entry.wiring || [];
        const wiringHtml = wRows.length
          ? `<table class="wiring-det-table"><thead><tr><th>Terminal</th><th>Label</th></tr></thead><tbody>${wRows.map(w => `<tr><td class="wiring-det-terminal">${esc(w.terminal)}</td><td>${esc(w.label)}</td></tr>`).join('')}</tbody></table>`
          : `<div class="wiring-empty">No wiring entries</div>`;
        powerBusCards += buildCollapsibleCard(`Power Bus — ${device?.name || entry.type}`, wiringHtml);
      }
    }

    el.detail.innerHTML = `
      <div class="det-header">
        <button class="icon-btn" id="det-back" aria-label="Back">${backIcon}</button>
        <div style="flex:1"></div>
        <button class="icon-btn" id="det-edit" aria-label="Edit">${editIcon}</button>
      </div>
      <div class="det-body">
        <div class="det-title-row">
          <div class="det-name">${esc(slot?.name || '(unnamed card)')}</div>
        </div>
        <div class="det-badges">
          <span class="badge badge-asset">Slot ${slotNumber}</span>
          ${slot?.cardType ? `<span class="badge badge-asset">${esc(slot.cardType)}</span>` : ''}
          <span class="badge badge-panel">${esc(rack.name)}</span>
        </div>
        <div class="det-card">
          <div class="det-fields">${fieldsHtml}</div>
        </div>
        ${ioCard}
        ${powerBusCards}
      </div>
    `;

    el.detail.querySelector('#det-back').addEventListener('click', closeDetail);
    el.detail.querySelector('#det-edit')?.addEventListener('click', () => openSlotForm(id, slotNumber));
    el.detail.querySelectorAll('.det-section-toggle').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const body     = btn.closest('.det-collapsible').querySelector('.det-section-body');
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        body.style.display = expanded ? 'none' : 'block';
      });
    });
  el.detail.scrollTop = savedScroll;
}

// Returns HTML string of <span class="sn-det-field"> pills for fields that have a value in data.
function buildFieldPills(fields, data) {
  return fields
    .filter(f => data[f.key])
    .map(f => `<span class="sn-det-field">${esc(f.label)}<strong>${esc(data[f.key])}</strong></span>`)
    .join('');
}

function buildSlotRow(rackId, slotNumber, slot) {
  if (!slot) {
    return `<div class="sn-det-row rack-slot-row" data-rack-id="${rackId}" data-slot-num="${slotNumber}" style="cursor:pointer">
      <div class="rack-slot-hdr"><span class="sn-det-name">Slot ${slotNumber}</span></div>
      <div class="sn-det-fields" style="color:var(--muted)">Empty — tap to add card</div>
    </div>`;
  }
  const typeTag = slot.cardType   ? `<span class="sn-det-field">${esc(slot.cardType)}</span>` : '';
  const pnTag   = slot.partNumber ? `<span class="sn-det-field">PN<strong>${esc(slot.partNumber)}</strong></span>` : '';
  const revTag  = slot.revision   ? `<span class="sn-det-field">Rev<strong>${esc(slot.revision)}</strong></span>` : '';
  let ioTag = '';
  if (CARD_TYPE_IO_TYPES.has(slot.cardType)) {
    const total = parseInt(slot.ioPointCount) || (slot.ioPoints?.length ?? 0);
    const inUse = (slot.ioPoints || []).filter(p => p.label && p.label !== 'Spare').length;
    ioTag = `<span class="sn-det-field">IO<strong>${inUse}/${total}</strong></span>`;
  }
  let ipTag = '';
  if (CARD_TYPE_NET_TYPES.has(slot.cardType)) {
    const netFields = getNetworkAddrFields(slot.networkId);
    const addrField = netFields.find(f => f.section === 'Network Address' && slot[f.key]);
    if (addrField) {
      const shortLabel = addrField.label.split(' ')[0];
      ipTag = `<span class="sn-det-field">${shortLabel}<strong>${esc(slot[addrField.key])}</strong></span>`;
    } else {
      const addr = slot.ipAddress || slot.nodeAddress;
      if (addr) ipTag = `<span class="sn-det-field">IP<strong>${esc(addr)}</strong></span>`;
    }
  }
  return `<div class="sn-det-row rack-slot-row" data-rack-id="${rackId}" data-slot-num="${slotNumber}" style="cursor:pointer">
    <div class="rack-slot-hdr">
      <span class="sn-det-name">Slot ${slotNumber}</span>
      <button class="rack-slot-clear wiring-rm-btn" data-rack-id="${rackId}" data-slot-num="${slotNumber}" aria-label="Clear slot">${ICON_RM}</button>
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
 * @param {object} f     - Field config from entity-config (key, label, type, options, refStore)
 * @param {object} item  - Current entity data (provides the initial value)
 * @returns {string} HTML string for the control, wrapped in .det-fval
 */
function buildEditableFieldHtml(f, item) {
  const rawVal = item[f.key] ?? '';

  if (f.type === 'text') {
    return `<input type="text" class="det-inline-input" data-edit-field="${f.key}" value="${esc(String(rawVal))}">`;
  }

  if (f.type === 'textarea') {
    return `<textarea class="det-inline-textarea" data-edit-field="${f.key}">${esc(String(rawVal))}</textarea>`;
  }

  if (f.type === 'enum') {
    const opts = (f.options || []).map(o =>
      `<option value="${esc(o)}"${o === rawVal ? ' selected' : ''}>${esc(o)}</option>`
    ).join('');
    return `<select class="det-inline-select" data-edit-field="${f.key}">
      <option value="">— Select —</option>
      ${opts}
    </select>`;
  }

  if (f.type === 'ref') {
    const refItems = state.cache[f.refStore] || [];
    const opts = refItems.map(i =>
      `<option value="${i.id}"${i.id === rawVal ? ' selected' : ''}>${esc(i.name)}</option>`
    ).join('');
    return `<select class="det-inline-select" data-edit-field="${f.key}">
      <option value="">— Unassigned —</option>
      ${opts}
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
async function renderEntityDetail(savedScroll) {
  const { detailType: type, detailId: id } = state;
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
    state.detailItemTables[t.key] = (item[t.key] || []).map(r => ({ ...r }));
  }

  // Load switch table state for managed switch assets
  const showSwitchTables = type === 'assets' && isManagedSwitch(item.assetClass, item.assetSubclass);
  if (showSwitchTables) {
    state.detailSwitchNetworks = (item.switchNetworks || []).map(r => ({ ...r }));
    state.detailSwitchPorts    = (item.switchPorts    || []).map(r => ({ ...r }));
  }

  /* ------------------------------------------------------------------
     Build field rows grouped by section.
     Fields are rendered as live editable inputs instead of read-only divs.
     ------------------------------------------------------------------ */
  const skipKeys = new Set(['id','createdAt','updatedAt','images','namedPhotos','assignedToType','assignedToId','name']);
  const sectionMap = new Map();

  for (const f of getEffectiveFields(type, item)) {
    if (skipKeys.has(f.key) || f.type === 'assign-type' || f.type === 'assign-id') continue;
    if (f.key === 'assetSubclass' && !(ENTITY.assets.classSubclasses?.[item.assetClass]?.length)) continue;

    // Each field is a label + an editable control (input, select, or textarea)
    const fieldHtml = `
      <div class="det-field">
        <div class="det-flabel">${esc(f.label)}</div>
        ${buildEditableFieldHtml(f, item)}
      </div>`;

    const sectionKey = f.section || null;
    if (!sectionMap.has(sectionKey)) sectionMap.set(sectionKey, []);
    sectionMap.get(sectionKey).push(fieldHtml);
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
      'Network Connections',
      `<div id="det-switch-networks-container"></div>`,
      { expanded: true }
    );
    switchPortsCard = buildCollapsibleCard(
      'Port Assignments',
      `<div id="det-switch-ports-container"></div>`,
      { expanded: true }
    );
  }

  // Assignment badge (read-only display — not editable inline)
  let assignBadge = '';
  if (item.assignedToType) {
    if (item.assignedToType === 'Plant') {
      assignBadge = `<span class="badge badge-plant">Plant-wide</span>`;
    } else {
      const s   = ASSIGN_STORE_MAP[item.assignedToType];
      const ref = s ? state.refs[s]?.[item.assignedToId] : null;
      const bc  = { Area:'badge-area', Panel:'badge-panel', Power:'badge-power', 'Safety Circuit':'badge-safety', Network:'badge-network' }[item.assignedToType] || 'badge-asset';
      assignBadge = `<span class="badge ${bc}">${esc(item.assignedToType)}: ${esc(ref?.name || '—')}</span>`;
    }
  }

  // PLC rack slots card — slots remain click-to-open (not inline editable)
  let rackSlotsCard = '';
  if (type === 'assets' && item.assetClass === 'PLC') {
    const slotCount = parseInt(item.slotCount) || 0;
    const slotsMap  = new Map((item.slots || []).map(s => [s.slotNumber, s]));
    const cardCount = (item.slots || []).length;
    const title     = cardCount > 0 ? `Cards (${cardCount})` : 'Cards';
    const slotRows  = slotCount === 0
      ? `<div style="font-size:14px;color:var(--muted)">No slots configured — set Slot Count above.</div>`
      : Array.from({ length: slotCount }, (_, k) => buildSlotRow(item.id, k, slotsMap.get(k))).join('');

    rackSlotsCard = `
      <div class="det-card det-collapsible">
        <button class="det-section-toggle" aria-expanded="true">
          <span class="section-label" style="margin:0">${title}</span>
          ${ICON_CHEVRON}
        </button>
        <div class="det-section-body">
          <div class="sn-det-list">${slotRows}</div>
        </div>
      </div>`;
  }

  const childSections = await buildChildSections(type, id, item);

  /* ------------------------------------------------------------------
     Render HTML.
     The name field is always an editable input (areas were previously
     readonly; all types now use the same pattern).
     The "Edit" button (opens bottom-sheet form) is removed — all editing
     happens inline.  The "Duplicate" button is kept.
     ------------------------------------------------------------------ */
  el.detail.innerHTML = `
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
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
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
    ${physicalSectionCards}
    ${requiredPhotosCard}
    ${otherPhotosCard}
    ${childSections}
    <div class="det-save-bar" id="det-save-bar">
      <button class="btn btn-outline btn-sm" id="det-discard">Discard</button>
      <button class="btn btn-primary btn-sm" id="det-save-changes">Save Changes</button>
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
      renderItemTable(t.key, t.label, t.placeholder1 || 'Terminal', t.placeholder2 || 'Label', {
        containerId,
        tablesState: state.detailItemTables,
      });
    }
  }

  /* ------------------------------------------------------------------
     Mount editable switch network / port tables for managed switches.
     The rerenderSwitch closure keeps both tables in sync after mutations
     without the detail re-rendering the entire panel.
     ------------------------------------------------------------------ */
  if (showSwitchTables) {
    const rerenderSwitch = () => {
      renderSwitchNetworksTable(
        'det-switch-networks-container',
        state.detailSwitchNetworks,
        state.detailSwitchPorts,
        rerenderSwitch,
        () => { state.detailChanges._switchDirty = true; }, // sentinel so hasUnsavedDetailChanges fires
        item.assetSubclass
      );
      renderSwitchPortsTable(
        'det-switch-ports-container',
        state.detailSwitchNetworks,
        state.detailSwitchPorts,
        rerenderSwitch,
        () => { state.detailChanges._switchDirty = true; },
        item.id // exclude the switch itself from device options
      );
    };
    rerenderSwitch();
  }

  /* ------------------------------------------------------------------
     Mount editable media galleries.
     Callbacks mutate state.detailImages / state.detailNamedPhotos and
     set detailMediaDirty so the navigation guard triggers correctly.
     ------------------------------------------------------------------ */
  if (cfg.requiredPhotoSlots) {
    for (const slot of cfg.requiredPhotoSlots) {
      const slotId    = `det-slot-${slot.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
      const container = document.getElementById(slotId);
      if (container) {
        renderMediaSlot(container, slot, state.detailNamedPhotos[slot], {
          onAdd:    items => { state.detailNamedPhotos[slot].push(...items); state.detailMediaDirty = true; },
          onRemove: i     => { state.detailNamedPhotos[slot].splice(i, 1);   state.detailMediaDirty = true; },
        });
      }
    }
  }
  if (!cfg.noImages) {
    const gallery = document.getElementById('det-gallery');
    if (gallery) {
      renderMediaGallery(gallery, state.detailImages, {
        onAdd:    items => { state.detailImages.push(...items); state.detailMediaDirty = true; },
        onRemove: i     => { state.detailImages.splice(i, 1);  state.detailMediaDirty = true; },
      });
    }
  }

  /* ------------------------------------------------------------------
     Wire all [data-edit-field] inputs (text, textarea, select, name input).
     Any change records the value in state.detailChanges.
     The panelId → areaId cascade is handled specially below.
     ------------------------------------------------------------------ */
  el.detail.querySelectorAll('[data-edit-field]').forEach(control => {
    const key = control.dataset.editField;
    const ev  = control.tagName === 'SELECT' ? 'change' : 'input';
    control.addEventListener(ev, () => {
      state.detailChanges[key] = control.value;
    });
  });

  // When the user changes the panel, auto-fill the area to match the panel's area.
  // This mirrors the cascade logic previously in activateInlineEdit.
  const panelSel = el.detail.querySelector('[data-edit-field="panelId"]');
  if (panelSel) {
    panelSel.addEventListener('change', () => {
      const panel = state.refs.panels?.[panelSel.value];
      if (panel?.areaId) {
        state.detailChanges['areaId'] = panel.areaId;
        const areaSel = el.detail.querySelector('[data-edit-field="areaId"]');
        if (areaSel) areaSel.value = panel.areaId;
      }
    });
  }

  /* ------------------------------------------------------------------
     Button wiring
     ------------------------------------------------------------------ */
  el.detail.querySelector('#det-back').addEventListener('click', closeDetail);
  el.detail.querySelector('#det-duplicate')?.addEventListener('click', () => duplicateItem(type, id));

  // Discard: re-render from saved state (resets all edit state via renderEntityDetail)
  el.detail.querySelector('#det-discard')?.addEventListener('click', () => {
    renderDetail();
  });

  // Save: commit all pending changes (fields + media + wiring + switch tables)
  el.detail.querySelector('#det-save-changes')?.addEventListener('click', () => {
    saveDetailChanges(type, id);
  });

  // Child-entity card clicks / delete buttons
  el.detail.querySelectorAll('.child-card-list').forEach(list => {
    const childStore = list.dataset.childStore;
    list.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => openDetail(childStore, card.dataset.id));
    });
    list.querySelectorAll('.card-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        deleteItem(childStore, btn.dataset.id, btn.dataset.name);
      });
    });
  });

  // PLC rack slot rows
  el.detail.querySelectorAll('.rack-slot-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.rack-slot-clear')) return;
      const rackId  = row.dataset.rackId;
      const slotNum = +row.dataset.slotNum;
      const rack    = state.refs.assets?.[rackId];
      const hasCard = rack?.slots?.some(s => s.slotNumber === slotNum);
      if (hasCard) openSlotDetail(rackId, slotNum);
      else         openSlotForm(rackId, slotNum);
    });
  });
  el.detail.querySelectorAll('.rack-slot-clear').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const rackId  = btn.dataset.rackId;
      const slotNum = +btn.dataset.slotNum;
      const rack    = state.refs.assets?.[rackId];
      if (!rack) return;
      const slot = rack.slots?.find(s => s.slotNumber === slotNum);
      const ok = await confirm('Delete card?', `Remove "${slot?.name || 'card'}" from Slot ${slotNum}? This cannot be undone.`);
      if (!ok) return;
      const slots = (rack.slots || []).filter(s => s.slotNumber !== slotNum);
      await upsert('assets', { ...rack, slots });
      await refreshAll();
      renderDetail({ preserveScroll: true });
    });
  });

  // Add-child buttons (shown in child-section headers)
  el.detail.querySelectorAll('[data-add-child]').forEach(btn => {
    btn.addEventListener('click', () => {
      const childType    = btn.dataset.addChild;
      const presetField  = btn.dataset.presetField;
      const presetVal    = btn.dataset.presetVal;
      const extraPresets = btn.dataset.extraPresets ? JSON.parse(btn.dataset.extraPresets) : {};
      if (childType === 'assets' || childType === 'power' || childType === 'safety' || childType === 'panels') {
        openAssignOrCreate(childType, presetField, presetVal);
      } else {
        openSheet(childType, null, { field: presetField, value: presetVal, extra: extraPresets });
      }
    });
  });

  // Collapsible section toggles
  el.detail.querySelectorAll('.det-section-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const body     = btn.closest('.det-collapsible').querySelector('.det-section-body');
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      body.style.display = expanded ? 'none' : 'block';
    });
  });

  el.detail.scrollTop = savedScroll;
}

function buildCollapsibleCard(title, bodyHtml, { expanded = false } = {}) {
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

function getSlotLinkedRacks(parentType, parentId) {
  return (state.cache.assets || [])
    .filter(a => a.assetClass === 'PLC' && a.slots?.length)
    .map(rack => {
      const slots = rack.slots.filter(slot => {
        if (parentType === 'networks')
          return CARD_TYPE_NET_TYPES.has(slot.cardType) && slot.networkId === parentId;
        if (parentType === 'power')
          return slot.powerBus?.some(pb => pb.type === 'Power' && pb.refId === parentId);
        if (parentType === 'safety')
          return slot.powerBus?.some(pb => pb.type === 'Safety Circuit' && pb.refId === parentId);
        return false;
      });
      return slots.length ? { rack, slots } : null;
    })
    .filter(Boolean);
}

function slotLinkedRackCardHTML(rack, slots) {
  const cfg = ENTITY.assets;
  const firstMedia = rack.images?.[0] || (rack.namedPhotos && Object.values(rack.namedPhotos)[0]) || null;
  const thumbSrc = getCardThumbSrc(firstMedia);
  const thumb = thumbSrc
    ? `<img class="card-thumb" src="${thumbSrc}" alt="">`
    : `<div class="card-thumb-ph" style="color:${cfg.color};background:${cfg.bgColor}">${entityIcon('assets', 24)}</div>`;
  const panelName = rack.panelId ? state.refs.panels?.[rack.panelId]?.name : '';
  const slotLines = slots.map(s => {
    const label = `Slot ${s.slotNumber}${s.name ? ` (${s.name})` : ''}`;
    const net = state.refs.networks?.[s.networkId];
    const addr = s.ipAddress || s.nodeAddress || '';
    const netPart = net ? (addr ? ` — ${net.name} — ${addr}` : ` — ${net.name}`) : '';
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

async function buildChildSections(type, id, item) {
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
    const all      = state.cache[child.store] || [];
    const filtered = (child.filter
      ? all.filter(i => i[child.field] === id && child.filter(i))
      : all.filter(i => i[child.field] === id)
    ).concat(
      // Also include switch assets connected to this network via switchNetworks
      type === 'networks' && child.store === 'assets'
        ? all.filter(a => a[child.field] !== id && a.switchNetworks?.some(sn => sn.networkId === id))
        : []
    ).sort(sortByName);

    const slotLinked = (['networks', 'power', 'safety'].includes(type) && child.store === 'assets')
      ? getSlotLinkedRacks(type, id).filter(({ rack }) => !filtered.some(f => f.id === rack.id)).sort((a, b) => sortByName(a.rack, b.rack))
      : [];

    const cardOpts = type === 'networks' && child.store === 'assets' ? { contextNetworkId: id } : {};
    const rows = [
      ...filtered.map(ci => cardHTML(child.store, ci, cardOpts)),
      ...slotLinked.map(({ rack, slots }) => slotLinkedRackCardHTML(rack, slots)),
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
          <button class="det-add-child-btn" data-add-child="${child.store}" data-preset-field="${child.field}" data-preset-val="${id}" data-extra-presets="${esc(JSON.stringify(child.extraPresets || {}))}" aria-label="Add ${esc(child.label)}">${plusIcon}</button>
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
   DETAIL SAVE — commits all pending edits to IndexedDB
   ============================================================ */

/**
 * Saves all pending changes from the detail panel:
 *   - Field changes (state.detailChanges)
 *   - Media (state.detailImages, state.detailNamedPhotos)
 *   - Wiring tables (state.detailItemTables)
 *   - Switch network/port tables (state.detailSwitchNetworks/Ports, managed switches only)
 *
 * After a successful save, all detail edit state is reset and the panel re-renders
 * from the freshly saved item so inputs reflect the committed values.
 */
async function saveDetailChanges(type, id) {
  const cfg  = ENTITY[type];
  const item = await getById(type, id);
  if (!item) return;

  // Merge field-level changes over the saved item
  const updatedItem = { ...item, ...state.detailChanges };

  // Remove the internal sentinel used by switch-table dirty tracking
  delete updatedItem._switchDirty;

  // Persist current media state (always write, even if unchanged, so no data is lost)
  updatedItem.images = state.detailImages;
  updatedItem.namedPhotos = Object.fromEntries(
    Object.entries(state.detailNamedPhotos)
  );

  // Persist each editable wiring table key back into the item
  for (const [key, rows] of Object.entries(state.detailItemTables)) {
    updatedItem[key] = rows;
  }

  // Persist switch tables for managed switch assets
  if (type === 'assets' && isManagedSwitch(item.assetClass, item.assetSubclass)) {
    updatedItem.switchNetworks = state.detailSwitchNetworks.filter(r => r.networkId);
    updatedItem.switchPorts    = state.detailSwitchPorts.filter(
      r => r.portName || r.networkId || r.assetId
    );
  }

  // Required field validation (applied to merged item so new values are checked)
  for (const f of getEffectiveFields(type, updatedItem)) {
    if (f.required && !updatedItem[f.key]) {
      showToast(`${f.label} is required`, 'error');
      return;
    }
  }

  await upsert(type, updatedItem);
  await refreshAll();

  // Reset all detail edit state before re-render so the guard doesn't fire
  _clearDetailEditState();

  showToast(`${cfg.label} saved`, 'success');
  renderDetail({ preserveScroll: true });
}
