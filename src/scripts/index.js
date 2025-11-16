import './app.js';
import './sw-register.js';
import 'leaflet/dist/leaflet.css';
import '../styles/styles.css';
import { subscribePush, unsubscribePush } from './services/push-service.js';
import { showAppNotification, initPushButton } from './notification.js';
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
    btn.setAttribute('aria-hidden', 'false');
    btn.addEventListener('click', async () => {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);
      } catch (err) {
        console.error('Install prompt error:', err);
      }
      deferredPrompt = null;
      btn.style.display = 'none';
      btn.setAttribute('aria-hidden', 'true');
    }, { once: true });
  }
});
function safeGet(selector) {
  try { 
    return document.querySelector(selector); 
  } catch (e) { 
    return null; 
  }
}

window.addEventListener('online', () => {
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('flush-outbox');
    }
  } catch (err) {
    console.error('Error flushing outbox:', err);
  }
});

if (typeof module !== 'undefined' && module.hot && module.hot.accept) {
  module.hot.accept();
}

window.subscribePush = subscribePush;
window.unsubscribePush = unsubscribePush;

window.addEventListener('DOMContentLoaded', async () => {
  try {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.ready;
      console.log('Service Worker ready');
    }
    
    await initPushButton();
    
  } catch (e) {
    console.error('Initialization error:', e);
  }
});

window.addEventListener('load', async () => {
  try {
    if ('serviceWorker' in navigator && typeof navigator.serviceWorker.getRegistrations === 'function') {
      const regs = await navigator.serviceWorker.getRegistrations();
      console.log('SW registrations:', regs);
      
      if (regs && regs.length > 0) {
        await showAppNotification('Story App', {
          body: 'Service Worker aktif dan siap digunakan',
          icon: '/assets/logo.png',
          badge: '/assets/logo.png',
          tag: 'sw-active'
        });
      }
    } else {
      console.log('serviceWorker API not available or getRegistrations not a function');
    }
  } catch (err) {
    console.warn('Load event error:', err);
  }
});

window.addEventListener('login:success', async (e) => {
  const d = e.detail || {};
  try {
    await showAppNotification('Story App', {
      body: `Selamat datang, ${d.username || 'user'}!`,
      icon: '/assets/logo.png',
      badge: '/assets/logo.png',
      tag: 'login-success',
      data: { url: '/' }
    });
  } catch (err) {
    console.error('Login notification error:', err);
  }
});

window.addEventListener('register:success', async (e) => {
  try {
    await showAppNotification('Story App', {
      body: 'Pendaftaran berhasil! Silakan login untuk melanjutkan.',
      icon: '/assets/logo.png',
      badge: '/assets/logo.png',
      tag: 'register-success',
      data: { url: '/login' }
    });
  } catch (err) {
    console.error('Register notification error:', err);
  }
});

window.addEventListener('auth:changed', async (e) => {
  const detail = e.detail;
  if (!detail) {
    try {
      await showAppNotification('Story App', {
        body: 'Logout berhasil. Sampai jumpa lagi!',
        icon: '/assets/logo.png',
        badge: '/assets/logo.png',
        tag: 'logout-success',
        data: { url: '/' }
      });
    } catch (err) {
      console.error('Logout notification error:', err);
    }
  }
});

window.addEventListener('story:created', async (e) => {
  const detail = e.detail || {};
  try {
    await showAppNotification('Story App', {
      body: 'Story berhasil dikirim dan telah dipublikasikan!',
      icon: '/assets/logo.png',
      badge: '/assets/logo.png',
      tag: 'story-created',
      data: { url: '/' }
    });
  } catch (err) {
    console.error('Story created notification error:', err);
  }
});

window.addEventListener('story:sync-pending', async (e) => {
  try {
    await showAppNotification('Story App', {
      body: 'Story tersimpan. Akan dikirim saat online.',
      icon: '/assets/logo.png',
      badge: '/assets/logo.png',
      tag: 'story-pending',
      requireInteraction: true
    });
  } catch (err) {
    console.error('Story sync pending notification error:', err);
  }
});

window.addEventListener('story:synced', async (e) => {
  try {
    await showAppNotification('Story App', {
      body: 'Story yang tertunda berhasil dikirim!',
      icon: '/assets/logo.png',
      badge: '/assets/logo.png',
      tag: 'story-synced'
    });
  } catch (err) {
    console.error('Story synced notification error:', err);
  }
});

export { showAppNotification };