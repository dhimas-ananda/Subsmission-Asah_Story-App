import { getOutbox, queueOutbox, deleteOutboxItem } from '../services/idb-service.js';

const API = 'https://story-api.dicoding.dev/v1';

export default class StoryModel {

  async fetchStories({ size = 100, location = 1 } = {}) {
    const token = localStorage.getItem('authToken') || '';

    try {
      const url = `${API}/stories?size=${size}&location=${location}`;
      const resp = await fetch(url, { 
        headers: token ? { Authorization: `Bearer ${token}` } : {} 
      });

      const data = await resp.json();

      if (!data.error && Array.isArray(data.listStory)) {
        return data.listStory;
      }

      return [];

    } catch (e) {
      console.error('Error fetching stories:', e);
      return [];
    }
  }

  async fetchStoryDetail(storyId) {
    const token = localStorage.getItem('authToken') || '';

    try {
      const url = `${API}/stories/${storyId}`;
      const resp = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      const data = await resp.json();

      if (!data.error && data.story) {
        return data.story;
      }

      throw new Error('Story not found');

    } catch (e) {
      console.error('Error fetching story detail:', e);
      throw e;
    }
  }

  async createStory(formData, token) {
    console.log('[StoryModel] 🚀 Creating story...');
    
    try {
      console.log('[StoryModel] 📡 Fetching API...');
      const resp = await fetch(`${API}/stories`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });

      console.log('[StoryModel] 📡 Response status:', resp.status);
      const data = await resp.json();
      
      console.log('[StoryModel] ✅ API response:', data);
      return data;

    } catch (e) {
      console.error('[StoryModel] ❌ Network error, queueing to outbox:', e.message);
      
      const fields = [];

      for (const pair of formData.entries()) {
        const [name, value] = pair;
        
        if (value instanceof File) {
          const ab = await value.arrayBuffer();
          let binary = '';
          const bytes = new Uint8Array(ab);
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          fields.push({ 
            name, 
            isFile: true, 
            filename: value.name, 
            type: value.type, 
            base64: btoa(binary) 
          });
        } else {
          fields.push({ 
            name, 
            isFile: false, 
            value: value 
          });
        }
      }

      console.log('[StoryModel] 💾 Saving to outbox...');
      
      await queueOutbox({ 
        url: `${API}/stories`, 
        method: 'POST', 
        fields 
      }, token || null);

      console.log('[StoryModel] ✅ Queued to outbox');

      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          if (reg.sync) {
            reg.sync.register('outbox-sync').catch(() => {});
          }
          try {
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage('flush-outbox');
            }
          } catch (e) {}
        }).catch(() => {});
      }

      return { 
        error: false, 
        message: 'Story tersimpan offline dan akan dikirim saat online',
        queued: true 
      };
    }
  }

  async flushOutbox() {
    console.log('[StoryModel] 📤 Flushing outbox...');
    const outbox = await getOutbox();
    console.log(`[StoryModel] 📦 Found ${outbox.length} entries`);

    for (const entry of outbox) {
      try {
        const fd = new FormData();

        for (const f of entry.fields) {
          if (f.isFile) {
            const bytes = atob(f.base64);
            const arr = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) {
              arr[i] = bytes.charCodeAt(i);
            }
            const blob = new Blob([arr], { type: f.type || 'image/png' });
            fd.append(f.name, blob, f.filename || 'photo.png');
          } else {
            fd.append(f.name, f.value);
          }
        }

        const headers = entry.token ? { Authorization: `Bearer ${entry.token}` } : {};

        console.log(`[StoryModel] 🔄 Syncing entry CID: ${entry.cid}`);
        const resp = await fetch(entry.url, { 
          method: entry.method, 
          body: fd, 
          headers 
        });

        if (resp && resp.ok) {
          await deleteOutboxItem(entry.cid);
          console.log(`[StoryModel] ✅ Synced CID: ${entry.cid}`);
        } else {
          console.error(`[StoryModel] ❌ Failed CID: ${entry.cid}, status: ${resp.status}`);
        }

      } catch (e) {
        console.error('[StoryModel] ❌ Error flushing entry:', e);
        break;
      }
    }
  }
}