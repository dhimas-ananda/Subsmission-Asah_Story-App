const isLocalhost = Boolean(
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  /^192\.168\./.test(location.hostname)
);

async function safeGetRegistrations() {
  try {
    if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
      return await navigator.serviceWorker.getRegistrations();
    }
    if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistration === 'function') {
      const r = await navigator.serviceWorker.getRegistration();
      return r ? [r] : [];
    }
  } catch (e) {}
  return [];
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    window.dispatchEvent(new CustomEvent('sw:unsupported'));
    return null;
  }

  if (!(location.protocol === 'https:' || isLocalhost)) {
    window.dispatchEvent(new CustomEvent('sw:skipped-insecure'));
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    window.dispatchEvent(new CustomEvent('sw:registered', { detail: reg }));
    const regs = await safeGetRegistrations();
    window.dispatchEvent(new CustomEvent('sw:registrations', { detail: regs }));
    return reg;
  } catch (err) {
    window.dispatchEvent(new CustomEvent('sw:register-failed', { detail: err }));
    return null;
  }
}

window.addEventListener('load', () => {
  setTimeout(registerServiceWorker, 50);
});
