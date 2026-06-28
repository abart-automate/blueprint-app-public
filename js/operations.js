/* ============================================================
   DATA OPERATIONS
   Depends on: entity-config.js, state.js, utils.js, db.js,
   renderers/detail.js, app.js (closeSheet, closeDetail, openSheet,
   openDetail, renderPage, renderDetail)
   ============================================================ */

const _getChildren = type => ENTITY[type]?.getChildren ?? [];

/** Dispatcher: routes to the appropriate save handler based on state.formType. */
async function saveForm() {
  const type = state.formType;
  if (type === '__picker__')    return savePickerForm();
  if (type === '__plc_slot__')  return saveSlotForm();
  if (type === '__plant__')     return savePlantForm();
  if (type === '__parts_lib__') return savePartsLibForm();
  return saveEntityForm();
}

async function savePickerForm() {
  const { childType, parentField, parentId, selected } = state.pickerMeta || {};
  if (!selected?.size) return;
  for (const id of selected) {
    const existing = state.refs[childType]?.[id];
    if (existing) await upsert(childType, { ...existing, [parentField]: parentId });
  }
  await refreshAll();
  const count = selected.size;
  const pcfg  = ENTITY[childType];
  closeSheet();
  showToast(`${count} ${pcfg.label}${count > 1 ? 's' : ''} assigned`, 'success');
  renderPage();
  if (state.detailType) renderDetail();
}

async function saveSlotForm() {
    const { rackId, slotNumber } = state.formPreset;
    const rack     = state.refs.assets?.[rackId];
    if (!rack) { showToast('Rack not found', 'error'); return; }
    const cardType = $('f-cardType')?.value || '';
    // Card Type must be selected before type-specific sections (IO points, terminal wiring,
    // network ports) can be collected — reject early so the user gets clear feedback.
    if (!cardType) { showToast('Card Type is required', 'error'); return; }
    const slotData = {
      slotNumber,
      name:            $('f-name')?.value.trim()            || '',
      cardType,
      partNumber:      $('f-partNumber')?.value.trim()      || '',
      firmwareVersion: $('f-firmwareVersion')?.value.trim() || '',
    };
    for (const f of PLC_CARD_TYPE_FIELDS[cardType] || []) {
      const el2 = $(`f-${f.key}`);
      if (el2) slotData[f.key] = f.type === 'ref' ? (el2.value || '') : el2.value.trim();
    }
    // ioPoints and powerBus only apply to I/O card types (Analog/Digital);
    if (CARD_TYPE_IO_TYPES.has(cardType)) {
      slotData.ioPoints = state.formIoPoints.map(r => ({...r}));
      slotData.powerBus = state.formPowerBus
        .filter(e => e.refId)
        .map(e => ({ type: e.type, refId: e.refId, wiring: e.wiring.filter(w => w.terminal || w.label) }));
    }
    // Terminal Block Wiring applies to Analog, Digital, and Specialty cards.
    // Blank rows (both fields empty) are filtered out to keep stored data clean.
    if (CARD_TYPE_TERMINAL_TYPES.has(cardType)) {
      slotData.terminalWiring = (state.formItemTables.terminalWiring || [])
        .filter(r => r.terminal || r.label);
    }
    // Network Ports apply to Controller and Communication cards.
    // All ports are kept even without a network selected so port entries are
    // not silently lost while the user is still configuring them.
    if (CARD_TYPE_NET_TYPES.has(cardType)) {
      slotData.networkPorts = state.formSlotNetworkPorts.map(p => ({...p}));
    }
    const slots = [...(rack.slots || [])];
    const idx   = slots.findIndex(s => s.slotNumber === slotNumber);
    if (idx >= 0) slots[idx] = slotData; else slots.push(slotData);
    // Renumber after every mutation so slotNumber always matches array index.
    const numbered = renumberSlots(slots);
    try {
      await upsert('assets', { ...rack, slots: numbered });
      await refreshAll();
      closeSheet();
      showToast('Card saved', 'success');
      renderPage();
      renderDetail({ preserveScroll: true });
    } catch (err) {
      // Surface hidden exceptions (quota exceeded, transaction failure, etc.)
      // that would otherwise be swallowed as unhandled promise rejections.
      showToast('Failed to save card', 'error');
      console.error('[saveSlotForm]', err);
    }
}

async function savePlantForm() {
  const name = $('pf-name')?.value.trim();
  if (!name) { showToast('Plant name is required', 'error'); return; }
  await setSetting('plantName', name);
  await setSetting('plantDesc', $('pf-desc')?.value.trim() || '');
  closeSheet();
  showToast('Plant info saved', 'success');
  renderPage();
}

// Returns an error string if any IP address in item conflicts with another asset,
// or null if the IP is unique. Checks both the primary ipAddress field and
// switchNetworks entries — a device can carry IPs in both places.
function validateUniqueIp(item, allAssets) {
  const assignments = [];
  if (item.ipAddress && item.networkId)
    assignments.push({ networkId: item.networkId, ipAddress: item.ipAddress });
  for (const sn of item.switchNetworks || []) {
    if (sn.ipAddress && sn.networkId)
      assignments.push({ networkId: sn.networkId, ipAddress: sn.ipAddress });
  }
  for (const { networkId, ipAddress } of assignments) {
    const conflicts = new Set();
    for (const a of allAssets) {
      if (a.id === item.id) continue;
      if (a.ipAddress === ipAddress && a.networkId === networkId) conflicts.add(a.name);
      for (const sn of a.switchNetworks || []) {
        if (sn.ipAddress === ipAddress && sn.networkId === networkId) conflicts.add(a.name);
      }
    }
    if (conflicts.size) return `IP ${ipAddress} already used by: ${[...conflicts].join(', ')}`;
  }
  return null;
}

// Returns an error string if any other item in the store already has the same name, or null.
function validateUniqueName(type, item) {
  const nameVal = item.name?.trim();
  if (!nameVal) return null;
  const conflict = (state.cache[type] || []).find(i => i.id !== item.id && i.name === nameVal);
  return conflict ? `Name "${nameVal}" is already in use` : null;
}

// Returns the first field config that is required but empty, or null if all required fields pass.
function validateRequiredFields(type, item) {
  for (const f of getEffectiveFields(type, item)) {
    if (f.required && !item[f.key]) return f;
  }
  return null;
}

// Saves the currently-open entity form. Uses getEffectiveFields() for a single-pass
// field read covering base, protocol, class, subclass, and network-type fields.
// Switch/Router port and network tables are read from form state, not DOM inputs.
async function saveEntityForm() {
  const type = state.formType;
  const cfg = ENTITY[type];
  const item = state.formId ? (await getById(type, state.formId)) || {} : {};

  // Capture areaId before fields are overwritten; undefined means "not a panel edit" (no cascade).
  const oldPanelAreaId = (type === 'panels' && state.formId) ? item.areaId : undefined;

  // Pre-seed type discriminators from the DOM so getEffectiveFields resolves conditional field
  // sets (classFields, subclassFields, protocolFields, networkTypeFields) correctly when item
  // starts empty for new entities. The main loop overwrites these again — no data is lost.
  if (type === 'assets') {
    if ($('f-assetClass'))    item.assetClass    = $('f-assetClass').value    || '';
    if ($('f-assetSubclass')) item.assetSubclass = $('f-assetSubclass').value || '';
    if ($('f-networkId'))     item.networkId     = $('f-networkId').value     || '';
  }
  if (type === 'networks') {
    if ($('f-networkType'))   item.networkType   = $('f-networkType').value   || '';
  }

  // Single pass over all effective fields (base + protocol/class/subclass/network-type).
  for (const f of getEffectiveFields(type, item)) {
    if (f.type === 'assign-type') {
      item.assignedToType = $('f-assign-type')?.value || '';
    } else if (f.type === 'assign-id') {
      item.assignedToId = $('f-assign-id')?.value || '';
    } else {
      const el2 = $(`f-${f.key}`);
      if (el2) item[f.key] = f.type === 'ref' ? (el2.value || '') : el2.value.trim();
    }
  }

  // Switch/Router tables are state-driven, not form fields.
  if (type === 'assets') {
    const showTables = isSwitchAsset(item.assetClass, item.assetSubclass);
    if (showTables) {
      item.switchNetworks = state.formSwitchNetworks.filter(r => r.networkId);
      item.switchPorts    = state.formSwitchPorts.filter(r => r.portName || r.networkId || r.assetId);
    }
  }

  if (type === 'assets') {
    const ipError = validateUniqueIp(item, state.cache.assets || []);
    if (ipError) { showToast(ipError, 'error'); return; }
  }

  const nameError = validateUniqueName(type, item);
  if (nameError) { showToast(nameError, 'error'); $('f-name')?.focus(); return; }

  const missingField = validateRequiredFields(type, item);
  if (missingField) { showToast(`${missingField.label} is required`, 'error'); $(`f-${missingField.key}`)?.focus(); return; }

  item.images = await freshenMediaItems(state.formImages);
  if (cfg.requiredPhotoSlots) {
    const _freshNamedPhotos = {};
    for (const [_slot, _items] of Object.entries(state.formNamedPhotos)) {
      _freshNamedPhotos[_slot] = await freshenMediaItems(_items);
    }
    item.namedPhotos = _freshNamedPhotos;
  }
  for (const t of itemTables(type, item))
    item[t.key] = (state.formItemTables[t.key] || []).filter(r => r.terminal || r.label);

  // Ensure preset fields are set if not captured from DOM (e.g. fields not yet rendered)
  if (state.formPreset && !state.formId) {
    if (!item[state.formPreset.field]) item[state.formPreset.field] = state.formPreset.value;
    for (const [k, v] of Object.entries(state.formPreset.extra || {})) {
      if (!item[k]) item[k] = v;
    }
  }

  const saved = await upsert(type, item);

  // When a panel's area changes, propagate the new areaId to every asset assigned to that panel
  // so assets always reflect the area of their containing panel.
  if (type === 'panels' && oldPanelAreaId !== undefined && saved.areaId !== oldPanelAreaId) {
    const allAssets = await getAll('assets');
    await Promise.all(
      allAssets
        .filter(a => a.panelId === saved.id)
        .map(a => upsert('assets', { ...a, areaId: saved.areaId || '' }))
    );
  }

  await refreshAll();
  closeSheet();
  showToast(`${cfg.label} saved`, 'success');

  renderPage();
  if (state.detailType) renderDetail();
}

/* ============================================================
   DELETE
   ============================================================ */

/**
 * Confirms and deletes an entity, cascading to child records defined in ENTITY[type].getChildren.
 * @param {string} type - Entity store name
 * @param {string} id   - Entity id
 * @param {string} name - Display name for the confirm dialog
 */
async function deleteItem(type, id, name) {
  const ok = await confirm('Delete ' + ENTITY[type].label, `Delete "${name}"? This cannot be undone.`, { yesLabel: 'Delete' });
  if (!ok) return;

  // Collect direct children from cache
  const childRels = [];
  for (const rel of _getChildren(type)) {
    let items = (state.cache[rel.store] || []).filter(i => i[rel.field] === id);
    if (rel.filter) items = items.filter(rel.filter);
    if (items.length > 0) childRels.push({ ...rel, items });
  }

  let deleteChildren = false;
  if (childRels.length > 0) {
    const desc = childRels.map(r => `${r.items.length} ${r.label.toLowerCase()}`).join(', ');
    deleteChildren = await confirm(
      'Delete associated items?',
      `"${name}" has ${desc}. Delete them too?`,
      { yesLabel: 'Delete', noLabel: 'Keep' }
    );
  }

  await remove(type, id);

  if (deleteChildren) {
    for (const rel of childRels) {
      for (const item of rel.items) {
        await cascadeDeleteItem(rel.store, item.id);
      }
    }
  } else {
    for (const rel of childRels) {
      for (const item of rel.items) {
        const updated = { ...item, [rel.field]: '' };
        if (rel.field === 'assignedToId') updated.assignedToType = '';
        await upsert(rel.store, updated);
      }
    }
  }

  await refreshAll();
  closeDetail();
  showToast(`${ENTITY[type].label} deleted`);
  renderPage();
}

async function cascadeDeleteItem(type, id) {
  for (const rel of _getChildren(type)) {
    let children = (state.cache[rel.store] || []).filter(i => i[rel.field] === id);
    if (rel.filter) children = children.filter(rel.filter);
    for (const child of children) {
      await cascadeDeleteItem(rel.store, child.id);
    }
  }
  await remove(type, id);
}

/* ============================================================
   CLEAR ALL DATA
   ============================================================ */

async function clearAllData() {
  const ok = await confirm(
    'Clear All Data',
    'This will permanently delete all areas, panels, equipment, and media. This cannot be undone.',
    { yesLabel: 'Clear All' }
  );
  if (!ok) return;
  for (const name of ['areas', 'panels', 'power', 'safety', 'networks', 'assets', 'settings']) {
    await clearStore(name);
  }
  revokeAllMediaUrls();
  await refreshAll();
  showToast('All data cleared', 'success');
  renderPage();
}

/* ============================================================
   DUPLICATE
   ============================================================ */

// Strips system-generated and media fields before duplication.
// upsert() then assigns a fresh id, createdAt, and updatedAt.
function _stripMediaAndSystemFields(entity, overrides = {}) {
  const { id: _id, createdAt: _c, updatedAt: _u, images: _img, namedPhotos: _np, ...rest } = entity;
  return { ...rest, ...overrides };
}

// Shows a scrollable checklist of panel children for the user to select.
// Appended to #app (position:relative) so the absolute overlay covers the full viewport.
// Resolves with the selected subset array, or null if the user cancels.
function showChildSelector(children) {
  const BADGE = { power: 'badge-power', safety: 'badge-safety', assets: 'badge-asset' };
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-backdrop open';
    backdrop.innerHTML = `
      <div class="confirm-box confirm-box--wide">
        <div class="confirm-title">Select items to duplicate</div>
        <div class="confirm-msg">Uncheck any items to omit from the new panel:</div>
        <div class="child-selector-list">
          ${children.map((c, i) => `
            <label class="child-selector-item">
              <input type="checkbox" value="${i}" checked>
              <span class="badge ${BADGE[c._store] || ''}">${c.typeLabel}</span>
              <span>${c.name}</span>
            </label>
          `).join('')}
        </div>
        <div class="confirm-actions">
          <button class="btn btn-outline" data-action="cancel">Cancel</button>
          <button class="btn btn-primary"  data-action="ok">Continue</button>
        </div>
      </div>`;
    $('app').appendChild(backdrop);

    const cleanup = () => $('app').removeChild(backdrop);
    backdrop.querySelector('[data-action=cancel]').addEventListener('click', () => { cleanup(); resolve(null); });
    backdrop.querySelector('[data-action=ok]').addEventListener('click', () => {
      const selected = [...backdrop.querySelectorAll('input[type=checkbox]:checked')]
        .map(cb => children[parseInt(cb.value)]);
      cleanup(); resolve(selected);
    });
  });
}

function uniqueCopyName(store, baseName, suffix = 'copy') {
  const existing = new Set((state.cache[store] || []).map(i => i.name));
  const candidate = `${baseName} (${suffix})`;
  if (!existing.has(candidate)) return candidate;
  let n = 2;
  while (existing.has(`${baseName} (${suffix} ${n})`)) n++;
  return `${baseName} (${suffix} ${n})`;
}

async function duplicateItem(type, id) {
  await refreshAll();
  const original = state.refs[type]?.[id];
  if (!original) return;

  const cfg = ENTITY[type];

  // Step 1: get a name for the new item
  const newName = await promptInput(
    `Duplicate ${cfg.label}`,
    `Enter a name for the new ${cfg.label.toLowerCase()}:`,
    uniqueCopyName(type, original.name)
  );
  if (newName === null) return;

  // Step 2: for panels, let the user select which children to include
  let selectedChildren = [];
  if (type === 'panels') {
    const childDefs = [
      { store: 'power',  field: 'panelId', typeLabel: 'Power'  },
      { store: 'safety', field: 'panelId', typeLabel: 'Safety' },
      { store: 'assets', field: 'panelId', typeLabel: 'Asset'  },
    ];
    const allChildren = childDefs.flatMap(def =>
      (state.cache[def.store] || [])
        .filter(item => item[def.field] === id)
        .map(item => ({ ...item, _store: def.store, _field: def.field, typeLabel: def.typeLabel }))
    );
    if (allChildren.length > 0) {
      const chosen = await showChildSelector(allChildren);
      if (chosen === null) return; // cancelled — abort before saving the panel
      selectedChildren = chosen;
    }
  }

  // Step 3: save the duplicated panel/item (no media)
  const saved = await upsert(type, _stripMediaAndSystemFields(original, { name: newName }));

  // Step 4: for each selected child, prompt for a name then save
  for (const child of selectedChildren) {
    const childName = await promptInput(
      `Duplicate ${child.typeLabel}`,
      `Enter a name for the copy of "${child.name}":`,
      uniqueCopyName(child._store, child.name)
    );
    if (childName === null) continue; // user skipped this child
    await upsert(child._store, _stripMediaAndSystemFields(child, {
      name:           childName,
      [child._field]: saved.id,
      areaId:         saved.areaId || child.areaId || '',
    }));
  }

  await refreshAll();
  showToast(`${cfg.label} duplicated`, 'success');
  renderPage();
  openDetail(type, saved.id);
}

/* ============================================================
   EXPORT OPTIONS DIALOG
   ============================================================ */

async function showExportOptions() {
  const modal = document.createElement('div');
  modal.className = 'export-options-modal';
  modal.innerHTML = `
    <div class="export-options-backdrop">
      <div class="export-options-content">
        <h3>Export Data</h3>
        <p>Choose export format:</p>
        <div class="export-options">
          <button class="export-option" data-format="json">
            <div class="export-option-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>
            </div>
            <div class="export-option-text">
              <div class="export-option-title">JSON</div>
              <div class="export-option-desc">Complete data in JSON format</div>
            </div>
          </button>
          <button class="export-option" data-format="zip">
            <div class="export-option-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <div class="export-option-text">
              <div class="export-option-title">ZIP</div>
              <div class="export-option-desc">Organized folders with photos</div>
            </div>
          </button>
          <button class="export-option" data-format="excel">
            <div class="export-option-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
            </div>
            <div class="export-option-text">
              <div class="export-option-title">Excel</div>
              <div class="export-option-desc">Export as .xlsx — one sheet per asset class, importable for offline edits</div>
            </div>
          </button>
        </div>
        <div class="export-options-actions">
          <button class="btn btn-outline" id="export-cancel">Cancel</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', async (e) => {
    const option = e.target.closest('.export-option');
    const cancelBtn = e.target.closest('#export-cancel');
    const backdrop = e.target.classList.contains('export-options-backdrop');

    if (option && !option.disabled) {
      const format = option.dataset.format;
      modal.remove();

      if (format === 'json') {
        await exportData();
      } else if (format === 'zip') {
        await exportToZip();
      } else if (format === 'excel') {
        await exportExcel();
      }
    } else if (cancelBtn || backdrop) {
      modal.remove();
    }
  });
}

/* ============================================================
   IMPORT / EXPORT WRAPPERS
   ============================================================ */

const _toArr = v => Array.isArray(v) ? v : (v ? [v] : []);

async function _blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function _serializeEntityMedia(entity) {
  const out = { ...entity };
  if (out.images?.length) {
    out.images = await Promise.all(out.images.map(async item => {
      if (item?.blob instanceof Blob) return _blobToBase64(item.blob);
      return item;
    }));
  }
  if (out.namedPhotos) {
    const slots = {};
    for (const [slot, value] of Object.entries(out.namedPhotos)) {
      slots[slot] = await Promise.all(_toArr(value).map(async item => {
        if (item?.blob instanceof Blob) return _blobToBase64(item.blob);
        return item;
      }));
    }
    out.namedPhotos = slots;
  }
  return out;
}

function _deserializeEntityMedia(entity) {
  const out = { ...entity };
  if (out.images) {
    out.images = out.images
      .map(item => (typeof item === 'string' && item.startsWith('data:')) ? base64ToMediaItem(item) : item)
      .filter(item => item?.blob instanceof Blob || typeof item === 'string');
  }
  if (out.namedPhotos) {
    const slots = {};
    for (const [slot, value] of Object.entries(out.namedPhotos)) {
      slots[slot] = _toArr(value)
        .map(item => (typeof item === 'string' && item.startsWith('data:')) ? base64ToMediaItem(item) : item)
        .filter(item => item?.blob instanceof Blob || typeof item === 'string');
    }
    out.namedPhotos = slots;
  }
  return out;
}

/** Exports all plant data to ZIP (with media) or XLSX. Prompts user to choose format. */
async function exportData() {
  try {
    const stores = ['areas', 'panels', 'power', 'safety', 'networks', 'assets'];
    const payload = {
      appName:    'blueprint',
      version:    1,
      exportedAt: new Date().toISOString(),
      data:       {}
    };
    for (const name of stores) {
      const items = await getAll(name);
      payload.data[name] = await Promise.all(items.map(_serializeEntityMedia));
    }
    // Checklist items may carry image blobs; serialize them the same way entity images are.
    const settings = await getAll('settings');
    payload.data.settings = await Promise.all(settings.map(async s =>
      s.id === 'checklistItems'
        ? { ...s, value: await Promise.all((s.value || []).map(_serializeEntityMedia)) }
        : s
    ));

    const plantName = (await getSetting('plantName')) || 'plant';
    const dateStr   = new Date().toISOString().slice(0, 10);
    const filename  = `${plantName.replace(/[^a-z0-9]/gi, '-')}-export-${dateStr}.json`;

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully', 'success');
  } catch (err) {
    console.error('Export failed:', err);
    showToast('Export failed', 'error');
  }
}

function importData() {
  $('import-file-input').click();
}

async function processImportFile(file) {
  // Route .xlsx files to the Excel merge importer
  if (file.name.toLowerCase().endsWith('.xlsx')) {
    await processXlsxImport(file);
    return;
  }

  try {
    const text = await file.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      showToast('Invalid file: not valid JSON', 'error');
      return;
    }

    if (
      typeof payload !== 'object' || payload === null ||
      payload.appName !== 'blueprint' ||
      typeof payload.version !== 'number' ||
      typeof payload.data !== 'object'
    ) {
      showToast('Invalid file: unrecognised format', 'error');
      return;
    }

    const choice = await confirmThreeWay(
      'Import data',
      'Merge will add new records and let you resolve any name/ID matches with existing data. Replace All will permanently delete all current data first.',
      { cancelLabel: 'Cancel', midLabel: 'Merge', midClass: 'btn-primary', yesLabel: 'Replace All', yesClass: 'btn-danger' }
    );
    if (choice === 'cancel') return;

    if (choice === 'mid') {
      await mergeJsonImport(payload);
      return;
    }

    const allStores = ['areas', 'panels', 'power', 'safety', 'networks', 'assets', 'settings'];
    for (const name of allStores) {
      await clearStore(name);
    }
    for (const name of allStores) {
      const items = payload.data[name];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        try {
          // Checklist items embed blobs in their value array; deserialize them specifically.
          const toStore = (name === 'settings' && item.id === 'checklistItems')
            ? { ...item, value: (item.value || []).map(_deserializeEntityMedia) }
            : _deserializeEntityMedia(item);
          await upsert(name, toStore);
        } catch (e) {
          console.warn(`JSON import: skipped ${name} item ${item?.id}:`, e);
        }
      }
    }

    await refreshAll();
    showToast('Data imported successfully', 'success');
    renderPage();
  } catch (err) {
    console.error('Import failed:', err);
    showToast('Import failed: ' + err.message, 'error');
  }
}
