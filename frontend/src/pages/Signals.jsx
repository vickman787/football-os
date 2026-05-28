import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { Loading, ErrorState, Skeleton } from '../components/States.jsx';

function timeAgo(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function Signals() {
  const { data, error, loading, refetch } = useFetch(api.signals, { pollMs: 5000 });
  const items = data?.signals ?? [];

  // tick to keep the "Xs ago" label fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">// Signal Feed · Live</span>
        <h1 className="title">Real-time alpha across the match window</h1>
        <p className="subtitle">
          Lineup leaks, sharp odds movement, weather, onchain whale activity. The feed
          refreshes every few seconds. New events slide in from the top.
        </p>
      </div>

      {error && <ErrorState error={error} onRetry={refetch} baseUrl={api.baseUrl} />}

      {loading && items.length === 0 && !error && (
        <>
          <Loading label="Streaming /api/signals" />
          <Skeleton height={62} count={6} />
        </>
      )}

      {!error && items.length > 0 && (
        <div className="signal-list">
          {items.map((s) => (
            <div key={s.id} className="signal">
              <span className="signal-tag">{s.tag}</span>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.14em', marginBottom: 4 }}>
                  {s.match}
                </div>
                <div className="signal-text">{s.text}</div>
              </div>
              <div className="signal-meta">
                <span className="conf">{Math.round(s.confidence * 100)}%</span>
                <span>{timeAgo(s.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
