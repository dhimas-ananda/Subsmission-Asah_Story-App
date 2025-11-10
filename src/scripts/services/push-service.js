const VAPID_PUBLIC = 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk';
const API_BASE = 'https://story-api.dicoding.dev/v1';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

export async function subscribePush(token) {
    if (!('serviceWorker' in navigator)) throw new Error('Service worker not supported');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
    });

    const resp = await fetch(`${API_BASE}/notifications/subscribe`, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(sub)
    });

    if (!resp.ok) {
        const txt = await resp.text().catch(()=> 'Server error');
        throw new Error('Gagal mengirim subscription ke server: '+txt);
    }
    return resp.json();
}

export async function unsubscribePush(token) {
    if (!('serviceWorker' in navigator)) throw new Error('Service worker not supported');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return false;
    await sub.unsubscribe();
    await fetch(`${API_BASE}/notifications/subscribe`, {
        method: 'DELETE',
        headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ endpoint: sub.endpoint })
    });
    return true;
}
