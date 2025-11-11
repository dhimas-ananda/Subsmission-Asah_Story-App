const API_BASE = 'https://story-api.dicoding.dev/v1';
const APP_SHELL = 'app-shell-v1';
const RUNTIME = 'runtime-v1';
const IMAGE = 'images-v1';
const OUTBOX_STORE = 'outbox';
const PRECACHE = ['/', '/index.html', '/app.bundle.js', '/styles.css', '/manifest.json'];
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(APP_SHELL).then(c => c.addAll(PRECACHE)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => ![APP_SHELL, RUNTIME, IMAGE].includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const urls = new URL(event.request.url);
  if (urls.hostname.includes('tile.openstreetmap.org') || urls.hostname.includes('a.tile.openstreetmap.org')) {
    event.respondWith(
      caches.open('osm-tiles').then(cache => cache.match(event.request).then(resp => resp || fetch(event.request).then(r => { cache.put(event.request, r.clone()); return r; })))
    );
    return;
  }
  if (req.method === 'GET') {
    if (req.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif)$/)) {
      event.respondWith(caches.open(IMAGE).then(cache => cache.match(req).then(r => r || fetch(req).then(res => { cache.put(req, res.clone()); return res; }))));
      return;
    }
    if (url.pathname.includes('/v1/stories') || url.pathname.includes('/stories')) {
      event.respondWith(fetch(req).then(res => { const clone = res.clone(); caches.open(RUNTIME).then(c => c.put(req, clone)); return res; }).catch(() => caches.match(req)));
      return;
    }
    event.respondWith(caches.match(req).then(r => r || fetch(req).catch(() => caches.match('/index.html'))));
    return;
  }
  if (req.method === 'POST' && url.pathname.endsWith('/stories')) {
    event.respondWith((async () => {
      try {
        const networkResp = await fetch(req.clone());
        return networkResp;
      } catch (err) {
        const fd = await req.clone().formData();
        const fields = [];
        for (const pair of fd.entries()) {
          const [name, value] = pair;
          if (value instanceof File) {
            const ab = await value.arrayBuffer();
            let binary = '';
            const bytes = new Uint8Array(ab);
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            fields.push({ kind: 'file', name, filename: value.name, type: value.type, data: btoa(binary) });
          } else {
            fields.push({ kind: 'field', name, value: value.toString() });
          }
        }
        const out = { url: req.url, method: req.method, formDataFields: fields, token: null, createdAt: Date.now() };
        await storeOutbox(out);
        if (self.registration.sync) {
          await self.registration.sync.register('outbox-sync');
        }
        return new Response(JSON.stringify({ error: false, message: 'queued-offline' }), { status: 202, headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }
});
function openDB() {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open('story-app-db', 1);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: 'cid', autoIncrement: true });
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
async function storeOutbox(value) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    tx.objectStore(OUTBOX_STORE).add(value);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}
async function getAllOutbox() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(OUTBOX_STORE, 'readonly');
    const req = tx.objectStore(OUTBOX_STORE).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
async function deleteOutboxKey(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    tx.objectStore(OUTBOX_STORE).delete(key);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}
self.addEventListener('sync', (event) => {
  if (event.tag === 'outbox-sync') {
    event.waitUntil(flushOutbox());
  }
});
async function flushOutbox() {
  const out = await getAllOutbox();
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
      const resp = await fetch(entry.url, { method: entry.method, body: fd, headers });
      if (resp && resp.ok) {
        await deleteOutboxKey(entry.cid);
      }
    } catch (e) {
      return;
    }
  }
}
self.addEventListener('message', (evt) => {
  if (!evt.data) return;
  if (evt.data === 'flush-outbox') {
    evt.waitUntil(flushOutbox());
  }
});
self.addEventListener('push', (event) => {
  let payload = { title: 'Story App', options: { body: 'Ada story baru', icon: '/icons/icon-192.png', url: '/' } };
  try { payload = event.data.json(); } catch (e) {}
  const options = payload.options || { body: payload.body || 'Ada story baru', icon: '/icons/icon-192.png', data: payload.url || '/' };
  event.waitUntil(self.registration.showNotification(payload.title || 'Story App', options));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    for (const w of windows) {
      if (w.url.includes(url)) {
        w.focus();
        return;
      }
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});

