const API = 'https://story-api.dicoding.dev/v1';

const VAPID_PUBLIC_KEY = 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribePush(token = '') {
  if (!('Notification' in window)) {
    throw new Error('Notification API not supported');
  }
  
  if (Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') {
      throw new Error('permission-not-granted');
    }
  }

  const reg = await navigator.serviceWorker.ready;
  
  let sub = await reg.pushManager.getSubscription();
  
  if (!sub) {
    const options = { 
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    };
    sub = await reg.pushManager.subscribe(options);
  }

  const raw = sub.toJSON ? sub.toJSON() : JSON.parse(JSON.stringify(sub));
  
  if (raw.expirationTime !== undefined) delete raw.expirationTime;
  if (raw.options !== undefined) delete raw.options;

  const payload = {
    endpoint: raw.endpoint,
    keys: {
      p256dh: raw.keys.p256dh,
      auth: raw.keys.auth
    }
  };

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(`${API}/notifications/subscribe`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`subscribe-failed:${resp.status}:${txt}`);
  }

  const result = await resp.json();
  console.log('Push subscription berhasil');
  
  return { subscription: raw, response: result };
}

async function unsubscribePush(token = '') {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  
  if (!sub) {
    console.log('No subscription found');
    return true;
  }

  const raw = sub.toJSON ? sub.toJSON() : JSON.parse(JSON.stringify(sub));
  
  const payload = {
    endpoint: raw.endpoint
  };

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const resp = await fetch(`${API}/notifications/subscribe`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify(payload)
    });

    if (resp.ok) {
      console.log('Unsubscribe dari server berhasil');
    }
  } catch (e) {
    console.error('Error unsubscribing from server:', e);
  }

  try {
    await sub.unsubscribe();
    console.log('Local subscription removed');
  } catch (e) {
    console.error('Error removing local subscription:', e);
  }

  return true;
}

async function isPushSubscribed() {
  try {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub !== null;
  } catch (e) {
    return false;
  }
}

export { subscribePush, unsubscribePush, urlBase64ToUint8Array, isPushSubscribed };