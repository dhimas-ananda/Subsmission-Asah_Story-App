const APP_SHELL = 'app-shell-v1';
const API_CACHE = 'story-app-api-v1';
const RUNTIME = 'runtime-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(APP_SHELL).then((c) => c.addAll(['/','/index.html','/styles.css']).catch(()=>{}))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => ![APP_SHELL, RUNTIME, API_CACHE].includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  const url = new URL(req.url);
  if (req.method === 'GET') {
    if (url.origin === location.origin && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html'))) {
      evt.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { caches.open(RUNTIME).then(c => c.put(req, res.clone())); return res; })).catch(()=>caches.match('/index.html')));
      return;
    }
    if (url.origin.includes('story-api.dicoding.dev')) {
      evt.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(API_CACHE).then(cache=>cache.put(req, c)); } return r; }).catch(()=>caches.match(req)));
      return;
    }
    if (req.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif)$/)) {
      evt.respondWith(caches.open('images').then(cache => cache.match(req).then(r => r || fetch(req).then(res => { cache.put(req, res.clone()); return res; }))));
      return;
    }
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'Story App', body: 'Ada story baru', icon: '/assets/icon-192.png', data: { url: '/' } };
  try { if (event.data) data = event.data.json(); } catch (e) { try { data.body = event.data.text(); } catch(e){} }
  const options = {
    body: data.body || 'Ada story baru',
    icon: data.icon || '/assets/icon-192.png',
    badge: data.badge || '/assets/icon-64.png',
    data: data.data || { url: '/' },
    actions: data.actions || []
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Story App', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    for (const w of wins) {
      try {
        if (w.url.includes(url) && 'focus' in w) { return w.focus(); }
      } catch (e) {}
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
