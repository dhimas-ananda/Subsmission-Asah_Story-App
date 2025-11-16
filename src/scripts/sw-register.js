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
  } catch (e) {
    console.warn('safeGetRegistrations error', e);
  }
  return [];
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('ServiceWorker not supported in this browser');
    window.dispatchEvent(new CustomEvent('sw:unsupported'));
    return null;
  }

  if (!(location.protocol === 'https:' || isLocalhost)) {
    console.warn('ServiceWorker registration skipped: insecure context and not localhost');
    window.dispatchEvent(new CustomEvent('sw:skipped-insecure'));
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('ServiceWorker registered', reg);
    window.dispatchEvent(new CustomEvent('sw:registered', { detail: reg }));

    const regs = await safeGetRegistrations();
    console.log('existing SW registrations:', regs);
    return reg;
  } catch (err) {
    console.error('ServiceWorker registration failed', err);
    window.dispatchEvent(new CustomEvent('sw:register-failed', { detail: err }));
    return null;
  }
}

window.addEventListener('load', () => {
  setTimeout(registerServiceWorker, 50);
});
