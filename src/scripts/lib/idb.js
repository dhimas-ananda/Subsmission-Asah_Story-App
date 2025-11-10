const DB_NAME = 'story-app-db';
const DB_VER = 1;
export function openDatabase() {
    return new Promise((resolve, reject) => {
        const r = indexedDB.open(DB_NAME, DB_VER);
        r.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('stories')) db.createObjectStore('stories', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'cid', autoIncrement: true });
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
}
export async function idbAdd(store, value) {
    const db = await openDatabase();
    return new Promise((res, rej) => {
        const tx = db.transaction(store, 'readwrite');
        const req = tx.objectStore(store).add(value);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });
}
export async function idbPut(store, value) {
    const db = await openDatabase();
    return new Promise((res, rej) => {
        const tx = db.transaction(store, 'readwrite');
        const req = tx.objectStore(store).put(value);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });
}
export async function idbGetAll(store) {
    const db = await openDatabase();
    return new Promise((res, rej) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => rej(req.error);
    });
}
export async function idbDelete(store, key) {
    const db = await openDatabase();
    return new Promise((res, rej) => {
        const tx = db.transaction(store, 'readwrite');
        const req = tx.objectStore(store).delete(key);
        req.onsuccess = () => res(true);
        req.onerror = () => rej(req.error);
    });
}
