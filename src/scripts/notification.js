export async function showAppNotification(title, options = {}) {
  try {
    if (typeof Notification === 'undefined') return null;

    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return null;
    }

    let registration = null;
    try {
      if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
        const regs = await navigator.serviceWorker.getRegistrations();
        registration = regs && regs.length ? regs[0] : null;
      } else if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistration === 'function') {
        registration = await navigator.serviceWorker.getRegistration();
      }
    } catch (e) {
      registration = null;
    }

    if (registration && typeof registration.showNotification === 'function') {
      await registration.showNotification(title, options);
      return true;
    } else {
      try {
        new Notification(title, options);
        return true;
      } catch (e) {
        return null;
      }
    }
  } catch (err) {
    console.error('showAppNotification error', err);
    return null;
  }
}
