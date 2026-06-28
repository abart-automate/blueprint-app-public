// JSON Merge Import Module
// Non-destructive alternative to the "Replace All" JSON import in operations.js.
// Detects name/ID matches between the imported file and existing data, lets the
// user resolve each match (Keep Existing / Overwrite / Import as New), and adds
// everything else as new records. Mirrors the two-phase strategy already used by
// the XLSX merge importer in import.js (build maps, then resolve cross-references).
//
// Dependencies: entity-config.js (ENTITY, ASSIGN_STORE_MAP), export.js (REF_FIELD_MAP),
//               state.js (state, confirm, showToast), db.js (getAll, upsert, setSetting),
//               operations.js (uniqueCopyName, _serializeEntityMedia, _deserializeEntityMedia),
//               app.js (refreshAll, renderPage)

const MERGE_STORE_ORDER = ['areas', 'panels', 'power', 'safety', 'networks', 'assets'];

// Ref-field keys whose values are entity ids, mapped to the store they point into.
// REF_FIELD_MAP (export.js) already covers areaId/panelId/powerId/safetyId/networkId;
// assetId is added here for cross-asset references (e.g. switchPorts[].assetId).
const MERGE_REF_STORE_KEYS = { ...REF_FIELD_MAP, assetId: 'assets' };

/* ============================================================
   STEP A: DETECT
   ============================================================ */

function _findExistingMatch(store, importedItem) {
  if (importedItem.id && state.refs[store]?.[importedItem.id]) return state.refs[store][importedItem.id];
  const name = importedItem.name?.trim().toLowerCase();
  if (!name) return null;
  return (state.cache[store] || []).find(i => i.name?.trim().toLowerCase() === name) || null;
}

function _diffableFields(entity) {
  const { id, createdAt, updatedAt, ...rest } = entity;
  return rest;
}

// Imported items carry media as base64 strings (the export format); serialize the
// existing entity's media the same way before comparing so the two are apples-to-apples.
async function _isSameAsExisting(importedItem, existing) {
  const serializedExisting = await _serializeEntityMedia(existing);
  return JSON.stringify(_diffableFields(importedItem)) === JSON.stringify(_diffableFields(serializedExisting));
}

// Builds a per-store list of resolutions (new / same / conflict) without writing anything.
async function detectJsonMergePlan(payload) {
  await refreshAll();
  const conflictsByStore = {};
  const newCounts = {};
  const allItems = {};

  for (const store of MERGE_STORE_ORDER) {
    const items = Array.isArray(payload.data[store]) ? payload.data[store] : [];
    const conflicts = [];
    let newCount = 0;
    const resolved = [];

    for (const importedItem of items) {
      const existing = _findExistingMatch(store, importedItem);
      if (!existing) {
        newCount++;
        resolved.push({ importedItem, existing: null, status: 'new' });
        continue;
      }
      const same = await _isSameAsExisting(importedItem, existing);
      if (same) {
        resolved.push({ importedItem, existing, status: 'same' });
      } else {
        const conflict = {
          store,
          importedItem,
          existingItem: existing,
          resolution: 'keep', // 'keep' | 'overwrite' | 'new'
          newName: uniqueCopyName(store, importedItem.name || existing.name, 'imported'),
        };
        conflicts.push(conflict);
        resolved.push({ importedItem, existing, status: 'conflict', conflict });
      }
    }

    if (conflicts.length) conflictsByStore[store] = conflicts;
    newCounts[store] = newCount;
    allItems[store] = resolved;
  }

  return { conflictsByStore, newCounts, allItems };
}

/* ============================================================
   STEP B: REVIEW UI
   ============================================================ */

// Scrollable conflict-review dialog, modeled on showChildSelector() in operations.js.
// Resolves with the (mutated) plan, or null if the user cancels.
function showJsonMergeReview(plan) {
  const groups = MERGE_STORE_ORDER
    .filter(store => plan.conflictsByStore[store]?.length)
    .map(store => ({ store, conflicts: plan.conflictsByStore[store] }));

  const totalNew = Object.values(plan.newCounts).reduce((a, b) => a + b, 0);
  const totalConflicts = groups.reduce((a, g) => a + g.conflicts.length, 0);

  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-backdrop open';
    backdrop.innerHTML = `
      <div class="confirm-box confirm-box--wide merge-review-box">
        <div class="confirm-title">Review Import</div>
        <div class="confirm-msg">
          ${totalNew ? `${totalNew} new item${totalNew > 1 ? 's' : ''} will be added. ` : ''}
          ${totalConflicts} item${totalConflicts > 1 ? 's' : ''} matched existing data — choose how to resolve each:
        </div>
        <div class="merge-review-bulk">
          <button type="button" class="btn btn-outline btn-sm" data-bulk="keep">Keep All Existing</button>
          <button type="button" class="btn btn-outline btn-sm" data-bulk="overwrite">Overwrite All</button>
          <button type="button" class="btn btn-outline btn-sm" data-bulk="new">Import All as New</button>
        </div>
        <div class="merge-review-list">
          ${groups.map(g => `
            <div class="merge-review-group">
              <div class="merge-review-group-title">${ENTITY[g.store].plural} (${g.conflicts.length})</div>
              ${g.conflicts.map((c, i) => `
                <div class="merge-review-row" data-store="${g.store}" data-index="${i}">
                  <div class="merge-review-row-name">${c.existingItem.name || c.importedItem.name}</div>
                  <div class="merge-review-row-options">
                    <label><input type="radio" name="res-${g.store}-${i}" value="keep" checked> Keep Existing</label>
                    <label><input type="radio" name="res-${g.store}-${i}" value="overwrite"> Overwrite</label>
                    <label><input type="radio" name="res-${g.store}-${i}" value="new"> Import as New</label>
                  </div>
                  <input type="text" class="f-input merge-review-rename" data-store="${g.store}" data-index="${i}"
                         value="${c.newName}" style="display:none">
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
        <div class="confirm-actions">
          <button class="btn btn-outline" data-action="cancel">Cancel</button>
          <button class="btn btn-primary"  data-action="ok">Continue</button>
        </div>
      </div>`;
    $('app').appendChild(backdrop);

    const getConflict = (store, index) => plan.conflictsByStore[store][index];

    const setResolution = (store, index, resolution) => {
      const conflict = getConflict(store, index);
      conflict.resolution = resolution;
      const row = backdrop.querySelector(`.merge-review-row[data-store="${store}"][data-index="${index}"]`);
      row.querySelector(`input[value="${resolution}"]`).checked = true;
      row.querySelector('.merge-review-rename').style.display = resolution === 'new' ? '' : 'none';
    };

    backdrop.querySelectorAll('input[type=radio]').forEach(input => {
      input.addEventListener('change', () => {
        const row = input.closest('.merge-review-row');
        setResolution(row.dataset.store, Number(row.dataset.index), input.value);
      });
    });
    backdrop.querySelectorAll('.merge-review-rename').forEach(input => {
      input.addEventListener('input', () => {
        getConflict(input.dataset.store, Number(input.dataset.index)).newName = input.value;
      });
    });
    backdrop.querySelectorAll('[data-bulk]').forEach(btn => {
      btn.addEventListener('click', () => {
        for (const g of groups) {
          g.conflicts.forEach((_, i) => setResolution(g.store, i, btn.dataset.bulk));
        }
      });
    });

    const cleanup = () => $('app').removeChild(backdrop);
    backdrop.querySelector('[data-action=cancel]').addEventListener('click', () => { cleanup(); resolve(null); });
    backdrop.querySelector('[data-action=ok]').addEventListener('click', () => {
      for (const g of groups) {
        for (const c of g.conflicts) {
          if (c.resolution === 'new' && !c.newName?.trim()) {
            c.newName = uniqueCopyName(c.store, c.importedItem.name || c.existingItem.name, 'imported');
          }
        }
      }
      cleanup(); resolve(plan);
    });
  });
}

/* ============================================================
   STEP C: APPLY
   ============================================================ */

// Recursively rewrites entity/id reference fields using the remap tables built up
// as each store is processed. Single generic rule (driven by MERGE_REF_STORE_KEYS /
// ASSIGN_STORE_MAP) instead of hand-coding every nested structure (switchPorts,
// slots[].networkPorts, wiring arrays, etc).
function remapRefsDeep(value, remapTables) {
  if (Array.isArray(value)) return value.map(v => remapRefsDeep(v, remapTables));
  if (value === null || typeof value !== 'object' || value instanceof Blob) return value;

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (key === 'assignedToId') {
      const refStore = ASSIGN_STORE_MAP[value.assignedToType || ''] || null;
      out[key] = (refStore && val && remapTables[refStore]?.[val]) || val;
      continue;
    }
    const refStore = MERGE_REF_STORE_KEYS[key];
    if (refStore && typeof val === 'string' && val) {
      out[key] = remapTables[refStore]?.[val] ?? val;
    } else {
      out[key] = remapRefsDeep(val, remapTables);
    }
  }
  return out;
}

function _stripSystemFields(entity) {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = entity;
  return rest;
}

// Settings have no name/id concept to conflict on: add keys that don't exist locally
// yet, leave existing keys untouched. checklistItems is the one list-shaped setting,
// so its custom entries are appended (de-duped by label) instead of being skipped outright.
async function _mergeSettings(payload) {
  const importedSettings = Array.isArray(payload.data.settings) ? payload.data.settings : [];
  if (!importedSettings.length) return;
  const existingSettings = await getAll('settings');
  const existingIds = new Set(existingSettings.map(s => s.id));

  for (const item of importedSettings) {
    if (item.id === 'checklistItems') {
      const existingChecklist = existingSettings.find(s => s.id === 'checklistItems');
      const existingLabels = new Set((existingChecklist?.value || []).map(c => c.label));
      const newItems = (item.value || [])
        .map(_deserializeEntityMedia)
        .filter(c => c.label && !existingLabels.has(c.label));
      if (newItems.length) {
        await setSetting('checklistItems', [...(existingChecklist?.value || []), ...newItems]);
      }
      continue;
    }
    if (!existingIds.has(item.id)) await setSetting(item.id, item.value);
  }
}

async function applyJsonMergePlan(payload, plan) {
  const remap = {};
  for (const store of MERGE_STORE_ORDER) remap[store] = {};
  const stats = { added: 0, kept: 0, overwritten: 0, renamed: 0 };
  const savedAssets = [];

  for (const store of MERGE_STORE_ORDER) {
    for (const entry of plan.allItems[store] || []) {
      const oldId = entry.importedItem.id;

      if (entry.status === 'same') {
        if (oldId) remap[store][oldId] = entry.existing.id;
        continue;
      }

      if (entry.status === 'new') {
        const deserialized = _deserializeEntityMedia(entry.importedItem);
        const saved = await upsert(store, remapRefsDeep(_stripSystemFields(deserialized), remap));
        if (oldId) remap[store][oldId] = saved.id;
        stats.added++;
        if (store === 'assets') savedAssets.push(saved.id);
        continue;
      }

      // status === 'conflict'
      const conflict = entry.conflict;
      if (conflict.resolution === 'keep') {
        if (oldId) remap[store][oldId] = entry.existing.id;
        stats.kept++;
        continue;
      }

      const deserialized = _deserializeEntityMedia(entry.importedItem);
      let toSave;
      if (conflict.resolution === 'overwrite') {
        // Full replace using imported data, but keep the existing record's identity.
        toSave = { ...deserialized, id: entry.existing.id, createdAt: entry.existing.createdAt };
        stats.overwritten++;
      } else {
        // 'new' — import as a new, separately-named record.
        toSave = { ..._stripSystemFields(deserialized), name: conflict.newName.trim() };
        stats.renamed++;
      }
      const saved = await upsert(store, remapRefsDeep(toSave, remap));
      if (oldId) remap[store][oldId] = saved.id;
      if (store === 'assets') savedAssets.push(saved.id);
    }
  }

  // Fixup pass: assets can reference sibling assets (e.g. switchPorts[].assetId) that
  // weren't resolvable until the full assets remap table existed. Mirrors why import.js
  // runs importSubdataSheets only after importAssetSheets has finished.
  for (const id of savedAssets) {
    const saved = await getById('assets', id);
    if (!saved) continue;
    const fixed = remapRefsDeep(saved, remap);
    if (JSON.stringify(fixed) !== JSON.stringify(saved)) await upsert('assets', fixed);
  }

  await _mergeSettings(payload);
  await refreshAll();
  renderPage();

  const parts = [];
  if (stats.added)       parts.push(`${stats.added} added`);
  if (stats.overwritten) parts.push(`${stats.overwritten} overwritten`);
  if (stats.renamed)     parts.push(`${stats.renamed} imported as new`);
  if (stats.kept)        parts.push(`${stats.kept} kept as-is`);
  showToast(parts.length ? `Merge complete: ${parts.join(', ')}` : 'Merge complete: nothing to import', 'success');
}

/* ============================================================
   ORCHESTRATOR
   ============================================================ */

async function mergeJsonImport(payload) {
  try {
    const plan = await detectJsonMergePlan(payload);
    const hasConflicts = Object.keys(plan.conflictsByStore).length > 0;

    if (!hasConflicts) {
      const totalNew = Object.values(plan.newCounts).reduce((a, b) => a + b, 0);
      if (!totalNew) {
        showToast('Nothing new to import — data already matches', 'success');
        return;
      }
      const ok = await confirm(
        'Import data?',
        `${totalNew} new item${totalNew > 1 ? 's' : ''} will be added. Existing data will not be changed.`,
        { yesLabel: 'Import', yesClass: 'btn-primary' }
      );
      if (!ok) return;
      await applyJsonMergePlan(payload, plan);
      return;
    }

    const resolvedPlan = await showJsonMergeReview(plan);
    if (!resolvedPlan) return;
    await applyJsonMergePlan(payload, resolvedPlan);
  } catch (err) {
    console.error('Merge import failed:', err);
    showToast('Merge import failed: ' + err.message, 'error');
  }
}
