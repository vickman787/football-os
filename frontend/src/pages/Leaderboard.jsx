// ─────────────────────────────────────────────────────────────────────────────
// Football OS · Leaderboard
//
// PUBLIC + GLOBAL. The leaderboard never filters by the connected wallet —
// it reads every onchain submission stored locally and ranks each unique
// wallet that has ever submitted on this device.
//
// The "My Stats" card is the ONLY place that depends on the connected wallet.
// Until oracle settlement is live, `accuracy` is a placeholder ("—").
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { KEYS, read, subscribe } from '../lib/store.js';
import { explorerAddressUrl, shortHash } from '../lib/contract.js';
import { useWallet } from '../lib/WalletContext.jsx';

function loadSubmissions() {
  const v = read(KEYS.onchainSubmissions, []);
  return Array.isArray(v) ? v : [];
}

/**
 * Build the public leaderboard from ALL submissions. Never filters by the
 * connected wallet. Sort order:
 *   1. predictionCount desc
 *   2. averageConfidence desc
 *   3. accuracy desc (placeholder for future oracle settlement)
 *   4. most recent submission first (tie-breaker)
 */
function buildLeaderboard(subs) {
  const by = new Map();
  for (const s of subs) {
    if (!s?.wallet) continue;
    const key = s.wallet.toLowerCase();
    const row = by.get(key) || {
      wallet: s.wallet,
      predictionCount: 0,
      totalConfidence: 0,
      lastAt: 0,
    };
    row.predictionCount += 1;
    row.totalConfidence += Number(s.confidence) || 0;
    const ts = new Date(s.timestamp).getTime();
    if (Number.isFinite(ts) && ts > row.lastAt) row.lastAt = ts;
    by.set(key, row);
  }

  const rows = [...by.values()].map((r) => ({
    wallet: r.wallet,
    predictionCount: r.predictionCount,
    averageConfidence: r.predictionCount
      ? Math.round(r.totalConfidence / r.predictionCount)
      : 0,
    accuracy: null, // oracle settlement coming later
    lastAt: r.lastAt,
  }));

  rows.sort((a, b) => {
    if (b.predictionCount !== a.predictionCount) return b.predictionCount - a.predictionCount;
    if (b.averageConfidence !== a.averageConfidence) return b.averageConfidence - a.averageConfidence;
    const accA = a.accuracy ?? -1;
    const accB = b.accuracy ?? -1;
    if (accB !== accA) return accB - accA;
    return b.lastAt - a.lastAt;
  });

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

function findMyRow(rows, address) {
  if (!address) return null;
  const lower = address.toLowerCase();
  return rows.find((r) => r.wallet.toLowerCase() === lower) || null;
}

function MyStats({ address, row }) {
  if (!address) {
    return (
      <div className="card my-stats empty">
        <span className="eyebrow">// My Stats</span>
        <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', lineHeight: 1.55 }}>
          Connect wallet to view your personal stats.
        </p>
      </div>
    );
  }

  return (
    <div className="card my-stats">
      <span className="eyebrow">// My Stats</span>
      <div className="my-stats-head">
        <div>
          <div className="my-stats-label">Wallet</div>
          <a
            href={explorerAddressUrl(address)}
            target="_blank"
            rel="noreferrer"
            className="my-stats-addr"
            title={address}
          >
            {shortHash(address, 6, 4)}
          </a>
        </div>
        <div className="my-stats-rank">
          {row ? `#${row.rank}` : 'Unranked'}
        </div>
      </div>
      <div className="my-stats-grid">
        <div className="my-stat">
          <div className="v">{row?.predictionCount ?? 0}</div>
          <div className="l">Predictions</div>
        </div>
        <div className="my-stat">
          <div className="v">{row ? `${row.averageConfidence}%` : '—'}</div>
          <div className="l">Avg Confidence</div>
        </div>
        <div className="my-stat">
          <div className="v">—</div>
          <div className="l">Accuracy</div>
        </div>
        <div className="my-stat">
          <div className="v" style={{ fontSize: 14 }}>
            {row?.lastAt ? new Date(row.lastAt).toLocaleDateString() : '—'}
          </div>
          <div className="l">Last Submission</div>
        </div>
      </div>
      {!row && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
          No submissions from this wallet yet — publish a prediction onchain to appear in the
          leaderboard.
        </p>
      )}
    </div>
  );
}

export default function Leaderboard() {
  const [subs, setSubs] = useState(() => loadSubmissions());
  const { address } = useWallet();

  useEffect(
    () => subscribe(KEYS.onchainSubmissions, () => setSubs(loadSubmissions())),
    []
  );

  // GLOBAL ranking — independent of `address`.
  const rows = buildLeaderboard(subs);
  const myRow = findMyRow(rows, address);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">// Leaderboard · Public</span>
        <h1 className="title">Top predictors anchored to X Layer</h1>
        <p className="subtitle">
          Public rankings across every wallet that has submitted a prediction onchain. Rank
          reflects verified pick volume and average declared confidence. Once oracle settlement is
          live, accuracy populates here automatically.
        </p>
      </div>

      <MyStats address={address} row={myRow} />

      {rows.length === 0 ? (
        <div className="card empty-card" style={{ marginTop: 16 }}>
          <span className="eyebrow">// No public leaderboard entries</span>
          <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', lineHeight: 1.55 }}>
            No public leaderboard entries yet. Submit an onchain prediction to appear here.
          </p>
        </div>
      ) : (
        <div className="card lb-card" style={{ padding: 0, marginTop: 16 }}>
          <div className="lb-scroll">
            <table className="lb">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Wallet</th>
                  <th>Predictions</th>
                  <th>Avg Confidence</th>
                  <th>Accuracy</th>
                  <th>Last Submission</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const mine = address && r.wallet.toLowerCase() === address.toLowerCase();
                  return (
                    <tr key={r.wallet} className={mine ? 'lb-row-mine' : ''}>
                      <td className={`rank rank-${r.rank}`}>#{r.rank}</td>
                      <td className="wallet">
                        <a
                          href={explorerAddressUrl(r.wallet)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--text)' }}
                        >
                          {shortHash(r.wallet, 6, 4)}
                        </a>
                        {mine && <span className="lb-you">YOU</span>}
                      </td>
                      <td className="num">{r.predictionCount}</td>
                      <td className="num pos">{r.averageConfidence}%</td>
                      <td className="num" style={{ color: 'var(--text-dim)' }}>—</td>
                      <td className="num">
                        {r.lastAt ? new Date(r.lastAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
