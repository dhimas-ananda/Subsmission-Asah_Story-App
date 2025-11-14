import * as idb from '../idb.js';

export async function saveStoriesToIDB(stories = []) {
  for (const s of stories) {
    await idb.idbPut('stories', s);
  }
}

export async function getStoriesFromIDB() {
  return idb.idbGetAll('stories');
}

export async function clearStoriesIDB() {
  const db = await idb.openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('stories', 'readwrite');
    tx.objectStore('stories').clear();
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}

export async function queueOutbox(formDataObj, token) {
  await idb.idbAdd('outbox', { url: formDataObj.url, method: formDataObj.method || 'POST', fields: formDataObj.fields, token, createdAt: Date.now() });
}

export async function getOutbox() {
  return idb.idbGetAll('outbox');
}

export async function deleteOutboxKey(key) {
  return idb.idbDelete('outbox', key);
}
