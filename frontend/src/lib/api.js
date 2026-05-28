const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

async function get(path, { signal } = {}) {
  const r = await fetch(`${BASE}${path}`, { signal });
  if (!r.ok) throw new Error(`${path} returned ${r.status}`);
  return r.json();
}

async function post(path, body, { signal } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok) throw new Error(`${path} returned ${r.status}`);
  return r.json();
}

export const api = {
  baseUrl: BASE,
  matches: (opts) => get('/api/matches', opts),
  match: (id, opts) => get(`/api/matches/${id}`, opts),
  signals: (opts) => get('/api/signals', opts),
  leaderboard: (opts) => get('/api/leaderboard', opts),
  predict: (payload, opts) => post('/api/predict', payload, opts),
};
