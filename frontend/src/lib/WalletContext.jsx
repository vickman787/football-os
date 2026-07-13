import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  detectWallets,
  pickProvider,
  connectWallet as connectWalletFn,
  switchToXLayer as switchToXLayerFn,
  subscribe,
  X_LAYER,
  X_LAYER_TESTNET,
  DEFAULT_NETWORK
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
  
  // Track the user's intended network (Mainnet vs Testnet)
  const [targetNetwork, setTargetNetworkState] = useState(DEFAULT_NETWORK);

  const userDisconnectedRef = useRef(false);

  useEffect(() => {
    const ts = [120, 350, 800].map((ms) =>
      setTimeout(() => setWallets(detectWallets()), ms)
    );
    return () => ts.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function tryReconnect() {
      const session = read(KEYS.walletSession);
      if (!session?.walletId) { setHydrating(false); return; }

      // Also restore their target network preference if we stored it
      const savedNetwork = session.chainId === X_LAYER_TESTNET.chainId ? X_LAYER_TESTNET : X_LAYER;
      setTargetNetworkState(savedNetwork);

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
              clear(KEYS.walletSession);
            }
          } catch {}
          break;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      if (!cancelled) setHydrating(false);
    }
    tryReconnect();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activeWallet?.provider) return;
    return subscribe(activeWallet.provider, {
      onAccounts: (a) => {
        setAddress(a);
        if (!a) {
          setActiveWallet(null);
          clear(KEYS.walletSession);
        }
      },
      onChain: (cid) => setChainId(cid),
    });
  }, [activeWallet]);

  const onTargetNetwork = chainId === targetNetwork.chainId;

  const connect = useCallback(async (walletId) => {
    setErr(null);
    setBusy(true);
    userDisconnectedRef.current = false;
    try {
      const { wallet, address, chainId: newChainId } = await connectWalletFn({
        walletId,
        target: targetNetwork,
      });
      setActiveWallet(wallet);
      setAddress(address);
      setChainId(newChainId);
      write(KEYS.walletSession, { walletId: wallet.id, address, chainId: targetNetwork.chainId, savedAt: Date.now() });
    } catch (e) {
      setErr(e.message || String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }, [targetNetwork]);

  const switchNetwork = useCallback(async (network = targetNetwork) => {
    if (!activeWallet?.provider) return;
    setErr(null);
    setBusy(true);
    try {
      const cid = await switchToXLayerFn(activeWallet.provider, network);
      setChainId(cid);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [activeWallet, targetNetwork]);

  const setTargetNetwork = useCallback(async (network) => {
    setTargetNetworkState(network);
    if (activeWallet?.provider) {
      await switchNetwork(network);
      const session = read(KEYS.walletSession);
      if (session) {
        write(KEYS.walletSession, { ...session, chainId: network.chainId });
      }
    }
  }, [activeWallet, switchNetwork]);

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
    onTargetNetwork,
    targetNetwork,
    setTargetNetwork,
    busy,
    hydrating,
    err,
    connect,
    disconnect,
    switchNetwork,
    copyAddress,
    refreshWallets: () => setWallets(detectWallets()),
  }), [wallets, activeWallet, address, chainId, onTargetNetwork, targetNetwork, setTargetNetwork, busy, hydrating, err, connect, disconnect, switchNetwork, copyAddress]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}
