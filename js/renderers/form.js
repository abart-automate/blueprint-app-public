// @ts-check
/* ============================================================
   FORM RENDERER
   Renders the bottom-sheet form for creating/editing entities,
   PLC slots, and the plant settings form.
   Depends on: state, ENTITY, ASSIGN_STORE_MAP, PLC_CARD_TYPE_FIELDS,
               ASSET_CLASS_NETWORK_PORTS,
               esc, getById, refreshAll,
               renderMediaSlot, renderMediaGallery, renderItemTable,
               renderClassItemTables, renderIoPointsTable, syncIoPointCount,
               renderSwitchNetworksTableForm, renderSwitchPortsTableForm,
               renderPowerBusTableForm, renderNetworkPortsTableForm,
               _renderNetworkPortsTable.
   ============================================================ */

/** @returns {Promise<void>} */
async function renderForm() {
  if (state.formType === FORM_TYPE.PLANT) return;
  if (state.formType === FORM_TYPE.PLC_SLOT) return renderSlotForm();
  return renderEntityForm();
}

/**
 * Shows/hides one or more wrap elements based on `condition`, and invokes
 * `renderFns` (zero-arg callbacks) when shown. Shared by every "toggle a
 * form section based on the current asset class/subclass, then render its
 * sub-table(s)" pattern in renderEntityForm (the switch VLAN/port tables,
 * the asset-level Network Ports table) — the DOM-toggle logic was
 * previously duplicated per section.
 * @param {string[]} wrapIds
 * @param {boolean} condition
 * @param {Array<() => void>} [renderFns]
 */
function toggleConditionalSection(wrapIds, condition, renderFns = []) {
  for (const id of wrapIds) {
    const wrap = $(id);
    if (wrap) wrap.style.display = condition ? '' : 'none';
  }
  if (condition) renderFns.forEach(fn => fn());
}

/* ---- PLC SLOT FORM ---- */

/** @returns {Promise<void>} */
async function renderSlotForm() {
  const { rackId, slotNumber } = /** @type {{ rackId: string, slotNumber: number }} */ (state.formPreset);
  const rack     = state.refs.assets?.[rackId];
  const existing = rack?.slots?.find(/** @param {any} s */ s => s.slotNumber === slotNumber) || null;
  await refreshAll();

  const cardTypeOpts = Object.keys(PLC_CARD_TYPE_FIELDS)
    .map(t => `<option value="${t}"${existing?.cardType === t ? ' selected' : ''}>${t}</option>`)
    .join('');
  const nameEmptyCls      = !existing?.name          ? ' field-empty' : '';
  const cardTypeEmptyCls  = !existing?.cardType       ? ' field-empty' : '';
  const partNumEmptyCls   = !existing?.partNumber     ? ' field-empty' : '';
  const firmwareEmptyCls  = !existing?.firmwareVersion ? ' field-empty' : '';
  el.formBody.innerHTML = `
    <div class="fg"><label class="fg-label">Card Name</label>
      <input class="f-input${nameEmptyCls}" id="f-name" type="text" value="${esc(existing?.name || '')}" placeholder="Card Name"></div>
    <div class="fg"><label class="fg-label">Card Type</label>
      <select class="f-select${cardTypeEmptyCls}" id="f-cardType"><option value=""></option>${cardTypeOpts}</select></div>
    <div class="fg"><label class="fg-label">Part Number</label>
      <input class="f-input${partNumEmptyCls}" id="f-partNumber" type="text" value="${esc(existing?.partNumber || '')}" placeholder="Part Number"></div>
    <div class="fg"><label class="fg-label">Firmware Version</label>
      <input class="f-input${firmwareEmptyCls}" id="f-firmwareVersion" type="text" value="${esc(existing?.firmwareVersion || '')}" placeholder="Firmware Version"></div>
    <div id="slot-cardtype-container"></div>
    <div id="io-points-wrap" style="display:none">
      <div class="form-section-hdr">IO Points</div>
      <div id="io-points-container"></div>
    </div>
    <div id="power-bus-wrap" style="display:none">
      <div class="form-section-hdr">Power Bus</div>
      <div id="power-bus-container"></div>
    </div>
    <div id="terminal-wiring-wrap" style="display:none">
      <div class="form-section-hdr">Terminal Block Wiring</div>
      <div id="wiring-table-terminalWiring" class="wiring-table"></div>
    </div>
    <div id="network-ports-wrap" style="display:none">
      <div class="form-section-hdr">Network Ports</div>
      <div id="network-ports-container"></div>
    </div>
  `;

  /* Delegated .field-empty toggle for slot form */
  attachFieldEmptyToggle(el.formBody, '.f-input, .f-textarea', '.f-select');

  const renderSlotCardTypeFields = async () => {
    const cardType  = _field('f-cardType')?.value;
    const fields    = PLC_CARD_TYPE_FIELDS[cardType ?? ''] || [];
    const container = $('slot-cardtype-container');
    if (!container) return;
    if (!fields.length) { container.innerHTML = ''; } else {
      let ph = '';
      for (const f of fields) ph += await buildFormField(f, existing, 'assets');
      container.innerHTML = ph;
    }
    const ioWrap = $('io-points-wrap');
    if (ioWrap) {
      const isIo = CARD_TYPE_IO_TYPES.has(cardType ?? '');
      ioWrap.style.display = isIo ? '' : 'none';
      if (isIo) {
        renderIoPointsTable();
        const ioCountEl = _field('f-ioPointCount');
        if (ioCountEl) ioCountEl.addEventListener('change', syncIoPointCount);
      }
    }
    const pbWrap = $('power-bus-wrap');
    if (pbWrap) {
      const isIo = CARD_TYPE_IO_TYPES.has(cardType ?? '');
      pbWrap.style.display = isIo ? '' : 'none';
      if (isIo) renderPowerBusTableForm();
    }

    // Terminal Block Wiring — visible for Analog, Digital, and Specialty cards.
    // Uses renderItemTable in form mode (no opts needed): reads/writes state.formItemTables['terminalWiring']
    // via the default wiring-table-terminalWiring container id.
    const twWrap = $('terminal-wiring-wrap');
    if (twWrap) {
      const hasTerminal = CARD_TYPE_TERMINAL_TYPES.has(cardType ?? '');
      twWrap.style.display = hasTerminal ? '' : 'none';
      if (hasTerminal) renderItemTableForm('terminalWiring', 'Terminal Block Wiring', 'Terminal', 'Wire Label');
    }

    // Network Ports — visible for Controller and Communication cards.
    // Uses renderNetworkPortsTable in form mode (no args): reads/writes state.formSlotNetworkPorts.
    const npWrap = $('network-ports-wrap');
    if (npWrap) {
      const hasNetPorts = CARD_TYPE_NET_TYPES.has(cardType ?? '');
      npWrap.style.display = hasNetPorts ? '' : 'none';
      if (hasNetPorts) renderNetworkPortsTableForm();
    }
  };

  /** @type {HTMLElement} */ ($('f-cardType')).addEventListener('change', renderSlotCardTypeFields);
  await renderSlotCardTypeFields();
}

/* ---- ENTITY FORM ---- */

// Two-pass render: (1) base fields rendered synchronously into formBody HTML,
// then (2) dynamic sections (class fields, subclass fields, switch tables, PLC card
// type fields) are wired and rendered via event-driven async callbacks after mount.
/** @returns {Promise<void>} */
async function renderEntityForm() {
  const type = /** @type {EntityType} */ (state.formType);
  const id   = state.formId;
  const cfg  = /** @type {Record<string, EntityConfig>} */ (ENTITY)[type];
  const rawExisting = id ? await getById(type, id) : null;
  const existing = rawExisting ?? (
    !id && state.formPreset?.copyFrom ? state.formPreset.copyFrom :
    !id && state.formPreset ? {
      ...(state.formPreset.extra || {}),
      ...(state.formPreset.field ? { [state.formPreset.field]: state.formPreset.value } : {}),
    } : null
  );
  await refreshAll();

  const FORM_PHYSICAL_SECTIONS = new Set(['Physical Sizing', 'Clearance']);
  let html = '';
  let physicalHtml = '';
  /** @type {string | undefined} */
  let currentSection = undefined;
  /** @type {string | undefined} */
  let physicalSection = undefined;
  for (const f of cfg.fields) {
    if (type === 'assets' && f.section && FORM_PHYSICAL_SECTIONS.has(f.section)) {
      if (f.section !== physicalSection) {
        physicalSection = f.section;
        physicalHtml += `<div class="form-section-hdr">${esc(f.section)}</div>`;
      }
      physicalHtml += await buildFormField(f, existing, type);
      continue;
    }
    if (f.section !== currentSection) {
      currentSection = f.section;
      if (currentSection) html += `<div class="form-section-hdr">${esc(currentSection)}</div>`;
    }
    html += await buildFormField(f, existing, type);
  }

  if (type === 'networks') {
    html += `<div id="protocol-fields-container"></div>`;
  }

  if (type === 'assets') {
    html += `<div id="class-fields-container"></div>`;
    html += `<div id="subclass-fields-container"></div>`;
    html += `
      <div id="switch-networks-wrap" style="display:none">
        <div class="form-section-hdr">VLANs</div>
        <div id="switch-networks-container"></div>
      </div>
      <div id="switch-ports-wrap" style="display:none">
        <div class="form-section-hdr">Port Assignments</div>
        <div id="switch-ports-container"></div>
      </div>
      <div id="asset-network-ports-wrap" style="display:none">
        <div class="form-section-hdr">Network Ports</div>
        <div id="asset-network-ports-container"></div>
      </div>
      <div id="class-item-tables-container"></div>`;
    html += physicalHtml;
  }

  if (cfg.itemTables) {
    for (const t of cfg.itemTables) {
      html += `<div class="form-section-hdr">${esc(t.label)}</div><div id="wiring-table-${t.key}"></div>`;
    }
  }

  if (cfg.requiredPhotoSlots) {
    html += `<div class="form-section-hdr">Required Media</div><div id="named-photo-slots">`;
    for (const slot of cfg.requiredPhotoSlots) {
      const slotId = `np-slot-${slot.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
      html += `<div class="named-photo-slot"><div class="named-photo-slot-label">${esc(slot)}</div><div id="${slotId}" class="named-photo-area img-grid"></div></div>`;
    }
    html += `</div>`;
  }

  if (!cfg.noImages) {
    html += `
      <div class="form-section-hdr">Other Media</div>
      <div class="fg">
        <div id="img-preview-grid" class="img-grid"></div>
      </div>
    `;
  }

  el.formBody.innerHTML = html;

  /* Delegated .field-empty toggle — covers static fields and all dynamic containers */
  attachFieldEmptyToggle(el.formBody, '.f-input, .f-textarea', '.f-select');

  if (cfg.itemTables) {
    for (const t of cfg.itemTables) renderItemTableForm(t.key, t.label);
  }

  if (type === 'assets') {
    const currentAssetClass = _field('f-assetClass')?.value;
    renderClassItemTables(currentAssetClass ?? '');
  }

  if (cfg.requiredPhotoSlots) {
    for (const slot of cfg.requiredPhotoSlots) {
      const slotId = `np-slot-${slot.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
      const area = $(slotId);
      if (!area) continue;
      const reSlot = () => renderMediaSlot(area, slot, state.formNamedPhotos[slot] || [], {
        onAdd:    items => { state.formNamedPhotos[slot] = [...(state.formNamedPhotos[slot] || []), ...items]; reSlot(); },
        onRemove: i     => { (state.formNamedPhotos[slot] || []).splice(i, 1); reSlot(); },
      });
      reSlot();
    }
  }

  if (!cfg.noImages) {
    const grid = /** @type {HTMLElement} */ ($('img-preview-grid'));
    const reGallery = () => renderMediaGallery(grid, state.formImages, {
      onAdd:    items => { state.formImages.push(...items); reGallery(); },
      onRemove: i     => { state.formImages.splice(i, 1); reGallery(); },
    });
    reGallery();
  }

  const assignTypeSelect = _field('f-assign-type');
  if (assignTypeSelect) {
    assignTypeSelect.addEventListener('change', () => populateAssignId(type, assignTypeSelect.value, existing?.assignedToId));
    populateAssignId(type, assignTypeSelect.value, existing?.assignedToId);
  }

  if (type === 'networks') {
    const typeSelect = _field('f-networkType');
    const renderProtocolFields = async () => {
      const networkType = typeSelect?.value;
      const protoFields = ENTITY.networks.protocolFields?.[networkType ?? ''] || [];
      const container   = $('protocol-fields-container');
      if (!container) return;
      if (!protoFields.length) { container.innerHTML = ''; return; }
      let ph = '';
      /** @type {string | undefined} */
      let lastSection;
      for (const f of protoFields) {
        if (f.section !== lastSection) {
          lastSection = f.section;
          ph += `<div class="form-section-hdr">${esc(f.section)}</div>`;
        }
        ph += await buildFormField(f, existing, type);
      }
      container.innerHTML = ph;
    };
    typeSelect?.addEventListener('change', renderProtocolFields);
    await renderProtocolFields();
  }

  if (type === 'assets') {
    const updateSwitchTables = () => {
      const assetClass = _field('f-assetClass')?.value;
      const subclass   = _field('f-assetSubclass')?.value;
      toggleConditionalSection(
        ['switch-networks-wrap', 'switch-ports-wrap'],
        isSwitchAsset(assetClass ?? '', subclass ?? ''),
        [renderSwitchNetworksTableForm, renderSwitchPortsTableForm]
      );
    };

    const rerenderAssetNetworkPorts = () => _renderNetworkPortsTable(
      'asset-network-ports-container', state.formAssetNetworkPorts, rerenderAssetNetworkPorts, null
    );

    const updateAssetNetworkPorts = () => {
      const assetClass = _field('f-assetClass')?.value;
      toggleConditionalSection(
        ['asset-network-ports-wrap'],
        ASSET_CLASS_NETWORK_PORTS.has(assetClass ?? ''),
        [rerenderAssetNetworkPorts]
      );
    };

    const renderSubclassFields = async () => {
      const subclass  = _field('f-assetSubclass')?.value;
      const fields    = ENTITY.assets.subclassFields?.[subclass ?? ''] || [];
      const container = $('subclass-fields-container');
      if (!container) return;
      if (!fields.length) { container.innerHTML = ''; updateSwitchTables(); updateAssetNetworkPorts(); return; }
      let ph = '';
      /** @type {string | undefined} */
      let lastSection;
      for (const f of fields) {
        if (f.section !== lastSection) {
          lastSection = f.section;
          ph += `<div class="form-section-hdr">${esc(f.section)}</div>`;
        }
        ph += await buildFormField(f, existing, type);
      }
      container.innerHTML = ph;
      updateSwitchTables();
      updateAssetNetworkPorts();
    };

    const renderClassSubclassField = async () => {
      const assetClass  = _field('f-assetClass')?.value;
      let   subclasses  = ENTITY.assets.classSubclasses?.[assetClass ?? ''] || [];
      const subclassSel = _field('f-assetSubclass');
      if (!subclassSel) return;
      const currentSub = existing?.assetSubclass || '';
      if (currentSub && id && !subclasses.includes(currentSub)) subclasses = [...subclasses, currentSub];
      subclassSel.innerHTML = '<option value=""></option>' +
        subclasses.map(s => `<option value="${s}"${s === currentSub ? ' selected' : ''}>${esc(s)}</option>`).join('');
      const wrap = /** @type {HTMLElement | null} */ (subclassSel.closest('.fg'));
      if (wrap) wrap.style.display = subclasses.length ? '' : 'none';

      const classIsLocked = !id && (
        state.formPreset?.extra?.assetClass ||
        state.formPreset?.field === 'assetClass'
      );
      const classWrap = /** @type {HTMLElement | null} */ (_field('f-assetClass')?.closest('.fg') ?? null);
      if (classWrap) classWrap.style.display = classIsLocked ? 'none' : '';
      const subclassIsLocked = !id && state.formPreset?.extra?.assetSubclass;
      if (wrap) wrap.style.display = (subclassIsLocked || !subclasses.length) ? 'none' : '';

      const classFieldDefs = ENTITY.assets.classFields?.[assetClass ?? ''] || [];
      const classCont = $('class-fields-container');
      if (classCont) {
        if (!classFieldDefs.length) {
          classCont.innerHTML = '';
        } else {
          let ph = '';
          for (const f of classFieldDefs) ph += await buildFormField(f, existing, type);
          classCont.innerHTML = ph;
        }
      }

      await renderSubclassFields();
      renderClassItemTables(assetClass ?? '');
    };

    _field('f-assetSubclass')?.addEventListener('change', renderSubclassFields);
    _field('f-assetClass')?.addEventListener('change', renderClassSubclassField);
    await renderClassSubclassField();
  }

  // Panel ↔ Area linkage for assets (and any other entity with both panelId and areaId fields):
  // - Panel selected: area is derived from the panel and locked (user cannot override it).
  // - Panel cleared:  area field is re-enabled for manual selection.
  // - Area changed (no panel): panel dropdown is filtered to panels in that area.
  // syncAreaFromPanel also calls filterPanelsByArea so panel options always match the area.
  {
    const panelSel = _field('f-panelId');
    const areaSel  = _field('f-areaId');
    if (panelSel && areaSel) {
      const syncAreaFromPanel = () => {
        const panel = state.refs.panels?.[panelSel.value];
        if (panelSel.value && panel) {
          areaSel.value    = panel.areaId || '';
          areaSel.disabled = true;
        } else {
          areaSel.disabled = false;
        }
        filterPanelsByArea(areaSel.value, panelSel.value);
      };
      panelSel.addEventListener('change', syncAreaFromPanel);
      areaSel.addEventListener('change', () => {
        if (!panelSel.value) filterPanelsByArea(areaSel.value, '');
      });
      syncAreaFromPanel(); // initialize on open (handles existing records with a panel already set)
    }
  }

  if (type === 'safety') {
    const panelSel = _field('f-panelId');
    if (panelSel) {
      panelSel.addEventListener('change', () => filterPowerByPanel(panelSel.value, existing?.powerId));
      if (panelSel.value) filterPowerByPanel(panelSel.value, existing?.powerId);
    }
  }
}

/* ---- FORM FIELD BUILDER ---- */

/**
 * @param {FieldDef} f
 * @param {Record<string, any> | null} existing
 * @param {EntityType} type
 * @returns {Promise<string>}
 */
async function buildFormField(f, existing, type) {
  const presetVal = !existing
    ? (state.formPreset?.field === f.key ? state.formPreset.value : (state.formPreset?.extra?.[f.key] ?? null))
    : null;
  const val      = existing?.[f.key] ?? presetVal ?? '';
  const emptyCls = !val ? ' field-empty' : '';

  if (f.type === 'text') {
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}${f.required ? '<span class="req">*</span>' : ''}</label>
      <input id="f-${f.key}" class="f-input${emptyCls}" type="text" value="${esc(val)}" placeholder="${esc(f.label)}">
    </div>`;
  }

  if (f.type === 'textarea') {
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}</label>
      <textarea id="f-${f.key}" class="f-textarea${emptyCls}" placeholder="${esc(f.label)}">${esc(val)}</textarea>
    </div>`;
  }

  if (f.type === 'enum') {
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}</label>
      <select id="f-${f.key}" class="f-select${emptyCls}">
        <option value="">— Select —</option>
        ${buildEnumOptions(f.options, val)}
      </select>
    </div>`;
  }

  if (f.type === 'ref') {
    let items = state.cache[f.refStore] || [];
    // refFilter/readOnly aren't part of RefFieldDef's current typedef — like the
    // 'assign-type'/'assign-id' field-type branches below and rel.filter in
    // operations.js, no current entity-config.js ref field sets either, but the
    // checks are kept defensive via a cast rather than widening the typedef for
    // properties nothing currently uses.
    const refFilter = /** @type {any} */ (f).refFilter;
    if (refFilter) items = items.filter(refFilter);
    const readOnly = /** @type {any} */ (f).readOnly;
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}${f.required ? '<span class="req">*</span>' : ''}</label>
      <select id="f-${f.key}" class="f-select${emptyCls}"${readOnly ? ' disabled' : ''}>
        <option value="">— Unassigned —</option>
        ${buildRefOptions(items, val)}
      </select>
    </div>`;
  }

  // 'assign-type'/'assign-id' aren't part of FieldDef's current discriminated
  // union — no entity-config.js field currently uses them (same defensive
  // dead-code pattern documented in utils.js's calcCompleteness() and
  // operations.js's saveEntityForm()/deleteItem()) — cast f.type to compare
  // against them without widening the typedef for branches nothing currently
  // exercises.
  const fType = /** @type {string} */ (f.type);
  if (fType === 'assign-type') {
    const preset   = state.formPreset?.field === 'assignedToType' ? state.formPreset.value : null;
    const current  = existing?.assignedToType || preset || '';
    const typeCls  = !current ? ' field-empty' : '';
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}</label>
      <select id="f-assign-type" class="f-select${typeCls}">
        <option value="">— Select type —</option>
        ${buildEnumOptions(/** @type {any} */ (f).options, current)}
      </select>
    </div>`;
  }

  if (fType === 'assign-id') {
    return `<div class="fg" id="fg-assign-id" style="display:none">
      <label class="fg-label" id="label-assign-id">Assigned Item</label>
      <select id="f-assign-id" class="f-select field-empty">
        <option value="">— Select —</option>
      </select>
    </div>`;
  }

  return '';
}

/* ---- ASSIGN-ID DROPDOWN ---- */

/**
 * @param {EntityType} type
 * @param {string | undefined} assignType
 * @param {string | undefined | null} currentId
 * @returns {Promise<void>}
 */
async function populateAssignId(type, assignType, currentId) {
  const fg  = $('fg-assign-id');
  const sel = _field('f-assign-id');
  const lbl = $('label-assign-id');
  if (!fg || !sel) return;

  if (!assignType || assignType === 'Plant') {
    fg.style.display = 'none';
    return;
  }

  fg.style.display = 'block';
  if (lbl) lbl.textContent = assignType;

  const storeName = /** @type {Record<string, string | null>} */ (ASSIGN_STORE_MAP)[assignType];
  if (!storeName) { fg.style.display = 'none'; return; }

  const items = /** @type {Record<string, DbRecord[]>} */ (state.cache)[storeName] || [];
  sel.innerHTML = `<option value="">— Select —</option>` + items.map(i => {
    const sub = /** @type {Record<string, EntityConfig>} */ (ENTITY)[storeName]?.getSubtitle(i, state.refs);
    const label = sub ? `${i.name} (${sub})` : i.name;
    return `<option value="${i.id}" ${i.id === currentId ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

/* ---- PANEL / POWER FILTERS ---- */

// Rebuilds the panel dropdown filtered to panels in the given area.
// Called when the area changes (no panel set) or on panel clear.
// currentPanelId keeps the previously-selected option selected after re-render.
/**
 * @param {string} areaId
 * @param {string | undefined} currentPanelId
 */
function filterPanelsByArea(areaId, currentPanelId) {
  const sel = _field('f-panelId');
  if (!sel) return;
  const all      = state.cache['panels'] || [];
  const filtered = areaId ? all.filter(p => p.areaId === areaId) : all;
  sel.innerHTML = `<option value="">— Unassigned —</option>` + filtered.map(p =>
    `<option value="${p.id}" ${p.id === currentPanelId ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');
}

/**
 * @param {string} panelId
 * @param {string | undefined | null} currentPowerId
 * @returns {Promise<void>}
 */
async function filterPowerByPanel(panelId, currentPowerId) {
  const sel = _field('f-powerId');
  if (!sel) return;
  const all = state.cache['power'] || [];
  const filtered = panelId ? all.filter(p => p.panelId === panelId) : all;
  sel.innerHTML = `<option value="">— None —</option>` + filtered.map(p =>
    `<option value="${p.id}" ${p.id === currentPowerId ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');
}
