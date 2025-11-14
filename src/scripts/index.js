import './app.js';
import './sw-register.js';
import 'leaflet/dist/leaflet.css';
import '../styles/styles.css';
import { subscribePush, unsubscribePush } from './services/push-service.js';
import StoryModel from './models/story-model.js';


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

window.subscribePush = subscribePush;
window.unsubscribePush = unsubscribePush;

async function initPushToggle() {
  const btn = document.getElementById('push-toggle');
  if (!btn) return;
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      btn.style.display = 'none';
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    btn.innerText = sub ? 'Disable Notifications' : 'Enable Notifications';
    btn.addEventListener('click', async () => {
      const token = localStorage.getItem('authToken') || '';
      try {
        const reg = await navigator.serviceWorker.ready;
        const current = await reg.pushManager.getSubscription();
        if (current) {
          await unsubscribePush(token);
          btn.innerText = 'Enable Notifications';
          alert('Berhenti berlangganan notifikasi');
        } else {
          await subscribePush(token);
          btn.innerText = 'Disable Notifications';
          alert('Berhasil berlangganan notifikasi');
        }
      } catch (e) {
        console.error(e);
        alert('Gagal mengubah status notifikasi: ' + (e && e.message));
      }
    });
  } catch (e) {
    btn.style.display = 'none';
  }
}

window.addEventListener('load', async () => {
  try { await initPushToggle(); } catch (e) {}
});

if ('serviceWorker' in navigator && typeof navigator.serviceWorker.getRegistrations === 'function') {
  navigator.serviceWorker.getRegistrations().then(regs => {
    console.log('SW registrations:', regs);
  }).catch(err => console.warn('getRegistrations failed', err));
} else {
  console.log('serviceWorker API not available or getRegistrations not a function');
}


async function showAppNotification(title, body, url) {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const options = { body: body || '', icon: '/assets/icon-192.png', badge: '/assets/icon-192.png', data: { url: url || '/' }, tag: 'story-app', renotify: true };
      await reg.showNotification(title || 'Story App', options);
      return;
    }
    if (window.Notification && Notification.permission === 'granted') {
      new Notification(title || 'Story App', { body: body || '', icon: '/assets/icon-192.png' });
    } else if (window.Notification && Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') new Notification(title || 'Story App', { body: body || '', icon: '/assets/icon-192.png' });
    }
  } catch (e) { console.error('showAppNotification error', e); }
}

window.addEventListener('load', () => {
  navigator.serviceWorker.getRegistrations().then(regs => {
    if (regs && regs.length) showAppNotification('Story App', 'Service Worker aktif');
  }).catch(()=>{});
});

window.addEventListener('login:success', (e) => {
  const d = e.detail || {};
  try { showAppNotification('Story App', `Selamat datang, ${d.username || 'user'}`, '/'); } catch(e){}
});

window.addEventListener('register:success', (e) => {
  showAppNotification('Story App', 'Pendaftaran berhasil', '/login');
});

window.addEventListener('auth:changed', (e) => {
  const detail = e.detail;
  if (!detail) showAppNotification('Story App', 'Logout berhasil', '/');
});

window.addEventListener('story:created', (e) => {
  const detail = e.detail || {};
  showAppNotification('Story App', 'Story berhasil dikirim', '/');
});
