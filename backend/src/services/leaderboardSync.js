import { JsonRpcProvider, Contract } from 'ethers';
import { createClient } from '@supabase/supabase-js';

const RPC_URL_MAINNET = process.env.XLAYER_RPC_URL_MAINNET || 'https://rpc.xlayer.tech';
const CONTRACT_ADDRESS_MAINNET = process.env.PREDICTION_CONTRACT_ADDRESS_MAINNET || '0x0000000000000000000000000000000000000000';

const ABI = [
  "event PredictionPublished(uint256 indexed id, address indexed predictor, bytes32 indexed matchId, bytes32 pickHash, uint16 confidenceBps, uint256 timestamp)"
];

let providerMainnet;
let contractMainnet;
let lastSyncBlockMainnet = 0;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export function isLeaderboardEnabled() {
  return CONTRACT_ADDRESS_MAINNET !== '0x0000000000000000000000000000000000000000' && supabase !== null;
}

async function getLastSyncedBlock(network) {
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from('onchain_predictions')
    .select('block_number')
    .eq('network', network)
    .order('block_number', { ascending: false })
    .limit(1);
    
  if (error || !data || data.length === 0) return 0;
  return data[0].block_number;
}

async function syncNetwork(provider, contract, network, lastSyncBlock) {
  try {
    const currentBlock = await provider.getBlockNumber();
    if (lastSyncBlock === 0) {
      lastSyncBlock = await getLastSyncedBlock(network);
    }
    
    // If database is empty, start from current - 2000
    let fromBlock = lastSyncBlock === 0 ? Math.max(0, currentBlock - 2000) : lastSyncBlock + 1;
    let syncedTo = fromBlock - 1;

    // Fast-catchup loop in chunks of 100 blocks
    while (fromBlock <= currentBlock) {
      const toBlock = Math.min(currentBlock, fromBlock + 99);
      const events = await contract.queryFilter(contract.filters.PredictionPublished(), fromBlock, toBlock);
      
      const rows = [];
      for (const ev of events) {
        const { predictor, matchId, pickHash, confidenceBps, timestamp } = ev.args;
        rows.push({
          tx_hash: ev.transactionHash,
          wallet_address: predictor,
          network: network,
          block_number: ev.blockNumber,
          match_id: matchId,
          pick_hash: pickHash,
          confidence_bps: Number(confidenceBps),
          timestamp: Number(timestamp)
        });
      }

      if (rows.length > 0 && supabase) {
        // Upsert to handle any overlapping blocks gracefully
        const { error } = await supabase.from('onchain_predictions').upsert(rows, { onConflict: 'tx_hash' });
        if (error) {
          console.warn(`[leaderboardSync] Supabase insert error on ${network}:`, error.message);
        }
      }

      syncedTo = toBlock;
      fromBlock = toBlock + 1;

      // Sleep 50ms to avoid rate limits during fast catchup
      if (fromBlock <= currentBlock) {
        await new Promise(r => setTimeout(r, 50));
      }
    }
    
    if (syncedTo > 0) {
      return syncedTo;
    }
  } catch (err) {
    console.warn(`[leaderboardSync] error syncing events on ${network}:`, err.message);
  }
  return lastSyncBlock;
}

export async function syncLeaderboard() {
  if (!isLeaderboardEnabled()) return;

  // Sync Mainnet
  if (CONTRACT_ADDRESS_MAINNET !== '0x0000000000000000000000000000000000000000') {
    if (!providerMainnet) {
      providerMainnet = new JsonRpcProvider(RPC_URL_MAINNET);
      contractMainnet = new Contract(CONTRACT_ADDRESS_MAINNET, ABI, providerMainnet);
    }
    lastSyncBlockMainnet = await syncNetwork(providerMainnet, contractMainnet, 'mainnet', lastSyncBlockMainnet);
  }
}

async function computeLeaderboard(network) {
  if (!supabase) return [];
  
  // Fetch all events for the network
  const { data, error } = await supabase
    .from('onchain_predictions')
    .select('wallet_address, confidence_bps')
    .eq('network', network);
    
  if (error || !data) return [];

  const statsMap = new Map();
  for (const row of data) {
    const predictor = row.wallet_address;
    const confidence = row.confidence_bps / 100;
    
    if (!statsMap.has(predictor)) {
      statsMap.set(predictor, {
        wallet: predictor,
        totalPredictions: 0,
        avgConfidence: 0,
        confidenceSum: 0,
        rank: 0,
      });
    }
    
    const st = statsMap.get(predictor);
    st.totalPredictions += 1;
    st.confidenceSum += confidence;
    st.avgConfidence = Math.round(st.confidenceSum / st.totalPredictions);
  }

  const sortedData = Array.from(statsMap.values()).sort((a, b) => b.totalPredictions - a.totalPredictions || b.avgConfidence - a.avgConfidence);
  
  sortedData.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return sortedData;
}

export async function getLeaderboard() {
  if (!supabase) {
    return { mainnet: [] };
  }

  const mainnet = await computeLeaderboard('mainnet');

  return { mainnet };
}


export async function getPredictionHistory(walletAddress) {
  if (!supabase) return [];
  const { data, error } = await supabase.from('onchain_predictions').select('*').ilike('wallet_address', walletAddress).order('timestamp', { ascending: false }).limit(20);
  if (error || !data) return [];
  return data;
}
