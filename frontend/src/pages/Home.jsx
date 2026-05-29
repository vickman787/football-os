import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { KEYS, read, subscribe } from '../lib/store.js';
import FanBadges from '../components/FanBadges.jsx';
import OnchainCard from '../components/OnchainCard.jsx';

function loadList(key) {
  const v = read(key, []);
  return Array.isArray(v) ? v : [];
}

function extractLiveMatches(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.matches)) return payload.matches;
  return [];
}

export default function Home() {
  // Real sources only:
  //  - live fixtures from the backend live-matches route
  //  - AI history saved by the user
  //  - Onchain submissions saved by the user (counted as ranked predictors by unique wallet)
  const [liveMatches, setLiveMatches] = useState([]);
  const [aiCount, setAiCount] = useState(loadList(KEYS.aiHistory).length);
  const [subs, setSubs] = useState(loadList(KEYS.onchainSubmissions));

  useEffect(() => {
    const a = subscribe(KEYS.aiHistory, () => setAiCount(loadList(KEYS.aiHistory).length));
    const b = subscribe(KEYS.onchainSubmissions, () => setSubs(loadList(KEYS.onchainSubmissions)));
    return () => { a(); b(); };
  }, []);

  // Live fixtures from the backend live-matches route.
  useEffect(() => {
    let alive = true;
    async function fetchLive() {
      try {
        const r = await fetch(`${api.baseUrl}/api/live-matches`);
        if (!r.ok) throw new Error(`live-matches ${r.status}`);
        const j = await r.json();
        if (!alive) return;
        const nextLiveMatches = extractLiveMatches(j);
        console.log('Live matches loaded:', nextLiveMatches.length);
        setLiveMatches(nextLiveMatches);
      } catch {
        if (alive) setLiveMatches([]);
      }
    }
    fetchLive();
    const id = setInterval(fetchLive, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const uniquePredictors = new Set(subs.map((s) => (s.wallet || '').toLowerCase()).filter(Boolean)).size;
  const liveCount = liveMatches.length;

  return (
    <>
      <section className="card hero">
        <div>
          <div className="eyebrow">Football Intelligence · X Layer</div>
          <h2>The onchain operating system for <span>football alpha</span>.</h2>
          <p>
            Football OS fuses an AI prediction engine, a real-time signal feed, and an onchain
            leaderboard into one console. Every prediction is anchored to X Layer as a
            verifiable proof, so winning calls compound into reputation, not screenshots.
          </p>
          <div className="hero-cta">
            <Link to="/predictions" className="btn primary">AI Predictions</Link>
            <Link to="/signals" className="btn">Live Signals</Link>
            <Link to="/leaderboard" className="btn ghost">Leaderboard</Link>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <div className="v">{liveCount}</div>
            <div className="l">Live Matches</div>
          </div>
          <div className="stat">
            <div className="v">{aiCount}</div>
            <div className="l">AI Predictions</div>
          </div>
          <div className="stat">
            <div className="v">{uniquePredictors}</div>
            <div className="l">Onchain Predictors</div>
          </div>
        </div>
      </section>

      <section className="section-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3 className="card-title">// Prediction engine</h3>
          <p style={{ margin: 0, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            OpenRouter-powered AI generates a structured pick with confidence, reasoning, and a
            ready-to-post X update. Every call is hashable and anchorable to X Layer.
          </p>
        </div>
        <OnchainCard />
      </section>

      <section style={{ marginBottom: 16 }}>
        <FanBadges />
      </section>

      <section className="section-grid">
        <div className="card">
          <h3 className="card-title">// Signal feed</h3>
          <p style={{ margin: 0, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            Real signals only — your AI predictions, your onchain submissions, and live fixtures
            from API-Football. No filler entries.
          </p>
        </div>
        <div className="card">
          <h3 className="card-title">// Leaderboard</h3>
          <p style={{ margin: 0, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            Built dynamically from real onchain submissions. Rank reflects verified pick volume
            and average declared confidence. Settlement-based ROI lands once the oracle is live.
          </p>
        </div>
      </section>
    </>
  );
}
