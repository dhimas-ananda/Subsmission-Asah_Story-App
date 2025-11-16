import { subscribePush, unsubscribePush } from './services/push-service.js';

async function showAppNotification(title, options = {}) {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return;
    }
    const reg = await navigator.serviceWorker.ready;
    if (reg && reg.showNotification) {
      return reg.showNotification(title, options);
    } else if (window.registration && window.registration.showNotification) {
      return window.registration.showNotification(title, options);
    }
  } catch (e) {
    console.error('showAppNotification error', e);
  }
}

async function checkSubscriptionStatus() {
  try {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    return subscription !== null;
  } catch (e) {
    console.error('Error checking subscription:', e);
    return false;
  }
}

function updatePushButton(button, isSubscribed) {
  if (!button) return;
  
  if (isSubscribed) {
    button.textContent = 'Disable Notifications';
    button.setAttribute('aria-label', 'Disable push notifications');
    button.dataset.subscribed = 'true';
  } else {
    button.textContent = 'Enable Notifications';
    button.setAttribute('aria-label', 'Enable push notifications');
    button.dataset.subscribed = 'false';
  }
  
  button.disabled = false;
}

async function initPushButton() {
  const pushButton = document.getElementById('push-toggle');
  if (!pushButton) return;

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    pushButton.textContent = 'Push Not Supported';
    pushButton.disabled = true;
    return;
  }

  const isSubscribed = await checkSubscriptionStatus();
  updatePushButton(pushButton, isSubscribed);

  pushButton.addEventListener('click', async () => {
    pushButton.disabled = true;
    pushButton.textContent = 'Processing...';

    try {
      const currentStatus = await checkSubscriptionStatus();
      
      if (currentStatus) {
        const token = localStorage.getItem('authToken') || '';
        await unsubscribePush(token);
        updatePushButton(pushButton, false);
        
        alert('Notifikasi berhasil dinonaktifkan');
      } else {
        const token = localStorage.getItem('authToken') || '';
        await subscribePush(token);
        updatePushButton(pushButton, true);
        
        await showAppNotification('Notifikasi Aktif', {
          body: 'Anda akan menerima notifikasi dari Story App',
          icon: '/assets/logo.png',
          badge: '/assets/logo.png'
        });
      }
    } catch (error) {
      console.error('Error toggling push subscription:', error);
      
      if (error.message === 'permission-not-granted') {
        alert('Izin notifikasi ditolak. Silakan aktifkan di pengaturan browser.');
      } else {
        alert('Gagal memproses notifikasi: ' + error.message);
      }
      
      const status = await checkSubscriptionStatus();
      updatePushButton(pushButton, status);
    }
  });
}

export { showAppNotification, initPushButton, checkSubscriptionStatus };