export default function OnchainCard() {
  const sample = {
    matchId: 'epl-ars-mci',
    pick: 'Arsenal Win',
    confidence: 0.62,
    network: 'X Layer · 196',
    hash: '0x9c8f4b21a73fde5c09a1b27e4a4d6f8b1e3c0d5a9f2b7c81e64f0a3d1b5e9c70',
  };

  return (
    <div className="card">
      <h3 className="card-title">// Onchain Prediction · Latest</h3>
      <div className="onchain">
        <div className="meta">
          <div style={{ fontSize: 18, fontWeight: 600 }}>{sample.pick}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.12em' }}>
            MATCH {sample.matchId} · CONFIDENCE {Math.round(sample.confidence * 100)}% · {sample.network}
          </div>
          <div className="hash">{sample.hash}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="chip">VERIFIED</span>
          <span className="chip">SOULBOUND</span>
        </div>
      </div>
    </div>
  );
}
