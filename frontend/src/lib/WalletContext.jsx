// ─────────────────────────────────────────────────────────────────────────────
// Football OS · Wallet context
//
// Centralizes wallet state (active wallet, address, chain) so the Nav and the
// Wallet page can share one connection. Mainnet only — X Layer (chainId 196).
//
// Persistence: when the user connects we remember the wallet id. On next page
// load we silently re-attach to the same provider (using `eth_accounts`, which
// does NOT trigger a popup) so the user appears already-connected. The user
// only "disconnects" by clicking Disconnect — which clears the saved session.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  detectWallets,
  pickProvider,
  connectWallet as connectWalletFn,
  switchToXLayer as switchToXLayerFn,
  subscribe,
  X_LAYER,
} from './xlayer.js';
import { KEYS, read, write, clear } from './store.js';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [wallets, setWallets] = useState(() => detectWallets());
  const [activeWallet, setActiveWallet] = useState(null);
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [hydrating, setHydrating] = useState(true);

  // Track an explicit disconnect so we don't auto-reconnect right after.
  const userDisconnectedRef = useRef(false);

  // Some wallets announce themselves slightly after mount via EIP-6963.
  // Re-detect a few times so the auto-reconnect can find them.
  useEffect(() => {
    const ts = [120, 350, 800].map((ms) =>
      setTimeout(() => setWallets(detectWallets()), ms)
    );
    return () => ts.forEach(clearTimeout);
  }, []);

  // ─── Silent auto-reconnect on mount ────────────────────────────────────────
  // Reads the saved walletId, finds the matching provider, and asks for
  // accounts WITHOUT the popup (eth_accounts, not eth_requestAccounts).
  useEffect(() => {
    let cancelled = false;
    async function tryReconnect() {
      const session = read(KEYS.walletSession);
      if (!session?.walletId) { setHydrating(false); return; }

      // Try repeatedly while EIP-6963 announcements arrive.
      for (let i = 0; i < 8 && !cancelled; i++) {
        const wallets = detectWallets();
        const wallet = wallets.find((w) => w.id === session.walletId);
        if (wallet?.provider) {
          try {
            const accounts = await wallet.provider.request({ method: 'eth_accounts' });
            const addr = accounts?.[0];
            if (addr) {
              const cid = await wallet.provider.request({ method: 'eth_chainId' });
              if (!cancelled) {
                setActiveWallet(wallet);
                setAddress(addr);
                setChainId(parseInt(cid, 16));
              }
            } else {
              // Wallet is installed but has revoked permission for this site.
              clear(KEYS.walletSession);
            }
          } catch {
            // ignore; will fall through to setHydrating(false)
          }
          break;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      if (!cancelled) setHydrating(false);
    }
    tryReconnect();
    return () => { cancelled = true; };
  }, []);

  // ─── React to account / chain changes from the connected wallet ────────────
  useEffect(() => {
    if (!activeWallet?.provider) return;
    return subscribe(activeWallet.provider, {
      onAccounts: (a) => {
        setAddress(a);
        if (!a) {
          // Account list emptied → user revoked permission in the wallet UI.
          setActiveWallet(null);
          clear(KEYS.walletSession);
        }
      },
      onChain: (cid) => setChainId(cid),
    });
  }, [activeWallet]);

  const onXLayer = chainId === X_LAYER.chainId;

  const connect = useCallback(async (walletId) => {
    setErr(null);
    setBusy(true);
    userDisconnectedRef.current = false;
    try {
      const { wallet, address, chainId } = await connectWalletFn({
        walletId,
        target: X_LAYER, // mainnet only
      });
      setActiveWallet(wallet);
      setAddress(address);
      setChainId(chainId);
      // Persist the session so we can silently reconnect on refresh.
      write(KEYS.walletSession, { walletId: wallet.id, address, savedAt: Date.now() });
    } catch (e) {
      setErr(e.message || String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!activeWallet?.provider) return;
    setErr(null);
    setBusy(true);
    try {
      const cid = await switchToXLayerFn(activeWallet.provider, X_LAYER);
      setChainId(cid);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [activeWallet]);

  // "Disconnect" in EIP-1193 land really means: forget the session locally.
  // Wallets generally don't expose a programmatic disconnect, so we clear our
  // state AND the persisted session so we won't auto-reconnect on next load.
  const disconnect = useCallback(() => {
    userDisconnectedRef.current = true;
    setActiveWallet(null);
    setAddress(null);
    setChainId(null);
    setErr(null);
    clear(KEYS.walletSession);
  }, []);

  const copyAddress = useCallback(async () => {
    if (!address) return false;
    try {
      await navigator.clipboard.writeText(address);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = address;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
      return true;
    }
  }, [address]);

  const value = useMemo(() => ({
    wallets,
    activeWallet,
    provider: activeWallet?.provider ?? null,
    address,
    chainId,
    onXLayer,
    busy,
    hydrating,
    err,
    connect,
    disconnect,
    switchNetwork,
    copyAddress,
    refreshWallets: () => setWallets(detectWallets()),
  }), [wallets, activeWallet, address, chainId, onXLayer, busy, hydrating, err, connect, disconnect, switchNetwork, copyAddress]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}
