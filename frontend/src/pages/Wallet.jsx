import { useState } from 'react';
import { useWallet } from '../lib/WalletContext.jsx';
import { X_LAYER } from '../lib/xlayer.js';
import WalletMenu from '../components/WalletMenu.jsx';
import { api } from '../lib/api.js';

export default function Wallet() {
  const {
    wallets, activeWallet, address, chainId, onTargetNetwork, targetNetwork, setTargetNetwork, busy, err,
    connect, switchNetwork,
  } = useWallet();

  const [proofBusy, setProofBusy] = useState(false);
  const [proofErr, setProofErr] = useState(null);
  const [proof, setProof] = useState(null);

  async function publishDemoProof() {
    setProofBusy(true);
    setProofErr(null);
    try {
      const r = await api.predict({
        wallet: address ?? '0x0000000000000000000000000000000000000000',
        matchId: 'epl-ars-mci',
        chainId: targetNetwork.chainId, // Send the intended chainId to the backend
      });
      setProof({ ...r.prediction, ...r.proof });
    } catch (e) {
      setProofErr(e.message || String(e));
    } finally {
      setProofBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">// Wallet · X Layer</span>
        <h1 className="title">Connect your wallet to publish predictions onchain</h1>
        <p className="subtitle">
          Football OS recommends <strong style={{ color: 'var(--accent)' }}>OKX Wallet</strong> for
          the smoothest X Layer experience. MetaMask and other injected wallets work too — we'll
          add the X Layer network to your wallet automatically if it's missing.
        </p>
      </div>

      <section className="section-grid">
        {/* ─── Connection panel ───────────────────────────────────────── */}
        <div className="card wallet-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>// Connection</h3>
            

          </div>

          {address ? (
            // CONNECTED — show the wallet pill (click for copy/disconnect menu)
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <WalletMenu variant="page" />
                <div className="wallet-state">
                  {onTargetNetwork
                    ? <span className="chip">{targetNetwork.chainName.toUpperCase()}</span>
                    : <span className="chip bad">WRONG NETWORK · {chainId}</span>}
                  {activeWallet && (
                    <span className="chip" style={{ background: 'rgba(57,255,20,0.04)' }}>
                      {activeWallet.name}
                    </span>
                  )}
                </div>
              </div>

              <dl className="kv">
                <dt>Wallet</dt><dd>{activeWallet?.name || '—'}</dd>
                <dt>Address</dt><dd style={{ wordBreak: 'break-all' }}>{address}</dd>
                <dt>Chain Id</dt><dd>{chainId ?? '—'}</dd>
                <dt>Network</dt>
                <dd>{chainId === X_LAYER.chainId ? 'X Layer Mainnet' : chainId ? `Chain ${chainId}` : '—'}</dd>
              </dl>

              {!onTargetNetwork && (
                <button className="btn primary" disabled={busy} onClick={() => switchNetwork()}>
                  Switch to {targetNetwork.chainName}
                </button>
              )}
            </>
          ) : (
            // DISCONNECTED — show wallet picker
            <>
              <div className="wallet-state">
                <span className="chip warn">DISCONNECTED</span>
              </div>

              <div className="wallet-picker">
                {wallets.length === 0 && (
                  <div className="card" style={{ borderColor: 'var(--line)', padding: 14 }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                      No EVM wallet detected. We recommend{' '}
                      <a href="https://www.okx.com/web3" target="_blank" rel="noreferrer">OKX Wallet</a>{' '}
                      for X Layer. MetaMask and other injected wallets also work.
                    </p>
                  </div>
                )}

                {wallets.map((w) => (
                  <button
                    key={w.id}
                    className={`wallet-option ${w.recommended ? 'recommended' : ''}`}
                    disabled={busy}
                    onClick={() => connect(w.id).catch(() => {})}
                  >
                    <span className="wallet-icon">
                      {w.icon
                        ? <img src={w.icon} alt="" width={20} height={20} />
                        : w.name.charAt(0)}
                    </span>
                    <span className="wallet-name">{w.name}</span>
                    {w.recommended && <span className="wallet-badge">RECOMMENDED</span>}
                  </button>
                ))}
              </div>
            </>
          )}

          {err && (
            <div style={{ color: 'var(--bad)', fontFamily: 'var(--mono)', fontSize: 12 }}>
              {err}
            </div>
          )}
        </div>

        {/* ─── Onchain proof panel ────────────────────────────────────── */}
        <div className="card wallet-card">
          <h3 className="card-title">// Publish prediction proof</h3>
          <p style={{ margin: 0, color: 'var(--text-dim)', lineHeight: 1.55, fontSize: 14 }}>
            For the MVP, the backend mints a deterministic hash representing your prediction. In
            production this hash is submitted to <strong>PredictionProof.sol</strong> on X Layer
            via the connected wallet.
          </p>
          <button
            className="btn primary"
            disabled={proofBusy || (address && !onTargetNetwork)}
            onClick={publishDemoProof}
          >
            Publish demo proof to {targetNetwork.chainName}
          </button>
          {address && !onTargetNetwork && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--warn)' }}>
              Switch to {targetNetwork.chainName} before publishing a proof.
            </p>
          )}
          {proofErr && (
            <div style={{ color: 'var(--bad)', fontFamily: 'var(--mono)', fontSize: 12 }}>
              {proofErr}
            </div>
          )}
          {proof && (
            <dl className="kv">
              <dt>Match</dt><dd>{proof.matchId}</dd>
              <dt>Pick</dt><dd>{proof.pick}</dd>
              <dt>Network</dt><dd>{proof.network} · {proof.chainId}</dd>
              <dt>Hash</dt><dd>{proof.hash}</dd>
              {(proof.chainId === X_LAYER.chainId || proof.chainId === X_LAYER_TESTNET.chainId) && (
                <>
                  <dt>Explorer</dt>
                  <dd>
                    <a
                      href={`${proof.chainId === X_LAYER.chainId ? X_LAYER.blockExplorerUrls[0] : X_LAYER_TESTNET.blockExplorerUrls[0]}/tx/${proof.hash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on OKLink
                    </a>
                  </dd>
                </>
              )}
            </dl>
          )}
        </div>
      </section>
    </>
  );
}
