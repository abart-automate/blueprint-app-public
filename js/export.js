// ZIP Export Module for Blueprint App
// Exports object hierarchy: Areas > Panels > (Power/Safety/Assets)
// Unassigned items go in "Field Folder" directories

// Dependencies: JSZip (loaded via script tag in index.html)

async function exportToZip() {
  try {
    // Show progress modal
    showExportProgress('Starting export...');

    // Fetch all data
    const [areas, panels, power, safety, assets] = await Promise.all([
      getAll('areas'),
      getAll('panels'),
      getAll('power'),
      getAll('safety'),
      getAll('assets')
    ]);

    // Build indexing maps
    const areaMap = new Map(areas.map(a => [a.id, a]));
    const panelMap = new Map(panels.map(p => [p.id, p]));
    const panelByArea = new Map();

    // Group panels by area
    panels.forEach(panel => {
      const areaId = panel.areaId;
      if (!panelByArea.has(areaId)) panelByArea.set(areaId, []);
      panelByArea.get(areaId).push(panel);
    });

    // Create ZIP
    const zip = new JSZip();
    let processedCount = 0;
    const totalItems = power.length + safety.length + assets.length;

    // Process each area
    for (const area of areas) {
      const areaFolder = zip.folder(sanitizeFilename(area.name));
      processedCount = await processArea(area, areaFolder, panelByArea, power, safety, assets, processedCount, totalItems);
    }

    // Process unassigned panels (no areaId)
    const unassignedPanels = panels.filter(p => !p.areaId);
    if (unassignedPanels.length > 0) {
      const fieldFolder = zip.folder('Field Folder (Unassigned Panels)');
      for (const panel of unassignedPanels) {
        const panelFolder = fieldFolder.folder(sanitizeFilename(panel.name));
        await processPanel(panel, panelFolder);
      }
    }

    // Process unassigned items (no panelId)
    const unassignedItems = [...power, ...safety, ...assets].filter(item => !item.panelId);
    if (unassignedItems.length > 0) {
      const fieldFolder = zip.folder('Field Folder (Unassigned Objects)');
      for (const item of unassignedItems) {
        const itemFolder = fieldFolder.folder(generateObjectFolderName(item, []));
        await processObject(item, itemFolder);
        processedCount++;
        updateProgress(processedCount, totalItems);
      }
    }

    // Checklist snapshot at ZIP root.
    // Image blobs cannot be JSON-serialised, so strip them from the snapshot;
    // media files are written to Checklist/<item>/ subfolders below.
    const checklistCustom = (await getSetting('checklistItems')) || [];
    const customItemsForJson = checklistCustom.map(({ images: _i, ...rest }) => rest);
    zip.file('data.json', JSON.stringify({
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      checklist: {
        autoItems: calcChecklistAutoItems(),
        customItems: customItemsForJson,
      },
    }, null, 2));

    // One subfolder per custom item: data.json (text fields) + photos/ (via _exportMedia)
    const checklistFolder = zip.folder('Checklist');
    for (const item of checklistCustom) {
      const folderName = sanitizeFilename(item.label || '') || item.id;
      const itemFolder = checklistFolder.folder(folderName);
      const { images: _imgs, ...itemData } = item;
      itemFolder.file('data.json', JSON.stringify(itemData, null, 2));
      _exportMedia(item, itemFolder.folder('photos'));
    }

    // Generate and download ZIP
    updateProgress(totalItems, totalItems, 'Generating ZIP file...');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blueprint-export-${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    hideExportProgress();
    showToast('Export completed successfully!', 'success');

  } catch (error) {
    console.error('Export failed:', error);
    hideExportProgress();
    showToast('Export failed: ' + error.message, 'error');
  }
}

async function exportExcel() {
  try {
    if (typeof XLSX === 'undefined') {
      throw new Error('XLSX library is not loaded');
    }

    showExportProgress('Preparing Excel export...');

    const [areas, panels, power, safety, networks, assets] = await Promise.all([
      getAll('areas'),
      getAll('panels'),
      getAll('power'),
      getAll('safety'),
      getAll('networks'),
      getAll('assets')
    ]);

    const refs = {
      areas:    buildMap(areas),
      panels:   buildMap(panels),
      power:    buildMap(power),
      safety:   buildMap(safety),
      networks: buildMap(networks),
      assets:   buildMap(assets),
    };

    // Partition assets by class
    const assetClasses = ['Network Switch', 'PLC', 'HMI', 'VFD', 'Network Device', 'Hardwired Device'];
    const assetsByClass = {};
    for (const cls of assetClasses) {
      assetsByClass[cls] = assets.filter(a => a.assetClass === cls);
    }

    const checklistCustom = (await getSetting('checklistItems')) || [];
    const checklistAuto   = calcChecklistAutoItems();

    const workbook = XLSX.utils.book_new();
    let processedCount = 0;
    const totalSheets = 22;

    const addSheet = (name, worksheet) => {
      XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(name));
      processedCount++;
      updateProgress(processedCount, totalSheets, `Adding ${name} sheet...`);
    };

    // Entity sheets
    addSheet('Checklist', buildChecklistSheet(checklistAuto, checklistCustom));
    addSheet('Areas',    buildWorksheet(areas,    'areas',    refs));
    addSheet('Panels',   buildWorksheet(panels,   'panels',   refs));
    addSheet('Power',    buildWorksheet(power,    'power',    refs, { excludeKeys: ['inputWiring', 'outputWiring'] }));
    addSheet('Power Wiring', buildPowerWiringSheet(power, refs));
    addSheet('Safety',   buildWorksheet(safety,   'safety',   refs));
    addSheet('Networks', buildWorksheet(networks, 'networks', refs));

    // Asset class sheets + sub-data sheets
    addSheet('Network Switch',  buildAssetClassSheet(assetsByClass['Network Switch'], 'Network Switch', refs));
    addSheet('Switch Networks', buildSwitchNetworksSheet(assetsByClass['Network Switch'], refs));
    addSheet('Switch Ports',    buildSwitchPortsSheet(assetsByClass['Network Switch'], refs));
    addSheet('PLC',                buildAssetClassSheet(assetsByClass['PLC'], 'PLC', refs));
    addSheet('PLC Slots',          buildPlcSlotsSheet(assetsByClass['PLC'], refs));
    addSheet('PLC Digital Wiring', buildPlcDigitalWiringSheet(assetsByClass['PLC'], refs));
    addSheet('PLC Analog Wiring',  buildPlcAnalogWiringSheet(assetsByClass['PLC'], refs));
    addSheet('HMI', buildAssetClassSheet(assetsByClass['HMI'], 'HMI', refs));
    addSheet('VFD',            buildAssetClassSheet(assetsByClass['VFD'], 'VFD', refs));
    addSheet('VFD Wiring',     buildVfdWiringSheet(assetsByClass['VFD'], refs));
    addSheet('VFD Parameters', buildVfdParametersSheet(assetsByClass['VFD'], refs));
    addSheet('Network Device',        buildAssetClassSheet(assetsByClass['Network Device'],   'Network Device',   refs));
    addSheet('Network Device Wiring', buildNetworkDeviceWiringSheet(assetsByClass['Network Device'], refs));
    addSheet('Hardwired Device',        buildAssetClassSheet(assetsByClass['Hardwired Device'], 'Hardwired Device', refs));
    addSheet('Hardwired Device Wiring', buildHardwiredWiringSheet(assetsByClass['Hardwired Device'], refs));

    const sheetMeta = workbook.SheetNames.map((name, i) => {
      const ws = workbook.Sheets[name];
      const ref = ws['!ref'];
      if (!ref) return null;
      const range = XLSX.utils.decode_range(ref);
      const headers = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
        headers.push(cell?.v != null ? String(cell.v) : `Column${c + 1}`);
      }
      return { index: i + 1, ref, headers };
    }).filter(Boolean);

    const workbookArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const finalArray = await postProcessXlsx(workbookArray, sheetMeta);
    const blob = new Blob([finalArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob, `blueprint-export-${new Date().toISOString().split('T')[0]}.xlsx`);

    hideExportProgress();
    showToast('Excel export completed successfully!', 'success');
  } catch (error) {
    console.error('Excel export failed:', error);
    hideExportProgress();
    showToast('Excel export failed: ' + error.message, 'error');
  }
}

function buildChecklistSheet(autoItems, customItems) {
  const rows = [['Label', 'Type', 'Status', 'Done', 'Total', 'Progress', 'Notes']];
  for (const item of autoItems) {
    const status = item.done === item.total ? 'Complete' : 'In Progress';
    rows.push([item.label, 'Auto', status, item.done, item.total, `${item.done}/${item.total}`, '']);
    for (const sub of item.subItems || []) {
      const ss = sub.done === sub.total ? 'Complete' : 'In Progress';
      rows.push([`  ${sub.label}`, 'Auto-Sub', ss, sub.done, sub.total, `${sub.done}/${sub.total}`, '']);
    }
  }
  for (const item of customItems) {
    rows.push([item.label, 'Custom', item.completed ? 'Complete' : 'Incomplete', '', '', '', item.notes || '']);
  }
  return XLSX.utils.aoa_to_sheet(rows);
}

// Keys excluded from each asset class's main sheet (handled by sub-data sheets)
const ASSET_CLASS_EXCLUDE_KEYS = {
  'Network Switch':   ['switchPorts', 'switchNetworks'],
  'PLC':              ['slots'],
  'VFD':              ['vfdParameters', 'deviceWiring'],
  'Network Device':   ['networkDeviceWiring'],
  'Hardwired Device': ['hardwiredWiring'],
};

function buildAssetClassSheet(assets, assetClass, refs) {
  const excludeKeys = ASSET_CLASS_EXCLUDE_KEYS[assetClass] || [];
  return buildWorksheet(assets, 'assets', refs, { excludeKeys });
}

function buildSwitchNetworksSheet(switchAssets, refs) {
  const headers = ['Asset ID', 'Asset Name', 'Network ID', 'Network Name'];
  const rows = [];
  for (const asset of switchAssets) {
    for (const sn of (asset.switchNetworks || [])) {
      const network = refs.networks?.get(sn.networkId);
      rows.push([asset.id, asset.name || '', sn.networkId || '', network?.name || '']);
    }
  }
  return buildSubDataSheet(headers, rows);
}

function buildSwitchPortsSheet(switchAssets, refs) {
  const headers = ['Asset ID', 'Asset Name', 'Port Name', 'Network ID', 'Network Name', 'Connected Asset ID', 'Connected Asset Name'];
  const rows = [];
  for (const asset of switchAssets) {
    for (const port of (asset.switchPorts || [])) {
      const network = refs.networks?.get(port.networkId);
      const connected = refs.assets?.get(port.assetId);
      rows.push([
        asset.id, asset.name || '',
        port.portName || '',
        port.networkId || '', network?.name || '',
        port.assetId || '', connected?.name || '',
      ]);
    }
  }
  return buildSubDataSheet(headers, rows);
}

function buildPlcSlotsSheet(plcAssets, refs) {
  const headers = [
    'Asset ID', 'Asset Name', 'Slot Number', 'Name', 'Card Type',
    'Part Number', 'Firmware Version', 'Network ID', 'Network Name',
    'IO Point Count', 'Voltage', 'Protocol', 'IP Address', 'Node Address',
    'IO Points', 'Power Bus',
  ];
  const rows = [];
  for (const asset of plcAssets) {
    for (const slot of (asset.slots || [])) {
      const network = refs.networks?.get(slot.networkId);
      rows.push([
        asset.id, asset.name || '',
        slot.slotNumber ?? '',
        slot.name || '',
        slot.cardType || '',
        slot.partNumber || '',
        slot.firmwareVersion || '',
        slot.networkId || '', network?.name || '',
        slot.ioPointCount || '',
        slot.voltageLevel || '',
        slot.protocol || '',
        slot.ipAddress || '',
        slot.nodeAddress || '',
        slot.ioPoints?.length  ? JSON.stringify(slot.ioPoints)  : '',
        slot.powerBus?.length  ? JSON.stringify(slot.powerBus)  : '',
      ]);
    }
  }
  return buildSubDataSheet(headers, rows);
}

function buildVfdParametersSheet(vfdAssets, refs) {
  const headers = ['Asset ID', 'Asset Name', 'Section', 'Parameter', 'Value'];
  const rows = [];
  for (const asset of vfdAssets) {
    for (const param of (asset.vfdParameters || [])) {
      rows.push([asset.id, asset.name || '', 'Parameters', param.parameter || '', param.value || '']);
    }
  }
  return buildSubDataSheet(headers, rows);
}

function buildPowerWiringSheet(powerItems, refs) {
  const headers = ['Power ID', 'Power Name', 'Section', 'Terminal', 'Label'];
  const rows = [];
  const tableDefs = [
    { key: 'inputWiring',  label: 'Input Wiring' },
    { key: 'outputWiring', label: 'Output Wiring' },
  ];
  for (const item of powerItems) {
    for (const tbl of tableDefs) {
      for (const row of (item[tbl.key] || [])) {
        rows.push([item.id, item.name || '', tbl.label, row.terminal || '', row.label || '']);
      }
    }
  }
  return buildSubDataSheet(headers, rows);
}

function buildVfdWiringSheet(vfdAssets, refs) {
  const headers = ['Asset ID', 'Asset Name', 'Section', 'Terminal', 'Label'];
  const rows = [];
  for (const asset of vfdAssets) {
    for (const row of (asset.deviceWiring || [])) {
      rows.push([asset.id, asset.name || '', 'Wiring', row.terminal || '', row.label || '']);
    }
  }
  return buildSubDataSheet(headers, rows);
}

function buildNetworkDeviceWiringSheet(networkDeviceAssets, refs) {
  const headers = ['Asset ID', 'Asset Name', 'Section', 'Terminal', 'Label'];
  const rows = [];
  for (const asset of networkDeviceAssets) {
    for (const row of (asset.networkDeviceWiring || [])) {
      rows.push([asset.id, asset.name || '', 'Wiring', row.terminal || '', row.label || '']);
    }
  }
  return buildSubDataSheet(headers, rows);
}

function buildHardwiredWiringSheet(hardwiredAssets, refs) {
  const headers = ['Asset ID', 'Asset Name', 'Section', 'Terminal', 'Label'];
  const rows = [];
  for (const asset of hardwiredAssets) {
    for (const row of (asset.hardwiredWiring || [])) {
      rows.push([asset.id, asset.name || '', 'Wiring', row.terminal || '', row.label || '']);
    }
  }
  return buildSubDataSheet(headers, rows);
}

function buildPlcDigitalWiringSheet(plcAssets, refs) {
  const headers = ['Asset ID', 'Asset Name', 'Slot #', 'Slot Name', 'IO Point #', 'Label'];
  const rows = [];
  for (const asset of plcAssets) {
    for (const slot of (asset.slots || [])) {
      if (slot.cardType !== 'Digital') continue;
      (slot.ioPoints || []).forEach((pt, idx) => {
        rows.push([asset.id, asset.name || '', slot.slotNumber ?? '', slot.name || '', idx + 1, pt.label || '']);
      });
    }
  }
  return buildSubDataSheet(headers, rows);
}

function buildPlcAnalogWiringSheet(plcAssets, refs) {
  const headers = ['Asset ID', 'Asset Name', 'Slot #', 'Slot Name', 'IO Point #', 'Label', 'Signal Type', 'Wiring Type'];
  const rows = [];
  for (const asset of plcAssets) {
    for (const slot of (asset.slots || [])) {
      if (slot.cardType !== 'Analog') continue;
      (slot.ioPoints || []).forEach((pt, idx) => {
        rows.push([asset.id, asset.name || '', slot.slotNumber ?? '', slot.name || '', idx + 1, pt.label || '', pt.signalType || '', pt.wiringType || '']);
      });
    }
  }
  return buildSubDataSheet(headers, rows);
}

async function postProcessXlsx(array, sheetMeta) {
  function xmlEsc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function dedupeHeaders(headers) {
    const seen = {};
    return headers.map(h => {
      if (!seen[h]) { seen[h] = 1; return h; }
      seen[h]++;
      return `${h}_${seen[h]}`;
    });
  }

  const zip = await JSZip.loadAsync(array);
  let contentTypes = await zip.file('[Content_Types].xml').async('string');

  for (const { index, ref, headers } of sheetMeta) {
    const range = XLSX.utils.decode_range(ref);
    // Excel requires tables to span at least 2 rows; extend ref for header-only sheets
    const tableRef = range.e.r === 0
      ? XLSX.utils.encode_range({ s: range.s, e: { r: 1, c: range.e.c } })
      : ref;

    const dedupedHeaders = dedupeHeaders(headers);
    const colCount = dedupedHeaders.length;
    const tableId = index;
    const tableName = `T_${tableId}`;

    const cols = dedupedHeaders.map((h, j) =>
      `<tableColumn id="${j + 1}" name="${xmlEsc(h)}"/>`
    ).join('');

    const tableXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"` +
      ` id="${tableId}" name="${tableName}" displayName="${tableName}"` +
      ` ref="${tableRef}" headerRowCount="1">` +
      `<autoFilter ref="${tableRef}"/>` +
      `<tableColumns count="${colCount}">${cols}</tableColumns>` +
      `<tableStyleInfo name="TableStyleMedium9" showFirstColumn="0"` +
      ` showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>` +
      `</table>`;

    zip.file(`xl/tables/table${tableId}.xml`, tableXml);

    const relXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId_t1"` +
      ` Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table"` +
      ` Target="../tables/table${tableId}.xml"/>` +
      `</Relationships>`;

    zip.file(`xl/worksheets/_rels/sheet${index}.xml.rels`, relXml);

    let sheetXml = await zip.file(`xl/worksheets/sheet${index}.xml`).async('string');
    if (!sheetXml.includes('xmlns:r=')) {
      sheetXml = sheetXml.replace(
        '<worksheet ',
        '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
      );
    }
    zip.file(
      `xl/worksheets/sheet${index}.xml`,
      sheetXml.replace(
        '</worksheet>',
        `<tableParts count="1"><tablePart r:id="rId_t1"/></tableParts></worksheet>`
      )
    );

    contentTypes = contentTypes.replace(
      '</Types>',
      `<Override PartName="/xl/tables/table${tableId}.xml"` +
      ` ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>`
    );
  }

  zip.file('[Content_Types].xml', contentTypes);
  return zip.generateAsync({ type: 'arraybuffer' });
}

function getDefaultHeaders(store, excludeKeys = []) {
  const excludeSet = new Set([...excludeKeys, 'images', 'namedPhotos']);
  const fields = ENTITY[store]?.fields || [];
  return [...new Set(['id', ...fields.map(f => f.key)])].filter(k => !excludeSet.has(k));
}

function buildSubDataSheet(headers, rows) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map(h => ({
    wch: Math.max(h.length + 4, 14),
    ...(h === 'ID' || h.endsWith(' ID') ? { hidden: true } : {}),
  }));
  return ws;
}

// options.excludeKeys: string[] — keys to omit from this sheet
function buildWorksheet(items, store, refs, options = {}) {
  const HIDDEN_KEYS = new Set(['id', 'createdAt', 'updatedAt']);
  const { excludeKeys = [] } = options;
  const orderedKeys = (items?.length)
    ? getExportHeaders(items, store, excludeKeys)
    : getDefaultHeaders(store, excludeKeys);

  // Build column specs; ref fields get two columns: resolved name + raw ID (always hidden)
  const columnSpec = [];
  for (const key of orderedKeys) {
    const label = getFieldLabel(store, key, items?.[0] ?? null);
    const hideMain = HIDDEN_KEYS.has(key);
    if (REF_FIELD_MAP[key] || key === 'assignedToId') {
      columnSpec.push({ header: label,    getValue: item => resolveExportValue(store, key, item[key], item, refs), hidden: hideMain });
      const idHeader = key === 'assignedToId' ? 'Assigned To ID' : label + ' ID';
      columnSpec.push({ header: idHeader, getValue: item => item[key] || '', hidden: true });
    } else {
      columnSpec.push({ header: label,    getValue: item => resolveExportValue(store, key, item[key], item, refs), hidden: hideMain });
    }
  }

  const headerLabels = columnSpec.map(c => c.header);
  const rows = (items || []).map(item => columnSpec.map(c => c.getValue(item)));

  const worksheet = XLSX.utils.aoa_to_sheet([headerLabels, ...rows]);

  worksheet['!cols'] = columnSpec.map(c => ({
    wch: Math.max(Math.min(c.header.length + 6, 30), 10),
    ...(c.hidden ? { hidden: true } : {}),
  }));

  return worksheet;
}

function getExportHeaders(items, store, excludeKeys = []) {
  const preferredOrder = [
    'id', 'name', 'description', 'assetClass', 'assetSubclass',
    'panelId', 'areaId', 'assignedToType', 'assignedToId',
    'networkId', 'networkType', 'ipAddress', 'macAddress',
    'manufacturer', 'model', 'serialNumber', 'createdAt', 'updatedAt'
  ];

  const excludeSet = new Set(excludeKeys);
  const keySet = new Set();
  items.forEach(item => {
    Object.keys(item).forEach(key => {
      if (key === 'images' || key === 'namedPhotos') return;
      if (excludeSet.has(key)) return;
      keySet.add(key);
    });
  });

  const keys = Array.from(keySet);
  keys.sort((a, b) => {
    const ai = preferredOrder.indexOf(a);
    const bi = preferredOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return keys;
}

function serializeExportValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.length === 0 ? '' : JSON.stringify(value);
  if (typeof value === 'object') return Object.keys(value).length === 0 ? '' : JSON.stringify(value);
  return value;
}

function resolveExportValue(store, key, value, item, refs) {
  if (value == null || value === '') return '';

  const fieldDef = findFieldDef(store, key, item);
  const refStore = fieldDef?.refStore || REF_FIELD_MAP[key];
  if (refStore) {
    const target = refs?.[refStore]?.get(value);
    return target ? (target.name || '') : '';
  }

  if (key === 'assignedToId' && item.assignedToType) {
    const assignStore = ASSIGN_STORE_MAP[item.assignedToType];
    if (assignStore) {
      const target = refs?.[assignStore]?.get(value);
      return target ? (target.name || '') : '';
    }
  }

  return serializeExportValue(value);
}

function getFieldLabel(store, key, item) {
  const fieldDef = findFieldDef(store, key, item);
  return fieldDef?.label || prettifyKey(key);
}

function findFieldDef(store, key, item) {
  const entity = ENTITY[store];
  if (!entity) return null;

  const searchFields = (fields) => fields?.find(f => f.key === key);
  let fieldDef = searchFields(entity.fields);
  if (fieldDef) return fieldDef;

  if (store === 'assets') {
    fieldDef = searchFields(entity.classFields?.[item?.assetClass] || []);
    if (fieldDef) return fieldDef;
    fieldDef = searchFields(entity.subclassFields?.[item?.assetSubclass] || []);
    if (fieldDef) return fieldDef;
    const networkType = entity.networkTypeFields?.[item?.networkType] ? item.networkType : null;
    fieldDef = searchFields(entity.networkTypeFields?.[networkType] || []);
    if (fieldDef) return fieldDef;
  }

  if (store === 'networks' && item?.networkType) {
    fieldDef = searchFields(entity.protocolFields?.[item.networkType] || []);
    if (fieldDef) return fieldDef;
  }

  return null;
}

function prettifyKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/Id$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

const REF_FIELD_MAP = {
  areaId:    'areas',
  panelId:   'panels',
  powerId:   'power',
  safetyId:  'safety',
  networkId: 'networks',
};

function buildMap(items) {
  return new Map(items.map(item => [item.id, item]));
}

function sanitizeSheetName(name) {
  const safe = name.replace(/[:\\/?*\[\]]/g, '_');
  return safe.substring(0, 31);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function processArea(area, areaFolder, panelByArea, power, safety, assets, processedCount, totalItems) {
  const panels = panelByArea.get(area.id) || [];

  // Process panels in this area
  if (panels.length > 0) {
    const panelsFolder = areaFolder.folder('Panels');
    for (const panel of panels) {
      const panelFolder = panelsFolder.folder(sanitizeFilename(panel.name));
      await processPanel(panel, panelFolder);
    }
  }

  // Process all Power items from panels in this area
  const areaPower = power.filter(p => {
    const panel = panels.find(panel => panel.id === p.panelId);
    return panel && panel.areaId === area.id;
  });
  if (areaPower.length > 0) {
    const powerFolder = areaFolder.folder('Power');
    for (const item of areaPower) {
      const itemFolder = powerFolder.folder(generateObjectFolderName(item, areaPower));
      await processObject(item, itemFolder);
      processedCount++;
      updateProgress(processedCount, totalItems);
    }
  }

  // Process all Safety items from panels in this area
  const areaSafety = safety.filter(s => {
    const panel = panels.find(panel => panel.id === s.panelId);
    return panel && panel.areaId === area.id;
  });
  if (areaSafety.length > 0) {
    const safetyFolder = areaFolder.folder('Safety');
    for (const item of areaSafety) {
      const itemFolder = safetyFolder.folder(generateObjectFolderName(item, areaSafety));
      await processObject(item, itemFolder);
      processedCount++;
      updateProgress(processedCount, totalItems);
    }
  }

  // Process all Assets items from panels in this area, grouped by class
  const areaAssets = assets.filter(a => {
    const panel = panels.find(panel => panel.id === a.panelId);
    return panel && panel.areaId === area.id;
  });
  if (areaAssets.length > 0) {
    const assetsFolder = areaFolder.folder('Assets');
    const assetsByClass = new Map();
    areaAssets.forEach(item => {
      const assetClass = item.assetClass || 'Unspecified';
      if (!assetsByClass.has(assetClass)) assetsByClass.set(assetClass, []);
      assetsByClass.get(assetClass).push(item);
    });

    for (const assetClass of Array.from(assetsByClass.keys()).sort()) {
      const classFolder = assetsFolder.folder(sanitizeFilename(assetClass));
      const items = assetsByClass.get(assetClass) || [];
      for (const item of items) {
        const itemFolder = classFolder.folder(generateObjectFolderName(item, items));
        await processObject(item, itemFolder);
        processedCount++;
        updateProgress(processedCount, totalItems);
      }
    }
  }

  // Process unassigned items in this area (items with areaId but no panelId)
  const unassignedInArea = [...power, ...safety, ...assets].filter(item =>
    item.areaId === area.id && !item.panelId
  );
  if (unassignedInArea.length > 0) {
    const fieldFolder = areaFolder.folder('Field Folder (Unassigned Objects)');
    for (const item of unassignedInArea) {
      const itemFolder = fieldFolder.folder(generateObjectFolderName(item, []));
      await processObject(item, itemFolder);
      processedCount++;
      updateProgress(processedCount, totalItems);
    }
  }

  return processedCount;
}

// Returns { blob, ext } from either a legacy base64 string or a { blob, mimeType } media item.
function _mediaItemToExport(value) {
  if (typeof value === 'string') return { blob: base64ToBlob(value), ext: 'jpg' };
  const ext = value.mimeType === 'video/mp4' ? 'mp4' : value.mimeType === 'video/quicktime' ? 'mov' : 'jpg';
  return { blob: value.blob, ext };
}

// Writes namedPhotos (object of arrays or legacy strings) and images array to a JSZip folder.
function _exportMedia(entity, photosFolder) {
  if (entity.namedPhotos) {
    for (const [slotName, slotValue] of Object.entries(entity.namedPhotos)) {
      const items = Array.isArray(slotValue) ? slotValue : (slotValue ? [slotValue] : []);
      items.forEach((item, i) => {
        const { blob, ext } = _mediaItemToExport(item);
        const suffix = items.length > 1 ? `-${i + 1}` : '';
        photosFolder.file(`${sanitizeFilename(slotName)}${suffix}.${ext}`, blob);
      });
    }
  }
  if (entity.images?.length) {
    entity.images.forEach((item, i) => {
      const { blob, ext } = _mediaItemToExport(item);
      photosFolder.file(`${i + 1}.${ext}`, blob);
    });
  }
}

async function processPanel(panel, panelFolder) {
  const data = { ...panel };
  delete data.namedPhotos;
  delete data.images;
  panelFolder.file('data.json', JSON.stringify(data, null, 2));
  _exportMedia(panel, panelFolder.folder('Photos'));
}

async function processObject(item, itemFolder) {
  const data = { ...item };
  delete data.namedPhotos;
  delete data.images;
  itemFolder.file('data.json', JSON.stringify(data, null, 2));
  _exportMedia(item, itemFolder.folder('photos'));
}

function generateObjectFolderName(item, siblings) {
  let baseName = item.name || `Unnamed-${item.id}`;
  baseName = sanitizeFilename(baseName);

  // Check for duplicates
  const existingNames = siblings.map(s => s.name || `Unnamed-${s.id}`).map(sanitizeFilename);
  let counter = 1;
  let finalName = baseName;
  while (existingNames.includes(finalName)) {
    finalName = `${baseName}_${counter}`;
    counter++;
  }

  return finalName;
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
}

function base64ToBlob(base64) {
  const cleanBase64 = base64.replace(/^data:image\/[a-z]+;base64,/, '');
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: 'image/jpeg' });
}

function showExportProgress(message) {
  hideExportProgress();

  const backdrop = document.createElement('div');
  backdrop.className = 'export-progress-backdrop';

  const modal = document.createElement('div');
  modal.className = 'export-progress-modal';

  const title = document.createElement('h3');
  title.textContent = 'Exporting Data';

  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';

  const progressFill = document.createElement('div');
  progressFill.className = 'progress-fill';
  progressFill.style.width = '0%';
  progressBar.appendChild(progressFill);

  const progressText = document.createElement('p');
  progressText.className = 'progress-text';
  progressText.textContent = message;

  const progressCount = document.createElement('p');
  progressCount.className = 'progress-count';
  progressCount.textContent = '0 / 0 objects';

  modal.appendChild(title);
  modal.appendChild(progressBar);
  modal.appendChild(progressText);
  modal.appendChild(progressCount);

  backdrop.appendChild(modal);

  const container = document.createElement('div');
  container.id = 'export-progress-modal';
  container.appendChild(backdrop);

  document.body.appendChild(container);
}

function updateProgress(current, total, message = null) {
  const container = document.getElementById('export-progress-modal');
  if (!container) return;

  const fill = container.querySelector('.progress-fill');
  const text = container.querySelector('.progress-text');
  const count = container.querySelector('.progress-count');

  const percent = total > 0 ? (current / total) * 100 : 0;
  fill.style.width = `${percent}%`;
  count.textContent = `${current} / ${total} sheets`;

  if (message) {
    text.textContent = message;
  }
}

function hideExportProgress() {
  const modal = document.getElementById('export-progress-modal');
  if (modal) modal.remove();
}

// Make export functions globally available
window.exportToZip  = exportToZip;
window.exportExcel  = exportExcel;
