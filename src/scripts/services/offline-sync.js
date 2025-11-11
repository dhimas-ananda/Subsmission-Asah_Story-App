import { idbAdd, idbGetAll, idbDelete } from '../lib/idb.js';
const API_BASE = 'https://story-api.dicoding.dev/v1';
function b64FromArrayBuffer(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
export async function queueStoryForSync(formData, token) {
  const formDataFields = [];
  for (const pair of formData.entries()) {
    const [name, value] = pair;
    if (value instanceof File) {
      const arrayBuffer = await value.arrayBuffer();
      formDataFields.push({
        kind: 'file',
        name,
        filename: value.name,
        type: value.type,
        data: b64FromArrayBuffer(arrayBuffer)
      });
    } else {
      formDataFields.push({
        kind: 'field',
        name,
        value: value.toString()
      });
    }
  }
  const outEntry = { formDataFields, token: token || null, createdAt: Date.now() };
  await idbAdd('outbox', outEntry);
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    try {
      await reg.sync.register('outbox-sync');
      return { queued: true, syncRegistered: true };
    } catch (e) {
      if (reg.active) reg.active.postMessage('flush-outbox');
      return { queued: true, syncRegistered: false };
    }
  } else {
    if (navigator.onLine) {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active) reg.active.postMessage('flush-outbox');
    }
    return { queued: true, syncRegistered: false };
  }
}
export async function flushOutboxFromClient() {
  const out = await idbGetAll('outbox');
  for (const entry of out) {
    try {
      const fd = new FormData();
      for (const f of entry.formDataFields) {
        if (f.kind === 'file') {
          const bytes = atob(f.data);
          const arr = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
          const blob = new Blob([arr], { type: f.type || 'image/png' });
          fd.append(f.name, blob, f.filename || 'photo.png');
        } else {
          fd.append(f.name, f.value);
        }
      }
      const headers = entry.token ? { Authorization: `Bearer ${entry.token}` } : {};
      const resp = await fetch(`${API_BASE}/stories`, { method: 'POST', body: fd, headers });
      if (resp && resp.ok) {
        await idbDelete('outbox', entry.cid);
      }
    } catch (e) {
      console.error(e);
    }
  }
}
