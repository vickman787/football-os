// ─────────────────────────────────────────────────────────────────────────────
// Football OS · Signal Feed
//
// Real signals only:
//   • AI predictions saved to localStorage (from the AI form)
//   • Onchain submissions saved to localStorage (real txs)
//   • Live fixtures from API-Football (when the backend has a working key)
// No mock entries. Empty state shown if none of the above produce a signal.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { KEYS, read, subscribe } from '../lib/store.js';
import { explorerTxUrl, shortHash } from '../lib/contract.js';
import { ErrorState } from '../components/States.jsx';

function timeAgo(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function loadAi() {
  const v = read(KEYS.aiHistory, []);
  return Array.isArray(v) ? v : [];
}
function loadOnchain() {
  const v = read(KEYS.onchainSubmissions, []);
  return Array.isArray(v) ? v : [];
}

function aiToSignal(p) {
  return {
    id: `ai-${p.id}`,
    tag: 'AI',
    match: `${p.teamA} vs ${p.teamB}`,
    text: `Model picks ${p.predictedWinner} at ${p.confidence}% confidence (${p.riskLevel || 'Medium'} risk).`,
    confidence: (p.confidence ?? 0) / 100,
    timestamp: p.timestamp,
  };
}

function onchainToSignal(s) {
  return {
    id: `oc-${s.id}`,
    tag: 'ONCHAIN',
    match: s.matchId,
    text: `Proof published: ${s.predictedWinner}${s.scorePrediction ? ' ' + s.scorePrediction : ''} · ${shortHash(s.txHash, 8, 6)}`,
    href: explorerTxUrl(s.txHash),
    confidence: (s.confidence ?? 0) / 100,
    timestamp: s.timestamp,
  };
}

function fixtureToSignal(f) {
  const h = f?.home?.name || 'Home';
  const a = f?.away?.name || 'Away';
  const goals = `${f?.home?.goals ?? 0}-${f?.away?.goals ?? 0}`;
  const status = f?.status === 'HT' ? 'Half-time' : f?.elapsed != null ? `${f.elapsed}'` : (f?.status || 'Live');
  return {
    id: `live-${f.id}`,
    tag: 'LIVE',
    match: `${h} vs ${a}`,
    text: `${status} · ${goals} · ${f.league || ''}`.trim(),
    confidence: null,
    timestamp: new Date().toISOString(),
  };
}

export default function Signals() {
  const [ai, setAi] = useState(() => loadAi());
  const [onchain, setOnchain] = useState(() => loadOnchain());
  const [live, setLive] = useState([]);
  const [liveErr, setLiveErr] = useState(null);
  const [, tick] = useState(0);

  // Sync from localStorage (same-tab + cross-tab).
  useEffect(() => {
    const a = subscribe(KEYS.aiHistory, () => setAi(loadAi()));
    const b = subscribe(KEYS.onchainSubmissions, () => setOnchain(loadOnchain()));
    return () => { a(); b(); };
  }, []);

  // Pull live fixtures from API-Football when available.
  useEffect(() => {
    let alive = true;
    async function fetchLive() {
      try {
        const r = await fetch(`${api.baseUrl}/api/live-matches`);
        if (!r.ok) throw new Error(`live-matches ${r.status}`);
        const j = await r.json();
        // Treat mock fallback as "no live data" — we want real signals only.
        if (alive) {
          if (j?.source === 'api-football' && Array.isArray(j.data)) {
            setLive(j.data);
            setLiveErr(null);
          } else {
            setLive([]);
          }
        }
      } catch (e) {
        if (alive) { setLive([]); setLiveErr(e); }
      }
    }
    fetchLive();
    const id = setInterval(fetchLive, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Keep "Xs ago" labels fresh.
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const items = [
    ...ai.map(aiToSignal),
    ...onchain.map(onchainToSignal),
    ...live.map(fixtureToSignal),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">// Signal Feed · Real-time</span>
        <h1 className="title">Real signals across your alpha graph</h1>
        <p className="subtitle">
          Aggregates AI predictions, onchain proof submissions, and live fixtures from
          API-Football. No filler entries — when nothing real has happened yet, the feed stays
          empty.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="card empty-card">
          <span className="eyebrow">// No signals yet</span>
          <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', lineHeight: 1.55 }}>
            Generate an <a href="/predictions">AI prediction</a> or submit a proof onchain to seed
            the feed. Live fixtures will also appear here when API-Football is configured.
          </p>
          {liveErr && (
            <p style={{ margin: '12px 0 0', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
              Live fixtures unavailable: {liveErr.message}
            </p>
          )}
        </div>
      ) : (
        <div className="signal-list">
          {items.map((s) => {
            const body = (
              <>
                <span className="signal-tag">{s.tag}</span>
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.14em', marginBottom: 4 }}>
                    {s.match}
                  </div>
                  <div className="signal-text">{s.text}</div>
                </div>
                <div className="signal-meta">
                  {s.confidence != null && <span className="conf">{Math.round(s.confidence * 100)}%</span>}
                  <span>{timeAgo(s.timestamp)}</span>
                </div>
              </>
            );
            return s.href ? (
              <a key={s.id} className="signal" href={s.href} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                {body}
              </a>
            ) : (
              <div key={s.id} className="signal">{body}</div>
            );
          })}
        </div>
      )}
    </>
  );
}
