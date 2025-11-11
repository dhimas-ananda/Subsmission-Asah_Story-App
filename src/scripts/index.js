import '../styles/styles.css';
import 'leaflet/dist/leaflet.css';
import './app.js';
import './sw-register.js';

let deferredPrompt = null;
const isLocalhost = Boolean(
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  /^192\.168\./.test(location.hostname)
);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('install-btn');
  if (btn) {
    btn.style.display = 'inline-block';
    btn.addEventListener('click', async () => {
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch (err) {}
      deferredPrompt = null;
      btn.style.display = 'none';
    }, { once: true });
  }
});

function safeGet(selector) {
  try { return document.querySelector(selector); } catch (e) { return null; }
}

async function initPushToggle() {
  const pushToggle = safeGet('#push-toggle');
  if (!pushToggle) return;
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      pushToggle.style.display = 'none';
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    pushToggle.innerText = sub ? 'Disable Notifications' : 'Enable Notifications';
    pushToggle.style.display = 'inline-block';
    pushToggle.addEventListener('click', async () => {
      const token = localStorage.getItem('authToken');
      if (!token) { alert('Silakan login terlebih dahulu'); return; }
      try {
        const mod = await import('./services/push-service.js');
        const currentSub = await reg.pushManager.getSubscription();
        if (currentSub) {
          await mod.unsubscribePush(token);
          pushToggle.innerText = 'Enable Notifications';
        } else {
          await mod.subscribePush(token);
          pushToggle.innerText = 'Disable Notifications';
        }
      } catch (err) {
        console.error(err);
        alert('Gagal mengubah preferensi notifikasi');
      }
    });
  } catch (err) {
    pushToggle.style.display = 'none';
  }
}

window.addEventListener('load', async () => {
  try { await initPushToggle(); } catch (e) {}
  const main = document.getElementById('main-content-inner') || document.getElementById('app') || document.body;
  if (!document.getElementById('bootstrap-fallback') && (!window.App && !window.Router)) {
    const fallback = document.createElement('div');
    fallback.id = 'bootstrap-fallback';
    fallback.innerHTML = '<h2>App belum dimulai</h2><p>Periksa console untuk error atau pastikan App.init() atau Router.start() dipanggil.</p>';
    main.appendChild(fallback);
  }
});

window.addEventListener('online', () => {
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('flush-outbox');
    }
  } catch (err) {}
});

if (typeof module !== 'undefined' && module.hot && module.hot.accept) {
  module.hot.accept();
}

import { subscribePush, unsubscribePush } from './services/push-service.js';
window.subscribePush = subscribePush;
window.unsubscribePush = unsubscribePush;
