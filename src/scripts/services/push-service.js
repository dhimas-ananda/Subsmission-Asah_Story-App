const API_BASE = 'https://story-api.dicoding.dev/v1';

export async function getVapidKey() {
  try {
    const r = await fetch(`${API_BASE}/vapidPublicKey`);
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.value ? d.value : null;
  } catch (e) {
    return null;
  }
}

function normalizeSubscription(sub) {
  try {
    const raw = sub.toJSON();
    const keys = raw.keys || {};
    return {
      endpoint: raw.endpoint,
      keys: {
        p256dh: keys.p256dh || '',
        auth: keys.auth || ''
      }
    };
  } catch (e) {
    return null;
  }
}

export async function subscribePush(token) {
  if (!('serviceWorker' in navigator)) throw new Error('sw not supported');

  if (Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') throw new Error('permission-not-granted');
  }

  const reg = await navigator.serviceWorker.ready;
  const vapid = await getVapidKey();
  const convertedVapid = vapid ? urlBase64ToUint8Array(vapid) : null;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: convertedVapid });
  const payload = normalizeSubscription(sub);
  if (!payload) throw new Error('bad sub payload');

  const resp = await fetch(`${API_BASE}/notifications/subscribe`, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: `Bearer ${token}` } : {}),
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const text = await resp.text().catch(()=>resp.statusText);
    throw new Error(`subscribe failed: ${resp.status} ${text}`);
  }
  return await resp.json();
}

export async function unsubscribePush(token) {
  if (!('serviceWorker' in navigator)) throw new Error('sw not supported');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const payload = normalizeSubscription(sub);
  const resp = await fetch(`${API_BASE}/notifications/unsubscribe`, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: `Bearer ${token}` } : {}),
    body: JSON.stringify(payload)
  });
  await sub.unsubscribe().catch(()=>{});
  return resp.ok ? await resp.json() : null;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
