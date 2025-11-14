const VAPID_PUBLIC_KEY = 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function normalizeSubscription(sub) {
  if (!sub) return null;
  const obj = { endpoint: sub.endpoint };
  try {
    const raw = sub.toJSON ? sub.toJSON() : sub;
    if (raw && raw.keys) {
      obj.keys = {
        p256dh: raw.keys.p256dh,
        auth: raw.keys.auth
      };
    } else if (sub.getKey) {
      const p256dh = sub.getKey && sub.getKey('p256dh');
      const auth = sub.getKey && sub.getKey('auth');
      obj.keys = {
        p256dh: p256dh ? btoa(String.fromCharCode.apply(null, new Uint8Array(p256dh))) : undefined,
        auth: auth ? btoa(String.fromCharCode.apply(null, new Uint8Array(auth))) : undefined
      };
    }
  } catch (e) {}
  return obj;
}

export async function subscribePush(token) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push not supported');
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    const payload = normalizeSubscription(existing);
    const res = await fetch('https://story-api.dicoding.dev/v1/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Subscribe API failed ${res.status} ${await res.text()}`);
    return existing;
  }
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  const payload = normalizeSubscription(sub);
  const res = await fetch('https://story-api.dicoding.dev/v1/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    try { await sub.unsubscribe(); } catch (e) {}
    throw new Error(`Subscribe API failed ${res.status} ${await res.text()}`);
  }
  return sub;
}

export async function unsubscribePush(token) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push not supported');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const payload = { endpoint: sub.endpoint };
  const res = await fetch('https://story-api.dicoding.dev/v1/notifications/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  await sub.unsubscribe();
  if (!res.ok) throw new Error(`Unsubscribe API failed ${res.status} ${await res.text()}`);
  return true;
}
