// IndexedDB layer for Plant Asset Manager
const DB_NAME = 'PlantAssetDB';
const DB_VERSION = 3;
const STORES = ['areas', 'panels', 'power', 'safety', 'networks', 'assets', 'settings', 'partsLibrary'];

let _db = null;

async function initDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      STORES.forEach(name => {
        if (!d.objectStoreNames.contains(name)) {
          d.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror    = ()  => reject(req.error);
    req.onblocked  = ()  => reject(new Error('IndexedDB blocked'));
  });
}

function tx(name, mode = 'readonly') {
  return _db.transaction(name, mode).objectStore(name);
}

async function getAll(name) {
  return new Promise((res, rej) => {
    const req = tx(name).getAll();
    req.onsuccess = () => res(req.result ?? []);
    req.onerror   = () => rej(req.error);
  });
}

async function getById(name, id) {
  return new Promise((res, rej) => {
    const req = tx(name).get(id);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = () => rej(req.error);
  });
}

async function upsert(name, item) {
  return new Promise((res, rej) => {
    if (!item.id)        item.id        = crypto.randomUUID();
    if (!item.createdAt) item.createdAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    const req = tx(name, 'readwrite').put(item);
    req.onsuccess = () => res(item);
    req.onerror   = () => rej(req.error);
  });
}

async function remove(name, id) {
  return new Promise((res, rej) => {
    const req = tx(name, 'readwrite').delete(id);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

async function clearStore(name) {
  return new Promise((res, rej) => {
    const req = tx(name, 'readwrite').clear();
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

async function getSetting(key) {
  const s = await getById('settings', key);
  return s?.value ?? null;
}

async function setSetting(key, value) {
  return new Promise((res, rej) => {
    const req = tx('settings', 'readwrite').put({ id: key, value });
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}
