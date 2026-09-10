// @ts-check
// IndexedDB layer for Plant Asset Manager
export const DB_NAME = 'PlantAssetDB';
export const DB_VERSION = 3;
export const STORES = /** @type {const} */ (['areas', 'panels', 'power', 'safety', 'networks', 'assets', 'settings', 'partsLibrary']);

/** @typedef {typeof STORES[number]} StoreName */

/**
 * A stored record. Every store's records are plain objects keyed by `id`
 * (IndexedDB keyPath); beyond that, shape varies per store — see
 * entity-config.js for the field definitions that give each store's records
 * their actual (still runtime-untyped) shape. `any` here is an honest
 * placeholder for "whatever entity-config.js says this store holds", not a
 * shortcut — replacing it is exactly the entity-config.ts work described in
 * the TypeScript migration plan.
 * @typedef {Record<string, any> & { id?: string, createdAt?: string, updatedAt?: string }} DbRecord
 */

/** @type {IDBDatabase | null} */
export let _db = null;

/** @returns {Promise<IDBDatabase>} */
export async function initDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = /** @type {IDBOpenDBRequest} */ (e.target).result;
      STORES.forEach(name => {
        if (!d.objectStoreNames.contains(name)) {
          d.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess  = (e) => { _db = /** @type {IDBOpenDBRequest} */ (e.target).result; resolve(_db); };
    req.onerror    = ()  => reject(req.error);
    req.onblocked  = ()  => reject(new Error('IndexedDB blocked'));
  });
}

/**
 * @param {StoreName} name
 * @param {IDBTransactionMode} [mode]
 * @returns {IDBObjectStore}
 */
export function tx(name, mode = 'readonly') {
  return /** @type {IDBDatabase} */ (_db).transaction(name, mode).objectStore(name);
}

/**
 * @param {StoreName} name
 * @returns {Promise<DbRecord[]>}
 */
export async function getAll(name) {
  return new Promise((res, rej) => {
    const req = tx(name).getAll();
    req.onsuccess = () => res(req.result ?? []);
    req.onerror   = () => rej(req.error);
  });
}

/**
 * @param {StoreName} name
 * @param {string} id
 * @returns {Promise<DbRecord | null>}
 */
export async function getById(name, id) {
  return new Promise((res, rej) => {
    const req = tx(name).get(id);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = () => rej(req.error);
  });
}

/**
 * Inserts or replaces a record. Auto-assigns `id` (if missing) and
 * `createdAt`/`updatedAt` timestamps; mutates and returns the same object.
 * @param {StoreName} name
 * @param {DbRecord} item
 * @returns {Promise<DbRecord>}
 */
export async function upsert(name, item) {
  return new Promise((res, rej) => {
    if (!item.id)        item.id        = crypto.randomUUID();
    if (!item.createdAt) item.createdAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    const req = tx(name, 'readwrite').put(item);
    req.onsuccess = () => res(item);
    req.onerror   = () => rej(req.error);
  });
}

/**
 * @param {StoreName} name
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function remove(name, id) {
  return new Promise((res, rej) => {
    const req = tx(name, 'readwrite').delete(id);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

/**
 * @param {StoreName} name
 * @returns {Promise<void>}
 */
export async function clearStore(name) {
  return new Promise((res, rej) => {
    const req = tx(name, 'readwrite').clear();
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

/**
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function getSetting(key) {
  const s = await getById('settings', key);
  return s?.value ?? null;
}

/**
 * @param {string} key
 * @param {any} value
 * @returns {Promise<void>}
 */
export async function setSetting(key, value) {
  return new Promise((res, rej) => {
    const req = tx('settings', 'readwrite').put({ id: key, value });
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}
