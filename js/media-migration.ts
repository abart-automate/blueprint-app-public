import type { DbRecord } from './db.js';
import type { MediaFields, MediaRow, StoredMediaEntry } from './media.js';

import { ENTITY_STORES, getAll, getSetting, putRaw, removeMany, setSetting } from './db.js';
import { classifyMediaEntry, collectMediaIds, countInlineEntries, hasInlineMedia, importInlineMedia, mapEntityMediaAsync, toMediaRef } from './media.js';
/* ============================================================
   MEDIA STORAGE MIGRATION + MAINTENANCE
   Runs from init() before the first render:
     1. migrateInlineMedia() — moves pre-v4 photo bytes embedded in
        records (Blobs or base64 strings) into the insert-only `media`
        store, leaving MediaRef pointers behind. See media.ts's header
        for why bytes must not live inside records on iOS/WebKit.
     2. collectOrphanMedia() — deletes `media` rows nothing points at.
   Both are idempotent and safe to interrupt: a record counts as
   migrated once it holds no inline media, so an interrupted run just
   resumes next launch.
   ============================================================ */

/** Rows younger than this are never treated as orphans: they may belong to an unsaved form / Quick Add in another tab. */
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

export interface MigrationProgress { done: number, total: number }
export interface MigrationResult { migrated: number, damaged: number }

/**
 * Converts every inline entry on a record into a stored media row + ref; existing
 * refs pass through and unrecognisable entries are dropped. Returns the rewritten
 * record (not yet saved) and how many entries turned out damaged.
 */
async function migrateRecord<T extends Record<string, any>>(record: T, onEntry: () => void): Promise<{ record: T, damaged: number }> {
  let damaged = 0;
  const out = await mapEntityMediaAsync(record, async (entry: StoredMediaEntry) => {
    const kind = classifyMediaEntry(entry);
    if (kind === 'ref') return entry;
    if (kind === 'invalid') return null;
    const item = await importInlineMedia(entry as Exclude<StoredMediaEntry, { mediaId: string }>);
    if (item.missing) damaged++;
    onEntry();
    return toMediaRef(item);
  });
  return { record: out, damaged };
}

/**
 * Moves all inline media into the `media` store. Each record's bytes are read and
 * stored as rows BEFORE the record itself is rewritten, and the rewrite keeps the
 * record's timestamps (putRaw) — migration is not a user edit.
 * Resolves immediately (no progress callbacks) when nothing needs migrating.
 */
export async function migrateInlineMedia(onProgress: (p: MigrationProgress) => void): Promise<MigrationResult> {
  const pending: Array<{ store: typeof ENTITY_STORES[number], record: DbRecord }> = [];
  for (const store of ENTITY_STORES) {
    for (const record of await getAll(store)) {
      if (hasInlineMedia(record)) pending.push({ store, record });
    }
  }
  const checklist: any[] = (await getSetting('checklistItems')) || [];
  const checklistNeedsMigration = checklist.some(hasInlineMedia);

  const total = pending.reduce((n, p) => n + countInlineEntries(p.record), 0)
    + (checklistNeedsMigration ? checklist.reduce((n: number, c: any) => n + countInlineEntries(c), 0) : 0);
  const result: MigrationResult = { migrated: 0, damaged: 0 };
  if (!total) return result;

  let done = 0;
  const tick = () => { done++; result.migrated++; onProgress({ done, total }); };
  onProgress({ done, total });

  for (const { store, record } of pending) {
    const { record: migrated, damaged } = await migrateRecord(record, tick);
    result.damaged += damaged;
    await putRaw(store, migrated);
  }
  if (checklistNeedsMigration) {
    const migratedItems = [];
    for (const item of checklist) {
      const { record: migrated, damaged } = await migrateRecord(item, tick);
      result.damaged += damaged;
      migratedItems.push(migrated);
    }
    await setSetting('checklistItems', migratedItems);
  }
  return result;
}

/**
 * Pure: ids of `media` rows that no record references and that are older than the
 * grace period (rows without a parsable createdAt count as old).
 */
export function findOrphanMediaIds(rows: Pick<MediaRow, 'id' | 'createdAt'>[], referenced: ReadonlySet<string>, now: number): string[] {
  return rows
    .filter(r => !referenced.has(r.id))
    .filter(r => !(now - Date.parse(r.createdAt) < ORPHAN_GRACE_MS))
    .map(r => r.id);
}

/** Every mediaId referenced by any record or checklist item. */
export async function collectReferencedMediaIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const store of ENTITY_STORES) {
    for (const record of await getAll(store)) collectMediaIds(record).forEach(id => ids.add(id));
  }
  for (const item of ((await getSetting('checklistItems')) || []) as MediaFields[]) {
    collectMediaIds(item).forEach(id => ids.add(id));
  }
  return ids;
}

/**
 * Deletes `media` rows nothing points at — photos removed from a record, records
 * deleted, forms cancelled after a capture. Media rows are never deleted at the
 * moment of removal (a row may still be on screen, and insert/delete-only rows
 * keep every loaded Blob valid); this sweep reclaims the space instead.
 * Returns the number of rows deleted.
 */
export async function collectOrphanMedia(): Promise<number> {
  const referenced = await collectReferencedMediaIds();
  const rows = (await getAll('media')) as MediaRow[];
  const orphans = findOrphanMediaIds(rows, referenced, Date.now());
  await removeMany('media', orphans);
  return orphans.length;
}
