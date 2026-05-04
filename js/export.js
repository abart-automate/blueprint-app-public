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
    showExportProgress('Starting Excel export...');

    const [areas, panels, power, safety, assets] = await Promise.all([
      getAll('areas'),
      getAll('panels'),
      getAll('power'),
      getAll('safety'),
      getAll('assets')
    ]);

    const panelByArea = new Map();
    panels.forEach(panel => {
      const areaId = panel.areaId;
      if (!panelByArea.has(areaId)) panelByArea.set(areaId, []);
      panelByArea.get(areaId).push(panel);
    });

    const zip = new JSZip();
    let processedCount = 0;
    const totalItems = panels.length + power.length + safety.length + assets.length;

    for (const area of areas) {
      const areaFolder = zip.folder(sanitizeFilename(area.name));
      processedCount = await processAreaExcel(area, areaFolder, panelByArea, power, safety, assets, processedCount, totalItems);
    }

    const unassignedPanels = panels.filter(p => !p.areaId);
    if (unassignedPanels.length > 0) {
      const fieldFolder = zip.folder('Field Folder (Unassigned Panels)');
      for (const panel of unassignedPanels) {
        const panelFolder = fieldFolder.folder(sanitizeFilename(panel.name));
        await processPanel(panel, panelFolder);
        processedCount++;
        updateProgress(processedCount, totalItems);
      }
    }

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

    updateProgress(totalItems, totalItems, 'Generating ZIP file...');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blueprint-excel-export-${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    hideExportProgress();
    showToast('Excel export completed successfully!', 'success');

  } catch (error) {
    console.error('Excel export failed:', error);
    hideExportProgress();
    showToast('Excel export failed: ' + error.message, 'error');
  }
}

async function processAreaExcel(area, areaFolder, panelByArea, power, safety, assets, processedCount, totalItems) {
  const panels = panelByArea.get(area.id) || [];

  if (panels.length > 0) {
    const panelsFolder = areaFolder.folder('Panels');
    for (const panel of panels) {
      const panelFolder = panelsFolder.folder(sanitizeFilename(panel.name));
      await processPanel(panel, panelFolder);
      processedCount++;
      updateProgress(processedCount, totalItems);
    }
  }

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
  // Remove/replace invalid filename characters
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
}

function base64ToBlob(base64) {
  // Remove data URL prefix if present
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
  // Remove any existing modal
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
  count.textContent = `${current} / ${total} objects`;

  if (message) {
    text.textContent = message;
  }
}

function hideExportProgress() {
  const modal = document.getElementById('export-progress-modal');
  if (modal) modal.remove();
}

// Make export function globally available
window.exportToZip = exportToZip;
window.exportExcel = exportExcel;