import { idbAdd } from '../lib/idb.js';

export async function queueStoryForSync(formData, token) {
    const fields = [];
    for (const pair of formData.entries()) {
        const [name, value] = pair;
        if (value instanceof File) {
        const file = value;
        const data = await file.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(data)));
        fields.push({
            kind: 'file',
            name,
            filename: file.name,
            type: file.type,
            data: b64
        });
        } else {
        fields.push({ kind: 'field', name, value });
        }
    }
    const outEntry = { formDataFields: fields, token: token || null, createdAt: Date.now() };
    await idbAdd('outbox', outEntry);

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const reg = await navigator.serviceWorker.ready;
        try {
        await reg.sync.register('sync-outbox');
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
