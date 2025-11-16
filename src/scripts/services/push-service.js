const API = 'https://story-api.dicoding.dev/v1';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function getVapidKey() {
  try {
    const r = await fetch(`${API}/notifications/vapid`);
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.publicKey ? j.publicKey : null;
  } catch (e) {
    return null;
  }
}

async function subscribePush(token = '') {
  if (!('Notification' in window)) throw new Error('Notification API not supported');
  if (Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') throw new Error('permission-not-granted');
  }
  const vapid = await getVapidKey();
  const reg = await navigator.serviceWorker.ready;
  const options = { userVisibleOnly: true };
  if (vapid) options.applicationServerKey = urlBase64ToUint8Array(vapid);
  const sub = await reg.pushManager.subscribe(options);

  const raw = sub.toJSON ? sub.toJSON() : JSON.parse(JSON.stringify(sub));
  if (raw.expirationTime !== undefined) delete raw.expirationTime;
  if (raw.options !== undefined) delete raw.options;

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(`${API}/notifications/subscribe`, {
    method: 'POST',
    headers,
    body: JSON.stringify(raw)
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(()=>'');
    throw new Error(`subscribe-failed:${resp.status}:${txt}`);
  }
  return raw;
}

async function unsubscribePush(token = '') {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;
  const raw = sub.toJSON ? sub.toJSON() : JSON.parse(JSON.stringify(sub));
  try {
    await sub.unsubscribe();
  } catch (e) {}
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  await fetch(`${API}/notifications/unsubscribe`, {
    method: 'POST',
    headers,
    body: JSON.stringify(raw)
  }).catch(()=>{});
  return true;
}

export { subscribePush, unsubscribePush, urlBase64ToUint8Array };
