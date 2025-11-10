const IDB_DB = 'story-app-db';
const IDB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_DB, IDB_VERSION);
        req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('stories')) db.createObjectStore('stories', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'cid', autoIncrement: true });
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}
async function idbPut(storeName, value) {
    const db = await openDB();
    return new Promise((res, rej) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(value);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
    });
}
async function idbGetAll(storeName) {
    const db = await openDB();
    return new Promise((res, rej) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => rej(req.error);
    });
}
async function idbDelete(storeName, key) {
    const db = await openDB();
    return new Promise((res, rej) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
    });
}

const CACHE_VERSION = 'v1';
const PRECACHE = `app-shell-${CACHE_VERSION}`;
const RUNTIME = `runtime-${CACHE_VERSION}`;
const PRECACHE_URLS = [
    '/', '/index.html', '/manifest.json',
    '/assets/logo.png', '/assets/favicon.png'
];

const API_BASE = 'https://story-api.dicoding.dev/v1';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => ![PRECACHE, RUNTIME].includes(k)).map(k => caches.delete(k)));
        await clients.claim();
        })()
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    if (req.method !== 'GET') {
        return;
    }

    if (url.origin === new URL(API_BASE).origin && url.pathname.startsWith('/v1/stories')) {
        event.respondWith((async () => {
        try {
            const networkResponse = await fetch(req);
            if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            const json = await clone.json().catch(()=>null);
            if (json && (json.listStory || json.list)) {
                const stories = json.listStory || json.list || [];
                for (const s of stories) {
                try { await idbPut('stories', s); } catch(e){}
                }
            }
            }
            return networkResponse;
        } catch (err) {
            const stored = await idbGetAll('stories');
            const payload = { error: false, message: 'offline', listStory: stored };
            return new Response(JSON.stringify(payload), { headers: { 'Content-Type':'application/json' } });
        }
        })());
        return;
    }

    if (req.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|svg|webp)$/)) {
        event.respondWith(
        caches.open(RUNTIME).then(async cache => {
            const cached = await cache.match(req);
            const networkFetch = fetch(req).then(resp => { if (resp.ok) cache.put(req, resp.clone()); return resp; }).catch(()=>null);
            return cached || networkFetch || fetch(req).catch(()=>cached);
        })
        );
        return;
    }

    event.respondWith(
        caches.match(req).then((cached) => cached || fetch(req).then((response) => {
        return caches.open(RUNTIME).then(cache => { cache.put(req, response.clone()); return response; });
        }).catch(() => {
        if (req.mode === 'navigate') return caches.match('/index.html');
        }))
    );
});

async function flushOutbox() {
    const out = await idbGetAll('outbox');
    for (const entry of out) {
        try {
        if (entry.formDataFields) {
            const fd = new FormData();
            for (const f of entry.formDataFields) {
            if (f.kind === 'file') {
                const bytes = atob(f.data);
                const arr = new Uint8Array(bytes.length);
                for (let i=0;i<bytes.length;i++) arr[i] = bytes.charCodeAt(i);
                const blob = new Blob([arr], { type: f.type || 'image/png' });
                fd.append(f.name, blob, f.filename || 'photo.png');
            } else {
                fd.append(f.name, f.value);
            }
            }
            const token = entry.token ? entry.token : null;
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const resp = await fetch(`${API_BASE}/stories`, { method: 'POST', body: fd, headers });
            if (resp && resp.ok) {
            await idbDelete('outbox', entry.cid);
            }
        } else if (entry.jsonPayload) {
            const token = entry.token ? entry.token : null;
            const resp = await fetch(`${API_BASE}/stories/guest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry.jsonPayload)
            });
            if (resp && resp.ok) await idbDelete('outbox', entry.cid);
        } else {
            await idbDelete('outbox', entry.cid);
        }
        } catch (e) {
        console.error('flushOutbox error', e);
        }
    }
}

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-outbox') {
        event.waitUntil(flushOutbox());
    }
});

self.addEventListener('message', (evt) => {
    if (!evt.data) return;
    if (evt.data === 'flush-outbox') {
        evt.waitUntil(flushOutbox());
    }
});

self.addEventListener('push', (event) => {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; } catch(e){ payload = { title: 'Story App', body: 'Ada story baru' }; }
    const title = payload.title || (payload.notification && payload.notification.title) || 'Story App';
    const options = {
        body: payload.body || (payload.notification && payload.notification.body) || 'Click to view',
        icon: payload.icon || '/assets/favicon.png',
        badge: payload.badge || '/assets/favicon.png',
        data: payload.data || { url: '/#/' },
        actions: payload.actions || [{ action: 'open', title: 'Lihat' }]
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const data = event.notification.data || {};
    const urlToOpen = data.url || '/#/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
        for (let client of windowClients) {
            if (client.url.includes('/') && 'focus' in client) {
            client.focus();
            client.postMessage({ type: 'navigate', url: urlToOpen });
            return client.navigate(urlToOpen).catch(()=>client);
            }
        }
        if (clients.openWindow) return clients.openWindow(urlToOpen);
        })
    );
});
