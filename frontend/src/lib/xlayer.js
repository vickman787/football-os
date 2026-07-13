// ─────────────────────────────────────────────────────────────────────────────
// Football OS · Wallet helpers
//
// This file does three things:
//   1. Defines the X Layer network configs (mainnet + testnet) so we can ask
//      the wallet to switch to / add the network.
//   2. Detects which wallets the user has installed (OKX first, then MetaMask,
//      then any other injected wallet).
//   3. Exposes small helpers the UI calls: pickProvider(), connectWallet(),
//      switchToXLayer(), getConnectionState().
//
// We deliberately keep this dependency-free (no wagmi/viem at this layer) so
// the wallet flow works even on the simplest hackathon setup. If you later
// install Reown / wagmi / viem, you can layer them on top — this module stays
// useful as the low-level fallback.
// ─────────────────────────────────────────────────────────────────────────────

// X Layer Mainnet — the network we want every prediction proof anchored to.
// `chainIdHex` is what `wallet_switchEthereumChain` expects (hex with 0x).
export const X_LAYER = {
  chainId: 196,
  chainIdHex: '0xc4', // 196 → 0xc4
  chainName: 'X Layer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: ['https://rpc.xlayer.tech'],
  blockExplorerUrls: ['https://www.oklink.com/xlayer'],
};

// X Layer Testnet — handy for hackathon demos before we deploy to mainnet.
export const X_LAYER_TESTNET = {
  chainId: 1952,
  chainIdHex: '0x7a0', // 1952 → 0x7a0
  chainName: 'X Layer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: ['https://testrpc.xlayer.tech'],
  blockExplorerUrls: ['https://www.oklink.com/xlayer-test'],
};

// Allow .env override (VITE_X_LAYER_CHAIN_ID=195 to demo on testnet).
const ENV_CHAIN = Number(import.meta.env?.VITE_X_LAYER_CHAIN_ID);
export const DEFAULT_NETWORK =
  ENV_CHAIN === X_LAYER_TESTNET.chainId ? X_LAYER_TESTNET : X_LAYER;

// ─── Wallet detection ────────────────────────────────────────────────────────
//
// Modern browser wallets advertise themselves in two ways:
//   (a) Legacy: they inject a single `window.ethereum` object.
//       OKX Wallet additionally injects `window.okxwallet` for unambiguous detection.
//   (b) EIP-6963: each wallet announces itself via a CustomEvent so the dapp
//       can list every installed wallet without guessing.
//
// We use both. Then we dedupe by wallet id, preferring the entry with the
// best metadata (an icon shipped by EIP-6963 beats the bare legacy entry).

import { FALLBACK_ICONS } from './walletIcons.js';

function dedupePreferIcon(list) {
  // Group by id, then keep the first entry that has an icon — falling back to
  // the first entry overall if none have one.
  const byId = new Map();
  for (const w of list) {
    const existing = byId.get(w.id);
    if (!existing) { byId.set(w.id, w); continue; }
    if (!existing.icon && w.icon) byId.set(w.id, w);
  }
  return Array.from(byId.values());
}

/**
 * Returns a normalized list of available wallets, OKX always first.
 * Each entry: { id, name, recommended, provider, icon? }
 */
export function detectWallets() {
  const found = [];
  const seenProviders = new Set();

  // 1) OKX Wallet via its dedicated injection. Most reliable signal that the
  //    user has OKX Wallet installed, even when MetaMask is also present.
  if (typeof window !== 'undefined' && window.okxwallet) {
    found.push({
      id: 'okx',
      name: 'OKX Wallet',
      recommended: true,
      provider: window.okxwallet,
    });
    seenProviders.add(window.okxwallet);
  }

  // 2) EIP-6963 announcements. We synchronously read whatever wallets have
  //    already announced themselves on this page (most do so on load).
  if (typeof window !== 'undefined') {
    const announcements = window.__eip6963Providers || [];
    for (const a of announcements) {
      const p = a.provider;
      if (!p || seenProviders.has(p)) continue;
      const name = a.info?.name || 'Wallet';
      // Normalize id so two paths to the same wallet collapse together
      // (e.g. window.okxwallet + EIP-6963 OKX both become id 'okx').
      const id = /okx/i.test(name)
        ? 'okx'
        : /metamask/i.test(name)
          ? 'metamask'
          : (a.info?.rdns || name.toLowerCase().replace(/\s+/g, '-'));
      found.push({
        id,
        name,
        recommended: id === 'okx',
        provider: p,
        icon: a.info?.icon,
      });
      seenProviders.add(p);
    }
  }

  // 3) Legacy `window.ethereum`. MetaMask, Rabby, Brave wallet, etc. We also
  //    handle the case where multiple wallets coexist via `providers` array.
  if (typeof window !== 'undefined' && window.ethereum) {
    const list = Array.isArray(window.ethereum.providers)
      ? window.ethereum.providers
      : [window.ethereum];
    for (const p of list) {
      if (!p || seenProviders.has(p)) continue;
      const isOkx = p.isOkxWallet || p.isOKExWallet;
      const isMM = p.isMetaMask;
      const id = isOkx ? 'okx' : isMM ? 'metamask' : 'injected';
      const name = isOkx ? 'OKX Wallet' : isMM ? 'MetaMask' : 'Injected Wallet';
      found.push({
        id,
        name,
        recommended: isOkx,
        provider: p,
        icon: FALLBACK_ICONS[id], // fox for MetaMask when EIP-6963 didn't fire
      });
      seenProviders.add(p);
    }
  }

  // Dedupe so OKX (or any wallet) doesn't appear twice when it shows up via
  // both window.okxwallet and EIP-6963. Prefer the entry that carries an icon.
  const deduped = dedupePreferIcon(found);

  // Sort: OKX first, then everything else preserving insertion order.
  deduped.sort((a, b) => Number(b.recommended) - Number(a.recommended));
  return deduped;
}

/**
 * Pick the best available provider. Defaults to OKX when present.
 * Pass an `id` (e.g. 'metamask') to force a specific wallet.
 */
export function pickProvider(id) {
  const wallets = detectWallets();
  if (id) {
    const match = wallets.find((w) => w.id === id);
    if (match) return match;
  }
  return wallets[0] || null;
}

/** True if any wallet is detected at all. */
export function hasAnyWallet() {
  return detectWallets().length > 0;
}

// ─── Connection helpers ──────────────────────────────────────────────────────

/**
 * Ask the chosen wallet for the user's accounts. Triggers the wallet popup
 * if the user has not yet authorized this site.
 */
export async function requestAccounts(provider) {
  if (!provider) throw new Error('No wallet provider. Install OKX Wallet to continue.');
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  const chainId = await provider.request({ method: 'eth_chainId' });
  return { address: accounts[0] ?? null, chainIdHex: chainId, chainId: parseInt(chainId, 16) };
}

/**
 * Switch the wallet to X Layer. If the network is not yet added to the wallet
 * (error code 4902), we add it using the config above and switch automatically.
 */
export async function switchToXLayer(provider, target = DEFAULT_NETWORK) {
  if (!provider) throw new Error('No wallet provider.');
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: target.chainIdHex }],
    });
  } catch (err) {
    // 4902 = "this chain has not been added to the wallet yet"
    if (err?.code === 4902 || /Unrecognized chain/i.test(err?.message || '')) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: target.chainIdHex,
          chainName: target.chainName,
          nativeCurrency: target.nativeCurrency,
          rpcUrls: target.rpcUrls,
          blockExplorerUrls: target.blockExplorerUrls,
        }],
      });
    } else {
      throw err;
    }
  }
  return target.chainId;
}

/**
 * One-shot connect: pick a wallet (OKX preferred), request accounts, and
 * switch to X Layer if the user is on a different network.
 */
export async function connectWallet({ walletId, target = DEFAULT_NETWORK } = {}) {
  const wallet = pickProvider(walletId);
  if (!wallet) {
    throw new Error('No EVM wallet detected. Install OKX Wallet (recommended) or MetaMask.');
  }
  const { address, chainId } = await requestAccounts(wallet.provider);
  if (chainId !== target.chainId) {
    await switchToXLayer(wallet.provider, target);
  }
  return { wallet, address, chainId: target.chainId };
}

/**
 * Subscribe to wallet events (account changes, network changes). Returns an
 * unsubscribe function the React effect can call on cleanup.
 */
export function subscribe(provider, { onAccounts, onChain }) {
  if (!provider?.on) return () => {};
  const a = (accs) => onAccounts?.(accs?.[0] ?? null);
  const c = (cid) => onChain?.(parseInt(cid, 16));
  provider.on('accountsChanged', a);
  provider.on('chainChanged', c);
  return () => {
    provider.removeListener?.('accountsChanged', a);
    provider.removeListener?.('chainChanged', c);
  };
}

// ─── EIP-6963 announcement collector ─────────────────────────────────────────
// Listens for wallet announcements as soon as this module is imported, so
// detectWallets() can find them later. Safe to import multiple times.
if (typeof window !== 'undefined') {
  window.__eip6963Providers = window.__eip6963Providers || [];
  if (!window.__eip6963Wired) {
    window.__eip6963Wired = true;
    window.addEventListener('eip6963:announceProvider', (event) => {
      const { detail } = event;
      if (!detail?.provider) return;
      // Avoid duplicates if a wallet announces twice.
      if (!window.__eip6963Providers.some((p) => p.provider === detail.provider)) {
        window.__eip6963Providers.push(detail);
      }
    });
    // Ask any installed wallets to (re)announce themselves.
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }
}
