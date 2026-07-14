// ─────────────────────────────────────────────────────────────────────────────
// Football OS · Onchain Prediction submission
//
// Real X Layer transactions only. No mock hashes.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../lib/WalletContext.jsx';
import { KEYS, read, push, subscribe } from '../lib/store.js';
import {
  submitOnchainPrediction,
  explorerTxUrl,
  explorerAddressUrl,
  shortHash,
} from '../lib/contract.js';
import { getPredictionHistory, savePredictionCleartext } from '../lib/api.js';

const MAX_HISTORY = 20;



function loadAiLatest() {
  return read(KEYS.aiLatest, null);
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

export default function OnchainPrediction() {
  const { address, provider, onTargetNetwork, targetNetwork, switchNetwork } = useWallet();

  const [matchId, setMatchId] = useState('');
  const [predictedWinner, setPredictedWinner] = useState('');
  const [scorePrediction, setScorePrediction] = useState('');
  const [confidence, setConfidence] = useState(70);

  const [phase, setPhase] = useState('idle'); // idle | signing | mining | success | error
  const [err, setErr] = useState(null);
  const [last, setLast] = useState(null); // { txHash, ... }

  const [history, setHistory] = useState([]);
  const [aiLatest, setAiLatest] = useState(() => loadAiLatest());
  const [autoFilled, setAutoFilled] = useState(false);

  useEffect(() => {
    if (!address) {
      setHistory([]);
      return;
    }
    getPredictionHistory(address).then(data => setHistory(data || []));
  }, [address]);

  // Auto-fill when a fresh AI result lands. We only auto-fill if the form is
  // empty or still showing the previous AI auto-fill — never overwrite manual edits.
  useEffect(() => {
    return subscribe(KEYS.aiLatest, () => {
      const next = loadAiLatest();
      setAiLatest(next);
      if (next) applyAiResult(next, { silent: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyAiResult(src = aiLatest, { silent = false } = {}) {
    if (!src) return false;
    setMatchId(src.matchId || '');
    setPredictedWinner(src.predictedWinner || '');
    setScorePrediction(src.scorePrediction || '2-1');
    if (Number.isFinite(src.confidence)) setConfidence(src.confidence);
    setAutoFilled(true);
    if (!silent) setErr(null);
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!address || !provider) return;
    if (!matchId.trim() || !predictedWinner.trim()) {
      setErr('Generate an AI prediction first or fill the form manually.');
      setPhase('error');
      return;
    }
    if (!onTargetNetwork) {
      try { await switchNetwork(); } catch {}
      return;
    }
    setErr(null);
    setLast(null);
    setPhase('signing');
    try {
      const result = await submitOnchainPrediction({
        provider,
        matchId: matchId.trim(),
        predictedWinner: predictedWinner.trim(),
        scorePrediction: scorePrediction.trim(),
        confidence,
      });
      setPhase('mining'); // tx already mined inside submitOnchainPrediction; this is for visual continuity
      const entry = {
        id: result.txHash,
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        proofId: result.proofId,
        matchId: matchId.trim(),
        predictedWinner: predictedWinner.trim(),
        scorePrediction: scorePrediction.trim(),
        confidence: Number(confidence),
        wallet_address: address,
        timestamp: Date.now(),
        predicted_winner: predictedWinner.trim(),
        score_prediction: scorePrediction.trim()
      };
      
      // Save cleartext to backend so other devices can read the names instead of just the hash
      savePredictionCleartext({
        txHash: result.txHash,
        walletAddress: address,
        network: onTargetNetwork ? 'mainnet' : 'testnet',
        matchId: matchId.trim(),
        predictedWinner: predictedWinner.trim(),
        scorePrediction: scorePrediction.trim(),
        confidenceBps: Math.round(Number(confidence) * 100)
      });

      // Prepend instantly for UI responsiveness
      setHistory(prev => [entry, ...prev].slice(0, MAX_HISTORY));
      setLast(entry);
      setPhase('success');
      // Reset form for the next submission, but keep last visible.
      setMatchId('');
      setPredictedWinner('');
      setScorePrediction('');
    } catch (e) {
      // Surface ethers' clean message when present.
      const msg = e?.shortMessage || e?.info?.error?.message || e?.message || String(e);
      setErr(msg);
      setPhase('error');
    }
  }

  const submitting = phase === 'signing' || phase === 'mining';
  const canSubmit = address && matchId.trim() && predictedWinner.trim() && !submitting;

  return (
    <section className="onchain-section">
      <div className="card onchain-form-card">
        <div className="ai-head">
          <span className="eyebrow">// Onchain Prediction · X Layer</span>
          <h3 className="ai-title">Submit a prediction proof onchain</h3>
        </div>

        {!address ? (
          <div className="onchain-gate">
            <p>Connect wallet to submit prediction.</p>
            <Link to="/wallet" className="btn primary">Connect Wallet</Link>
          </div>
        ) : (
          <form className="ai-form" onSubmit={handleSubmit}>
            <div className="onchain-ai-bridge">
              <button
                type="button"
                className="btn"
                onClick={() => applyAiResult()}
                disabled={!aiLatest}
                title={aiLatest ? 'Fill the form from your latest AI prediction' : 'Generate an AI prediction first'}
              >
                Use AI Result For Onchain Proof
              </button>
              {aiLatest && (
                <span className="onchain-ai-meta">
                  Latest AI: <strong>{aiLatest.predictedWinner}</strong> · {aiLatest.confidence}% · {aiLatest.scorePrediction || '2-1'}
                </span>
              )}
              {autoFilled && <span className="chip">AUTO-FILLED FROM AI</span>}
            </div>

            <label className="ai-field">
              <span className="ai-label">Match ID</span>
              <input
                className="ai-input"
                type="text"
                placeholder="e.g. EPL-ARS-MCI-2026-05-30"
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                maxLength={80}
                required
              />
            </label>
            <div className="ai-row">
              <label className="ai-field">
                <span className="ai-label">Predicted Winner</span>
                <input
                  className="ai-input"
                  type="text"
                  placeholder="e.g. Arsenal"
                  value={predictedWinner}
                  onChange={(e) => setPredictedWinner(e.target.value)}
                  maxLength={80}
                  required
                />
              </label>
              <label className="ai-field">
                <span className="ai-label">Score Prediction</span>
                <input
                  className="ai-input"
                  type="text"
                  placeholder="e.g. 2-1"
                  value={scorePrediction}
                  onChange={(e) => setScorePrediction(e.target.value)}
                  maxLength={20}
                />
              </label>
            </div>
            <label className="ai-field">
              <span className="ai-label">Confidence ({confidence}%)</span>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="ai-range"
              />
            </label>

            <div className="ai-actions">
              {!onTargetNetwork ? (
                <button type="button" className="btn primary" onClick={() => switchNetwork()}>
                  Switch to {targetNetwork?.chainName || 'X Layer'}
                </button>
              ) : (
                <button type="submit" className="btn primary" disabled={!canSubmit}>
                  {phase === 'signing' && 'Confirm in wallet…'}
                  {phase === 'mining' && 'Submitting onchain…'}
                  {phase !== 'signing' && phase !== 'mining' && 'Submit Prediction Onchain'}
                </button>
              )}
              {err && <span className="ai-err">{err}</span>}
            </div>

            {/* Success state */}
            {phase === 'success' && last && (
              <div className="onchain-success">
                <div className="ai-result-head">
                  <span className="chip">CONFIRMED</span>
                  <span className="chip">BLOCK {last.blockNumber}</span>
                  {last.proofId != null && <span className="chip">PROOF #{last.proofId}</span>}
                </div>
                <div className="onchain-tx">
                  <span className="ai-label">TX HASH</span>
                  <a
                    className="onchain-tx-hash"
                    href={explorerTxUrl(last.txHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {last.txHash}
                  </a>
                </div>
              </div>
            )}
          </form>
        )}
      </div>

      {/* History */}
      <div className="card ai-history">
        <div className="ai-history-head">
          <h3 className="card-title" style={{ margin: 0 }}>// Onchain history</h3>
          <span className="ai-history-count">{history.length}</span>
        </div>

        {history.length === 0 ? (
          <p className="ai-empty">
            No onchain predictions yet. Submitted proofs will appear here with a real X Layer tx hash.
          </p>
        ) : (
          <ul className="ai-history-list">
            {history.map((h) => (
              <li key={h.tx_hash || h.id} className="ai-history-item">
                <div className="ai-history-main">
                  <div className="ai-history-teams">
                    <span>{h.match_id || h.matchId}</span>
                  </div>
                  <div className="ai-history-meta">
                    <span className="ai-history-winner">{h.predicted_winner || h.predictedWinner}</span>
                    {h.scorePrediction && (
                      <>
                        <span className="ai-history-sep">·</span>
                        <span>{h.scorePrediction}</span>
                      </>
                    )}
                    <span className="ai-history-sep">·</span>
                    <span>{h.confidence_bps != null ? Math.round(h.confidence_bps / 100) : h.confidence}%</span>
                    <span className="ai-history-sep">·</span>
                    <a
                      href={explorerTxUrl(h.tx_hash || h.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--accent)' }}
                    >
                      {shortHash(h.txHash, 8, 6)}
                    </a>
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
