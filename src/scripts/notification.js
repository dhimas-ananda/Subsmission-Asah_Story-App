import { subscribePush, unsubscribePush, isPushSubscribed } from './services/push-service.js';

async function showAppNotification(title, options = {}) {
  try {
    if (!('Notification' in window)) {
      console.warn('Notification API not supported');
      return;
    }
    
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return;
    }

    const reg = await navigator.serviceWorker.ready;
    
    const notificationOptions = {
      body: options.body || '',
      icon: options.icon || '/assets/icon-192.png',
      badge: options.badge || '/assets/icon-72.png',
      tag: options.tag || 'app-notification',
      requireInteraction: false,
      vibrate: options.vibrate || [200, 100, 200],
      data: options.data || {}
    };

    if (reg && reg.showNotification) {
      return reg.showNotification(title, notificationOptions);
    }
  } catch (e) {
    console.error('showAppNotification error:', e);
  }
}

async function checkSubscriptionStatus() {
  return await isPushSubscribed();
}

function updatePushButton(button, isSubscribed) {
  if (!button) return;
  
  if (isSubscribed) {
    button.textContent = 'Nonaktifkan Notifikasi';
    button.setAttribute('aria-label', 'Disable push notifications');
    button.dataset.subscribed = 'true';
    button.classList.add('subscribed');
  } else {
    button.textContent = 'Aktifkan Notifikasi';
    button.setAttribute('aria-label', 'Enable push notifications');
    button.dataset.subscribed = 'false';
    button.classList.remove('subscribed');
  }
  button.disabled = false;
}

async function initPushButton() {
  const pushButton = document.getElementById('push-toggle');
  if (!pushButton) return;

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    pushButton.textContent = '❌ Push Not Supported';
    pushButton.disabled = true;
    return;
  }

  const isSubscribed = await checkSubscriptionStatus();
  updatePushButton(pushButton, isSubscribed);

  pushButton.addEventListener('click', async () => {
    pushButton.disabled = true;
    pushButton.textContent = '⏳ Memproses...';

    try {
      const currentStatus = await checkSubscriptionStatus();
      const token = localStorage.getItem('authToken') || '';

      if (currentStatus) {
        await unsubscribePush(token);
        updatePushButton(pushButton, false);
        
        if (window.ui && window.ui.showToast) {
          window.ui.showToast('🔕 Notifikasi dinonaktifkan');
        } else {
          alert('Notifikasi berhasil dinonaktifkan');
        }
      } else {
        await subscribePush(token);
        updatePushButton(pushButton, true);
        
        await showAppNotification('🔔 Notifikasi Aktif', {
          body: 'Anda akan menerima notifikasi saat menambah story baru',
          icon: '/assets/icon-192.png',
          badge: '/assets/icon-72.png',
          tag: 'subscription-success'
        });

        if (window.ui && window.ui.showToast) {
          window.ui.showToast('✅ Notifikasi berhasil diaktifkan');
        }
      }
    } catch (error) {
      console.error('Error toggling push subscription:', error);
      
      let errorMsg = 'Gagal memproses notifikasi';
      
      if (error.message === 'permission-not-granted') {
        errorMsg = 'Izin notifikasi ditolak. Aktifkan di pengaturan browser.';
      } else if (error.message.includes('subscribe-failed')) {
        errorMsg = 'Gagal subscribe ke server. Pastikan Anda login.';
      }

      if (window.ui && window.ui.showToast) {
        window.ui.showToast('❌ ' + errorMsg);
      } else {
        alert(errorMsg);
      }

      const status = await checkSubscriptionStatus();
      updatePushButton(pushButton, status);
    }
  });
}

async function ensurePushSubscription() {
  try {
    const isSubscribed = await checkSubscriptionStatus();
    
    if (!isSubscribed) {
      if (Notification.permission === 'granted') {
        const token = localStorage.getItem('authToken') || '';
        await subscribePush(token);
        console.log('✅ Auto-subscribed untuk push notifications');
        return true;
      }
    }
    return isSubscribed;
  } catch (e) {
    console.error('Error ensuring push subscription:', e);
    return false;
  }
}

export { 
  showAppNotification, 
  initPushButton, 
  checkSubscriptionStatus,
  ensurePushSubscription 
};