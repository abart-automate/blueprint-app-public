import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Export/import paths for photos, run against an in-memory stand-in for db.ts
 * (vitest's "node" environment has no IndexedDB). Covers the plan's matrix:
 * JSON export → import round trip, pre-v4 inline data (migration and old JSON
 * exports), ZIP/Excel export media handling, Excel import preserving refs, backup
 * restore planning, and orphan cleanup.
 *
 * Same `window = {}` stand-in as utils.test.ts / detail.test.ts: the operations/
 * export import graph assigns a few window.* globals at module load.
 * FileReader isn't in Node; the minimal stand-in below covers _blobToBase64().
 * Image decoding is unavailable here too, so stored items simply get no
 * thumbnail — the pipeline treats that as best-effort, exactly as on a device
 * that can't decode a format.
 */
(globalThis as any).window = (globalThis as any).window ?? {};
(globalThis as any).FileReader = class {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  readAsDataURL(blob: Blob) {
    blob.arrayBuffer().then(buf => {
      this.result = `data:${blob.type};base64,${btoa(String.fromCharCode(...new Uint8Array(buf)))}`;
      this.onload?.();
    }, err => this.onerror?.(err));
  }
};

/* ---- In-memory db.ts ---- */
const stores = new Map<string, Map<string, any>>();
const storeOf = (name: string) => {
  if (!stores.has(name)) stores.set(name, new Map());
  return stores.get(name)!;
};
vi.mock('./db.js', async importOriginal => {
  const actual = await importOriginal<typeof import('./db.js')>();
  return {
    ...actual,
    getAll: async (name: string) => [...storeOf(name).values()],
    getById: async (name: string, id: string) => storeOf(name).get(id) ?? null,
    getMany: async (name: string, ids: string[]) => ids.map(id => storeOf(name).get(id) ?? null),
    insert: async (name: string, item: any) => {
      if (storeOf(name).has(item.id)) throw new Error('ConstraintError');
      storeOf(name).set(item.id, item);
    },
    putRaw: async (name: string, item: any) => { storeOf(name).set(item.id, item); },
    upsert: async (name: string, item: any) => {
      item.id ??= crypto.randomUUID();
      item.updatedAt = 'now';
      storeOf(name).set(item.id, item);
      return item;
    },
    removeMany: async (name: string, ids: string[]) => { ids.forEach(id => storeOf(name).delete(id)); },
    clearStore: async (name: string) => { storeOf(name).clear(); },
    getSetting: async (key: string) => storeOf('settings').get(key)?.value ?? null,
    setSetting: async (key: string, value: any) => { storeOf('settings').set(key, { id: key, value }); },
  };
});

const media = await import('./media.js');
const { _serializeEntityMedia, _deserializeEntityMedia } = await import('./operations.js');
const { estimateMediaBytes, getDefaultHeaders, getExportHeaders, _exportMedia } = await import('./export.js');
const { mergeUpsert } = await import('./import.js');
const { migrateInlineMedia, collectOrphanMedia, findOrphanMediaIds, ORPHAN_GRACE_MS } = await import('./media-migration.js');
const { planMediaRestore } = await import('./media-restore.js');

const jpeg = (text: string) => new Blob([text], { type: 'image/jpeg' });
const stored = (text: string, mimeType = 'image/jpeg') =>
  media.saveNewMedia({ blob: new Blob([text], { type: mimeType }), mimeType, width: 4, height: 3 });

beforeEach(() => stores.clear());

describe('media store basics', () => {
  it('saveNewMedia inserts an insert-only row and loadMedia resolves it', async () => {
    const item = await stored('photo-bytes');
    expect(storeOf('media').size).toBe(1);
    const [loaded] = await media.loadMedia([media.toMediaRef(item)]);
    expect(await loaded.blob!.text()).toBe('photo-bytes');
    expect(loaded.missing).toBeFalsy();
  });

  it('loadMedia preserves order/count and flags missing rows and damaged refs', async () => {
    const ok = media.toMediaRef(await stored('a'));
    const gone = { mediaId: 'no-such-row', mimeType: 'image/jpeg' };
    const damaged = { mediaId: 'x', mimeType: 'image/jpeg', damaged: true as const };
    const items = await media.loadMedia([ok, gone, damaged]);
    expect(items.map(i => Boolean(i.missing))).toEqual([false, true, true]);
  });
});

describe('JSON export → import round trip', () => {
  it('keeps slot names, order, bytes and MIME types', async () => {
    const a = await stored('gallery-1');
    const b = await stored('nameplate-1');
    const v = await stored('video-1', 'video/mp4');
    const record = { id: 'r1', name: 'Pump', images: media.toMediaRefs([a, v]), namedPhotos: { Nameplate: media.toMediaRefs([b]) } };

    const stats = { missing: 0 };
    const exported = await _serializeEntityMedia(record, stats);
    expect(stats.missing).toBe(0);
    // Same file format as before the media store: base64 data URLs.
    expect(exported.images.every((x: unknown) => typeof x === 'string' && x.startsWith('data:'))).toBe(true);

    stores.clear(); // import into an empty database (Replace All)
    const imported = await _deserializeEntityMedia(JSON.parse(JSON.stringify(exported)));
    const { images, slots } = await media.loadEntityMedia(imported);
    expect(await Promise.all(images.map(i => i.blob!.text()))).toEqual(['gallery-1', 'video-1']);
    expect(images.map(i => i.mimeType)).toEqual(['image/jpeg', 'video/mp4']);
    expect(slots[0][0]).toBe('Nameplate');
    expect(await slots[0][1][0].blob!.text()).toBe('nameplate-1');
    // Records hold refs only.
    expect(imported.images.every(media.isMediaRef)).toBe(true);
  });

  it('leaves out unavailable photos and counts them', async () => {
    const record = { id: 'r1', images: [{ mediaId: 'gone', mimeType: 'image/jpeg', damaged: true }] };
    const stats = { missing: 0 };
    const exported = await _serializeEntityMedia(record, stats);
    expect(exported.images).toEqual([]);
    expect(stats.missing).toBe(1);
  });

  it('imports a JSON export made before the media store (inline base64)', async () => {
    const legacy = { id: 'r2', images: ['data:image/png;base64,' + btoa('old-png')] };
    const imported = await _deserializeEntityMedia(legacy);
    const [item] = await media.loadMedia(imported.images);
    expect(await item.blob!.text()).toBe('old-png');
    expect(item.mimeType).toBe('image/png');
  });

  it('stores unreadable photo data as a damaged ref instead of dropping it', async () => {
    const imported = await _deserializeEntityMedia({ id: 'r3', images: ['data:image/jpeg;base64,'] });
    expect(imported.images).toHaveLength(1);
    expect(imported.images[0].damaged).toBe(true);
  });
});

describe('migration of pre-v4 inline media', () => {
  it('moves inline Blobs and base64 into media rows, keeping timestamps', async () => {
    storeOf('assets').set('a1', {
      id: 'a1', updatedAt: 'yesterday',
      images: [{ blob: jpeg('inline-1'), mimeType: 'image/jpeg' }],
      namedPhotos: { Nameplate: 'data:image/jpeg;base64,' + btoa('b64-1') },
    });
    storeOf('assets').set('a2', { id: 'a2', images: [{ blob: new Blob([]), mimeType: 'image/jpeg' }] });

    const progress: number[] = [];
    const result = await migrateInlineMedia(p => progress.push(p.done));
    expect(result).toEqual({ migrated: 3, damaged: 1 });
    expect(progress.at(-1)).toBe(3);

    const a1 = storeOf('assets').get('a1');
    expect(a1.updatedAt).toBe('yesterday');
    expect(media.hasInlineMedia(a1)).toBe(false);
    const { images, slots } = await media.loadEntityMedia(a1);
    expect(await images[0].blob!.text()).toBe('inline-1');
    expect(await slots[0][1][0].blob!.text()).toBe('b64-1');
    expect(storeOf('assets').get('a2').images[0].damaged).toBe(true);

    // Idempotent: a second run finds nothing to do.
    expect(await migrateInlineMedia(() => {})).toEqual({ migrated: 0, damaged: 0 });
  });

  it('migrates checklist item media in the settings store', async () => {
    storeOf('settings').set('checklistItems', { id: 'checklistItems', value: [{ id: 'c1', label: 'Walkdown', images: [{ blob: jpeg('cl'), mimeType: 'image/jpeg' }] }] });
    await migrateInlineMedia(() => {});
    const [item] = storeOf('settings').get('checklistItems').value;
    expect(media.isMediaRef(item.images[0])).toBe(true);
  });
});

describe('ZIP / Excel export', () => {
  it('_exportMedia writes original bytes with correct names/extensions and reports gaps', async () => {
    const png = await media.saveNewMedia({ blob: new Blob(['png'], { type: 'image/png' }), mimeType: 'image/png' });
    const mov = await stored('mov', 'video/quicktime');
    const files: Record<string, Blob> = {};
    const folder = { file: (name: string, blob: Blob) => { files[name] = blob; } };
    const missing = await _exportMedia({
      images: media.toMediaRefs([png, mov]),
      namedPhotos: { 'Name/plate': [media.toMediaRef(await stored('np')), { mediaId: 'gone', mimeType: 'image/jpeg' }] },
    }, folder);
    expect(Object.keys(files).sort()).toEqual(['1.png', '2.mov', 'Name_plate-1.jpg']);
    expect(await files['1.png'].text()).toBe('png');
    expect(missing).toBe(1);
  });

  it('estimates ZIP size from ref sizes without loading media', () => {
    expect(estimateMediaBytes([
      { images: [{ mediaId: 'a', mimeType: 'image/jpeg', size: 1000 }, { mediaId: 'b', mimeType: 'image/jpeg', size: 5, damaged: true }] },
    ])).toBe(1000);
  });

  it('Excel sheets never get media columns, with refs or legacy data', () => {
    const items = [{ id: '1', name: 'Pump', images: [{ mediaId: 'a', mimeType: 'image/jpeg' }], namedPhotos: { X: [] } }];
    expect(getExportHeaders(items as any, 'assets')).not.toContain('images');
    expect(getExportHeaders(items as any, 'assets')).not.toContain('namedPhotos');
    expect(getDefaultHeaders('assets')).not.toContain('images');
  });
});

describe('Excel import', () => {
  it('mergeUpsert keeps the record’s photo refs untouched', async () => {
    const refs = media.toMediaRefs([await stored('keep-me')]);
    storeOf('assets').set('a1', { id: 'a1', name: 'Old', images: refs, namedPhotos: { Nameplate: refs } });
    const stats = { added: 0, updated: 0, errors: 0 } as any;
    await mergeUpsert('assets', { id: 'a1', name: 'New name' }, new Set(['a1']), stats);
    const saved = storeOf('assets').get('a1');
    expect(saved.name).toBe('New name');
    expect(saved.images).toEqual(refs);
    expect(saved.namedPhotos).toEqual({ Nameplate: refs });
  });
});

describe('restore from backup', () => {
  it('pairs each missing photo with the backup photo at the same position', () => {
    const steps = planMediaRestore(
      { images: [false, true], slots: { Nameplate: [true], Other: [true] } },
      { images: ['data:image/jpeg;base64,AA', 'data:image/jpeg;base64,BB'], namedPhotos: { Nameplate: ['data:image/jpeg;base64,CC'] } },
    );
    expect(steps).toEqual([
      { slot: null, index: 1, source: 'data:image/jpeg;base64,BB' },
      { slot: 'Nameplate', index: 0, source: 'data:image/jpeg;base64,CC' },
    ]);
  });

  it('ignores backups without data at that position', () => {
    expect(planMediaRestore({ images: [true], slots: {} }, { images: [] })).toEqual([]);
  });
});

describe('orphan media cleanup', () => {
  it('findOrphanMediaIds keeps referenced and recent rows', () => {
    const now = Date.parse('2026-10-03T12:00:00Z');
    const old = new Date(now - ORPHAN_GRACE_MS - 1).toISOString();
    const recent = new Date(now - 1000).toISOString();
    const rows = [{ id: 'ref', createdAt: old }, { id: 'orphan', createdAt: old }, { id: 'fresh', createdAt: recent }];
    expect(findOrphanMediaIds(rows, new Set(['ref']), now)).toEqual(['orphan']);
  });

  it('collectOrphanMedia deletes only unreferenced old rows', async () => {
    const kept = await stored('kept');
    const orphan = await stored('orphan');
    storeOf('media').get(kept.mediaId).createdAt = '2000-01-01T00:00:00Z';
    storeOf('media').get(orphan.mediaId).createdAt = '2000-01-01T00:00:00Z';
    storeOf('assets').set('a1', { id: 'a1', images: [media.toMediaRef(kept)] });
    expect(await collectOrphanMedia()).toBe(1);
    expect(storeOf('media').has(kept.mediaId)).toBe(true);
    expect(storeOf('media').has(orphan.mediaId)).toBe(false);
  });
});
