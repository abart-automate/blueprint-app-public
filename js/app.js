/* Entity configuration, shared field arrays, icon constants, and ASSIGN_STORE_MAP
   are defined in js/entity-config.js (loaded before this file). */

/* State object, DOM refs, showToast, confirm, loadCache, refreshAll
   are defined in js/state.js (loaded before this file). */

/* esc, resolveRef, resolveRefName, getEffectiveFields, itemTables, getIpPrefix,
   calcCompleteness, calcArea/PanelDevicesCompleteness, buildDetailCompletenessHtml,
   entityIcon, processMediaFile, base64ToMediaItem, createMediaUrl, revokeAllMediaUrls,
   openMediaLightbox are defined in js/utils.js. */

/* ============================================================
   BACK BUTTON / DETAIL PANEL
   ============================================================ */

function openDetail(type, id) {
  const wasOpen = !!(state.detailType && state.detailId);
  if (wasOpen) {
    state.detailStack.push({ type: state.detailType, id: state.detailId });
    state.detailChanges = {};
  }
  state.detailType = type;
  state.detailId   = id;
  renderDetail();
  if (!wasOpen) {
    el.detail.classList.remove('animating');
    el.detail.style.display = 'block';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.detail.classList.add('open'));
    });
  }
  el.backBtn.style.visibility = 'visible';
  el.addBtn.style.visibility  = 'hidden';
  el.pageTitle.textContent    = ENTITY[type].label;
}

function closeDetail() {
  if (state.detailStack.length > 0) {
    const prev = state.detailStack.pop();
    state.detailType       = prev.type;
    state.detailId         = prev.id;
    state.detailSlotNumber = prev.slotNumber ?? null;
    state.detailChanges    = {};
    renderDetail();
    el.pageTitle.textContent = prev.type === '__plc_slot__'
      ? `Slot ${prev.slotNumber}`
      : ENTITY[prev.type].label;
    return;
  }
  el.detail.classList.remove('open');
  el.detail.classList.add('animating');
  setTimeout(() => {
    el.detail.classList.remove('animating');
    el.detail.style.display = 'none';
    el.detail.innerHTML = '';
  }, 300);
  state.detailType       = null;
  state.detailId         = null;
  state.detailSlotNumber = null;
  state.detailChanges    = {};
  state.detailStack      = [];
  setHeaderForPage(state.page);
}

/* ============================================================
   SHEET FORM
   ============================================================ */

function openSheet(type, id = null, preset = null) {
  state.formType   = type;
  state.formId     = id;
  state.formPreset = preset;
  const existing = id ? state.refs[type]?.[id] : (preset?.copyFrom || null);
  state.formImages = (existing?.images || []).map(
    x => (typeof x === 'string' ? base64ToMediaItem(x) : x)
  );
  state.formNamedPhotos = Object.fromEntries(
    Object.entries(existing?.namedPhotos || {}).map(([k, v]) => {
      const arr = Array.isArray(v) ? v : (v ? [v] : []);
      return [k, arr.map(x => (typeof x === 'string' ? base64ToMediaItem(x) : x))];
    })
  );
  state.formItemTables = {};
  const cfg = ENTITY[type];
  for (const t of [...(cfg.itemTables || []), ...Object.values(cfg.classItemTables || {}).flat()])
    state.formItemTables[t.key] = existing?.[t.key]?.map(r => ({...r})) ?? [];
  state.formSwitchNetworks = existing?.switchNetworks ? existing.switchNetworks.map(r => ({...r})) : [];
  state.formSwitchPorts    = existing?.switchPorts    ? existing.switchPorts.map(r => ({...r}))    : [];
  state.formIoPoints       = existing?.ioPoints       ? existing.ioPoints.map(r => ({...r}))       : [];
  const isCopy   = !id && !!preset?.copyFrom;
  const subLabel = isCopy
    ? (existing?.assetSubclass || null)
    : (!id ? (preset?.extra?.assetSubclass || existing?.assetSubclass) : existing?.assetSubclass);
  el.formTitle.textContent = isCopy
    ? `Duplicate ${subLabel || ENTITY[type].label}`
    : (id ? 'Edit ' : 'Add ') + (subLabel || ENTITY[type].label);
  renderForm();
  el.backdrop.classList.add('open');
  el.sheet.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.sheet.classList.add('open'));
  });
}

function closeSheet() {
  el.sheet.classList.remove('open');
  el.backdrop.classList.remove('open');
  el.formSave.textContent = 'Save';
  el.formSave.disabled    = false;
  setTimeout(() => { el.sheet.style.display = 'none'; el.formBody.innerHTML = ''; }, 300);
  revokeAllMediaUrls();
  state.formType         = null;
  state.formId           = null;
  state.formPreset       = null;
  state.formImages       = [];
  state.formNamedPhotos  = {};
  state.formItemTables  = {};
  state.formSwitchNetworks = [];
  state.formSwitchPorts    = [];
  state.formIoPoints       = [];
  state.formPowerBus       = [];
  state.formDuplicateSource = null;
  state.pickerMeta        = null;
}

function openSlotForm(rackId, slotNumber) {
  const rack     = state.refs.assets?.[rackId];
  const existing = rack?.slots?.find(s => s.slotNumber === slotNumber) || null;
  state.formType     = '__plc_slot__';
  state.formId       = null;
  state.formPreset   = { rackId, slotNumber };
  state.formImages   = [];
  state.formIoPoints = existing?.ioPoints
    ? existing.ioPoints.map(r => ({ label: r.label ?? r.tagName ?? 'Spare', signalType: r.signalType || '', wiringType: r.wiringType || '' }))
    : [];
  state.formPowerBus = existing?.powerBus
    ? existing.powerBus.map(e => ({ type: e.type || 'Power', refId: e.refId || '', wiring: (e.wiring || []).map(w => ({...w})) }))
    : [];
  el.formTitle.textContent = existing
    ? `Slot ${slotNumber} — Edit Card`
    : `Slot ${slotNumber} — Add Card`;
  renderForm();
  el.backdrop.classList.add('open');
  el.sheet.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => el.sheet.classList.add('open')));
}

function openSlotDetail(rackId, slotNumber) {
  const wasOpen = !!state.detailType;
  if (wasOpen) {
    state.detailStack.push({ type: state.detailType, id: state.detailId, slotNumber: state.detailSlotNumber });
    state.detailChanges = {};
  }
  state.detailType       = '__plc_slot__';
  state.detailId         = rackId;
  state.detailSlotNumber = slotNumber;
  renderDetail();
  if (!wasOpen) {
    el.detail.classList.remove('animating');
    el.detail.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => el.detail.classList.add('open')));
  }
  el.backBtn.style.visibility = 'visible';
  el.addBtn.style.visibility  = 'hidden';
  el.pageTitle.textContent    = `Slot ${slotNumber}`;
}

async function openAssignOrCreate(childType, parentField, parentId) {
  await refreshAll();
  const cfg        = ENTITY[childType];
  const unassigned = (state.cache[childType] || []).filter(i => Object.hasOwn(i, parentField) && !i[parentField]);

  if (!unassigned.length) {
    openSheet(childType, null, { field: parentField, value: parentId });
    return;
  }

  const selected = new Set();
  state.formType   = '__picker__';
  state.pickerMeta = { childType, parentField, parentId, selected };
  el.formTitle.textContent = `Add ${cfg.label}`;
  el.formSave.textContent  = 'Assign';
  el.formSave.disabled     = true;

  const infoField = cfg.fields.find(f =>
    f.key !== 'name' && f.key !== parentField && f.key !== 'powerId' &&
    (f.type === 'text' || f.type === 'enum')
  );

  const checkIcon = `<svg class="picker-check-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const plusIcon  = ICON_PLUS;

  el.formBody.innerHTML = `
    <div style="margin-bottom:20px">
      <button class="btn btn-outline btn-full" id="picker-create-new">${plusIcon} Create New ${esc(cfg.label)}</button>
    </div>
    <div class="picker-or-label">or select existing to assign</div>
    ${unassigned.map(item => {
      const info = infoField ? item[infoField.key] : '';
      return `<div class="picker-item" data-id="${item.id}">
        <div class="picker-item-body">
          <div class="picker-item-name">${esc(item.name)}</div>
          ${info ? `<div class="picker-item-info">${esc(info)}</div>` : ''}
        </div>
        ${checkIcon}
      </div>`;
    }).join('')}
  `;

  const updateBtn = () => {
    el.formSave.disabled    = selected.size === 0;
    el.formSave.textContent = selected.size > 0 ? `Assign (${selected.size})` : 'Assign';
  };

  el.formBody.querySelector('#picker-create-new').addEventListener('click', () => {
    closeSheet();
    openSheet(childType, null, { field: parentField, value: parentId });
  });

  el.formBody.querySelectorAll('.picker-item').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.id;
      if (selected.has(id)) {
        selected.delete(id);
        row.classList.remove('picker-item-selected');
      } else {
        selected.add(id);
        row.classList.add('picker-item-selected');
      }
      updateBtn();
    });
  });

  el.backdrop.classList.add('open');
  el.sheet.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => el.sheet.classList.add('open')));
}

/* ============================================================
   ROUTER
   ============================================================ */

function navigate(page) {
  if (state.detailType) { state.detailStack = []; closeDetail(); }
  if (state.formType)   closeSheet();
  state.page = page;
  window.location.hash = page;
  setHeaderForPage(page);
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  renderPage();
}

function setHeaderForPage(page) {
  if (page === 'home') {
    el.pageTitle.textContent   = 'blueprint';
    el.backBtn.style.visibility = 'hidden';
    el.addBtn.style.visibility  = 'hidden';
  } else if (page === 'plc') {
    el.pageTitle.textContent   = 'PLCs';
    el.backBtn.style.visibility = 'hidden';
    el.addBtn.style.visibility  = 'visible';
  } else {
    el.pageTitle.textContent   = ENTITY[page].plural;
    el.backBtn.style.visibility = 'hidden';
    el.addBtn.style.visibility  = 'visible';
  }
}

/* ============================================================
   PAGE RENDERING
   ============================================================ */

async function renderPage() {
  el.main.innerHTML = '<div class="spinner"></div>';
  if (state.page === 'home')  { await renderHome(); return; }
  if (state.page === 'areas') { await renderAreasList(); return; }
  if (state.page === 'plc') {
    await renderList('assets', {
      preFilter: a => a.assetClass === 'PLC',
      label:     'PLC Rack',
      plural:    'PLC Racks',
      chipField: 'panelId',
    });
    return;
  }
  await renderList(state.page);
}

/* ---- HOME ---- */
async function renderHome() {
  await refreshAll();
  const [plantName, plantDesc, rawChecklistItems] = await Promise.all([
    getSetting('plantName').then(v => v || 'My Plant'),
    getSetting('plantDesc').then(v => v || 'Tap the edit button to set plant info'),
    getSetting('checklistItems').then(v => v || []),
  ]);

  const counts = {};
  for (const key of Object.keys(ENTITY)) counts[key] = state.cache[key]?.length ?? 0;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const showInstall = !isStandalone && !!_deferredInstallPrompt;

  el.main.innerHTML = `
    <div class="home-hero">
      <div class="home-plant-name">${esc(plantName)}</div>
      <div class="home-plant-desc">${esc(plantDesc)}</div>
      <button class="home-edit-btn" id="home-edit-plant" aria-label="Edit plant info">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="home-stats-toggle${_statsExpanded ? ' expanded' : ''}" id="home-stats-toggle" aria-label="Toggle summary" aria-expanded="${_statsExpanded}">${ICON_CHEVRON}</button>
    </div>
    <div class="stats-grid" id="home-stats-grid"${_statsExpanded ? '' : ' hidden'}>
      ${Object.entries(ENTITY).map(([key, cfg]) => `
        <div class="stat-card" data-nav="${key}">
          <div class="stat-icon" style="background:${cfg.bgColor};color:${cfg.color}">${entityIcon(key, 22)}</div>
          <div class="stat-info">
            <div class="stat-count">${counts[key]}</div>
            <div class="stat-label">${cfg.plural}</div>
          </div>
        </div>
      `).join('')}
    </div>
    ${showInstall ? `
    <div class="home-install-card">
      <div class="home-install-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
          stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </div>
      <div class="home-install-body">
        <div class="home-install-title">Install blueprint</div>
        <div class="home-install-desc">Add to your home screen for offline use</div>
      </div>
      <button class="btn btn-primary home-install-btn" id="home-install-btn">Install</button>
    </div>
    ` : ''}
    <div class="home-checklist" id="home-checklist">
      ${buildChecklistHtml(calcChecklistAutoItems(), rawChecklistItems)}
    </div>
    <div class="home-data-actions">
      <div class="section-label">Data Management</div>
      <div class="home-data-btns">
        <button class="btn btn-outline" id="home-export-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button class="btn btn-outline" id="home-import-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Import
        </button>
        <button class="btn btn-danger" id="home-clear-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          Clear All Data
        </button>
      </div>
    </div>
    <div class="home-footer">
      <span class="home-version">v${APP_VERSION}</span>
    </div>
  `;

  bindChecklistEvents();
  el.main.querySelector('#home-edit-plant').addEventListener('click', () => openPlantForm());
  el.main.querySelector('#home-stats-toggle').addEventListener('click', () => {
    _statsExpanded = !_statsExpanded;
    const grid = el.main.querySelector('#home-stats-grid');
    const btn  = el.main.querySelector('#home-stats-toggle');
    grid.hidden = !_statsExpanded;
    btn.classList.toggle('expanded', _statsExpanded);
    btn.setAttribute('aria-expanded', _statsExpanded);
  });
  el.main.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('click', () => navigate(card.dataset.nav));
  });
  el.main.querySelector('#home-export-btn').addEventListener('click', showExportOptions);
  el.main.querySelector('#home-import-btn').addEventListener('click', importData);
  el.main.querySelector('#home-clear-btn').addEventListener('click', clearAllData);
  if (showInstall) {
    el.main.querySelector('#home-install-btn').addEventListener('click', async () => {
      if (!_deferredInstallPrompt) return;
      _deferredInstallPrompt.prompt();
      const { outcome } = await _deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        _deferredInstallPrompt = null;
        renderHome();
      }
    });
  }
}

let _statsExpanded = false;
const _expandedAutoKeys = new Set();

function buildChecklistHtml(autoItems, customItems) {
  const autoDone  = autoItems.reduce((s, i) => s + i.done, 0);
  const autoTotal = autoItems.reduce((s, i) => s + i.total, 0);
  const custDone  = customItems.filter(i => i.completed).length;
  const custTotal = customItems.length;
  const grandDone  = autoDone + custDone;
  const grandTotal = autoTotal + custTotal;
  const pct        = grandTotal > 0 ? Math.round(grandDone / grandTotal * 100) : 0;
  const allDone    = grandTotal > 0 && grandDone === grandTotal;

  const autoRows = autoItems.map(item => {
    const complete  = item.done === item.total;
    const hasSubs   = !!item.subItems?.length;
    const expanded  = _expandedAutoKeys.has(item.key);

    const row = `<div class="checklist-item checklist-item-auto${complete ? ' checklist-done' : ''}">
      <span class="checklist-check-icon${complete ? ' checklist-icon-complete' : ''}">${complete ? ICON_CHECK : ICON_CIRCLE}</span>
      <span class="checklist-label">${esc(item.label)}</span>
      <span class="checklist-count">${item.done}/${item.total}</span>
      ${hasSubs ? `<button class="checklist-expand-btn${expanded ? ' expanded' : ''}" data-key="${esc(item.key)}" aria-label="Toggle subtypes">${ICON_CHEVRON}</button>` : ''}
    </div>`;

    if (!hasSubs) return row;

    const subRows = item.subItems.map(sub => {
      const sc = sub.done === sub.total;
      return `<div class="checklist-item checklist-subitem checklist-item-auto${sc ? ' checklist-done' : ''}">
        <span class="checklist-check-icon${sc ? ' checklist-icon-complete' : ''}">${sc ? ICON_CHECK : ICON_CIRCLE}</span>
        <span class="checklist-label">${esc(sub.label)}</span>
        <span class="checklist-count">${sub.done}/${sub.total}</span>
      </div>`;
    }).join('');

    return `${row}<div class="checklist-subgroup" data-parent="${esc(item.key)}"${expanded ? '' : ' hidden'}>${subRows}</div>`;
  }).join('');

  const customRows = customItems.map(item => `
    <div class="checklist-item${item.completed ? ' checklist-done' : ''}">
      <button class="checklist-toggle-btn" data-cid="${esc(item.id)}" aria-label="Toggle task">
        <span class="${item.completed ? 'checklist-icon-complete' : ''}">${item.completed ? ICON_CHECK : ICON_CIRCLE}</span>
      </button>
      <span class="checklist-label">${esc(item.label)}</span>
      <button class="checklist-delete-btn" data-cid="${esc(item.id)}" aria-label="Delete task">${ICON_RM}</button>
    </div>`).join('');

  return `
    <div class="section-label">Discovery Checklist</div>
    <div class="checklist-summary${allDone ? ' checklist-summary-complete' : ''}">
      <div class="checklist-summary-top">
        <span class="checklist-summary-label">All Items</span>
        <span class="checklist-summary-meta">${grandDone}/${grandTotal} &bull; ${pct}%</span>
      </div>
      <div class="checklist-summary-track"><div class="checklist-summary-fill" style="width:${pct}%"></div></div>
    </div>
    ${autoItems.length ? `<div class="checklist-group">${autoRows}</div>` : ''}
    <div class="checklist-group checklist-custom">
      ${customRows}
      <div class="checklist-add-row">
        <input id="checklist-new-input" class="f-input checklist-new-input" type="text" placeholder="Add task…" maxlength="120">
        <button class="btn btn-outline checklist-add-btn" id="checklist-add-btn">${ICON_PLUS}</button>
      </div>
    </div>`;
}

function bindChecklistEvents() {
  const container = $('home-checklist');
  if (!container) return;

  const rerender = async () => {
    const items = (await getSetting('checklistItems')) || [];
    container.innerHTML = buildChecklistHtml(calcChecklistAutoItems(), items);
    bindChecklistEvents();
  };

  container.querySelectorAll('.checklist-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const sub = container.querySelector(`.checklist-subgroup[data-parent="${key}"]`);
      if (!sub) return;
      const nowExpanded = !_expandedAutoKeys.has(key);
      nowExpanded ? _expandedAutoKeys.add(key) : _expandedAutoKeys.delete(key);
      sub.hidden = !nowExpanded;
      btn.classList.toggle('expanded', nowExpanded);
    });
  });

  container.querySelectorAll('.checklist-toggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const items = (await getSetting('checklistItems')) || [];
      const idx = items.findIndex(i => i.id === btn.dataset.cid);
      if (idx === -1) return;
      items[idx].completed = !items[idx].completed;
      await setSetting('checklistItems', items);
      await rerender();
    });
  });

  container.querySelectorAll('.checklist-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const items = ((await getSetting('checklistItems')) || []).filter(i => i.id !== btn.dataset.cid);
      await setSetting('checklistItems', items);
      await rerender();
    });
  });

  const doAdd = async () => {
    const input = $('checklist-new-input');
    const label = input?.value.trim();
    if (!label) return;
    const items = (await getSetting('checklistItems')) || [];
    items.push({ id: crypto.randomUUID(), label, completed: false });
    await setSetting('checklistItems', items);
    await rerender();
  };

  $('checklist-add-btn')?.addEventListener('click', doAdd);
  $('checklist-new-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
}

function openPlantForm() {
  el.formTitle.textContent = 'Plant Info';
  state.formType = '__plant__';
  state.formImages = [];
  el.formBody.innerHTML = `
    <div class="fg">
      <label class="fg-label">Plant Name <span class="req">*</span></label>
      <input id="pf-name" class="f-input" type="text" placeholder="Enter plant name">
    </div>
    <div class="fg">
      <label class="fg-label">Description</label>
      <textarea id="pf-desc" class="f-textarea" placeholder="Brief description of the plant"></textarea>
    </div>
  `;
  getSetting('plantName').then(n => { if (n) $('pf-name').value = n; });
  getSetting('plantDesc').then(d => { if (d) $('pf-desc').value = d; });
  el.backdrop.classList.add('open');
  el.sheet.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => el.sheet.classList.add('open')));
}

/* ---- AREAS LIST ---- */
async function renderAreasList() {
  await refreshAll();
  const areas = state.cache.areas || [];

  el.main.innerHTML = `
    <div class="search-wrap">
      <span class="search-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </span>
      <input id="list-search" class="search-input" type="search" placeholder="Search areas…">
    </div>
    <div id="area-list" class="area-list"></div>
  `;

  const list = el.main.querySelector('#area-list');

  const render = () => {
    const q = el.main.querySelector('#list-search')?.value?.toLowerCase() || '';
    const shown = q ? areas.filter(a => a.name?.toLowerCase().includes(q)) : areas;

    if (!shown.length) {
      list.innerHTML = areas.length === 0
        ? `<div class="empty"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><h3>No Areas yet</h3><p>Tap <strong>+</strong> to add your first area.</p></div>`
        : `<div class="empty"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><h3>No results</h3><p>Try a different search.</p></div>`;
      return;
    }

    list.innerHTML = shown.map(area => {
      const panelItems = (state.cache.panels  || []).filter(p => p.areaId === area.id);
      const panelIds   = new Set(panelItems.map(p => p.id));
      const counts = {
        panels:   panelItems.length,
        power:    (state.cache.power    || []).filter(p => panelIds.has(p.panelId)).length,
        safety:   (state.cache.safety   || []).filter(s => panelIds.has(s.panelId)).length,
        networks: (state.cache.networks || []).filter(n => n.assignedToType === 'Area' && n.assignedToId === area.id).length,
        assets:   (state.cache.assets   || []).filter(a => panelIds.has(a.panelId)).length,
      };
      return areaCardHTML(area, counts);
    }).join('');

    list.querySelectorAll('.area-card').forEach(card => {
      card.addEventListener('click', () => openDetail('areas', card.dataset.id));
    });
    list.querySelectorAll('.area-card-delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        deleteItem('areas', btn.dataset.id, btn.dataset.name);
      });
    });
  };

  el.main.querySelector('#list-search').addEventListener('input', render);
  render();
}

function areaCardHTML(area, counts) {
  const pct = calcAreaCompleteness(area);
  const barColor = pct >= COMPLETION_THRESHOLD ? 'var(--success)' : 'var(--danger)';
  const countDefs = [
    { type: 'panels',   color: 'var(--c-panel)',   title: 'Panels',   n: counts.panels },
    { type: 'power',    color: 'var(--c-power)',   title: 'Power',    n: counts.power },
    { type: 'safety',   color: 'var(--c-safety)',  title: 'Safety',   n: counts.safety },
    { type: 'networks', color: 'var(--c-network)', title: 'Networks', n: counts.networks },
    { type: 'assets',   color: 'var(--c-asset)',   title: 'Assets',   n: counts.assets },
  ];
  return `
    <div class="area-card" data-id="${area.id}">
      <div class="area-card-header">
        <div class="area-card-name">${esc(area.name)}</div>
        <button class="area-card-delete" data-id="${area.id}" data-name="${esc(area.name)}" aria-label="Delete area">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
      <div class="area-card-counts">
        ${countDefs.map(c => `
          <div class="area-count-item" style="color:${c.color}" title="${c.title}">
            ${entityIcon(c.type, 17)}
            <span>${c.n}</span>
          </div>
        `).join('')}
      </div>
      <div class="card-progress-wrap area-card-progress">
        <div class="card-progress-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>
    </div>
  `;
}

/* ---- LIST VIEW ---- */
async function renderList(type, opts = {}) {
  await loadCache(['areas', 'panels', 'power', 'safety', 'networks', 'assets']);
  let items = state.cache[type] || [];
  if (opts.preFilter) items = items.filter(opts.preFilter);
  const cfg        = ENTITY[type];
  const cfgLabel   = opts.label  || cfg.label;
  const cfgPlural  = opts.plural || cfg.plural;

  const parentFilter = buildParentFilterChips(type, items, opts.chipField);

  el.main.innerHTML = `
    <div class="search-wrap">
      <span class="search-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </span>
      <input id="list-search" class="search-input" type="search" placeholder="Search ${cfgPlural.toLowerCase()}…">
    </div>
    ${parentFilter.html}
    <div id="card-list" class="card-list"></div>
  `;

  parentFilter.bind(el.main);

  const list = el.main.querySelector('#card-list');
  let activeParent = 'all';

  const render = () => {
    const q     = el.main.querySelector('#list-search')?.value?.toLowerCase() || '';
    const shown = items.filter(item => {
      const matchQ = !q || item.name?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q) || item.tag?.toLowerCase().includes(q);
      const matchP = activeParent === 'all' || matchParentChip(type, item, activeParent, opts.chipField);
      return matchQ && matchP;
    });

    if (!shown.length) {
      list.innerHTML = items.length === 0
        ? `<div class="empty"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><h3>No ${cfgPlural} yet</h3><p>Tap <strong>+</strong> to add your first ${cfgLabel.toLowerCase()}.</p></div>`
        : `<div class="empty"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><h3>No results</h3><p>Try a different search or filter.</p></div>`;
      return;
    }

    list.innerHTML = shown.map(item => cardHTML(type, item)).join('');
    list.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => openDetail(type, card.dataset.id));
    });
    list.querySelectorAll('.card-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        deleteItem(type, btn.dataset.id, btn.dataset.name);
      });
    });
  };

  el.main.querySelector('#list-search').addEventListener('input', render);
  el.main.addEventListener('chip-change', e => { activeParent = e.detail; render(); });
  render();
}

function cardHTML(type, item, { contextNetworkId } = {}) {
  const cfg  = ENTITY[type];
  const classLine = type === 'assets' && item.assetClass
    ? (item.assetSubclass ? `${item.assetClass} — ${item.assetSubclass}` : item.assetClass)
    : '';
  const locationLine = (() => {
    const panel = item.panelId ? state.refs.panels?.[item.panelId]?.name : '';
    const area  = item.areaId  ? state.refs.areas?.[item.areaId]?.name  : '';
    if (panel && area) return `${area} / ${panel}`;
    if (panel) return panel;
    if (area) return area;
    return type === 'assets' ? '' : (cfg.getSubtitle ? cfg.getSubtitle(item, state.refs) : '');
  })();
  const networkLine = (() => {
    if (type !== 'assets') return '';
    if (item.assetClass === 'PLC') {
      const parts = (item.slots || [])
        .filter(s => (s.cardType === 'Controller' || s.cardType === 'Communication') && s.networkId &&
          (!contextNetworkId || s.networkId === contextNetworkId))
        .map(s => {
          const net = state.refs.networks?.[s.networkId];
          if (!net) return '';
          const addr = s.ipAddress || s.nodeAddress || '';
          return addr ? `${net.name} — ${addr}` : net.name;
        })
        .filter(Boolean);
      return parts.join(', ');
    }
    if (item.switchNetworks?.length) {
      const relevant = contextNetworkId
        ? item.switchNetworks.filter(sn => sn.networkId === contextNetworkId)
        : item.switchNetworks;
      const parts = relevant.map(sn => {
        const net = state.refs.networks?.[sn.networkId];
        if (!net) return '';
        const addr = sn.ipAddress || sn.nodeAddress || '';
        return addr ? `${net.name} — ${addr}` : net.name;
      }).filter(Boolean);
      if (parts.length) return parts.join(', ');
    }
    if (!item.networkId) return '';
    const net = state.refs.networks?.[item.networkId];
    if (!net) return '';
    const addr = item.ipAddress || item.nodeAddress || '';
    return addr ? `${net.name} — ${addr}` : net.name;
  })();
  const firstMedia = item.images?.[0] || (item.namedPhotos && Object.values(item.namedPhotos)[0]) || null;
  const thumbSrc = getCardThumbSrc(firstMedia);
  const thumb = thumbSrc
    ? `<img class="card-thumb" src="${thumbSrc}" alt="">`
    : `<div class="card-thumb-ph" style="color:${cfg.color};background:${cfg.bgColor}">${entityIcon(type, 24)}</div>`;

  const allChildren = [
    ...(cfg.getChildren || []),
    ...(cfg.subclassChildren?.[item?.assetSubclass] || []),
  ];
  const counts = allChildren.map(child => {
    const all = state.cache[child.store] || [];
    const n = child.countFn
      ? child.countFn(all, item.id)
      : child.filter
        ? all.filter(i => i[child.field] === item.id && child.filter(i)).length
        : all.filter(i => i[child.field] === item.id).length;
    return { store: child.store, label: child.label, n };
  });
  const countsHtml = counts.length ? `
    <div class="card-counts">
      ${counts.map(c => `
        <div class="card-count-item" style="color:${ENTITY[c.store].color}" title="${esc(c.label)}">
          ${entityIcon(c.store, 14)}<span>${c.n}</span>
        </div>`).join('')}
    </div>` : '';

  const trashIcon = ICON_TRASH;
  const pct = calcCompleteness(type, item);
  const barColor = pct >= COMPLETION_THRESHOLD ? 'var(--success)' : 'var(--danger)';

  let progressHtml;
  if (type === 'panels') {
    const devPct = calcPanelDevicesCompleteness(item.id);
    const devColor = devPct !== null ? (devPct >= COMPLETION_THRESHOLD ? 'var(--success)' : 'var(--danger)') : 'var(--border)';
    progressHtml = `
      <div class="card-progress-multi">
        <div class="cpr-row">
          <span class="cpr-label">Panel</span>
          <div class="cpr-track"><div class="cpr-fill" style="width:${pct}%;background:${barColor}"></div></div>
          <span class="cpr-pct" style="color:${barColor}">${pct}%</span>
        </div>
        <div class="cpr-row">
          <span class="cpr-label">Devices</span>
          <div class="cpr-track"><div class="cpr-fill" style="width:${devPct ?? 0}%;background:${devColor}"></div></div>
          <span class="cpr-pct" style="color:${devColor}">${devPct !== null ? devPct + '%' : '—'}</span>
        </div>
      </div>`;
  } else {
    progressHtml = `
      <div class="card-progress-wrap">
        <div class="card-progress-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>`;
  }

  return `
    <div class="card" data-id="${item.id}">
      <div class="card-row">
        ${thumb}
        <div class="card-body">
          <div class="card-name-row">
            <div class="card-name">${esc(item.name)}${classLine ? ` <span class="card-class-inline">${esc(classLine)}</span>` : ''}</div>
            <button class="card-delete-btn" data-id="${item.id}" data-name="${esc(item.name)}" aria-label="Delete">${trashIcon}</button>
          </div>
          ${locationLine ? `<div class="card-location">${esc(locationLine)}</div>` : ''}
          ${networkLine ? `<div class="card-network">${esc(networkLine)}</div>` : ''}
          ${item.description ? `<div class="card-desc">${esc(item.description)}</div>` : ''}
          ${countsHtml}
        </div>
      </div>
      ${progressHtml}
    </div>
  `;
}

/* ---- PARENT FILTER CHIPS ---- */
function buildParentFilterChips(type, items, chipFieldKey) {
  const bindChips = (container) => {
    const chips = container.querySelector('#filter-chips');
    if (!chips) return;
    chips.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      chips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      container.dispatchEvent(new CustomEvent('chip-change', { detail: chip.dataset.val }));
    });
  };

  const parentField = chipFieldKey
    ? ENTITY[type]?.fields.find(f => f.key === chipFieldKey)
    : ENTITY[type]?.fields.find(f => f.type === 'ref' && (f.required || f.filterChip));
  if (parentField) {
    const refStore = parentField.refStore;
    const parentIds = [...new Set(items.map(i => i[parentField.key]).filter(Boolean))];
    const hasUnassigned = items.some(i => !i[parentField.key]);
    if (!parentIds.length && !hasUnassigned) return { html: '', bind: () => {} };
    const parents = parentIds.map(id => state.refs[refStore]?.[id]).filter(Boolean);
    if (!parents.length && !hasUnassigned) return { html: '', bind: () => {} };
    const html = `
      <div class="chips" id="filter-chips">
        <button class="chip active" data-val="all">All</button>
        ${parents.map(p => `<button class="chip" data-val="${p.id}">${esc(p.name)}</button>`).join('')}
        ${hasUnassigned ? `<button class="chip" data-val="unassigned">Unassigned</button>` : ''}
      </div>
    `;
    return { html, bind: bindChips };
  }

  const enumField = ENTITY[type]?.fields.find(f => f.enumFilterChip);
  if (enumField) {
    const values = [...new Set(items.map(i => i[enumField.key]).filter(Boolean))];
    if (!values.length) return { html: '', bind: () => {} };
    const html = `
      <div class="chips" id="filter-chips">
        <button class="chip active" data-val="all">All</button>
        ${values.map(v => `<button class="chip" data-val="${esc(v)}">${esc(v)}</button>`).join('')}
      </div>
    `;
    return { html, bind: bindChips };
  }

  return { html: '', bind: () => {} };
}

function matchParentChip(type, item, parentId, chipFieldKey) {
  const field = chipFieldKey
    ? ENTITY[type]?.fields.find(f => f.key === chipFieldKey)
    : ENTITY[type]?.fields.find(f => f.type === 'ref' && (f.required || f.filterChip));
  if (field?.type === 'ref') {
    if (parentId === 'unassigned') return !item[field.key];
    return item[field.key] === parentId;
  }
  if (!chipFieldKey) {
    const enumField = ENTITY[type]?.fields.find(f => f.enumFilterChip);
    if (enumField) return item[enumField.key] === parentId;
  }
  return true;
}

/* ============================================================
   DETAIL VIEW
   ============================================================ */

/* renderDetail, renderSlotDetail, renderEntityDetail, buildCollapsibleCard,
   getSlotLinkedRacks, slotLinkedRackCardHTML, buildChildSections,
   showDetailSaveBar, activateNameEdit, activateInlineEdit, saveDetailChanges
   are defined in js/renderers/detail.js (loaded before this file). */

/* ============================================================
   FORM RENDERING
   ============================================================ */

/* renderForm, renderSlotForm, renderEntityForm, buildFormField,
   populateAssignId, filterPowerByPanel are in js/renderers/form.js. */

/* saveForm, savePickerForm, saveSlotForm, savePlantForm, saveEntityForm,
   deleteItem, cascadeDeleteItem, uniqueCopyName, duplicateItem,
   cascadeDuplicateChildren, showExportOptions, exportData, importData,
   processImportFile are defined in js/operations.js (loaded before this file). */


/* ============================================================
   WIRE UP GLOBAL EVENTS
   ============================================================ */

/* wireEvents is defined in js/events.js (loaded before this file). */

/* ============================================================
   INIT & PWA LIFECYCLE
   ============================================================ */

/* init, initInstallPrompt, initUpdateBanner are defined in js/init.js (loaded after this file). */
