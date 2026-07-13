// Connected-state pill with a dropdown: Copy address / Disconnect / View on
// OKLink. Closes on outside click and on Escape.

import { useEffect, useRef, useState } from 'react';
import { useWallet } from '../lib/WalletContext.jsx';
import { X_LAYER } from '../lib/xlayer.js';

function shortAddr(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
}

export default function WalletMenu({ variant = 'nav' }) {
  const { address, activeWallet, chainId, onTargetNetwork, targetNetwork, disconnect, copyAddress, switchNetwork } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!address) return null;

  async function handleCopy() {
    const ok = await copyAddress();
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  }

  function handleDisconnect() {
    setOpen(false);
    disconnect();
  }

  return (
    <div className={`wallet-menu wallet-menu--${variant}`} ref={ref}>
      <button
        className={`wallet-pill ${onTargetNetwork ? '' : 'wallet-pill--warn'}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="wallet-pill-dot" />
        <span className="wallet-pill-addr">{shortAddr(address)}</span>
        <span className="wallet-pill-caret">▾</span>
      </button>

      {open && (
        <div className="wallet-dropdown" role="menu">
          <div className="wallet-dropdown-head">
            <div className="wallet-dropdown-name">{activeWallet?.name || 'Wallet'}</div>
            <div className="wallet-dropdown-addr" title={address}>{address}</div>
            <div className="wallet-dropdown-net">
              {onTargetNetwork
                ? <span className="chip">{targetNetwork?.chainName || 'X Layer'}</span>
                : <span className="chip bad">WRONG NETWORK · {chainId}</span>}
            </div>
          </div>

          <div className="wallet-dropdown-actions">
            {!onTargetNetwork && (
              <button className="wallet-action" onClick={() => { setOpen(false); switchNetwork(); }}>
                Switch to {targetNetwork?.chainName || 'X Layer'}
              </button>
            )}
            <button className="wallet-action" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy address'}
            </button>
            <a
              className="wallet-action"
              href={`${X_LAYER.blockExplorerUrls[0]}/address/${address}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              View on OKLink
            </a>
            <button className="wallet-action wallet-action--danger" onClick={handleDisconnect}>
              Disconnect wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
