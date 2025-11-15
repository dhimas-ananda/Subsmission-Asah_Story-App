const APP_SHELL = 'app-shell-v1';
const RUNTIME = 'runtime-v1';
const API_CACHE = 'api-v1';
const IMAGE_CACHE = 'images-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.bundle.js',
  '/manifest.json',
  '/assets/logo.png',
  '/assets/favicon.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(APP_SHELL).then(cache => cache.addAll(PRECACHE_URLS).catch(()=>{}))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => ![APP_SHELL, RUNTIME, IMAGE_CACHE, API_CACHE].includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  try {
    const url = new URL(req.url);
    if (url.origin === location.origin) {
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname.endsWith('.html'))) {
        event.respondWith(fetch(req).catch(()=>caches.match('/index.html')));
        return;
      }
      if (req.method === 'GET' && url.pathname.match(/\.(js|css|woff2|woff|ttf|eot)$/)) {
        event.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { caches.open(RUNTIME).then(c => c.put(req, res.clone())); return res; })));
        return;
      }
      if (req.method === 'GET' && url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif)$/)) {
        event.respondWith(caches.match(req).then(r => r || fetch(req).then(r2 => { caches.open(IMAGE_CACHE).then(c => c.put(req, r2.clone())); return r2; })));
        return;
      }
    }

    if (url.hostname && url.hostname.includes('story-api.dicoding.dev')) {
      if (req.method !== 'GET') {
        event.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ error: true, message: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
        return;
      }
      event.respondWith(fetch(req).then(res => {
        const clone = res.clone();
        caches.open(API_CACHE).then(c => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req) || new Response(JSON.stringify({ error: true, message: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
      return;
    }

    if (req.method === 'GET') {
      event.respondWith(caches.match(req).then(r => r || fetch(req).catch(()=>caches.match('/index.html'))));
      return;
    }

    event.respondWith(fetch(req));
  } catch (e) {
    event.respondWith(fetch(req).catch(()=>caches.match('/index.html')));
  }
});

async function openDB() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open('story-app-db', 1);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'cid', autoIncrement: true });
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

async function addOutbox(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    tx.objectStore('outbox').add(item);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllOutbox() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readonly');
    const req = tx.objectStore('outbox').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function deleteOutboxKey(cid) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    tx.objectStore('outbox').delete(cid);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'outbox-sync') event.waitUntil(flushOutbox());
});

async function flushOutbox() {
  const out = await getAllOutbox();
  for (const entry of out) {
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
      if (resp && resp.ok) await deleteOutboxKey(entry.cid);
    } catch (e) {
      return;
    }
  }
}

self.addEventListener('message', (evt) => {
  if (!evt.data) return;
  if (evt.data === 'flush-outbox') evt.waitUntil(flushOutbox());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Story App', options: { body: 'Ada story baru', icon: '/assets/icon-192.png', data: { url: '/' } } };
  try { payload = event.data.json(); } catch (e) {}
  const title = payload.title || 'Story App';
  const options = payload.options || { body: payload.body || 'Ada story baru', icon: payload.icon || '/assets/icon-192.png', data: payload.data || { url: '/' } };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    for (const w of windows) {
      if (w.url.includes(url)) { w.focus(); return; }
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
