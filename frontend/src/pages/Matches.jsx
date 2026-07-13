import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    async function fetchMatches() {
      try {
        const r = await fetch(`${api.baseUrl}/api/matches`);
        let j = {};
        try { j = await r.json(); } catch {}
        if (!r.ok) throw new Error(j.message || j.error || `matches ${r.status}`);
        if (alive) {
          setMatches(j.matches || []);
          setErr(null);
        }
      } catch (e) {
        if (alive) setErr(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchMatches();
    return () => {
      alive = false;
    };
  }, []);

  const handlePredict = (homeName, awayName) => {
    // Navigate to predictions page and prefill (could pass state or use local storage)
    // For simplicity, we just navigate to /predictions. 
    // Wait, let's use localStorage to pass a temporary context or just navigate.
    // In a real app we'd pass state via router or query params. Let's just pass state via Router.
    navigate('/predictions', { state: { teamA: homeName, teamB: awayName } });
  };

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">// Upcoming Fixtures</span>
        <h1 className="title">Football Matches</h1>
        <p className="subtitle">
          View upcoming football fixtures and launch the AI model with one click to generate a verifiable prediction on X Layer.
        </p>
      </div>

      <div className="card">
        {loading ? (
          <p className="ai-empty">Loading upcoming matches...</p>
        ) : err ? (
          <p className="ai-empty" style={{ color: 'var(--red)' }}>Error: {err}</p>
        ) : matches.length === 0 ? (
          <p className="ai-empty">No upcoming matches available at this time.</p>
        ) : (
          <div className="market-list">
            {matches.map((m, i) => (
              <article key={m.fixtureId || i} className="market-card" style={{ padding: '16px', marginBottom: '12px' }}>
                <div className="market-card-head" style={{ marginBottom: '12px' }}>
                  <div>
                    <div className="market-title">
                      {m.home?.name || 'Home'} vs {m.away?.name || 'Away'}
                    </div>
                    <div className="market-meta">
                      <span>{m.league || 'Football'}</span>
                    </div>
                  </div>
                  <button 
                    className="btn primary" 
                    onClick={() => handlePredict(m.home?.name, m.away?.name)}
                  >
                    Predict with AI
                  </button>
                </div>
                

              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
