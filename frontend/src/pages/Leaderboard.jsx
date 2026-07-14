import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function Leaderboard() {
  const [data, setData] = useState({ mainnet: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    async function fetchLb() {
      try {
        const r = await fetch(`${api.baseUrl}/api/leaderboard`);
        if (!r.ok) throw new Error(`leaderboard ${r.status}`);
        const j = await r.json();
        if (alive) {
          setData(j.leaderboard || { mainnet: [] });
          setErr(null);
        }
      } catch (e) {
        if (alive) setErr(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchLb();
    const interval = setInterval(fetchLb, 15000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const currentData = data.mainnet;

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">// Leaderboard</span>
        <h1 className="title">Global Rankings</h1>
        <p className="subtitle">
          Rankings are built dynamically from real onchain submissions on X Layer Mainnet. Rank reflects verified pick volume and average declared confidence.
        </p>
      </div>

      <div className="card">
        {loading ? (
          <p className="ai-empty">Syncing with X Layer...</p>
        ) : err ? (
          <p className="ai-empty" style={{ color: 'var(--red)' }}>Error: {err}</p>
        ) : currentData.length === 0 ? (
          <p className="ai-empty">No predictions found on mainnet yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '12px 8px' }}>Rank</th>
                  <th style={{ padding: '12px 8px' }}>Predictor (Wallet)</th>
                  <th style={{ padding: '12px 8px' }}>Total Proofs</th>
                  <th style={{ padding: '12px 8px' }}>Avg Confidence</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((row) => (
                  <tr key={row.wallet} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>#{row.rank}</td>
                    <td style={{ padding: '12px 8px', fontFamily: 'var(--mono)', fontSize: '0.9rem' }}>
                      {row.wallet.slice(0, 6)}...{row.wallet.slice(-4)}
                    </td>
                    <td style={{ padding: '12px 8px' }}>{row.totalPredictions}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span className="conf">{row.avgConfidence}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
