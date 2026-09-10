// IndexedDB layer for Plant Asset Manager
export const DB_NAME = 'PlantAssetDB';
export const DB_VERSION = 3;
export const STORES = ['areas', 'panels', 'power', 'safety', 'networks', 'assets', 'settings', 'partsLibrary'] as const;

export type StoreName = typeof STORES[number];

/**
 * A stored record. Every store's records are plain objects keyed by `id`
 * (IndexedDB keyPath); beyond that, shape varies per store — see
 * entity-config.js for the field definitions that give each store's records
 * their actual (still runtime-untyped) shape. `any` here is an honest
 * placeholder for "whatever entity-config.js says this store holds", not a
 * shortcut — replacing it is exactly the entity-config.ts work described in
 * the TypeScript migration plan.
 */
export type DbRecord = Record<string, any> & { id?: string, createdAt?: string, updatedAt?: string };

export let _db: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = (e.target as IDBOpenDBRequest).result;
      STORES.forEach(name => {
        if (!d.objectStoreNames.contains(name)) {
          d.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess  = (e) => { _db = (e.target as IDBOpenDBRequest).result; resolve(_db); };
    req.onerror    = ()  => reject(req.error);
    req.onblocked  = ()  => reject(new Error('IndexedDB blocked'));
  });
}

export function tx(name: StoreName, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
  return (_db as IDBDatabase).transaction(name, mode).objectStore(name);
}

export async function getAll(name: StoreName): Promise<DbRecord[]> {
  return new Promise((res, rej) => {
    const req = tx(name).getAll();
    req.onsuccess = () => res(req.result ?? []);
    req.onerror   = () => rej(req.error);
  });
}

export async function getById(name: StoreName, id: string): Promise<DbRecord | null> {
  return new Promise((res, rej) => {
    const req = tx(name).get(id);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = () => rej(req.error);
  });
}

/**
 * Inserts or replaces a record. Auto-assigns `id` (if missing) and
 * `createdAt`/`updatedAt` timestamps; mutates and returns the same object.
 */
export async function upsert(name: StoreName, item: DbRecord): Promise<DbRecord> {
  return new Promise((res, rej) => {
    if (!item.id)        item.id        = crypto.randomUUID();
    if (!item.createdAt) item.createdAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    const req = tx(name, 'readwrite').put(item);
    req.onsuccess = () => res(item);
    req.onerror   = () => rej(req.error);
  });
}

export async function remove(name: StoreName, id: string): Promise<void> {
  return new Promise((res, rej) => {
    const req = tx(name, 'readwrite').delete(id);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

export async function clearStore(name: StoreName): Promise<void> {
  return new Promise((res, rej) => {
    const req = tx(name, 'readwrite').clear();
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

export async function getSetting(key: string): Promise<any> {
  const s = await getById('settings', key);
  return s?.value ?? null;
}

export async function setSetting(key: string, value: any): Promise<void> {
  return new Promise((res, rej) => {
    const req = tx('settings', 'readwrite').put({ id: key, value });
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}
