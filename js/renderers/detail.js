/* ============================================================
   DETAIL VIEW RENDERERS
   Depends on: entity-config.js, state.js, utils.js, db.js, app.js (openDetail,
   closeDetail, openSheet, openSlotForm, openSlotDetail, openAssignOrCreate,
   cardHTML, duplicateItem, deleteItem, upsert)
   ============================================================ */

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
    if (slot?.cardType === 'Analog' || slot?.cardType === 'Digital') {
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
    if ((slot?.cardType === 'Controller' || slot?.cardType === 'Communication') && network) {
      const netFields = ENTITY.assets.networkTypeFields?.[network.networkType] || [];
      for (const f of netFields) fieldsHtml += field(f.label, slot?.[f.key]);
    }

    // IO points table for Analog/Digital
    let ioCard = '';
    if (slot?.cardType === 'Analog' || slot?.cardType === 'Digital') {
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
    if (slot?.cardType === 'Analog' || slot?.cardType === 'Digital') {
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

async function renderEntityDetail(savedScroll) {
  const { detailType: type, detailId: id } = state;
  const cfg  = ENTITY[type];
  const item = await getById(type, id);
  if (!item) { state.detailStack = []; closeDetail(); return; }
  await refreshAll();

  // Build field rows grouped by section (all fields shown, blank or not)
  const skipKeys = new Set(['id','createdAt','updatedAt','images','namedPhotos','assignedToType','assignedToId','name']);
  const sectionMap = new Map();
  for (const f of getEffectiveFields(type, item)) {
    if (skipKeys.has(f.key) || f.type === 'assign-type' || f.type === 'assign-id') continue;
    if (f.key === 'assetSubclass' && !(ENTITY.assets.classSubclasses?.[item.assetClass]?.length)) continue;
    const rawVal = item[f.key];
    let displayVal;
    if (f.type === 'ref') {
      const refItem = state.refs[f.refStore]?.[rawVal];
      displayVal = refItem ? refItem.name : '';
    } else {
      displayVal = rawVal != null ? String(rawVal) : '';
    }
    const isEmpty = !displayVal;
    const fieldHtml = `<div class="det-field" data-key="${f.key}"><div class="det-flabel">${esc(f.label)}</div><div class="det-fval${isEmpty ? ' det-fval-empty' : ''}">${isEmpty ? '—' : esc(displayVal)}</div></div>`;
    const sectionKey = f.section || null;
    if (!sectionMap.has(sectionKey)) sectionMap.set(sectionKey, []);
    sectionMap.get(sectionKey).push(fieldHtml);
  }

  const generalFields = (sectionMap.get(null) || []).join('');

  // Categorise named sections: detail sections vs. physical/clearance sections
  const PHYSICAL_SECTIONS = new Set(['Physical Sizing', 'Backpanel Sizing', 'Clearance']);
  let detailSectionCards = '';
  let physicalSectionCards = '';
  for (const [section, rows] of sectionMap) {
    if (!section) continue;
    if (PHYSICAL_SECTIONS.has(section)) {
      physicalSectionCards += buildCollapsibleCard(section, rows.join(''));
    } else {
      detailSectionCards += buildCollapsibleCard(section, rows.join(''));
    }
  }

  // Item table cards (collapseable)
  let wiringCards = '';
  for (const t of itemTables(type, item)) {
    const h1 = t.placeholder1 || 'Terminal';
    const h2 = t.placeholder2 || 'Label';
    const wRows = item[t.key] || [];
    const rowsHtml = wRows.length
      ? wRows.map(r => `<tr><td class="wiring-det-terminal">${esc(r.terminal)}</td><td>${esc(r.label)}</td></tr>`).join('')
      : `<tr><td colspan="2" class="wiring-empty">No entries</td></tr>`;
    wiringCards += buildCollapsibleCard(t.label,
      `<table class="wiring-det-table"><thead><tr><th>${esc(h1)}</th><th>${esc(h2)}</th></tr></thead><tbody>${rowsHtml}</tbody></table>`);
  }

  // Required media card (collapseable) — slots rendered into placeholders after innerHTML set
  let requiredPhotosCard = '';
  if (cfg.requiredPhotoSlots) {
    const slotsHtml = cfg.requiredPhotoSlots.map(slot => {
      const slotId = `det-slot-${slot.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
      return `
        <div class="named-photo-det-item">
          <div class="named-photo-det-label">${esc(slot)}</div>
          <div id="${slotId}" class="img-grid"></div>
        </div>
      `;
    }).join('');
    requiredPhotosCard = buildCollapsibleCard('Required Media', slotsHtml);
  }

  // Other media card (collapseable) — gallery rendered into placeholder after innerHTML set
  let otherPhotosCard = '';
  if (!cfg.noImages) {
    otherPhotosCard = buildCollapsibleCard('Other Media', `<div id="det-gallery" class="img-grid"></div>`);
  }

  // Assignment badge for networks/assets
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

  // PLC rack slots card — each slot is clickable to add/edit its card
  let rackSlotsCard = '';
  if (type === 'assets' && item.assetClass === 'PLC') {
    const slotCount  = parseInt(item.slotCount) || 0;
    const slotsMap   = new Map((item.slots || []).map(s => [s.slotNumber, s]));
    const cardCount  = (item.slots || []).length;
    const chevron   = ICON_CHEVRON;
    const title     = cardCount > 0 ? `Cards (${cardCount})` : 'Cards';
    const clearIcon = ICON_RM;

    let slotRows = '';
    if (slotCount === 0) {
      slotRows = `<div style="font-size:14px;color:var(--muted)">No slots configured — edit the rack to set Slot Count.</div>`;
    } else {
      slotRows = Array.from({ length: slotCount }, (_, k) => {
        const slot = slotsMap.get(k);
        if (slot) {
          const typeTag  = slot.cardType  ? `<span class="sn-det-field">${esc(slot.cardType)}</span>`  : '';
          const pnTag    = slot.partNumber ? `<span class="sn-det-field">PN<strong>${esc(slot.partNumber)}</strong></span>` : '';
          const revTag   = slot.revision   ? `<span class="sn-det-field">Rev<strong>${esc(slot.revision)}</strong></span>`  : '';
          let ioTag = '';
          if (slot.cardType === 'Analog' || slot.cardType === 'Digital') {
            const total = parseInt(slot.ioPointCount) || (slot.ioPoints?.length ?? 0);
            const inUse = (slot.ioPoints || []).filter(p => p.label && p.label !== 'Spare').length;
            ioTag = `<span class="sn-det-field">IO<strong>${inUse}/${total}</strong></span>`;
          }
          let ipTag = '';
          if (slot.cardType === 'Controller' || slot.cardType === 'Communication') {
            const addr = slot.ipAddress || slot.nodeAddress;
            if (addr) ipTag = `<span class="sn-det-field">IP<strong>${esc(addr)}</strong></span>`;
          }
          return `<div class="sn-det-row rack-slot-row" data-rack-id="${item.id}" data-slot-num="${k}" style="cursor:pointer">
            <div class="rack-slot-hdr">
              <span class="sn-det-name">Slot ${k}</span>
              <button class="rack-slot-clear wiring-rm-btn" data-rack-id="${item.id}" data-slot-num="${k}" aria-label="Clear slot">${clearIcon}</button>
            </div>
            <div class="sn-det-fields"><span class="sn-det-field"><strong>${esc(slot.name || '—')}</strong></span>${typeTag}${pnTag}${revTag}${ioTag}${ipTag}</div>
          </div>`;
        }
        return `<div class="sn-det-row rack-slot-row" data-rack-id="${item.id}" data-slot-num="${k}" style="cursor:pointer">
          <div class="rack-slot-hdr"><span class="sn-det-name">Slot ${k}</span></div>
          <div class="sn-det-fields" style="color:var(--muted)">Empty — tap to add card</div>
        </div>`;
      }).join('');
    }

    rackSlotsCard = `
      <div class="det-card det-collapsible">
        <button class="det-section-toggle" aria-expanded="true">
          <span class="section-label" style="margin:0">${title}</span>
          ${chevron}
        </button>
        <div class="det-section-body">
          <div class="sn-det-list">${slotRows}</div>
        </div>
      </div>`;
  }

  let ioPointsCard = '';

  // Switch/Router network connections and port assignment cards
  let switchNetworksCard = '';
  let switchPortsCard    = '';
  if (type === 'assets') {
    const showTables = item.assetClass === 'Network Switch' &&
                       (item.assetSubclass === 'Managed' || item.assetSubclass === 'Router');
    if (showTables) {
      const snHtml = item.switchNetworks?.length
        ? item.switchNetworks.map(r => {
            const net        = state.refs.networks?.[r.networkId];
            const addrFields = ENTITY.assets.networkTypeFields?.[net?.networkType] || [];
            const fieldPills = addrFields
              .filter(f => r[f.key])
              .map(f => `<span class="sn-det-field">${esc(f.label)}<strong>${esc(r[f.key])}</strong></span>`)
              .join('');
            return `<div class="sn-det-row">
              <div class="sn-det-name">${esc(net?.name || '—')}</div>
              ${fieldPills ? `<div class="sn-det-fields">${fieldPills}</div>` : ''}
            </div>`;
          }).join('')
        : `<div class="wiring-empty">No networks assigned</div>`;
      switchNetworksCard = buildCollapsibleCard('Network Connections', `<div class="sn-det-list">${snHtml}</div>`);

      const spHtml = item.switchPorts?.length
        ? item.switchPorts.map(r => {
            const net   = state.refs.networks?.[r.networkId];
            const asset = state.refs.assets?.[r.assetId];
            let slotLabel = '';
            let ipAddr    = '';
            if (asset?.assetClass === 'PLC') {
              const matchSlot = r.slotNumber != null
                ? (asset.slots || []).find(s => s.slotNumber === r.slotNumber)
                : (asset.slots || []).find(s =>
                    (s.cardType === 'Controller' || s.cardType === 'Communication') && s.networkId === r.networkId
                  );
              if (matchSlot) {
                slotLabel = `Slot ${matchSlot.slotNumber}${matchSlot.name ? ` — ${matchSlot.name}` : ''}`;
                ipAddr = matchSlot.ipAddress || matchSlot.nodeAddress || '';
              }
            } else {
              ipAddr = asset?.ipAddress || asset?.nodeAddress || '';
            }
            const pills = [
              net         ? `<span class="sn-det-field">Network<strong>${esc(net.name)}</strong></span>`    : '',
              net?.vlanId ? `<span class="sn-det-field">VLAN<strong>${esc(net.vlanId)}</strong></span>`     : '',
              `<span class="sn-det-field">Device<strong>${esc(asset?.name || 'No Connection')}</strong></span>`,
              slotLabel   ? `<span class="sn-det-field">Slot<strong>${esc(slotLabel)}</strong></span>`      : '',
              ipAddr      ? `<span class="sn-det-field">IP<strong>${esc(ipAddr)}</strong></span>`            : '',
            ].filter(Boolean).join('');
            return `<div class="sn-det-row">
              <div class="sn-det-name">${esc(r.portName || '—')}</div>
              <div class="sn-det-fields">${pills}</div>
            </div>`;
          }).join('')
        : `<div class="wiring-empty">No ports assigned</div>`;
      switchPortsCard = buildCollapsibleCard('Port Assignments', `<div class="sn-det-list">${spHtml}</div>`);
    }
  }

  // Related children
  const childSections = await buildChildSections(type, id, item);

  el.detail.innerHTML = `
    <div class="det-header">
      <button class="det-back-btn" id="det-back" aria-label="Back">
        ${ICON_BACK}
      </button>
    </div>
    ${buildDetailCompletenessHtml(type, item)}
    <div class="det-card">
      ${type === 'areas'
        ? `<input class="det-name-input" id="det-name-input" type="text" value="${esc(item.name)}" readonly>`
        : `<div class="det-name-row">
             <div class="det-name">${esc(item.name)}</div>
             <button class="det-edit-btn" id="det-duplicate" aria-label="Duplicate">
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
             </button>
             <button class="det-edit-btn" id="det-edit" aria-label="Edit">
               ${ICON_EDIT}
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
    ${ioPointsCard}
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

  state.detailChanges = {};

  if (cfg.requiredPhotoSlots) {
    for (const slot of cfg.requiredPhotoSlots) {
      const slotId = `det-slot-${slot.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
      const container = document.getElementById(slotId);
      if (container) renderMediaSlot(container, slot, _normalizeMediaItems(item.namedPhotos?.[slot]), { readonly: true });
    }
  }
  if (!cfg.noImages) {
    const gallery = document.getElementById('det-gallery');
    if (gallery) renderMediaGallery(gallery, _normalizeMediaItems(item.images), { readonly: true });
  }

  el.detail.querySelector('#det-back').addEventListener('click', closeDetail);

  el.detail.querySelector('#det-duplicate')?.addEventListener('click', () => duplicateItem(type, id));
  el.detail.querySelector('#det-edit')?.addEventListener('click', () => openSheet(type, id));

  // Save bar buttons
  el.detail.querySelector('#det-discard')?.addEventListener('click', () => {
    state.detailChanges = {};
    renderDetail();
  });
  el.detail.querySelector('#det-save-changes')?.addEventListener('click', () => {
    saveDetailChanges(type, id);
  });

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

  el.detail.querySelectorAll('[data-add-child]').forEach(btn => {
    btn.addEventListener('click', () => {
      const childType    = btn.dataset.addChild;
      const presetField  = btn.dataset.presetField;
      const presetVal    = btn.dataset.presetVal;
      const extraPresets = btn.dataset.extraPresets ? JSON.parse(btn.dataset.extraPresets) : {};
      if (childType === 'assets' || ((childType === 'power' || childType === 'safety') && presetField === 'panelId') || (childType === 'panels' && presetField === 'areaId')) {
        openAssignOrCreate(childType, presetField, presetVal);
      } else {
        openSheet(childType, null, { field: presetField, value: presetVal, extra: extraPresets });
      }
    });
  });

  // Collapseable section toggles
  el.detail.querySelectorAll('.det-section-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const body = btn.closest('.det-collapsible').querySelector('.det-section-body');
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
          return (slot.cardType === 'Controller' || slot.cardType === 'Communication') && slot.networkId === parentId;
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
    );

    const slotLinked = (['networks', 'power', 'safety'].includes(type) && child.store === 'assets')
      ? getSlotLinkedRacks(type, id).filter(({ rack }) => !filtered.some(f => f.id === rack.id))
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
   DETAIL INLINE EDITING
   ============================================================ */

function showDetailSaveBar() {
  el.detail.querySelector('#det-save-bar')?.classList.add('visible');
}

function activateNameEdit(nameDiv, item) {
  const input = document.createElement('input');
  input.className = 'det-name-input';
  input.value = state.detailChanges['name'] ?? item.name;
  nameDiv.textContent = '';
  nameDiv.appendChild(input);
  input.focus();
  input.addEventListener('input', () => {
    state.detailChanges['name'] = input.value;
    showDetailSaveBar();
  });
  input.addEventListener('blur', () => {
    const val = state.detailChanges['name'] ?? item.name;
    nameDiv.textContent = val || item.name;
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
}

function activateInlineEdit(field, fConfig, item) {
  const fvalEl = field.querySelector('.det-fval');
  const rawVal = state.detailChanges[fConfig.key] !== undefined
    ? state.detailChanges[fConfig.key]
    : (item[fConfig.key] ?? '');

  let control;
  if (fConfig.type === 'text') {
    control = document.createElement('input');
    control.className = 'det-inline-input';
    control.type = 'text';
    control.value = String(rawVal);
  } else if (fConfig.type === 'textarea') {
    control = document.createElement('textarea');
    control.className = 'det-inline-textarea';
    control.value = String(rawVal);
  } else if (fConfig.type === 'enum') {
    control = document.createElement('select');
    control.className = 'det-inline-select';
    control.innerHTML = `<option value="">— Select —</option>` +
      fConfig.options.map(o => `<option value="${esc(o)}"${o === rawVal ? ' selected' : ''}>${esc(o)}</option>`).join('');
  } else if (fConfig.type === 'ref') {
    const refItems = state.cache[fConfig.refStore] || [];
    control = document.createElement('select');
    control.className = 'det-inline-select';
    control.innerHTML = `<option value="">— Unassigned —</option>` +
      refItems.map(i => `<option value="${i.id}"${i.id === rawVal ? ' selected' : ''}>${esc(i.name)}</option>`).join('');
  }

  if (!control) return;

  fvalEl.innerHTML = '';
  fvalEl.classList.remove('det-fval-empty');
  fvalEl.appendChild(control);
  control.focus();

  const markDirty = () => {
    state.detailChanges[fConfig.key] = control.value;
    showDetailSaveBar();
  };
  control.addEventListener('input', markDirty);
  control.addEventListener('change', markDirty);

  control.addEventListener('blur', () => {
    const currentVal = state.detailChanges[fConfig.key] !== undefined
      ? state.detailChanges[fConfig.key]
      : (item[fConfig.key] ?? '');
    let displayVal;
    if (fConfig.type === 'ref') {
      const refItem = state.refs[fConfig.refStore]?.[currentVal];
      displayVal = refItem ? refItem.name : '';
    } else {
      displayVal = currentVal;
    }
    const isEmpty = !displayVal;
    fvalEl.classList.toggle('det-fval-empty', isEmpty);
    fvalEl.textContent = isEmpty ? '—' : String(displayVal);

    // Auto-sync areaId when panelId is changed inline
    if (fConfig.key === 'panelId') {
      const efFields = getEffectiveFields(state.detailType, item);
      if (efFields.some(f => f.key === 'areaId')) {
        const panel = state.refs.panels?.[currentVal];
        if (panel?.areaId) {
          state.detailChanges['areaId'] = panel.areaId;
          showDetailSaveBar();
          const areaField = el.detail.querySelector('.det-field-editable[data-key="areaId"]');
          if (areaField) {
            const areaFval  = areaField.querySelector('.det-fval');
            const areaName  = state.refs.areas?.[panel.areaId]?.name || '';
            areaFval.classList.toggle('det-fval-empty', !areaName);
            areaFval.textContent = areaName || '—';
          }
        }
      }
    }
  });
}

async function saveDetailChanges(type, id) {
  if (!Object.keys(state.detailChanges).length) return;
  const cfg  = ENTITY[type];
  const item = await getById(type, id);
  if (!item) return;
  const updatedItem = { ...item, ...state.detailChanges };
  for (const f of getEffectiveFields(type, updatedItem)) {
    if (f.required && !updatedItem[f.key]) {
      showToast(`${f.label} is required`, 'error');
      return;
    }
  }
  await upsert(type, updatedItem);
  await refreshAll();
  state.detailChanges = {};
  showToast(`${cfg.label} saved`, 'success');
  renderDetail();
}
