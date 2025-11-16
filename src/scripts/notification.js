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
