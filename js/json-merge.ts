import type { DbRecord } from './db.js';
import type { EntityType } from './entity-config.js';

import { getAll, getById, setSetting, upsert } from './db.js';
import { ASSIGN_STORE_MAP, ENTITY } from './entity-config.js';
import { $, confirm, refreshAll, showToast, state } from './state.js';
import { _deserializeEntityMedia, _serializeEntityMedia, uniqueCopyName } from './operations.js';
import { renderPage } from './app.js';
import { REF_FIELD_MAP } from './export.js';
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

export const MERGE_STORE_ORDER: readonly EntityType[] = ['areas', 'panels', 'power', 'safety', 'networks', 'assets'];

// Ref-field keys whose values are entity ids, mapped to the store they point into.
// REF_FIELD_MAP (export.js) already covers areaId/panelId/powerId/safetyId/networkId;
// assetId is added here for cross-asset references (e.g. switchPorts[].assetId).
export const MERGE_REF_STORE_KEYS: Record<string, string> = { ...REF_FIELD_MAP, assetId: 'assets' };

export interface MergeConflict {
  store: EntityType;
  importedItem: Record<string, any>;
  existingItem: DbRecord;
  resolution: 'keep' | 'overwrite' | 'new';
  newName: string;
}

export interface MergeEntry {
  importedItem: Record<string, any>;
  existing: DbRecord | null;
  status: 'new' | 'same' | 'conflict';
  conflict?: MergeConflict;
}

export interface MergePlan {
  conflictsByStore: Partial<Record<EntityType, MergeConflict[]>>;
  newCounts: Partial<Record<EntityType, number>>;
  allItems: Partial<Record<EntityType, MergeEntry[]>>;
}

export type MergePayload = { data: Record<string, any[]> };

/* ============================================================
   STEP A: DETECT
   ============================================================ */

export function _findExistingMatch(store: EntityType, importedItem: Record<string, any>): DbRecord | null {
  if (importedItem.id && state.refs[store]?.[importedItem.id]) return state.refs[store][importedItem.id];
  const name = importedItem.name?.trim().toLowerCase();
  if (!name) return null;
  return (state.cache[store] || []).find(i => i.name?.trim().toLowerCase() === name) || null;
}

export function _diffableFields(entity: Record<string, any>): Record<string, any> {
  const { id, createdAt, updatedAt, ...rest } = entity;
  return rest;
}

/**
 * Imported items carry media as base64 strings (the export format); serialize the
 * existing entity's media the same way before comparing so the two are apples-to-apples.
 */
export async function _isSameAsExisting(importedItem: Record<string, any>, existing: DbRecord): Promise<boolean> {
  const serializedExisting = await _serializeEntityMedia(existing);
  return JSON.stringify(_diffableFields(importedItem)) === JSON.stringify(_diffableFields(serializedExisting));
}

/**
 * Builds a per-store list of resolutions (new / same / conflict) without writing anything.
 */
export async function detectJsonMergePlan(payload: MergePayload): Promise<MergePlan> {
  await refreshAll();
  const conflictsByStore: Partial<Record<EntityType, MergeConflict[]>> = {};
  const newCounts: Partial<Record<EntityType, number>> = {};
  const allItems: Partial<Record<EntityType, MergeEntry[]>> = {};

  for (const store of MERGE_STORE_ORDER) {
    const items = Array.isArray(payload.data[store]) ? payload.data[store] : [];
    const conflicts: MergeConflict[] = [];
    let newCount = 0;
    const resolved: MergeEntry[] = [];

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
        const conflict: MergeConflict = {
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

/**
 * Scrollable conflict-review dialog, modeled on showChildSelector() in operations.js.
 * Resolves with the (mutated) plan, or null if the user cancels.
 */
export function showJsonMergeReview(plan: MergePlan): Promise<MergePlan | null> {
  const groups = MERGE_STORE_ORDER
    .filter(store => plan.conflictsByStore[store]?.length)
    .map(store => ({ store, conflicts: plan.conflictsByStore[store] as MergeConflict[] }));

  const totalNew = Object.values(plan.newCounts).reduce((a: number, b) => a + (b ?? 0), 0);
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
    ($('app') as HTMLElement).appendChild(backdrop);

    const getConflict = (store: EntityType, index: number): MergeConflict => (plan.conflictsByStore[store] as MergeConflict[])[index];

    const setResolution = (store: EntityType, index: number, resolution: string | undefined) => {
      const conflict = getConflict(store, index);
      conflict.resolution = resolution as 'keep' | 'overwrite' | 'new';
      const row = backdrop.querySelector(`.merge-review-row[data-store="${store}"][data-index="${index}"]`) as HTMLElement;
      (row.querySelector(`input[value="${resolution}"]`) as HTMLInputElement).checked = true;
      (row.querySelector('.merge-review-rename') as HTMLElement).style.display = resolution === 'new' ? '' : 'none';
    };

    backdrop.querySelectorAll('input[type=radio]').forEach(input => {
      input.addEventListener('change', () => {
        const row = input.closest('.merge-review-row') as HTMLElement;
        setResolution(row.dataset.store as EntityType, Number(row.dataset.index), (input as HTMLInputElement).value);
      });
    });
    backdrop.querySelectorAll('.merge-review-rename').forEach(input => {
      input.addEventListener('input', () => {
        const el = input as HTMLInputElement;
        getConflict(el.dataset.store as EntityType, Number(el.dataset.index)).newName = el.value;
      });
    });
    backdrop.querySelectorAll('[data-bulk]').forEach(btn => {
      btn.addEventListener('click', () => {
        const bulk = (btn as HTMLElement).dataset.bulk;
        for (const g of groups) {
          g.conflicts.forEach((_, i) => setResolution(g.store, i, bulk));
        }
      });
    });

    const cleanup = () => ($('app') as HTMLElement).removeChild(backdrop);
    (backdrop.querySelector('[data-action=cancel]') as HTMLElement).addEventListener('click', () => { cleanup(); resolve(null); });
    (backdrop.querySelector('[data-action=ok]') as HTMLElement).addEventListener('click', () => {
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

/**
 * Recursively rewrites entity/id reference fields using the remap tables built up
 * as each store is processed. Single generic rule (driven by MERGE_REF_STORE_KEYS /
 * ASSIGN_STORE_MAP) instead of hand-coding every nested structure (switchPorts,
 * slots[].networkPorts, wiring arrays, etc).
 *
 * Kept honestly generic per the TS migration plan: this walks arbitrary nested
 * JSON (not just entity records), so `value: T` in, `T` out (identity-preserving,
 * like structuredClone<T>) is the correct type — typing it against a specific
 * EntityRecord union would be actively wrong and require unsafe casts. The
 * recursive walk itself is done through `any`, relying on the runtime shape
 * checks below (Array.isArray, typeof, instanceof Blob) as the real safety net.
 * @param remapTables - storeName -> (oldId -> newId)
 */
export function remapRefsDeep<T>(value: T, remapTables: Record<string, Record<string, string>>): T {
  if (Array.isArray(value)) return value.map(v => remapRefsDeep(v, remapTables)) as T;
  if (value === null || typeof value !== 'object' || value instanceof Blob) return value;

  const src = value as Record<string, any>;
  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(src)) {
    if (key === 'assignedToId') {
      const refStore = (ASSIGN_STORE_MAP as Record<string, string | null>)[src.assignedToType || ''] || null;
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
  return out as T;
}

export function _stripSystemFields(entity: Record<string, any>): Record<string, any> {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = entity;
  return rest;
}

/**
 * Settings have no name/id concept to conflict on: add keys that don't exist locally
 * yet, leave existing keys untouched. checklistItems is the one list-shaped setting,
 * so its custom entries are appended (de-duped by label) instead of being skipped outright.
 */
export async function _mergeSettings(payload: MergePayload): Promise<void> {
  const importedSettings = Array.isArray(payload.data.settings) ? payload.data.settings : [];
  if (!importedSettings.length) return;
  const existingSettings = await getAll('settings');
  const existingIds = new Set(existingSettings.map(s => s.id));

  for (const item of importedSettings) {
    if (item.id === 'checklistItems') {
      const existingChecklist = existingSettings.find(s => s.id === 'checklistItems');
      const existingLabels = new Set(((existingChecklist?.value || []) as any[]).map(c => c.label));
      const newItems = ((item.value || []) as any[])
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

export async function applyJsonMergePlan(payload: MergePayload, plan: MergePlan): Promise<void> {
  const remap: Record<string, Record<string, string>> = {};
  for (const store of MERGE_STORE_ORDER) remap[store] = {};
  const stats = { added: 0, kept: 0, overwritten: 0, renamed: 0 };
  const savedAssets: string[] = [];

  for (const store of MERGE_STORE_ORDER) {
    for (const entry of plan.allItems[store] || []) {
      const oldId = entry.importedItem.id;

      if (entry.status === 'same') {
        if (oldId) remap[store][oldId] = entry.existing?.id as string;
        continue;
      }

      if (entry.status === 'new') {
        const deserialized = _deserializeEntityMedia(entry.importedItem);
        const saved = await upsert(store, remapRefsDeep(_stripSystemFields(deserialized), remap));
        if (oldId) remap[store][oldId] = saved.id as string;
        stats.added++;
        if (store === 'assets') savedAssets.push(saved.id as string);
        continue;
      }

      // status === 'conflict'
      const conflict = entry.conflict as MergeConflict;
      if (conflict.resolution === 'keep') {
        if (oldId) remap[store][oldId] = entry.existing?.id as string;
        stats.kept++;
        continue;
      }

      const deserialized = _deserializeEntityMedia(entry.importedItem);
      let toSave: Record<string, any>;
      if (conflict.resolution === 'overwrite') {
        // Full replace using imported data, but keep the existing record's identity.
        const existing = entry.existing as DbRecord;
        toSave = { ...deserialized, id: existing.id, createdAt: existing.createdAt };
        stats.overwritten++;
      } else {
        // 'new' — import as a new, separately-named record.
        toSave = { ..._stripSystemFields(deserialized), name: conflict.newName.trim() };
        stats.renamed++;
      }
      const saved = await upsert(store, remapRefsDeep(toSave, remap));
      if (oldId) remap[store][oldId] = saved.id as string;
      if (store === 'assets') savedAssets.push(saved.id as string);
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

  const parts: string[] = [];
  if (stats.added)       parts.push(`${stats.added} added`);
  if (stats.overwritten) parts.push(`${stats.overwritten} overwritten`);
  if (stats.renamed)     parts.push(`${stats.renamed} imported as new`);
  if (stats.kept)        parts.push(`${stats.kept} kept as-is`);
  showToast(parts.length ? `Merge complete: ${parts.join(', ')}` : 'Merge complete: nothing to import', 'success');
}

/* ============================================================
   ORCHESTRATOR
   ============================================================ */

export async function mergeJsonImport(payload: MergePayload): Promise<void> {
  try {
    const plan = await detectJsonMergePlan(payload);
    const hasConflicts = Object.keys(plan.conflictsByStore).length > 0;

    if (!hasConflicts) {
      const totalNew = Object.values(plan.newCounts).reduce((a: number, b) => a + (b ?? 0), 0);
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
    showToast('Merge import failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
  }
}
