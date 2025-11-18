import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

console.log('[SW] ✅ Workbox initialized');

const CACHE_VERSION = 'v1';

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: `pages-${CACHE_VERSION}`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  })
);

registerRoute(
  ({ request }) => 
    request.destination === 'script' || 
    request.destination === 'style',
  new CacheFirst({
    cacheName: `static-${CACHE_VERSION}`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

registerRoute(
  ({ url, request }) => {
    const isStoryAPI = url.origin.includes('story-api.dicoding.dev');
    const isGET = request.method === 'GET';
    return isStoryAPI && isGET; 
  },
  new StaleWhileRevalidate({
    cacheName: `api-${CACHE_VERSION}`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60,
      }),
    ],
  })
);

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: `images-${CACHE_VERSION}`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 24 * 60 * 60,
      }),
    ],
  })
);

registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: `fonts-${CACHE_VERSION}`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
    ],
  })
);

self.addEventListener('sync', (event) => {
  console.log('[SW] 🔄 Sync event:', event.tag);
  if (event.tag === 'outbox-sync') {
    event.waitUntil(flushOutboxFromSW());
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'flush-outbox') {
    console.log('[SW] 🔔 Message: flush-outbox');
    event.waitUntil(
      flushOutboxFromSW().then(result => {
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'flush-complete', result });
          });
        });
      })
    );
  }
});

async function flushOutboxFromSW() {
  console.log('[SW] 📤 Flushing outbox...');
  
  try {
    const db = await openOutboxDB();
    const tx = db.transaction('outbox', 'readonly');
    const store = tx.objectStore('outbox');
    const allEntries = await getAllFromStore(store);

    console.log('[SW] 📦 Outbox entries:', allEntries.length);

    if (allEntries.length === 0) {
      return { success: true, synced: 0 };
    }

    let successCount = 0;

    for (const entry of allEntries) {
      try {
        console.log('[SW] 🔄 Syncing CID:', entry.cid);
        
        if (!entry.formDataFields || !Array.isArray(entry.formDataFields)) {
          console.error('[SW] ❌ Invalid formDataFields for CID:', entry.cid);
          await deleteFromOutboxDB(entry.cid);
          continue;
        }

        const fd = new FormData();

        for (const f of entry.formDataFields) {
          if (!f || !f.name) continue;
          
          if (f.kind === 'file' && f.data) {
            const bytes = atob(f.data);
            const arr = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) {
              arr[i] = bytes.charCodeAt(i);
            }
            const blob = new Blob([arr], { type: f.type || 'image/jpeg' });
            fd.append(f.name, blob, f.filename || 'photo.jpg');
          } else if (f.kind === 'field') {
            fd.append(f.name, f.value || '');
          }
        }

        const headers = {};
        if (entry.token) {
          headers['Authorization'] = `Bearer ${entry.token}`;
        }

        console.log('[SW] 🚀 Posting to API...');
        const resp = await fetch('https://story-api.dicoding.dev/v1/stories', {
          method: 'POST',
          body: fd,
          headers
        });

        console.log('[SW] 📡 Response status:', resp.status);

        if (resp.ok) {
          await deleteFromOutboxDB(entry.cid);
          successCount++;
          console.log('[SW] ✅ Synced CID:', entry.cid);
        } else {
          const errorText = await resp.text();
          console.error('[SW] ❌ Failed CID:', entry.cid, resp.status, errorText);
        }

      } catch (err) {
        console.error('[SW] ❌ Error syncing:', err);
      }
    }

    if (successCount > 0) {
      self.registration.showNotification('Story Disinkronkan ✅', {
        body: `${successCount} story berhasil dikirim`,
        icon: '/assets/icon-192.png',
        tag: 'sync-success',
      });
    }

    return { success: true, synced: successCount };

  } catch (err) {
    console.error('[SW] ❌ Flush error:', err);
    return { success: false, synced: 0, error: err.message };
  }
}

function openOutboxDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('story-app-db', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'cid' });
      }
      if (!db.objectStoreNames.contains('bookmarked-stories')) {
        db.createObjectStore('bookmarked-stories', { keyPath: 'id' });
      }
    };
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteFromOutboxDB(cid) {
  const db = await openOutboxDB();
  const tx = db.transaction('outbox', 'readwrite');
  const store = tx.objectStore('outbox');
  return new Promise((resolve, reject) => {
    const request = store.delete(cid);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

self.addEventListener('push', (event) => {
  console.log('[SW] 🔔 Push received');
  
  let data = { 
    title: 'Story App', 
    body: 'Ada story baru', 
    icon: '/assets/icon-192.png', 
    data: { url: '/' } 
  };

  try { 
    if (event.data) {
      const parsed = event.data.json();
      if (parsed.title) data.title = parsed.title;
      if (parsed.options?.body) {
        data.body = parsed.options.body;
      } else if (parsed.body) {
        data.body = parsed.body;
      }
      if (parsed.options?.icon) data.icon = parsed.options.icon;
      if (parsed.data?.storyId) {
        data.data.url = `/#/story/${parsed.data.storyId}`;
      }
    }
  } catch (e) { 
    console.error('[SW] ❌ Parse push error:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: '/assets/icon-64.png',
    data: data.data,
    actions: [
      { action: 'open', title: 'Lihat Detail' },
      { action: 'close', title: 'Tutup' }
    ],
    tag: 'story-notification',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 🖱️ Notification clicked');
  event.notification.close();

  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(wins => {
      for (const w of wins) {
        if (w.url.includes(url)) return w.focus();
      }
      return clients.openWindow(url);
    })
  );
});