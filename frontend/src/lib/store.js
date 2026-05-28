// ─────────────────────────────────────────────────────────────────────────────
// Football OS · localStorage helpers
//
// One module, every key. Components import {keys, read, write, push, clear,
// subscribe} so we don't have ad-hoc localStorage logic scattered everywhere.
//
// Subscribe lets one tab/component react to writes from another (cross-tab
// works via the native `storage` event; same-tab uses a custom event that we
// dispatch ourselves).
// ─────────────────────────────────────────────────────────────────────────────

export const KEYS = {
  walletSession: 'footballos:wallet-session',
  aiHistory: 'footballos:ai-predictions',
  aiLatest: 'footballos:ai-latest',
  onchainSubmissions: 'footballos:onchain-submissions',
};

const SAME_TAB_EVENT = 'footballos:store-change';

export function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    notify(key);
  } catch {}
}

export function clear(key) {
  try { localStorage.removeItem(key); notify(key); } catch {}
}

export function push(key, item, max = Infinity) {
  const list = read(key, []);
  const next = Array.isArray(list) ? [item, ...list].slice(0, max) : [item];
  write(key, next);
  return next;
}

function notify(key) {
  try {
    window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT, { detail: { key } }));
  } catch {}
}

/**
 * Subscribe to changes for a single key. Fires for both same-tab writes
 * (via our custom event) and other-tab writes (via the storage event).
 */
export function subscribe(key, handler) {
  const onStorage = (e) => {
    if (e.key === key || e.key == null) handler();
  };
  const onSame = (e) => {
    if (!e?.detail || e.detail.key === key) handler();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(SAME_TAB_EVENT, onSame);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(SAME_TAB_EVENT, onSame);
  };
}
