// Knowledge-graph storage in IndexedDB.
// localStorage is limited to ~5 MB per site; a single big city (Rome: ~3 MB of statements)
// filled most of it, so saving a second city could fail without notice. IndexedDB allows
// hundreds of MB. Trips themselves stay in localStorage; only the statements move here.
const DB_NAME = 'travelscout';
const STORE = 'knowledge';

let dbPromise = null;
function openDb() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('IndexedDB not available'));
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result ?? null);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const loadKG = (tripId) => run('readonly', (s) => s.get(tripId)).catch(() => null);
export const saveKG = (tripId, kg) => run('readwrite', (s) => s.put(kg, tripId));
export const deleteKG = (tripId) => run('readwrite', (s) => s.delete(tripId)).catch(() => null);

/** Trip data as stored in localStorage: statements removed (they live in IndexedDB). */
export const stripKG = (data) => {
  const kg = data?.knowledgeGraph;
  if (!kg?.nodes?.length) return data;
  return { ...data, knowledgeGraph: { nodes: [], edges: [], lastUpdated: kg.lastUpdated || null, inIndexedDB: true, count: kg.nodes.length } };
};
