// ─────────────────────────────────────────────────────────────────────────────
// Football OS · Leaderboard (Coming Soon)
//
// The public leaderboard ships with the Phase 2 reputation system. Until the
// shared database + oracle settlement land, this page previews the feature
// set so users know what's coming and keep submitting predictions onchain.
//
// No wallet dependency — the page renders identically connected or not.
// ─────────────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: 'Global Rankings',
    desc: 'Compare performance across all Football OS users.',
    icon: 'G',
  },
  {
    title: 'Oracle Reputation',
    desc: 'Build a verifiable football prediction identity.',
    icon: 'O',
  },
  {
    title: 'Accuracy Tracking',
    desc: 'Historical prediction performance and hit rate.',
    icon: 'A',
  },
  {
    title: 'Onchain Proofs',
    desc: 'Rankings backed by verifiable X Layer submissions.',
    icon: 'X',
  },
  {
    title: 'Prediction Streaks',
    desc: 'Track consistency and winning runs.',
    icon: 'S',
  },
];

export default function Leaderboard() {
  return (
    <>
      <div className="page-head">
        <span className="eyebrow">// Leaderboard · Phase 2</span>
        <h1 className="title">Public Leaderboard Coming Soon</h1>
        <p className="subtitle">
          The Football OS leaderboard will rank predictors based on verified onchain submissions,
          prediction accuracy, confidence scores, and long-term performance. Rankings will become
          available after the public reputation system launches.
        </p>
        <div className="lb-status-row">
          <span className="lb-status-badge">PHASE 2 FEATURE</span>
        </div>
      </div>

      <div className="lb-feature-grid">
        {FEATURES.map((f) => (
          <div key={f.title} className="card lb-feature">
            <div className="lb-feature-icon">{f.icon}</div>
            <h3 className="lb-feature-title">{f.title}</h3>
            <p className="lb-feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="card lb-note">
        <span className="eyebrow">// Keep building reputation</span>
        <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Continue submitting predictions. Historical data will be used when the leaderboard
          launches.
        </p>
      </div>
    </>
  );
}
