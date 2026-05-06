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

    const workbook = XLSX.utils.book_new();
    let processedCount = 0;
    const totalSheets = 15;

    const addSheet = (name, worksheet) => {
      XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(name));
      processedCount++;
      updateProgress(processedCount, totalSheets, `Adding ${name} sheet...`);
    };

    // Entity sheets
    addSheet('Areas',    buildWorksheet(areas,    'areas',    refs));
    addSheet('Panels',   buildWorksheet(panels,   'panels',   refs));
    addSheet('Power',    buildWorksheet(power,    'power',    refs));
    addSheet('Safety',   buildWorksheet(safety,   'safety',   refs));
    addSheet('Networks', buildWorksheet(networks, 'networks', refs));

    // Asset class sheets + sub-data sheets
    addSheet('Network Switch', buildAssetClassSheet(assetsByClass['Network Switch'], 'Network Switch', refs));
    addSheet('Switch Networks', buildSwitchNetworksSheet(assetsByClass['Network Switch'], refs));
    addSheet('Switch Ports',    buildSwitchPortsSheet(assetsByClass['Network Switch'], refs));
    addSheet('PLC',            buildAssetClassSheet(assetsByClass['PLC'],             'PLC',             refs));
    addSheet('PLC Slots',      buildPlcSlotsSheet(assetsByClass['PLC'], refs));
    addSheet('HMI',            buildAssetClassSheet(assetsByClass['HMI'],             'HMI',             refs));
    addSheet('VFD',            buildAssetClassSheet(assetsByClass['VFD'],             'VFD',             refs));
    addSheet('VFD Parameters', buildVfdParametersSheet(assetsByClass['VFD'], refs));
    addSheet('Network Device',   buildAssetClassSheet(assetsByClass['Network Device'],   'Network Device',   refs));
    addSheet('Hardwired Device', buildAssetClassSheet(assetsByClass['Hardwired Device'], 'Hardwired Device', refs));

    const workbookArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([workbookArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob, `blueprint-export-${new Date().toISOString().split('T')[0]}.xlsx`);

    hideExportProgress();
    showToast('Excel export completed successfully!', 'success');
  } catch (error) {
    console.error('Excel export failed:', error);
    hideExportProgress();
    showToast('Excel export failed: ' + error.message, 'error');
  }
}

// Keys excluded from each asset class's main sheet (handled by sub-data sheets)
const ASSET_CLASS_EXCLUDE_KEYS = {
  'Network Switch': ['switchPorts', 'switchNetworks'],
  'PLC':            ['slots'],
  'VFD':            ['vfdParameters'],
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
  const headers = ['Asset ID', 'Asset Name', 'Parameter', 'Value'];
  const rows = [];
  for (const asset of vfdAssets) {
    for (const param of (asset.vfdParameters || [])) {
      rows.push([asset.id, asset.name || '', param.parameter || '', param.value || '']);
    }
  }
  return buildSubDataSheet(headers, rows);
}

function buildSubDataSheet(headers, rows) {
  const data = rows.length ? [headers, ...rows] : [headers, ['No records']];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 14) }));
  if (rows.length) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };
  }
  return ws;
}

// options.excludeKeys: string[] — keys to omit from this sheet
function buildWorksheet(items, store, refs, options = {}) {
  if (!items || !items.length) {
    return XLSX.utils.aoa_to_sheet([['No records']]);
  }

  const { excludeKeys = [] } = options;
  const orderedKeys = getExportHeaders(items, store, excludeKeys);

  // Build column specs; ref fields get two columns: resolved name + raw ID
  const columnSpec = [];
  for (const key of orderedKeys) {
    const label = getFieldLabel(store, key, items[0]);
    if (REF_FIELD_MAP[key] || key === 'assignedToId') {
      columnSpec.push({ header: label,          getValue: item => resolveExportValue(store, key, item[key], item, refs) });
      const idHeader = key === 'assignedToId' ? 'Assigned To ID' : label + ' ID';
      columnSpec.push({ header: idHeader,       getValue: item => item[key] || '' });
    } else {
      columnSpec.push({ header: label,          getValue: item => resolveExportValue(store, key, item[key], item, refs) });
    }
  }

  const headerLabels = columnSpec.map(c => c.header);
  const rows = items.map(item => columnSpec.map(c => c.getValue(item)));

  const worksheet = XLSX.utils.aoa_to_sheet([headerLabels, ...rows]);
  const range = XLSX.utils.decode_range(worksheet['!ref']);

  worksheet['!cols'] = headerLabels.map(label => ({ wch: Math.max(Math.min(label.length + 6, 30), 10) }));
  worksheet['!autofilter'] = { ref: XLSX.utils.encode_range(range) };

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

async function processPanel(panel, panelFolder) {
  // Export panel data.json
  const data = { ...panel };
  delete data.namedPhotos;
  delete data.images;
  panelFolder.file('data.json', JSON.stringify(data, null, 2));

  // Export panel photos in photos/ subfolder
  const photosFolder = panelFolder.folder('Photos');
  if (panel.namedPhotos) {
    for (const [slotName, base64] of Object.entries(panel.namedPhotos)) {
      if (base64) {
        const blob = base64ToBlob(base64);
        photosFolder.file(`${sanitizeFilename(slotName)}.jpg`, blob);
      }
    }
  }
  if (panel.images && panel.images.length > 0) {
    panel.images.forEach((base64, index) => {
      if (base64) {
        const blob = base64ToBlob(base64);
        photosFolder.file(`${index + 1}.jpg`, blob);
      }
    });
  }
}

async function processObject(item, itemFolder) {
  // Export data.json (exclude photo data)
  const data = { ...item };
  delete data.namedPhotos;
  delete data.images;
  itemFolder.file('data.json', JSON.stringify(data, null, 2));

  // Export all photos in photos/ subfolder
  const photosFolder = itemFolder.folder('photos');
  if (item.namedPhotos) {
    for (const [slotName, base64] of Object.entries(item.namedPhotos)) {
      if (base64) {
        const blob = base64ToBlob(base64);
        photosFolder.file(`${sanitizeFilename(slotName)}.jpg`, blob);
      }
    }
  }
  if (item.images && item.images.length > 0) {
    item.images.forEach((base64, index) => {
      if (base64) {
        const blob = base64ToBlob(base64);
        photosFolder.file(`${index + 1}.jpg`, blob);
      }
    });
  }
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
