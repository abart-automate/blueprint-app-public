import type { DbRecord } from './db.js';
import type { MediaFields, MediaRef, StoredMediaEntry } from './media.js';

import { ENTITY_STORES, getAll, getSetting, setSetting, upsert } from './db.js';
import { classifyMediaEntry, entityMediaLists, importInlineMedia, loadEntityMedia, readMediaForExport, toMediaRef } from './media.js';
import { refreshAll, showToast } from './state.js';
import { hideExportProgress, showExportProgress, updateProgress } from './export.js';
import { renderPage } from './app.js';
/* ============================================================
   RESTORE PHOTOS FROM BACKUP
   Replaces photos whose bytes are unavailable on this device (shown
   as "Photo unavailable") with the same photos from a previously
   exported JSON file. Only damaged/missing items are touched: records
   are matched by id, photos by gallery/slot position, and text fields
   and healthy photos are never changed.
   ============================================================ */

/** Where one restorable photo goes, and the backup data to restore it from. */
export interface RestoreStep {
  /** Named-photo slot, or null for the "Other Media" gallery. */
  slot: string | null,
  index: number,
  source: string,
}

/** Which positions of a record's media are currently unavailable. */
export interface MissingMap {
  images: boolean[],
  slots: Record<string, boolean[]>,
}

/**
 * Pure: pairs each unavailable local photo with the backup's photo at the same
 * slot/gallery position, when the backup has one (a base64 data URL — the JSON
 * export format). Positions the backup can't fill are simply not returned.
 */
export function planMediaRestore(missing: MissingMap, backup: MediaFields): RestoreStep[] {
  const { images, slots } = entityMediaLists(backup);
  const backupSlots = new Map(slots);
  const steps: RestoreStep[] = [];
  const pick = (slot: string | null, flags: boolean[], source: StoredMediaEntry[] | undefined) => {
    flags.forEach((isMissing, index) => {
      const entry = source?.[index];
      if (isMissing && typeof entry === 'string' && classifyMediaEntry(entry) === 'base64') {
        steps.push({ slot, index, source: entry });
      }
    });
  };
  pick(null, missing.images, images);
  for (const [slot, flags] of Object.entries(missing.slots)) pick(slot, flags, backupSlots.get(slot));
  return steps;
}

/** Reads which of a record's photos are unavailable (read-only; no writes). */
async function findMissing(record: MediaFields): Promise<{ map: MissingMap, count: number }> {
  const { images, slots } = await loadEntityMedia(record, readMediaForExport);
  const map: MissingMap = {
    images: images.map(i => Boolean(i.missing)),
    slots: Object.fromEntries(slots.map(([slot, items]) => [slot, items.map(i => Boolean(i.missing))])),
  };
  const count = map.images.filter(Boolean).length + Object.values(map.slots).flat().filter(Boolean).length;
  return { map, count };
}

/**
 * Applies restore steps to a copy of `record`: each backup photo is stored as a
 * new `media` row and its ref replaces the unavailable one. Returns the updated
 * record and how many photos were actually restored (backup data can itself be
 * unreadable).
 */
async function applyRestore<T extends Record<string, any>>(record: T, steps: RestoreStep[], onStep: () => void): Promise<{ record: T, restored: number }> {
  const out: Record<string, any> = {
    ...record,
    images: [...(record.images || [])],
    namedPhotos: Object.fromEntries(Object.entries(record.namedPhotos || {}).map(([k, v]) => [k, [...(Array.isArray(v) ? v : [v])]])),
  };
  if (!record.images) delete out.images;
  if (!record.namedPhotos) delete out.namedPhotos;
  let restored = 0;
  for (const step of steps) {
    const item = await importInlineMedia(step.source);
    onStep();
    if (item.missing) continue;
    const list: MediaRef[] = step.slot === null ? out.images : out.namedPhotos[step.slot];
    list[step.index] = toMediaRef(item);
    restored++;
  }
  return { record: out as T, restored };
}

/** Lets the user pick a JSON file; resolves null if they cancel. */
function pickJsonFile(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/**
 * Home → "Restore Photos from Backup". Asks for a JSON export, restores every
 * unavailable photo the backup has, and reports what was restored and what is
 * still missing (with item names).
 */
export async function restorePhotosFromBackup(): Promise<void> {
  const file = await pickJsonFile();
  if (!file) return;

  let payload: any;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    showToast('Invalid file: not valid JSON', 'error');
    return;
  }
  if (payload?.appName !== 'blueprint' || typeof payload.data !== 'object') {
    showToast('Invalid file: not a Blueprint JSON export', 'error');
    return;
  }

  try {
    showExportProgress('Checking photos...', 'Restoring Photos');

    // Collect work: entity records first, then checklist items.
    type Job = { store: typeof ENTITY_STORES[number] | 'checklist', record: DbRecord, steps: RestoreStep[], missing: number };
    const jobs: Job[] = [];
    let totalMissing = 0;
    for (const store of ENTITY_STORES) {
      const backupById = new Map<string, any>((payload.data[store] || []).map((r: any) => [r.id, r]));
      for (const record of await getAll(store)) {
        const { map, count } = await findMissing(record);
        if (!count) continue;
        totalMissing += count;
        const backup = backupById.get(record.id as string);
        jobs.push({ store, record, steps: backup ? planMediaRestore(map, backup) : [], missing: count });
      }
    }
    const checklist: any[] = (await getSetting('checklistItems')) || [];
    const backupChecklist = new Map<string, any>(
      ((payload.data.settings || []).find((s: any) => s.id === 'checklistItems')?.value || []).map((c: any) => [c.id, c])
    );
    for (const item of checklist) {
      const { map, count } = await findMissing(item);
      if (!count) continue;
      totalMissing += count;
      const backup = backupChecklist.get(item.id);
      jobs.push({ store: 'checklist', record: item, steps: backup ? planMediaRestore(map, backup) : [], missing: count });
    }

    if (!totalMissing) {
      hideExportProgress();
      showToast('No unavailable photos found — nothing to restore.', 'success');
      return;
    }

    const totalSteps = jobs.reduce((n, j) => n + j.steps.length, 0);
    let done = 0;
    let restored = 0;
    const stillMissing: string[] = [];
    const updatedChecklist = [...checklist];
    for (const job of jobs) {
      const result = await applyRestore(job.record, job.steps, () => updateProgress(++done, totalSteps, 'Restoring photos...', 'photos'));
      restored += result.restored;
      if (result.restored < job.missing) stillMissing.push(String(job.record.name || job.record.label || job.record.id));
      if (!result.restored) continue;
      if (job.store === 'checklist') {
        updatedChecklist[updatedChecklist.indexOf(job.record)] = result.record;
      } else {
        await upsert(job.store, result.record);
      }
    }
    if (updatedChecklist.some((c, i) => c !== checklist[i])) await setSetting('checklistItems', updatedChecklist);

    hideExportProgress();
    await refreshAll();
    renderPage();
    const remaining = totalMissing - restored;
    showToast(remaining
      ? `Restored ${restored} photo(s); ${remaining} still unavailable (${stillMissing.slice(0, 5).join(', ')}${stillMissing.length > 5 ? '…' : ''}).`
      : `Restored all ${restored} unavailable photo(s).`, remaining ? 'error' : 'success');
  } catch (err) {
    hideExportProgress();
    console.error('Photo restore failed:', err);
    showToast('Photo restore failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
  }
}
