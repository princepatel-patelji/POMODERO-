/* Minimal promise wrapper over IndexedDB — the app's durable store. */
const NAME = 'focusflow-db', VER = 1;
const STORES = ['subjects', 'tasks', 'sessions', 'kv'];
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB is not available. Use a non-private browser window.'));
    const req = indexedDB.open(NAME, VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === 'kv' ? 'key' : 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
    req.onblocked = () => reject(new Error('IndexedDB open was blocked by another tab.'));
  });
  return dbp;
}

const op = (store, fn, mode = 'readwrite') => (db, ...args) => new Promise((res, rej) => {
  const r = fn(db.transaction(store, mode).objectStore(store), ...args);
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error || new Error('IndexedDB operation failed'));
});

export async function put(store, val) { const db = await open(); return op(store, (os, v) => os.put(v))(db, val); }
export async function get(store, key) { const db = await open(); return op(store, (os, k) => os.get(k), 'readonly')(db, key); }
export async function getAll(store) { const db = await open(); return op(store, os => os.getAll(), 'readonly')(db); }
export async function del(store, key) { const db = await open(); return op(store, (os, k) => os.delete(k))(db, key); }
export async function clear(store) { const db = await open(); return op(store, os => os.clear())(db); }
export async function bulkPut(store, arr) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    for (const v of arr) tx.objectStore(store).put(v);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error || new Error('Bulk write failed'));
  });
}