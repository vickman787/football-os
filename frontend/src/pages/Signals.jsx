// ─────────────────────────────────────────────────────────────────────────────
// Football OS · Signal Feed
//
// Real signals only:
//   • AI predictions saved to localStorage (from the AI form)
//   • Onchain submissions saved to localStorage (real txs)
//   • Live fixtures from Sportmonks, with a labeled demo fallback when no live games are available
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

function extractLiveMatches(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.matches)) return payload.matches;
  return [];
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
  const h = f?.homeTeam || f?.home?.name || 'Home';
  const a = f?.awayTeam || f?.away?.name || 'Away';
  const homeGoals = f?.score?.home ?? f?.home?.goals;
  const awayGoals = f?.score?.away ?? f?.away?.goals;
  const goals = homeGoals != null && awayGoals != null ? `${homeGoals}-${awayGoals}` : 'score pending';
  const status = f?.status === 'HT' ? 'Half-time' : f?.elapsed != null ? `${f.elapsed}'` : (f?.status || 'Scheduled');
  return {
    id: `live-${f.id}`,
    tag: f?.status === 'NS' || f?.elapsed == null ? 'FIXTURE' : 'LIVE',
    match: `${h} vs ${a}`,
    text: `${status} · ${goals} · ${f.league || ''}`.trim(),
    confidence: null,
    timestamp: new Date().toISOString(),
  };
}

function formatCurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatProbability(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const pct = n <= 1 ? n * 100 : n;
  return `${Math.round(pct)}%`;
}

export default function Signals() {
  const [ai, setAi] = useState(() => loadAi());
  const [onchain, setOnchain] = useState(() => loadOnchain());
  const [liveMatches, setLiveMatches] = useState([]);
  const [liveErr, setLiveErr] = useState(null);
  const [marketEvents, setMarketEvents] = useState([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketErr, setMarketErr] = useState(null);
  const [, tick] = useState(0);

  // Sync from localStorage (same-tab + cross-tab).
  useEffect(() => {
    const a = subscribe(KEYS.aiHistory, () => setAi(loadAi()));
    const b = subscribe(KEYS.onchainSubmissions, () => setOnchain(loadOnchain()));
    return () => { a(); b(); };
  }, []);

  // Pull football fixtures from the Sportmonks-backed backend when available.
  useEffect(() => {
    let alive = true;
    async function fetchLive() {
      try {
        const r = await fetch(`${api.baseUrl}/api/live-matches`);
        if (!r.ok) throw new Error(`live-matches ${r.status}`);
        const j = await r.json();
        if (alive) {
          const nextLiveMatches = extractLiveMatches(j);
          console.log('Live matches loaded:', nextLiveMatches.length);
          setLiveMatches(nextLiveMatches);
          setLiveErr(null);
        }
      } catch (e) {
        if (alive) { setLiveMatches([]); setLiveErr(e); }
      }
    }
    fetchLive();
    const id = setInterval(fetchLive, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    let alive = true;
    async function fetchMarkets() {
      setMarketLoading(true);
      setMarketErr(null);
      try {
        const polymarketUrl = `${api.baseUrl}/api/polymarket/football-markets`;
        console.log('Polymarket requested URL:', polymarketUrl);
        const r = await fetch(polymarketUrl);
        if (!r.ok) throw new Error(`polymarket ${r.status}`);
        const data = await r.json();
        if (alive) setMarketEvents(Array.isArray(data) ? data : []);
      } catch (e) {
        if (alive) {
          setMarketEvents([]);
          setMarketErr(e);
        }
      } finally {
        if (alive) setMarketLoading(false);
      }
    }
    fetchMarkets();
    return () => { alive = false; };
  }, []);

  // Keep "Xs ago" labels fresh.
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const items = [
    ...ai.map(aiToSignal),
    ...onchain.map(onchainToSignal),
    ...liveMatches.map(fixtureToSignal),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">// Signal Feed · Real-time</span>
        <h1 className="title">Real signals across your alpha graph</h1>
        <p className="subtitle">
          Aggregates AI predictions, onchain proof submissions, and fixtures from Sportmonks.
          When Sportmonks has no active live games, the backend keeps the dashboard alive with
          clearly labeled demo fixtures.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="card empty-card">
          <span className="eyebrow">// No signals yet</span>
          <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', lineHeight: 1.55 }}>
            Generate an <a href="/predictions">AI prediction</a> or submit a proof onchain to seed
            the feed. Sportmonks fixtures will appear here when the backend has football data.
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

      <section className="market-consensus">
        <div className="ai-history-head">
          <div>
            <span className="eyebrow">// Market Consensus Signals</span>
            <h3 className="card-title" style={{ margin: '6px 0 0' }}>Polymarket football probabilities</h3>
          </div>
          <span className="ai-history-count">{marketEvents.length}</span>
        </div>

        {marketLoading ? (
          <div className="card empty-card">
            <p className="ai-empty">Loading market consensus signals…</p>
          </div>
        ) : marketErr ? (
          <div className="card empty-card">
            <p className="ai-empty">Market consensus unavailable: {marketErr.message}</p>
          </div>
        ) : marketEvents.length === 0 ? (
          <div className="card empty-card">
            <p className="ai-empty">No active football markets found on Polymarket right now.</p>
          </div>
        ) : (
          <div className="market-list">
            {marketEvents.map((event) => (
              <article key={event.id} className="market-card">
                <div className="market-card-head">
                  <div>
                    <div className="market-title">{event.title}</div>
                    <div className="market-meta">
                      <span>{event.category || 'Football'}</span>
                      <span>Ends {formatDate(event.endDate)}</span>
                    </div>
                  </div>
                  <span className="chip">{event.source}</span>
                </div>

                <div className="market-metrics">
                  <span>Volume {formatCurrency(event.volume)}</span>
                  <span>Liquidity {formatCurrency(event.liquidity)}</span>
                </div>

                <div className="market-questions">
                  {(event.markets || []).map((market) => (
                    <div key={market.id} className="market-question">
                      <div className="market-question-text">{market.question}</div>
                      <div className="market-outcomes">
                        {(market.outcomes || []).map((outcome, index) => (
                          <span key={`${market.id}-${outcome}`} className="market-outcome">
                            <span>{outcome}</span>
                            <strong>{formatProbability(market.outcomePrices?.[index])}</strong>
                          </span>
                        ))}
                      </div>
                      <div className="market-metrics">
                        <span>Volume {formatCurrency(market.volume)}</span>
                        <span>Liquidity {formatCurrency(market.liquidity)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
