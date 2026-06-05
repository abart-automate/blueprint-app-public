/* ============================================================
   DATA OPERATIONS
   Depends on: entity-config.js, state.js, utils.js, db.js,
   renderers/detail.js, app.js (closeSheet, closeDetail, openSheet,
   openDetail, renderPage, renderDetail)
   ============================================================ */

async function saveForm() {
  const type = state.formType;
  if (type === '__picker__')   return savePickerForm();
  if (type === '__plc_slot__') return saveSlotForm();
  if (type === '__plant__')    return savePlantForm();
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
    if (cardType === 'Controller' || cardType === 'Communication') {
      const linkedNet = state.refs.networks?.[slotData.networkId];
      for (const f of ENTITY.assets.networkTypeFields?.[linkedNet?.networkType] || []) {
        const el2 = $(`f-${f.key}`);
        if (el2) slotData[f.key] = el2.value.trim();
      }
    }
    if (cardType === 'Analog' || cardType === 'Digital') {
      slotData.ioPoints = state.formIoPoints.map(r => ({...r}));
      slotData.powerBus = state.formPowerBus
        .filter(e => e.refId)
        .map(e => ({ type: e.type, refId: e.refId, wiring: e.wiring.filter(w => w.terminal || w.label) }));
    }
    const slots = [...(rack.slots || [])];
    const idx   = slots.findIndex(s => s.slotNumber === slotNumber);
    if (idx >= 0) slots[idx] = slotData; else slots.push(slotData);
    await upsert('assets', { ...rack, slots });
    await refreshAll();
    closeSheet();
    showToast('Card saved', 'success');
    renderPage();
    renderDetail({ preserveScroll: true });
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

async function saveEntityForm() {
  const type = state.formType;
  const cfg = ENTITY[type];
  const item = state.formId ? (await getById(type, state.formId)) || {} : {};

  for (const f of cfg.fields) {
    if (f.type === 'assign-type') {
      item.assignedToType = $('f-assign-type')?.value || '';
    } else if (f.type === 'assign-id') {
      item.assignedToId = $('f-assign-id')?.value || '';
    } else {
      const el2 = $(`f-${f.key}`);
      if (el2) item[f.key] = el2.value.trim();
    }
  }

  // Read protocol-specific fields for networks
  if (type === 'networks') {
    const networkType = item.networkType;
    for (const f of ENTITY.networks.protocolFields?.[networkType] || []) {
      const el2 = $(`f-${f.key}`);
      if (el2) item[f.key] = f.type === 'ref' ? (el2.value || '') : el2.value.trim();
    }
  }

  // Read subclass and network-type-driven fields for assets
  if (type === 'assets') {
    // Class-level fields (flat classes)
    for (const f of ENTITY.assets.classFields?.[item.assetClass] || []) {
      const el2 = $(`f-${f.key}`);
      if (el2) item[f.key] = f.type === 'ref' ? (el2.value || '') : el2.value.trim();
    }
    // Subclass fields
    for (const f of ENTITY.assets.subclassFields?.[item.assetSubclass] || []) {
      const el2 = $(`f-${f.key}`);
      if (el2) item[f.key] = f.type === 'ref' ? (el2.value || '') : el2.value.trim();
    }
    // Network address fields (driven by linked network's type)
    const linkedNetwork = state.refs.networks?.[item.networkId];
    for (const f of ENTITY.assets.networkTypeFields?.[linkedNetwork?.networkType] || []) {
      const el2 = $(`f-${f.key}`);
      if (el2) item[f.key] = el2.value.trim();
    }
    // Switch/Router tables
    const showTables = item.assetClass === 'Network Switch' &&
                       (item.assetSubclass === 'Managed' || item.assetSubclass === 'Router');
    if (showTables) {
      item.switchNetworks = state.formSwitchNetworks.filter(r => r.networkId);
      item.switchPorts    = state.formSwitchPorts.filter(r => r.portName || r.networkId || r.assetId);
    }
  }

  // Validate IP uniqueness across the network
  if (type === 'assets') {
    const ipAssignments = [];
    if (item.ipAddress && item.networkId)
      ipAssignments.push({ networkId: item.networkId, ipAddress: item.ipAddress });
    for (const sn of item.switchNetworks || []) {
      if (sn.ipAddress && sn.networkId)
        ipAssignments.push({ networkId: sn.networkId, ipAddress: sn.ipAddress });
    }
    for (const { networkId, ipAddress } of ipAssignments) {
      const conflicts = new Set();
      for (const a of state.cache.assets || []) {
        if (a.id === item.id) continue;
        if (a.ipAddress === ipAddress && a.networkId === networkId) conflicts.add(a.name);
        for (const sn of a.switchNetworks || []) {
          if (sn.ipAddress === ipAddress && sn.networkId === networkId) conflicts.add(a.name);
        }
      }
      if (conflicts.size) {
        showToast(`IP ${ipAddress} already used by: ${[...conflicts].join(', ')}`, 'error');
        return;
      }
    }
  }

  // Enforce store-wide name uniqueness
  const nameVal = item.name?.trim();
  if (nameVal && ENTITY[type]) {
    const conflict = (state.cache[type] || []).find(i => i.id !== item.id && i.name === nameVal);
    if (conflict) {
      showToast(`Name "${nameVal}" is already in use`, 'error');
      $('f-name')?.focus();
      return;
    }
  }

  // Validate required fields
  for (const f of getEffectiveFields(type, item)) {
    if (f.required && !item[f.key]) {
      showToast(`${f.label} is required`, 'error');
      $(`f-${f.key}`)?.focus();
      return;
    }
  }

  item.images = [...state.formImages];
  if (cfg.requiredPhotoSlots) item.namedPhotos = {...state.formNamedPhotos};
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

  // Post-save: cascade duplicate children if this was a duplication
  if (state.formDuplicateSource) {
    const { sourceId, duplicateChildren } = state.formDuplicateSource;
    state.formDuplicateSource = null;
    if (duplicateChildren) {
      await cascadeDuplicateChildren(type, sourceId, saved.id);
    }
    await refreshAll();
    closeSheet();
    showToast(`${cfg.label} duplicated`, 'success');
    renderPage();
    openDetail(type, saved.id);
    return;
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

async function deleteItem(type, id, name) {
  const ok = await confirm('Delete ' + ENTITY[type].label, `Delete "${name}"? This cannot be undone.`);
  if (!ok) return;

  // Collect direct children from cache
  const childRels = [];
  for (const rel of ENTITY[type].getChildren) {
    let items = (state.cache[rel.store] || []).filter(i => i[rel.field] === id);
    if (rel.filter) items = items.filter(rel.filter);
    if (items.length > 0) childRels.push({ ...rel, items });
  }

  let deleteChildren = false;
  if (childRels.length > 0) {
    const desc = childRels.map(r => `${r.items.length} ${r.label.toLowerCase()}`).join(', ');
    el.confirmYes.textContent = 'Also Delete';
    el.confirmNo.textContent  = 'Keep';
    deleteChildren = await confirm(
      'Delete associated items?',
      `"${name}" has ${desc}. Delete them too?`
    );
    el.confirmYes.textContent = 'Delete';
    el.confirmNo.textContent  = 'Cancel';
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
  for (const rel of ENTITY[type].getChildren) {
    let children = (state.cache[rel.store] || []).filter(i => i[rel.field] === id);
    if (rel.filter) children = children.filter(rel.filter);
    for (const child of children) {
      await cascadeDeleteItem(rel.store, child.id);
    }
  }
  await remove(type, id);
}

/* ============================================================
   DUPLICATE
   ============================================================ */

function uniqueCopyName(store, baseName) {
  const existing = new Set((state.cache[store] || []).map(i => i.name));
  const candidate = `${baseName} (copy)`;
  if (!existing.has(candidate)) return candidate;
  let n = 2;
  while (existing.has(`${baseName} (copy ${n})`)) n++;
  return `${baseName} (copy ${n})`;
}

async function duplicateItem(type, id) {
  await refreshAll();
  const original = state.refs[type]?.[id];
  if (!original) return;

  const cfg = ENTITY[type];
  const childRels = [];
  for (const rel of cfg.getChildren || []) {
    const children = (state.cache[rel.store] || [])
      .filter(i => i[rel.field] === id && (!rel.filter || rel.filter(i)));
    if (children.length) childRels.push({ ...rel, count: children.length });
  }

  let duplicateChildren = false;
  if (childRels.length) {
    const desc = childRels.map(r => `${r.count} ${r.label.toLowerCase()}`).join(', ');
    el.confirmYes.textContent = 'Yes, duplicate all';
    el.confirmNo.textContent  = 'No, just this item';
    duplicateChildren = await confirm(
      'Duplicate children?',
      `"${original.name}" has ${desc}. Duplicate these too?`
    );
    el.confirmYes.textContent = 'Delete';
    el.confirmNo.textContent  = 'Cancel';
  }

  state.formDuplicateSource = { sourceId: id, duplicateChildren };
  const copy = { ...original, name: uniqueCopyName(type, original.name) };
  openSheet(type, null, { copyFrom: copy });
}

async function cascadeDuplicateChildren(type, sourceId, newParentId) {
  const cfg = ENTITY[type];
  for (const rel of cfg.getChildren || []) {
    const children = (state.cache[rel.store] || [])
      .filter(i => i[rel.field] === sourceId && (!rel.filter || rel.filter(i)));
    for (const child of children) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = child;
      const childCopy = { ...rest, [rel.field]: newParentId, name: uniqueCopyName(rel.store, child.name) };
      const saved = await upsert(rel.store, childCopy);
      await cascadeDuplicateChildren(rel.store, child.id, saved.id);
    }
  }
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
      payload.data[name] = await getAll(name);
    }
    payload.data.settings = await getAll('settings');

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

    el.confirmYes.textContent = 'Replace All';
    const ok = await confirm(
      'Replace all data?',
      'This will permanently delete all current data and replace it with the imported file. This cannot be undone.'
    );
    el.confirmYes.textContent = 'Delete';
    if (!ok) return;

    const allStores = ['areas', 'panels', 'power', 'safety', 'networks', 'assets', 'settings'];
    for (const name of allStores) {
      await clearStore(name);
    }
    for (const name of allStores) {
      const items = payload.data[name];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        await upsert(name, item);
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
