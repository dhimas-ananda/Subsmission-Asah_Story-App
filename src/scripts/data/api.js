const BASE = 'https://story-api.dicoding.dev/v1';

async function requestRaw(path, options = {}) {
  const url = `${BASE}${path}`;
  const resp = await fetch(url, options);
  return resp;
}

export async function loginUser(credentials) {
  const resp = await requestRaw('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  return resp.json();
}

export async function registerUser(payload) {
  const resp = await requestRaw('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return resp.json();
}

export async function getStories(token) {
  const params = '?size=100&location=1';
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const resp = await fetch(`${BASE}/stories${params}`, { headers });
  if (!resp.ok) {
    let text = '';
    try { text = await resp.text(); } catch (e) { text = resp.statusText || 'Error'; }
    return { error: true, status: resp.status, message: text };
  }
  try {
    const data = await resp.json();
    return data;
  } catch (e) {
    return { error: true, message: 'Invalid JSON from API' };
  }
}

export async function postStory(formData, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const resp = await fetch(`${BASE}/stories`, {
    method: 'POST',
    headers,
    body: formData,
  });
  return resp;
}
