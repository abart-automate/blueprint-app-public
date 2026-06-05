/* ============================================================
   FORM RENDERER
   Renders the bottom-sheet form for creating/editing entities,
   PLC slots, and the plant settings form.
   Depends on: state, ENTITY, ASSIGN_STORE_MAP, PLC_CARD_TYPE_FIELDS,
               esc, getIpPrefix, getById, refreshAll,
               renderMediaSlot, renderMediaGallery, renderItemTable,
               renderClassItemTables, renderIoPointsTable, syncIoPointCount,
               renderSwitchNetworksTable, renderSwitchPortsTable, renderPowerBusTable.
   ============================================================ */

async function renderForm() {
  if (state.formType === '__plant__') return;
  if (state.formType === '__plc_slot__') return renderSlotForm();
  return renderEntityForm();
}

/* ---- PLC SLOT FORM ---- */

async function renderSlotForm() {
  const { rackId, slotNumber } = state.formPreset;
  const rack     = state.refs.assets?.[rackId];
  const existing = rack?.slots?.find(s => s.slotNumber === slotNumber) || null;
  await refreshAll();

  const cardTypeOpts = ['Controller','Communication','Analog','Digital','Specialty']
    .map(t => `<option value="${t}"${existing?.cardType === t ? ' selected' : ''}>${t}</option>`)
    .join('');
  el.formBody.innerHTML = `
    <div class="fg"><label class="f-label">Card Name</label>
      <input class="f-input" id="f-name" type="text" value="${esc(existing?.name || '')}"></div>
    <div class="fg"><label class="f-label">Card Type</label>
      <select class="f-select" id="f-cardType"><option value=""></option>${cardTypeOpts}</select></div>
    <div class="fg"><label class="f-label">Part Number</label>
      <input class="f-input" id="f-partNumber" type="text" value="${esc(existing?.partNumber || '')}"></div>
    <div class="fg"><label class="f-label">Firmware Version</label>
      <input class="f-input" id="f-firmwareVersion" type="text" value="${esc(existing?.firmwareVersion || '')}"></div>
    <div id="slot-cardtype-container"></div>
    <div id="network-address-container"></div>
    <div id="io-points-wrap" style="display:none">
      <div class="form-section-hdr">IO Points</div>
      <div id="io-points-container"></div>
    </div>
    <div id="power-bus-wrap" style="display:none">
      <div class="form-section-hdr">Power Bus</div>
      <div id="power-bus-container"></div>
    </div>
  `;

  const renderSlotNetworkAddressFields = async () => {
    const networkId = $('f-networkId')?.value;
    const network   = state.refs.networks?.[networkId];
    const fields    = ENTITY.assets.networkTypeFields?.[network?.networkType] || [];
    const container = $('network-address-container');
    if (!container) return;
    if (!fields.length) { container.innerHTML = ''; return; }
    let ph = `<div class="form-section-hdr">Network Address</div>`;
    for (const f of fields) ph += await buildFormField(f, existing, 'assets');
    container.innerHTML = ph;
  };

  const renderSlotCardTypeFields = async () => {
    const cardType  = $('f-cardType')?.value;
    const fields    = PLC_CARD_TYPE_FIELDS[cardType] || [];
    const container = $('slot-cardtype-container');
    if (!container) return;
    if (!fields.length) { container.innerHTML = ''; } else {
      let ph = '';
      for (const f of fields) ph += await buildFormField(f, existing, 'assets');
      container.innerHTML = ph;
      if (cardType === 'Controller' || cardType === 'Communication') {
        $('f-networkId')?.addEventListener('change', renderSlotNetworkAddressFields);
        await renderSlotNetworkAddressFields();
      }
    }
    const ioWrap = $('io-points-wrap');
    if (ioWrap) {
      const isIo = cardType === 'Analog' || cardType === 'Digital';
      ioWrap.style.display = isIo ? '' : 'none';
      if (isIo) {
        renderIoPointsTable();
        const ioCountEl = $('f-ioPointCount');
        if (ioCountEl) ioCountEl.addEventListener('change', syncIoPointCount);
      }
    }
    const pbWrap = $('power-bus-wrap');
    if (pbWrap) {
      const isIo = cardType === 'Analog' || cardType === 'Digital';
      pbWrap.style.display = isIo ? '' : 'none';
      if (isIo) renderPowerBusTable();
    }
  };

  $('f-cardType').addEventListener('change', renderSlotCardTypeFields);
  await renderSlotCardTypeFields();
}

/* ---- ENTITY FORM ---- */

async function renderEntityForm() {
  const { formType: type, formId: id } = state;
  const cfg      = ENTITY[type];
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
  let currentSection = undefined;
  let physicalSection = undefined;
  for (const f of cfg.fields) {
    if (type === 'assets' && FORM_PHYSICAL_SECTIONS.has(f.section)) {
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
    html += `<div id="network-address-container"></div>`;
    html += `
      <div id="switch-networks-wrap" style="display:none">
        <div class="form-section-hdr">Network Connections</div>
        <div id="switch-networks-container"></div>
      </div>
      <div id="switch-ports-wrap" style="display:none">
        <div class="form-section-hdr">Port Assignments</div>
        <div id="switch-ports-container"></div>
      </div>
      <div id="card-type-fields-container"></div>
      <div id="class-item-tables-container"></div>
      <div id="io-points-wrap" style="display:none">
        <div class="form-section-hdr">IO Points</div>
        <div id="io-points-container"></div>
      </div>`;
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

  if (cfg.itemTables) {
    for (const t of cfg.itemTables) renderItemTable(t.key, t.label);
  }

  if (type === 'assets') {
    const currentAssetClass = $('f-assetClass')?.value;
    renderClassItemTables(currentAssetClass);
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
    const grid = $('img-preview-grid');
    const reGallery = () => renderMediaGallery(grid, state.formImages, {
      onAdd:    items => { state.formImages.push(...items); reGallery(); },
      onRemove: i     => { state.formImages.splice(i, 1); reGallery(); },
    });
    reGallery();
  }

  const assignTypeSelect = $('f-assign-type');
  if (assignTypeSelect) {
    assignTypeSelect.addEventListener('change', () => populateAssignId(type, assignTypeSelect.value, existing?.assignedToId));
    populateAssignId(type, assignTypeSelect.value, existing?.assignedToId);
  }

  if (type === 'networks') {
    const typeSelect = $('f-networkType');
    const renderProtocolFields = async () => {
      const networkType = typeSelect?.value;
      const protoFields = ENTITY.networks.protocolFields?.[networkType] || [];
      const container   = $('protocol-fields-container');
      if (!container) return;
      if (!protoFields.length) { container.innerHTML = ''; return; }
      let ph = '';
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
    const renderNetworkAddressFields = async () => {
      const networkId = $('f-networkId')?.value;
      const network   = state.refs.networks?.[networkId];
      const fields    = ENTITY.assets.networkTypeFields?.[network?.networkType] || [];
      const container = $('network-address-container');
      if (!container) return;
      if (!fields.length) { container.innerHTML = ''; return; }
      let ph = `<div class="form-section-hdr">Network Address</div>`;
      for (const f of fields) ph += await buildFormField(f, existing, type);
      container.innerHTML = ph;
      const ipInput = $('f-ipAddress');
      if (ipInput && !ipInput.value) {
        const prefix = getIpPrefix(network?.ipRange);
        if (prefix) ipInput.value = prefix;
      }
    };

    const updateSwitchTables = () => {
      const assetClass = $('f-assetClass')?.value;
      const subclass   = $('f-assetSubclass')?.value;
      const showTables = assetClass === 'Network Switch' && (subclass === 'Managed' || subclass === 'Router');
      const snWrap = $('switch-networks-wrap');
      const spWrap = $('switch-ports-wrap');
      if (snWrap) snWrap.style.display = showTables ? '' : 'none';
      if (spWrap) spWrap.style.display = showTables ? '' : 'none';
      if (showTables) {
        renderSwitchNetworksTable();
        renderSwitchPortsTable();
      }
    };

    const renderSubclassFields = async () => {
      const subclass  = $('f-assetSubclass')?.value;
      const fields    = ENTITY.assets.subclassFields?.[subclass] || [];
      const container = $('subclass-fields-container');
      if (!container) return;
      if (!fields.length) { container.innerHTML = ''; updateSwitchTables(); return; }
      let ph = '', lastSection;
      for (const f of fields) {
        if (f.section !== lastSection) {
          lastSection = f.section;
          ph += `<div class="form-section-hdr">${esc(f.section)}</div>`;
        }
        ph += await buildFormField(f, existing, type);
      }
      container.innerHTML = ph;
      if ($('f-networkId')) {
        $('f-networkId').addEventListener('change', renderNetworkAddressFields);
        await renderNetworkAddressFields();
      }
      const portCountEl = $('f-portCount');
      if (portCountEl) {
        portCountEl.addEventListener('change', () => {
          const count   = Math.max(0, parseInt(portCountEl.value) || 0);
          const current = state.formSwitchPorts.length;
          if (count > current) {
            for (let i = current + 1; i <= count; i++)
              state.formSwitchPorts.push({ portName: `Port ${i}`, networkId: '', assetId: '' });
          } else if (count < current) {
            state.formSwitchPorts.splice(count);
          }
          renderSwitchPortsTable();
        });
      }
      const cardTypeEl = $('f-cardType');
      if (cardTypeEl) {
        cardTypeEl.addEventListener('change', renderCardTypeFields);
        await renderCardTypeFields();
      }
      updateSwitchTables();
    };

    const renderCardTypeFields = async () => {
      const cardType  = $('f-cardType')?.value;
      const fields    = ENTITY.assets.cardTypeFields?.[cardType] || [];
      const container = $('card-type-fields-container');
      if (!container) return;
      if (!fields.length) { container.innerHTML = ''; } else {
        let ph = '', lastSection;
        for (const f of fields) {
          if (f.section !== lastSection) {
            lastSection = f.section;
            ph += `<div class="form-section-hdr">${esc(f.section)}</div>`;
          }
          ph += await buildFormField(f, existing, type);
        }
        container.innerHTML = ph;
        if (cardType === 'Controller') {
          $('f-networkId')?.addEventListener('change', renderNetworkAddressFields);
          await renderNetworkAddressFields();
        }
      }
      const ioWrap = $('io-points-wrap');
      if (ioWrap) {
        const isIo = cardType === 'Analog' || cardType === 'Digital';
        ioWrap.style.display = isIo ? '' : 'none';
        if (isIo) {
          renderIoPointsTable();
          const ioCountEl = $('f-ioPointCount');
          if (ioCountEl) ioCountEl.addEventListener('change', syncIoPointCount);
        }
      }
    };

    const renderClassSubclassField = async () => {
      const assetClass  = $('f-assetClass')?.value;
      let   subclasses  = ENTITY.assets.classSubclasses?.[assetClass] || [];
      const subclassSel = $('f-assetSubclass');
      if (!subclassSel) return;
      const currentSub = existing?.assetSubclass || '';
      if (currentSub && id && !subclasses.includes(currentSub)) subclasses = [...subclasses, currentSub];
      subclassSel.innerHTML = '<option value=""></option>' +
        subclasses.map(s => `<option value="${s}"${s === currentSub ? ' selected' : ''}>${esc(s)}</option>`).join('');
      const wrap = subclassSel.closest('.fg');
      if (wrap) wrap.style.display = subclasses.length ? '' : 'none';

      const classIsLocked = !id && (
        state.formPreset?.extra?.assetClass ||
        state.formPreset?.field === 'assetClass'
      );
      const classWrap = $('f-assetClass')?.closest('.fg');
      if (classWrap) classWrap.style.display = classIsLocked ? 'none' : '';
      const subclassIsLocked = !id && state.formPreset?.extra?.assetSubclass;
      if (wrap) wrap.style.display = (subclassIsLocked || !subclasses.length) ? 'none' : '';

      const classFieldDefs = ENTITY.assets.classFields?.[assetClass] || [];
      const classCont = $('class-fields-container');
      if (classCont) {
        if (!classFieldDefs.length) {
          classCont.innerHTML = '';
        } else {
          let ph = '';
          for (const f of classFieldDefs) ph += await buildFormField(f, existing, type);
          classCont.innerHTML = ph;
          $('f-networkId')?.addEventListener('change', renderNetworkAddressFields);
          await renderNetworkAddressFields();
        }
      }

      await renderSubclassFields();
      renderClassItemTables(assetClass);
    };

    $('f-assetSubclass')?.addEventListener('change', renderSubclassFields);
    $('f-assetClass')?.addEventListener('change', renderClassSubclassField);
    await renderClassSubclassField();
  }

  {
    const panelSel = $('f-panelId');
    const areaSel  = $('f-areaId');
    if (panelSel && areaSel) {
      panelSel.addEventListener('change', () => {
        const panel = state.refs.panels?.[panelSel.value];
        if (panel?.areaId) areaSel.value = panel.areaId;
      });
    }
  }

  if (type === 'safety') {
    const panelSel = $('f-panelId');
    if (panelSel) {
      panelSel.addEventListener('change', () => filterPowerByPanel(panelSel.value, existing?.powerId));
      if (panelSel.value) filterPowerByPanel(panelSel.value, existing?.powerId);
    }
  }
}

/* ---- FORM FIELD BUILDER ---- */

async function buildFormField(f, existing, type) {
  const presetVal = !existing
    ? (state.formPreset?.field === f.key ? state.formPreset.value : (state.formPreset?.extra?.[f.key] ?? null))
    : null;
  const val = existing?.[f.key] ?? presetVal ?? '';

  if (f.type === 'text') {
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}${f.required ? '<span class="req">*</span>' : ''}</label>
      <input id="f-${f.key}" class="f-input" type="text" value="${esc(val)}" placeholder="${esc(f.label)}">
    </div>`;
  }

  if (f.type === 'textarea') {
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}</label>
      <textarea id="f-${f.key}" class="f-textarea" placeholder="${esc(f.label)}">${esc(val)}</textarea>
    </div>`;
  }

  if (f.type === 'enum') {
    const opts = f.options.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('');
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}</label>
      <select id="f-${f.key}" class="f-select">
        <option value="">— Select —</option>
        ${opts}
      </select>
    </div>`;
  }

  if (f.type === 'ref') {
    let items = state.cache[f.refStore] || [];
    if (f.refFilter) items = items.filter(f.refFilter);
    const opts  = items.map(i => `<option value="${i.id}" ${i.id === val ? 'selected' : ''}>${esc(i.name)}</option>`).join('');
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}${f.required ? '<span class="req">*</span>' : ''}</label>
      <select id="f-${f.key}" class="f-select"${f.readOnly ? ' disabled' : ''}>
        <option value="">— Unassigned —</option>
        ${opts}
      </select>
    </div>`;
  }

  if (f.type === 'assign-type') {
    const preset = state.formPreset?.field === 'assignedToType' ? state.formPreset.value : null;
    const current = existing?.assignedToType || preset || '';
    const opts = f.options.map(o => `<option value="${o}" ${o === current ? 'selected' : ''}>${esc(o)}</option>`).join('');
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}</label>
      <select id="f-assign-type" class="f-select">
        <option value="">— Select type —</option>
        ${opts}
      </select>
    </div>`;
  }

  if (f.type === 'assign-id') {
    return `<div class="fg" id="fg-assign-id" style="display:none">
      <label class="fg-label" id="label-assign-id">Assigned Item</label>
      <select id="f-assign-id" class="f-select">
        <option value="">— Select —</option>
      </select>
    </div>`;
  }

  return '';
}

/* ---- ASSIGN-ID DROPDOWN ---- */

async function populateAssignId(type, assignType, currentId) {
  const fg  = $('fg-assign-id');
  const sel = $('f-assign-id');
  const lbl = $('label-assign-id');
  if (!fg || !sel) return;

  if (!assignType || assignType === 'Plant') {
    fg.style.display = 'none';
    return;
  }

  fg.style.display = 'block';
  if (lbl) lbl.textContent = assignType;

  const storeName = ASSIGN_STORE_MAP[assignType];
  if (!storeName) { fg.style.display = 'none'; return; }

  const items = state.cache[storeName] || [];
  sel.innerHTML = `<option value="">— Select —</option>` + items.map(i => {
    const sub = ENTITY[storeName]?.getSubtitle(i, state.refs);
    const label = sub ? `${i.name} (${sub})` : i.name;
    return `<option value="${i.id}" ${i.id === currentId ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

/* ---- POWER FILTER (safety circuits) ---- */

async function filterPowerByPanel(panelId, currentPowerId) {
  const sel = $('f-powerId');
  if (!sel) return;
  const all = state.cache['power'] || [];
  const filtered = panelId ? all.filter(p => p.panelId === panelId) : all;
  sel.innerHTML = `<option value="">— None —</option>` + filtered.map(p =>
    `<option value="${p.id}" ${p.id === currentPowerId ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');
}
