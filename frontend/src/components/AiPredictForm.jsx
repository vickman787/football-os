// ─────────────────────────────────────────────────────────────────────────────
// Football OS · AI Match Prediction
//
// Form → POST /api/ai-predict → display result → store in localStorage.
// Latest 10 predictions persisted across refreshes; user can clear history.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, getAiHistory, saveAiHistory } from '../lib/api.js';
import { KEYS, read, write, subscribe } from '../lib/store.js';
import { useWallet } from '../lib/WalletContext.jsx';

const STORAGE_KEY = KEYS.aiHistory;
const MAX_HISTORY = 10;

function loadHistory() {
  const v = read(STORAGE_KEY, []);
  return Array.isArray(v) ? v : [];
}

function saveHistory(items) {
  write(STORAGE_KEY, items);
}

function timeAgo(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function riskClass(level) {
  const v = (level || '').toLowerCase();
  if (v === 'low') return 'risk risk--low';
  if (v === 'high') return 'risk risk--high';
  return 'risk risk--medium';
}

export default function AiPredictForm() {
  const location = useLocation();
  const { address } = useWallet();
  const [teamA, setTeamA] = useState(location.state?.teamA || '');
  const [teamB, setTeamB] = useState(location.state?.teamB || '');
  const [matchContext, setMatchContext] = useState('');
  const [isNeutralVenue, setIsNeutralVenue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState(() => loadHistory());

  // Load from Supabase if address exists
  useEffect(() => {
    let cancelled = false;
    async function fetchHistory() {
      if (!address) {
        setHistory(loadHistory());
        return;
      }
      const data = await getAiHistory(address);
      if (!cancelled && data && data.length > 0) {
        const mapped = data.map(h => ({
          id: h.id,
          teamA: h.team_a,
          teamB: h.team_b,
          predictedWinner: h.predicted_winner,
          confidence: h.confidence,
          riskLevel: h.risk_level,
          timestamp: h.timestamp
        }));
        setHistory(mapped);
      } else if (!cancelled) {
        setHistory(loadHistory());
      }
    }
    fetchHistory();
    return () => { cancelled = true; };
  }, [address]);

  // Persist + cross-tab sync.
  useEffect(() => { saveHistory(history); }, [history]);
  useEffect(() => subscribe(STORAGE_KEY, () => {
    if (!address) setHistory(loadHistory());
  }), [address]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!teamA.trim() || !teamB.trim() || busy) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    setCopied(false);
    try {
      let finalContext = matchContext.trim();
      if (isNeutralVenue) {
        finalContext = finalContext ? `${finalContext} (Note: This match is being played at a neutral venue)` : 'Note: This match is being played at a neutral venue';
      }

      const res = await api.aiPredict({
        teamA: teamA.trim(),
        teamB: teamB.trim(),
        matchContext: finalContext,
      });
      setResult(res);
      // Make the latest result available to the Onchain form (auto-fill).
      write(KEYS.aiLatest, {
        teamA: teamA.trim(),
        teamB: teamB.trim(),
        predictedWinner: res.predictedWinner,
        confidence: res.confidence,
        scorePrediction: res.scorePrediction || '2-1',
        matchId: res.matchId,
        riskLevel: res.riskLevel,
        timestamp: new Date().toISOString(),
      });
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        teamA: teamA.trim(),
        teamB: teamB.trim(),
        predictedWinner: res.predictedWinner,
        confidence: res.confidence,
        riskLevel: res.riskLevel,
        timestamp: new Date().toISOString(),
      };
      
      if (address) {
        saveAiHistory({
          id: entry.id,
          wallet_address: address,
          team_a: entry.teamA,
          team_b: entry.teamB,
          predicted_winner: entry.predictedWinner,
          confidence: entry.confidence,
          risk_level: entry.riskLevel,
          timestamp: entry.timestamp
        });
      }

      setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function clearHistory() {
    setHistory([]);
  }

  async function copyXPost() {
    if (!result?.suggestedXPost) return;
    try {
      await navigator.clipboard.writeText(result.suggestedXPost);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  const isMock = result && result.source && result.source !== 'openrouter';

  return (
    <section className="ai-section">
      <div className="card ai-card">
        <div className="ai-head">
          <div>
            <span className="eyebrow">// AI Engine</span>
            <h3 className="ai-title">Generate a match prediction</h3>
            <p className="ai-sub">
              Provide both teams plus optional context. The Football OS AI engine returns a
              structured pick with a confidence score, reasoning, and a suggested X post.
            </p>
          </div>
        </div>

        <form className="ai-form" onSubmit={handleSubmit}>
          <div className="ai-row">
            <label className="ai-field">
              <span className="ai-label">Team A</span>
              <input
                className="ai-input"
                type="text"
                placeholder="e.g. Arsenal"
                value={teamA}
                onChange={(e) => setTeamA(e.target.value)}
                maxLength={80}
                required
              />
            </label>
            <label className="ai-field">
              <span className="ai-label">Team B</span>
              <input
                className="ai-input"
                type="text"
                placeholder="e.g. Manchester City"
                value={teamB}
                onChange={(e) => setTeamB(e.target.value)}
                maxLength={80}
                required
              />
            </label>
          </div>
          
          <label className="ai-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '-8px', marginBottom: '16px' }}>
            <input 
              type="checkbox" 
              checked={isNeutralVenue}
              onChange={(e) => setIsNeutralVenue(e.target.checked)}
              style={{ width: 'auto', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Neutral Venue (e.g. World Cup, Final)</span>
          </label>
          <label className="ai-field">
            <span className="ai-label">Match Context (optional)</span>
            <textarea
              className="ai-input ai-textarea"
              rows={3}
              placeholder="Form, injuries, venue, head-to-head, weather…"
              value={matchContext}
              onChange={(e) => setMatchContext(e.target.value)}
              maxLength={1000}
            />
          </label>

          <div className="ai-actions">
            <button type="submit" className="btn primary" disabled={busy || !teamA.trim() || !teamB.trim()}>
              {busy ? 'Generating…' : 'Generate AI Prediction'}
            </button>
            {err && <span className="ai-err">{err}</span>}
          </div>
        </form>

        {/* Result card */}
        {result && (
          <div className="ai-result">
            <div className="ai-result-head">
              <span className="chip">PREDICTED WINNER</span>
              {isMock
                ? <span className="chip warn">FALLBACK</span>
                : <span className="chip">LIVE AI</span>}
              <span className={riskClass(result.riskLevel)}>{result.riskLevel || 'Medium'} RISK</span>
            </div>

            <div className="ai-winner">{result.predictedWinner}</div>

            <div className="ai-conf">
              <div className="bar"><span style={{ width: `${Math.max(0, Math.min(100, result.confidence))}%` }} /></div>
              <div className="ai-conf-label">Confidence {result.confidence}%</div>
            </div>

            <div className="ai-reasoning">{result.reasoning}</div>

            {result.suggestedXPost && (
              <div className="ai-xpost">
                <div className="ai-xpost-head">
                  <span className="ai-xpost-label">SUGGESTED X POST</span>
                  <button type="button" className="ai-copy" onClick={copyXPost}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="ai-xpost-body">{result.suggestedXPost}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History */}
      <div className="card ai-history">
        <div className="ai-history-head">
          <h3 className="card-title" style={{ margin: 0 }}>// Prediction history</h3>
          <div className="ai-history-actions">
            <span className="ai-history-count">{history.length} / {MAX_HISTORY}</span>
            <button
              type="button"
              className="btn ghost"
              onClick={clearHistory}
              disabled={history.length === 0}
            >
              Clear History
            </button>
          </div>
        </div>

        {history.length === 0 ? (
          <p className="ai-empty">No predictions yet. Generate one above and it will appear here — saved across refreshes.</p>
        ) : (
          <ul className="ai-history-list">
            {history.map((h) => (
              <li key={h.id} className="ai-history-item">
                <div className="ai-history-main">
                  <div className="ai-history-teams">
                    <span>{h.teamA}</span>
                    <span className="ai-history-vs">vs</span>
                    <span>{h.teamB}</span>
                  </div>
                  <div className="ai-history-meta">
                    <span className="ai-history-winner">{h.predictedWinner}</span>
                    <span className="ai-history-sep">·</span>
                    <span>{h.confidence}%</span>
                    <span className="ai-history-sep">·</span>
                    <span className={riskClass(h.riskLevel)}>{h.riskLevel}</span>
                  </div>
                </div>
                <div className="ai-history-time">{timeAgo(h.timestamp)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
