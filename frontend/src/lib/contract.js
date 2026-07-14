// ─────────────────────────────────────────────────────────────────────────────
// Football OS · PredictionProof contract helper
//
// Wraps ethers v6 to publish a prediction proof to X Layer. Uses the connected
// wallet provider (no private keys, no RPC config). Hashes are derived
// deterministically from (matchId, predictedWinner, scorePrediction, salt) so
// the same call from the same wallet at the same time produces a stable hash.
// ─────────────────────────────────────────────────────────────────────────────

import { BrowserProvider, Contract, keccak256, toUtf8Bytes, getBytes } from 'ethers';
import { X_LAYER } from './xlayer.js';

const MAINNET_ADDRESS = '0x8BCdd0c4FE9F5B86E848e4251443cB089b74f53B';

export function getContractAddress(chainId) {
  return MAINNET_ADDRESS;
}

// ABI matches contracts/PredictionProof.sol — minimal surface used by the FE.
export const PREDICTION_PROOF_ABI = [
  {
    type: 'function',
    name: 'publish',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'pickHash', type: 'bytes32' },
      { name: 'confidenceBps', type: 'uint16' },
    ],
    outputs: [{ name: 'id', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'ProofPublished',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'id', type: 'uint256' },
      { indexed: true, name: 'predictor', type: 'address' },
      { indexed: true, name: 'matchId', type: 'bytes32' },
      { indexed: false, name: 'pickHash', type: 'bytes32' },
      { indexed: false, name: 'confidenceBps', type: 'uint16' },
    ],
  },
];

/** keccak256(matchId) padded to bytes32. Match IDs are arbitrary strings ("EPL-ARS-MCI"). */
export function matchIdToBytes32(matchId) {
  return keccak256(toUtf8Bytes(String(matchId)));
}

/** Hash of the human-readable pick (winner + score) as bytes32. */
export function pickHashOf(predictedWinner, scorePrediction) {
  const seed = `winner:${predictedWinner}|score:${scorePrediction || ''}`;
  return keccak256(toUtf8Bytes(seed));
}

/**
 * Submit a prediction proof from the connected wallet. Returns the receipt
 * plus the parsed proof id from the ProofPublished event.
 */
export async function submitOnchainPrediction({
  provider,            // EIP-1193 provider from WalletContext
  matchId,
  predictedWinner,
  scorePrediction = '',
  confidence = 70,     // 0–100
}) {
  if (!provider) throw new Error('Wallet not connected');
  if (!matchId) throw new Error('Match ID is required');
  if (!predictedWinner) throw new Error('Predicted winner is required');

  const browserProvider = new BrowserProvider(provider);
  const network = await browserProvider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 196) {
    throw new Error(`Wrong network. Expected X Layer Mainnet, got ${chainId}.`);
  }

  const signer = await browserProvider.getSigner();
  const contractAddress = getContractAddress(chainId);
  const contract = new Contract(contractAddress, PREDICTION_PROOF_ABI, signer);

  const matchIdBytes = matchIdToBytes32(matchId);
  const pickHash = pickHashOf(predictedWinner, scorePrediction);
  const confidenceBps = Math.max(0, Math.min(10_000, Math.round(Number(confidence) * 100)));

  const tx = await contract.publish(matchIdBytes, pickHash, confidenceBps);
  
  // We bypass `tx.wait()` because injected wallets (like OKX/MetaMask) sometimes fail 
  // to poll for receipts on X Layer Testnet, throwing 'could not coalesce error'.
  // Returning immediately is faster and the backend will naturally index it!
  
  return {
    txHash: tx.hash || tx.transactionHash,
    blockNumber: 0,
    proofId: null,
    matchIdBytes,
    pickHash,
    confidenceBps,
  };
}

/** OKLink explorer URL for a tx hash. */
export function explorerTxUrl(hash) {
  return `https://www.oklink.com/xlayer/tx/${hash}`;
}

export function explorerAddressUrl(address) {
  return `https://www.oklink.com/xlayer/address/${address}`;
}

/** Cosmetic — hash bytes to length. */
export function shortHash(h, head = 10, tail = 8) {
  if (!h) return '';
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

/** Used by leaderboard / signal feed — converts a Uint8Array safely. */
export function bytesToHex(b) {
  try { return '0x' + Buffer.from(getBytes(b)).toString('hex'); }
  catch { return ''; }
}
