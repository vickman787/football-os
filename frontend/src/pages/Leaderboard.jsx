// ─────────────────────────────────────────────────────────────────────────────
// Football OS · Leaderboard
//
// Built dynamically from onchain submissions stored in localStorage. Until
// settlements arrive (oracle integration), we rank by submission volume and
// average confidence — both verifiable signals. No fake ROI or streaks.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { KEYS, read, subscribe } from '../lib/store.js';
import { explorerAddressUrl, shortHash } from '../lib/contract.js';

function loadSubmissions() {
  const v = read(KEYS.onchainSubmissions, []);
  return Array.isArray(v) ? v : [];
}

function buildLeaderboard(subs) {
  const by = new Map();
  for (const s of subs) {
    if (!s?.wallet) continue;
    const w = s.wallet.toLowerCase();
    const row = by.get(w) || { wallet: s.wallet, picks: 0, totalConf: 0, lastAt: 0 };
    row.picks += 1;
    row.totalConf += Number(s.confidence) || 0;
    const ts = new Date(s.timestamp).getTime();
    if (ts > row.lastAt) row.lastAt = ts;
    by.set(w, row);
  }
  const rows = [...by.values()].map((r) => ({
    ...r,
    avgConfidence: r.picks ? Math.round(r.totalConf / r.picks) : 0,
  }));
  // Rank by picks desc, then avgConfidence desc, then most recent first.
  rows.sort((a, b) => b.picks - a.picks || b.avgConfidence - a.avgConfidence || b.lastAt - a.lastAt);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export default function Leaderboard() {
  const [subs, setSubs] = useState(() => loadSubmissions());

  useEffect(() => subscribe(KEYS.onchainSubmissions, () => setSubs(loadSubmissions())), []);

  const rows = buildLeaderboard(subs);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">// Leaderboard · Onchain</span>
        <h1 className="title">Top predictors anchored to X Layer</h1>
        <p className="subtitle">
          Built from real onchain submissions. Rank reflects verified pick volume and average
          declared confidence. Once oracle settlement is live, accuracy and ROI will populate
          here automatically.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card empty-card">
          <span className="eyebrow">// No onchain predictions yet</span>
          <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', lineHeight: 1.55 }}>
            Submit a prediction from the <a href="/predictions">AI Predictions</a> page to start
            building the leaderboard. Each onchain submission shows up here, indexed by wallet.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="lb">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Wallet</th>
                <th>Picks</th>
                <th>Avg Confidence</th>
                <th>Last Submission</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.wallet}>
                  <td className={`rank rank-${r.rank}`}>#{r.rank}</td>
                  <td className="wallet">
                    <a href={explorerAddressUrl(r.wallet)} target="_blank" rel="noreferrer" style={{ color: 'var(--text)' }}>
                      {shortHash(r.wallet, 6, 4)}
                    </a>
                  </td>
                  <td className="num">{r.picks}</td>
                  <td className="num pos">{r.avgConfidence}%</td>
                  <td className="num">{new Date(r.lastAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
