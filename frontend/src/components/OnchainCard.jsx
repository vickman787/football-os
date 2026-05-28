import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KEYS, read, subscribe } from '../lib/store.js';
import { explorerTxUrl, shortHash } from '../lib/contract.js';

function loadLatest() {
  const v = read(KEYS.onchainSubmissions, []);
  return Array.isArray(v) && v.length ? v[0] : null;
}

export default function OnchainCard() {
  const [latest, setLatest] = useState(() => loadLatest());

  useEffect(() => subscribe(KEYS.onchainSubmissions, () => setLatest(loadLatest())), []);

  if (!latest) {
    return (
      <div className="card">
        <h3 className="card-title">// Onchain Prediction · Latest</h3>
        <p style={{ margin: 0, color: 'var(--text-dim)', lineHeight: 1.55, fontSize: 13 }}>
          No onchain proofs yet. <Link to="/predictions">Submit one</Link> and your latest tx will
          appear here, anchored to X Layer.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title">// Onchain Prediction · Latest</h3>
      <div className="onchain">
        <div className="meta">
          <div style={{ fontSize: 18, fontWeight: 600 }}>{latest.predictedWinner}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.12em' }}>
            MATCH {latest.matchId} · CONFIDENCE {latest.confidence}% · X LAYER · 196
          </div>
          <a
            className="hash"
            href={explorerTxUrl(latest.txHash)}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'block', color: 'var(--text-dim)' }}
          >
            {shortHash(latest.txHash, 14, 12)}
          </a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="chip">VERIFIED</span>
          {latest.proofId != null && <span className="chip">#{latest.proofId}</span>}
        </div>
      </div>
    </div>
  );
}
