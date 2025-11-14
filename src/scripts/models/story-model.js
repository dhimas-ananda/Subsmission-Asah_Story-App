import { saveStoriesToIDB, getOutbox, queueOutbox, deleteOutboxKey } from '../services/idb-service.js';
const API = 'https://story-api.dicoding.dev/v1';

export default class StoryModel {
  async fetchStories({ size = 100, location = 1 } = {}) {
    const token = localStorage.getItem('authToken') || '';
    try {
      const url = `${API}/stories?size=${size}&location=${location}`;
      const resp = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await resp.json();
      if (!data.error && Array.isArray(data.listStory)) {
        await saveStoriesToIDB(data.listStory);
        return data.listStory;
      }
      return await import('../services/idb-service.js').then(m => m.getStoriesFromIDB()).catch(() => []);
    } catch (e) {
      return await import('../services/idb-service.js').then(m => m.getStoriesFromIDB()).catch(() => []);
    }
  }

  async createStory(formData, token) {
    try {
      const resp = await fetch(`${API}/stories`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      const data = await resp.json();
      return data;
    } catch (e) {
      const fields = [];
      for (const pair of formData.entries()) {
        const [name, value] = pair;
        if (value instanceof File) {
          const ab = await value.arrayBuffer();
          let binary = '';
          const bytes = new Uint8Array(ab);
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          fields.push({ name, isFile: true, filename: value.name, type: value.type, base64: btoa(binary) });
        } else {
          fields.push({ name, isFile: false, value: value });
        }
      }
      await queueOutbox({ url: `${API}/stories/guest`, method: 'POST', fields }, token || null);
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          if (reg.sync) reg.sync.register('outbox-sync').catch(()=>{});
          try { if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage('flush-outbox'); } catch(e) {}
        }).catch(()=>{});
      }
      return { error: false, message: 'queued-offline' };
    }
  }

  async flushOutbox() {
    const { default: idbService } = await import('../services/idb-service.js');
    const outbox = await idbService.getOutbox();
    for (const entry of outbox) {
      try {
        const fd = new FormData();
        for (const f of entry.fields) {
          if (f.isFile) {
            const bytes = atob(f.base64);
            const arr = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
            const blob = new Blob([arr], { type: f.type || 'image/png' });
            fd.append(f.name, blob, f.filename || 'photo.png');
          } else {
            fd.append(f.name, f.value);
          }
        }
        const headers = entry.token ? { Authorization: `Bearer ${entry.token}` } : {};
        const resp = await fetch(entry.url, { method: entry.method, body: fd, headers });
        if (resp && resp.ok) {
          await idbService.deleteOutboxKey(entry.cid);
        }
      } catch (e) {
        break;
      }
    }
  }
}
