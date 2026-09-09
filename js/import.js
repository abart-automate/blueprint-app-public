// XLSX Import Module for Blueprint App
// Merges data from an exported Excel file back into the database.
// Records not present in the file are left untouched (merge, not replace).
//
// Dependencies: XLSX library, export.js (REF_FIELD_MAP, ENTITY, prettifyKey,
//               getFieldLabel, findFieldDef), db.js, app.js (el, confirm,
//               refreshAll, renderPage, showToast, ASSIGN_STORE_MAP)

const KNOWN_SHEET_NAMES = new Set([
  'Areas', 'Panels', 'Power', 'Safety', 'Networks',
  'Network Switch', 'Switch Networks', 'Switch Ports',
  'PLC', 'PLC Slots', 'HMI', 'HMI Network Ports',
  'Field Device', 'Field Device Parameters', 'Field Device Network Ports',
  'Power Wiring', 'Field Device Wiring',
  'Checklist',
]);

// Two-phase import strategy:
// 1. Load current data and build nameToId resolution maps (area/panel/network names → ids).
// 2. Merge sheets in dependency order: areas → panels → networks → assets → sub-data.
//    Records are matched by name; missing records are created, existing ones are updated.
async function processXlsxImport(file) {
  try {
    if (typeof XLSX === 'undefined') {
      throw new Error('XLSX library is not loaded');
    }

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });

    if (!wb.SheetNames.some(n => KNOWN_SHEET_NAMES.has(n))) {
      showToast('Invalid file: no recognisable Blueprint sheets found', 'error');
      return;
    }

    const ok = await confirm(
      'Merge Excel data?',
      'Existing records will be updated with values from the file. Records not in the file will not be deleted.',
      { yesLabel: 'Merge', yesClass: 'btn-primary' }
    );
    if (!ok) return;

    // Load current data to build resolution maps
    const [areas, panels, power, safety, networks, assets] = await Promise.all([
      getAll('areas'), getAll('panels'), getAll('power'),
      getAll('safety'), getAll('networks'), getAll('assets'),
    ]);

    const nameToId = {
      areas:    buildNameMap(areas),
      panels:   buildNameMap(panels),
      power:    buildNameMap(power),
      safety:   buildNameMap(safety),
      networks: buildNameMap(networks),
      assets:   buildNameMap(assets),
    };
    const idExists = {
      areas:    new Set(areas.map(a => a.id)),
      panels:   new Set(panels.map(p => p.id)),
      power:    new Set(power.map(p => p.id)),
      safety:   new Set(safety.map(s => s.id)),
      networks: new Set(networks.map(n => n.id)),
      assets:   new Set(assets.map(a => a.id)),
    };

    const stats = { updated: 0, added: 0, errors: 0 };

    await importEntitySheets(wb, nameToId, idExists, stats);
    await importAssetSheets(wb, nameToId, idExists, stats);
    await importSubdataSheets(wb, nameToId, idExists);
    await importChecklistSheet(wb);

    await refreshAll();
    renderPage();

    const msg = `Imported: ${stats.updated} updated, ${stats.added} added` +
      (stats.errors ? `, ${stats.errors} skipped` : '');
    showToast(msg, 'success');

  } catch (err) {
    console.error('XLSX import failed:', err);
    showToast('Import failed: ' + err.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Entity sheet import (Areas, Panels, Power, Safety, Networks)
// ---------------------------------------------------------------------------

const ENTITY_SHEET_DEFS = [
  { sheetName: 'Areas',    store: 'areas' },
  { sheetName: 'Panels',   store: 'panels' },
  { sheetName: 'Power',    store: 'power' },
  { sheetName: 'Safety',   store: 'safety' },
  { sheetName: 'Networks', store: 'networks' },
];

async function importEntitySheets(wb, nameToId, idExists, stats) {
  for (const { sheetName, store } of ENTITY_SHEET_DEFS) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const headerMap = buildImportHeaderMap(store);

    for (const row of rows) {
      if (isPlaceholderRow(row)) continue;
      try {
        const item = mapRowToItem(row, headerMap, nameToId, idExists);
        if (!item.name && !item.id) continue;
        await mergeUpsert(store, item, idExists[store], stats);
      } catch (e) {
        console.warn(`Import error in ${sheetName}:`, e);
        stats.errors++;
      }
    }

    // Refresh maps so downstream sheets can resolve refs added in this pass
    const refreshed = await getAll(store);
    nameToId[store] = buildNameMap(refreshed);
    idExists[store] = new Set(refreshed.map(i => i.id));
  }
}

// ---------------------------------------------------------------------------
// Asset class sheet import (one sheet per asset class)
// ---------------------------------------------------------------------------

const ASSET_CLASS_SHEET_DEFS = [
  { sheetName: 'Network Switch', assetClass: 'Network Switch' },
  { sheetName: 'PLC',            assetClass: 'PLC' },
  { sheetName: 'HMI',            assetClass: 'HMI' },
  { sheetName: 'Field Device', assetClass: 'Field Device' },
];

// Sub-array keys managed by sub-data sheets; preserved from existing record
const SUBDATA_KEYS_BY_CLASS = {
  'Network Switch': ['switchPorts', 'switchNetworks'],
  'PLC':            ['slots'],
  'Field Device':   ['fieldDeviceParameters', 'fieldDeviceWiring', 'networkPorts'],
  'HMI':            ['networkPorts'],
};

async function importAssetSheets(wb, nameToId, idExists, stats) {
  for (const { sheetName, assetClass } of ASSET_CLASS_SHEET_DEFS) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const excludeKeys = SUBDATA_KEYS_BY_CLASS[assetClass] || [];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const headerMap = buildImportHeaderMap('assets', assetClass, excludeKeys);

    for (const row of rows) {
      if (isPlaceholderRow(row)) continue;
      try {
        const item = mapRowToItem(row, headerMap, nameToId, idExists);
        if (!item.name && !item.id) continue;

        // Carry over existing sub-arrays that this sheet doesn't manage
        if (item.id && idExists.assets.has(item.id)) {
          const existing = await getById('assets', item.id);
          if (existing) {
            for (const key of excludeKeys) {
              if (existing[key] !== undefined) item[key] = existing[key];
            }
          }
        }

        await mergeUpsert('assets', item, idExists.assets, stats);
      } catch (e) {
        console.warn(`Import error in ${sheetName}:`, e);
        stats.errors++;
      }
    }
  }

  // Refresh asset maps so sub-data sheets can resolve newly-added asset names/IDs
  const refreshed = await getAll('assets');
  nameToId.assets = buildNameMap(refreshed);
  idExists.assets = new Set(refreshed.map(i => i.id));
}

// ---------------------------------------------------------------------------
// Sub-data sheet import (Switch Networks, Switch Ports, PLC Slots, Field Device Parameters)
// ---------------------------------------------------------------------------

async function importChecklistSheet(wb) {
  const ws = wb.Sheets['Checklist'];
  if (!ws) return;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);
  const customItems = rows
    .filter(r => r[1] === 'Custom')
    .map(r => {
      const item = { id: crypto.randomUUID(), label: String(r[0] ?? '').trim(), completed: r[2] === 'Complete' };
      // Column 6 (index 6) is Notes — absent in older exports, so guard with nullish coalesce
      const notes = String(r[6] ?? '').trim();
      if (notes) item.notes = notes;
      return item;
    })
    .filter(i => i.label);
  if (customItems.length) await setSetting('checklistItems', customItems);
}

async function importSubdataSheets(wb, nameToId, idExists) {
  await importSwitchNetworksSheet(wb, nameToId, idExists);
  await importSwitchPortsSheet(wb, nameToId, idExists);
  await importPlcSlotsSheet(wb, nameToId, idExists);
  await importFieldDeviceParametersSheet(wb, nameToId, idExists);
  await importAssetNetworkPortsSheet(wb, 'Field Device Network Ports', nameToId, idExists);
  await importAssetNetworkPortsSheet(wb, 'HMI Network Ports', nameToId, idExists);
  await importPowerWiringSheet(wb, nameToId, idExists);
  await importAssetWiringSheet(wb, 'Field Device Wiring',  'fieldDeviceWiring', nameToId, idExists);
}

async function importSwitchNetworksSheet(wb, nameToId, idExists) {
  const ws = wb.Sheets['Switch Networks'];
  if (!ws) return;

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const grouped = groupByParentAsset(rows, 'Asset ID', 'Asset Name', nameToId, idExists);

  for (const [assetId, assetRows] of grouped) {
    const asset = await getById('assets', assetId);
    if (!asset) continue;
    asset.switchNetworks = assetRows
      .map(row => ({
        networkId: resolveRefId(str(row['Network ID']), str(row['Network Name']), 'networks', nameToId, idExists) || '',
      }))
      .filter(sn => sn.networkId);
    await upsert('assets', asset);
  }
}

async function importSwitchPortsSheet(wb, nameToId, idExists) {
  const ws = wb.Sheets['Switch Ports'];
  if (!ws) return;

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const grouped = groupByParentAsset(rows, 'Asset ID', 'Asset Name', nameToId, idExists);

  for (const [assetId, assetRows] of grouped) {
    const asset = await getById('assets', assetId);
    if (!asset) continue;
    asset.switchPorts = assetRows.map(row => ({
      portName:  str(row['Port Name']),
      networkId: resolveRefId(str(row['Network ID']), str(row['Network Name']), 'networks', nameToId, idExists) || '',
      assetId:   resolveRefId(str(row['Connected Asset ID']), str(row['Connected Asset Name']), 'assets', nameToId, idExists) || '',
    }));
    await upsert('assets', asset);
  }
}

// Imports the flat "Field Device Network Ports" / "HMI Network Ports" sheets into
// asset.networkPorts — one row per port, grouped by parent asset. Unlike PLC's
// slot-nested networkPorts (deserialized from a JSON blob column since slots are
// nested inside the PLC asset), these ports live directly on the asset, like
// switchPorts, so a flat sheet is this data's actual round-trip source of truth.
async function importAssetNetworkPortsSheet(wb, sheetName, nameToId, idExists) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return;

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const grouped = groupByParentAsset(rows, 'Asset ID', 'Asset Name', nameToId, idExists);

  for (const [assetId, assetRows] of grouped) {
    const asset = await getById('assets', assetId);
    if (!asset) continue;
    asset.networkPorts = assetRows.map(row => {
      const port = {
        portNumber: row['Port #'] !== '' ? Number(row['Port #']) : undefined,
        networkId:  resolveRefId(str(row['Network ID']), str(row['Network Name']), 'networks', nameToId, idExists) || '',
      };
      if (str(row['IP Address']))  port.ipAddress  = str(row['IP Address']);
      if (str(row['Subnet Mask'])) port.subnetMask = str(row['Subnet Mask']);
      if (str(row['Gateway']))     port.gateway    = str(row['Gateway']);
      if (str(row['Node Address'])) port.nodeAddress = str(row['Node Address']);
      return port;
    });
    await upsert('assets', asset);
  }
}

async function importPlcSlotsSheet(wb, nameToId, idExists) {
  const ws = wb.Sheets['PLC Slots'];
  if (!ws) return;

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const grouped = groupByParentAsset(rows, 'Asset ID', 'Asset Name', nameToId, idExists);

  for (const [assetId, assetRows] of grouped) {
    const asset = await getById('assets', assetId);
    if (!asset) continue;
    // Rows are read in sheet order (= original slot order). Renumber after mapping
    // so slotNumber always equals array index, filling any gaps from pre-change exports.
    asset.slots = renumberSlots(assetRows.map(row => {
      let ioPoints       = [];
      let powerBus       = [];
      let terminalWiring = [];
      let networkPorts   = [];
      try { ioPoints       = row['IO Points']            ? JSON.parse(row['IO Points'])            : []; } catch {}
      try { powerBus       = row['Power Bus']            ? JSON.parse(row['Power Bus'])            : []; } catch {}
      try { terminalWiring = row['Terminal Block Wiring'] ? JSON.parse(row['Terminal Block Wiring']) : []; } catch {}
      try { networkPorts   = row['Network Ports']        ? JSON.parse(row['Network Ports'])        : []; } catch {}
      return {
        slotNumber:      0, // placeholder — renumberSlots overwrites this immediately
        name:            str(row['Name']),
        cardType:        str(row['Card Type']),
        partNumber:      str(row['Part Number']),
        firmwareVersion: str(row['Firmware Version']),
        ioPointCount:    str(row['IO Point Count']),
        voltageLevel:    str(row['Voltage']),
        // networkId, protocol, ipAddress, nodeAddress removed — per-port address details
        // are deserialized from the Network Ports JSON column via networkPorts above.
        ioPoints,
        powerBus,
        terminalWiring,
        networkPorts,
      };
    }));
    await upsert('assets', asset);
  }
}

async function importFieldDeviceParametersSheet(wb, nameToId, idExists) {
  const ws = wb.Sheets['Field Device Parameters'];
  if (!ws) return;

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const grouped = groupByParentAsset(rows, 'Asset ID', 'Asset Name', nameToId, idExists);

  for (const [assetId, assetRows] of grouped) {
    const asset = await getById('assets', assetId);
    if (!asset) continue;
    asset.fieldDeviceParameters = assetRows
      .map(row => ({ terminal: str(row['Parameter']), label: str(row['Value']) }))
      .filter(p => p.terminal);
    await upsert('assets', asset);
  }
}

async function importPowerWiringSheet(wb, nameToId, idExists) {
  const ws = wb.Sheets['Power Wiring'];
  if (!ws) return;
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const grouped = groupByParentAsset(rows, 'Power ID', 'Power Name', nameToId, idExists, 'power');
  for (const [powerId, powerRows] of grouped) {
    const item = await getById('power', powerId);
    if (!item) continue;
    item.inputWiring = powerRows
      .filter(r => str(r['Section']) === 'Input Wiring')
      .map(r => ({ terminal: str(r['Terminal']), label: str(r['Label']) }))
      .filter(r => r.terminal || r.label);
    item.outputWiring = powerRows
      .filter(r => str(r['Section']) === 'Output Wiring')
      .map(r => ({ terminal: str(r['Terminal']), label: str(r['Label']) }))
      .filter(r => r.terminal || r.label);
    await upsert('power', item);
  }
}

async function importAssetWiringSheet(wb, sheetName, wiringKey, nameToId, idExists) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return;
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const grouped = groupByParentAsset(rows, 'Asset ID', 'Asset Name', nameToId, idExists);
  for (const [assetId, assetRows] of grouped) {
    const asset = await getById('assets', assetId);
    if (!asset) continue;
    asset[wiringKey] = assetRows
      .map(r => ({ terminal: str(r['Terminal']), label: str(r['Label']) }))
      .filter(r => r.terminal || r.label);
    await upsert('assets', asset);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildNameMap(items) {
  const map = new Map();
  for (const item of items) {
    if (item.name) map.set(item.name.trim().toLowerCase(), item.id);
  }
  return map;
}

function resolveRefId(rawId, name, store, nameToId, idExists) {
  if (rawId && idExists[store]?.has(rawId)) return rawId;
  if (name) {
    const found = nameToId[store]?.get(name.trim().toLowerCase());
    if (found) return found;
  }
  return null;
}

function groupByParentAsset(rows, idCol, nameCol, nameToId, idExists, store = 'assets') {
  const grouped = new Map();
  for (const row of rows) {
    if (isPlaceholderRow(row)) continue;
    const id = resolveRefId(str(row[idCol]), str(row[nameCol]), store, nameToId, idExists);
    if (!id) continue;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(row);
  }
  return grouped;
}

function isPlaceholderRow(row) {
  const vals = Object.values(row);
  if (!vals.length) return true;
  if (vals.every(v => v === '' || v == null)) return true;
  const first = String(vals[0] ?? '').trim();
  if (first === 'No records') return true;
  return false;
}

// Build a header-label → { key, isRawId } map for a given store/class.
// Uses the same ENTITY field definitions and prettifyKey as the exporter so
// the mapping stays in sync automatically.
function buildImportHeaderMap(store, assetClass = null, excludeKeys = []) {
  const excludeSet = new Set(excludeKeys);
  const entity = ENTITY[store];
  if (!entity) return {};

  const map = {};

  // Common auto-fields not in ENTITY.fields
  for (const key of ['id', 'createdAt', 'updatedAt']) {
    if (excludeSet.has(key)) continue;
    map[prettifyKey(key)] = { key };
  }
  // assignedTo pair
  if (!excludeSet.has('assignedToType')) map[prettifyKey('assignedToType')] = { key: 'assignedToType' };
  if (!excludeSet.has('assignedToId')) {
    map['Assigned To'] = { key: 'assignedToId' };
    map['Assigned To ID'] = { key: 'assignedToId', isRawId: true };
  }

  // Collect all relevant field definition sets
  const fieldSets = [entity.fields || []];
  if (store === 'assets') {
    if (assetClass) {
      fieldSets.push(entity.classFields?.[assetClass] || []);
      const subclasses = entity.classSubclasses?.[assetClass] || [];
      subclasses.forEach(sub => fieldSets.push(entity.subclassFields?.[sub] || []));
      Object.values(entity.networkTypeFields || {}).forEach(f => fieldSets.push(f));
    } else {
      Object.values(entity.classFields || {}).forEach(f => fieldSets.push(f));
      Object.values(entity.subclassFields || {}).forEach(f => fieldSets.push(f));
      Object.values(entity.networkTypeFields || {}).forEach(f => fieldSets.push(f));
    }
  }
  if (store === 'networks') {
    Object.values(entity.protocolFields || {}).forEach(f => fieldSets.push(f));
  }

  for (const fieldDefs of fieldSets) {
    for (const fd of fieldDefs) {
      if (excludeSet.has(fd.key)) continue;
      if (!map[fd.label]) map[fd.label] = { key: fd.key };

      const isRef = fd.refStore || REF_FIELD_MAP[fd.key];
      if (isRef) {
        const idLabel = fd.label + ' ID';
        if (!map[idLabel]) map[idLabel] = { key: fd.key, isRawId: true };
      }
    }
  }

  return map;
}

// Convert a sheet row (keys = column headers) into a plain field-key object.
// Ref fields are resolved via resolveRefId using the dual name+rawId columns.
function mapRowToItem(row, headerMap, nameToId, idExists) {
  const refAccum = {}; // key → { name, rawId }
  const item = {};

  for (const [colHeader, value] of Object.entries(row)) {
    const spec = headerMap[colHeader];
    if (!spec) continue;
    const { key, isRawId } = spec;

    if (isRawId) {
      if (!refAccum[key]) refAccum[key] = {};
      refAccum[key].rawId = str(value);
    } else if (REF_FIELD_MAP[key] || key === 'assignedToId') {
      if (!refAccum[key]) refAccum[key] = {};
      refAccum[key].name = str(value);
    } else {
      // Every non-ref field reachable here comes from an ENTITY field def of type
      // 'text' | 'textarea' | 'enum' (see buildImportHeaderMap) — i.e. always scalar,
      // never an array/object. Previously this speculatively JSON.parse'd any cell
      // string that merely looked array/object-like ("[...]"/"{...}"), which could
      // silently turn ordinary hand-typed text (e.g. a note starting with "[TODO]")
      // into an unintended array/object if it happened to also be valid JSON. The
      // structured sub-data fields that genuinely are arrays/objects (slot IO points,
      // power bus, switch ports/networks, etc.) are excluded from this generic field
      // set entirely (see SUBDATA_KEYS_BY_CLASS / excludeSet) and parsed explicitly,
      // with their own try/catch, at their own dedicated call sites — so no field
      // reaching this branch should ever need re-hydrating from a JSON string.
      item[key] = value;
    }
  }

  // Resolve ref fields
  for (const [key, { name = '', rawId = '' }] of Object.entries(refAccum)) {
    let refStore = REF_FIELD_MAP[key];
    if (key === 'assignedToId') {
      refStore = ASSIGN_STORE_MAP[item.assignedToType || ''] || null;
    }
    if (refStore) {
      item[key] = resolveRefId(rawId, name, refStore, nameToId, idExists) || '';
    } else {
      item[key] = rawId || name || '';
    }
  }

  return item;
}

// Upsert with merge semantics:
//   known id  → load existing record, overwrite only fields present in item
//   unknown id → insert as new (drop unrecognised id so db.js generates one)
async function mergeUpsert(store, item, idSet, stats) {
  const itemId = str(item.id);

  if (itemId && idSet.has(itemId)) {
    const existing = await getById(store, itemId) || {};
    const merged = { ...existing };
    for (const [k, v] of Object.entries(item)) {
      if (k === 'id' || k === 'createdAt') continue;
      if (v !== undefined) merged[k] = v;
    }
    await upsert(store, merged);
    stats.updated++;
  } else {
    // New record — drop id if it was unrecognised, require a name
    if (itemId && !idSet.has(itemId)) delete item.id;
    if (!item.name) { stats.errors++; return; }
    await upsert(store, item);
    stats.added++;
  }
}

function str(value) {
  return String(value ?? '').trim();
}

window.processXlsxImport = processXlsxImport;
