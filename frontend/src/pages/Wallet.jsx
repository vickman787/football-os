import { useEffect, useState } from 'react';
import { connectAndSwitch, X_LAYER, X_LAYER_TESTNET } from '../lib/xlayer.js';
import { api } from '../lib/api.js';

export default function Wallet() {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState(null);

  useEffect(() => {
    if (!window.ethereum) return;
    const onChain = (cid) => setChainId(parseInt(cid, 16));
    const onAcct = (a) => setAddress(a?.[0] ?? null);
    window.ethereum.on?.('chainChanged', onChain);
    window.ethereum.on?.('accountsChanged', onAcct);
    return () => {
      window.ethereum.removeListener?.('chainChanged', onChain);
      window.ethereum.removeListener?.('accountsChanged', onAcct);
    };
  }, []);

  async function handleConnect(target) {
    setErr(null); setBusy(true);
    try {
      const { address, chainId } = await connectAndSwitch(target);
      setAddress(address);
      setChainId(chainId);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function publishDemoProof() {
    setBusy(true); setErr(null);
    try {
      const r = await api.predict({
        wallet: address ?? '0x0000000000000000000000000000000000000000',
        matchId: 'epl-ars-mci',
      });
      setProof({ ...r.prediction, ...r.proof });
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const onXLayer = chainId === X_LAYER.chainId || chainId === X_LAYER_TESTNET.chainId;

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">// Wallet · X Layer</span>
        <h1 className="title">Connect your wallet to publish predictions onchain</h1>
        <p className="subtitle">
          Football OS supports any EVM wallet (MetaMask, OKX Wallet, Rabby). On connect we
          request a switch to X Layer and add the network if it's missing.
        </p>
      </div>

      <section className="section-grid">
        <div className="card wallet-card">
          <h3 className="card-title">// Connection</h3>
          <div className="wallet-state">
            {address ? <span className="chip">CONNECTED</span> : <span className="chip warn">DISCONNECTED</span>}
            {chainId != null && (
              onXLayer
                ? <span className="chip">X LAYER · {chainId}</span>
                : <span className="chip bad">WRONG NETWORK · {chainId}</span>
            )}
          </div>
          <dl className="kv">
            <dt>Address</dt><dd>{address || '—'}</dd>
            <dt>Chain Id</dt><dd>{chainId ?? '—'}</dd>
          </dl>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn primary" disabled={busy} onClick={() => handleConnect(X_LAYER)}>
              Connect · X Layer Mainnet
            </button>
            <button className="btn" disabled={busy} onClick={() => handleConnect(X_LAYER_TESTNET)}>
              Connect · X Layer Testnet
            </button>
          </div>
          {err && <div style={{ color: 'var(--bad)', fontFamily: 'var(--mono)', fontSize: 12 }}>{err}</div>}
        </div>

        <div className="card wallet-card">
          <h3 className="card-title">// Publish prediction proof</h3>
          <p style={{ margin: 0, color: 'var(--text-dim)', lineHeight: 1.55, fontSize: 14 }}>
            For the MVP, the backend mints a deterministic hash representing your prediction. In
            production this hash is submitted to <strong>PredictionProof.sol</strong> on X Layer
            via the connected wallet.
          </p>
          <button className="btn primary" disabled={busy} onClick={publishDemoProof}>
            Publish demo proof
          </button>
          {proof && (
            <dl className="kv">
              <dt>Match</dt><dd>{proof.matchId}</dd>
              <dt>Pick</dt><dd>{proof.pick}</dd>
              <dt>Network</dt><dd>{proof.network} · {proof.chainId}</dd>
              <dt>Hash</dt><dd>{proof.hash}</dd>
            </dl>
          )}
        </div>
      </section>
    </>
  );
}
