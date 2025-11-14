const APP_SHELL_CACHE = 'story-app-shell-v1';
const RUNTIME_CACHE = 'story-app-runtime-v1';
const API_CACHE = 'story-app-api-v1';
const IMAGES_CACHE = 'story-app-images-v1';

const PRECACHE_FILES = [
  './',
  './index.html',
  '../styles/styles.css',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    await Promise.all(PRECACHE_FILES.map(async (req) => {
      try {
        const r = await fetch(req, { cache: 'no-store' });
        if (r && r.ok) {
          await cache.put(req, r.clone());
        } else {
          console.warn('precached resource failed, skipped:', req);
        }
      } catch (e) {
        console.warn('precached fetch error:', req, e && e.message);
      }
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (![APP_SHELL_CACHE, RUNTIME_CACHE, API_CACHE, IMAGES_CACHE].includes(k)) {
        return caches.delete(k);
      }
      return Promise.resolve();
    }));
    await self.clients.claim();
  })());
});

async function fetchAndCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const c = await caches.open(cacheName);
      c.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw e;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin === 'https://story-api.dicoding.dev') {
    if (req.method !== 'GET') {
      event.respondWith(fetch(req).catch(() => new Response(null, { status: 503 })));
      return;
    }
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(API_CACHE).then(cache => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    if (req.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/') {
      event.respondWith(
        caches.match(req).then((cached) => cached || fetch(req).then(r => { caches.open(RUNTIME_CACHE).then(c => c.put(req, r.clone())); return r; }).catch(() => caches.match('./index.html')))
      );
      return;
    }

    if (req.destination === 'script' || req.destination === 'style' || /\.(js|css|woff2?|ttf|eot)$/.test(url.pathname)) {
      event.respondWith(
        caches.match(req).then((cached) => cached || fetchAndCache(req, RUNTIME_CACHE))
      );
      return;
    }

    if (req.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
      event.respondWith(
        caches.match(req).then((cached) => cached || fetchAndCache(req, IMAGES_CACHE).catch(() => cached))
      );
      return;
    }
  }

  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'outbox-sync') {
    event.waitUntil((async () => {
      const clientsList = await clients.matchAll({ includeUncontrolled: true });
      clientsList.forEach(c => c.postMessage({ type: 'FLUSH_OUTBOX' }));
    })());
  }
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Story App', options: { body: 'Ada story baru', icon: './assets/icon-192.png', data: { url: '/' } } };
  try { payload = event.data.json(); } catch (e) {}
  const title = payload.title || 'Story App';
  const options = payload.options || {
    body: payload.body || 'Ada story baru',
    icon: payload.icon || './assets/icon-192.png',
    badge: payload.badge || './assets/icon-192.png',
    data: payload.data || { url: '/' },
    timestamp: Date.now()
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cList) => {
    for (const c of cList) {
      if (c.url.includes(url)) {
        return c.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
