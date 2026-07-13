import { JsonRpcProvider, Contract } from 'ethers';

const RPC_URL_MAINNET = process.env.XLAYER_RPC_URL_MAINNET || 'https://rpc.xlayer.tech';
const CONTRACT_ADDRESS_MAINNET = process.env.PREDICTION_CONTRACT_ADDRESS_MAINNET || '0x0000000000000000000000000000000000000000';

const RPC_URL_TESTNET = process.env.XLAYER_RPC_URL_TESTNET || 'https://testrpc.xlayer.tech';
const CONTRACT_ADDRESS_TESTNET = process.env.PREDICTION_CONTRACT_ADDRESS_TESTNET || '0x0000000000000000000000000000000000000000';

const ABI = [
  "event PredictionPublished(uint256 indexed id, address indexed predictor, bytes32 indexed matchId, bytes32 pickHash, uint16 confidenceBps, uint256 timestamp)"
];

let providerMainnet;
let contractMainnet;
let leaderboardDataMainnet = [];
let lastSyncBlockMainnet = 0;

let providerTestnet;
let contractTestnet;
let leaderboardDataTestnet = [];
let lastSyncBlockTestnet = 0;

export function isLeaderboardEnabled() {
  return CONTRACT_ADDRESS_MAINNET !== '0x0000000000000000000000000000000000000000' || 
         CONTRACT_ADDRESS_TESTNET !== '0x0000000000000000000000000000000000000000';
}

async function syncNetwork(provider, contract, lastSyncBlock, leaderboardData) {
  try {
    const currentBlock = await provider.getBlockNumber();
    let fromBlock = lastSyncBlock === 0 ? Math.max(0, currentBlock - 2000) : lastSyncBlock + 1;
    let syncedTo = fromBlock - 1;

    // Fast-catchup loop in chunks of 100 blocks
    while (fromBlock <= currentBlock) {
      const toBlock = Math.min(currentBlock, fromBlock + 99);
      const events = await contract.queryFilter(contract.filters.PredictionPublished(), fromBlock, toBlock);
      
      const statsMap = new Map();
      for (const entry of leaderboardData) {
        statsMap.set(entry.wallet, entry);
      }

      for (const ev of events) {
        const { predictor, confidenceBps } = ev.args;
        const confidence = Number(confidenceBps) / 100;
        
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

      const newData = Array.from(statsMap.values()).sort((a, b) => b.totalPredictions - a.totalPredictions || b.avgConfidence - a.avgConfidence);
      
      newData.forEach((entry, idx) => {
        entry.rank = idx + 1;
      });

      leaderboardData = newData;
      syncedTo = toBlock;
      fromBlock = toBlock + 1;

      // Sleep 50ms to avoid rate limits during fast catchup
      if (fromBlock <= currentBlock) {
        await new Promise(r => setTimeout(r, 50));
      }
    }
    
    if (syncedTo > 0) {
      return { newData: leaderboardData, newLastSyncBlock: syncedTo };
    }
  } catch (err) {
    console.warn('[leaderboardSync] error syncing events:', err.message);
  }
  return null;
}

export async function syncLeaderboard() {
  if (!isLeaderboardEnabled()) return getLeaderboard();

  // Init Mainnet
  if (CONTRACT_ADDRESS_MAINNET !== '0x0000000000000000000000000000000000000000') {
    if (!providerMainnet) {
      providerMainnet = new JsonRpcProvider(RPC_URL_MAINNET);
      contractMainnet = new Contract(CONTRACT_ADDRESS_MAINNET, ABI, providerMainnet);
    }
    const res = await syncNetwork(providerMainnet, contractMainnet, lastSyncBlockMainnet, leaderboardDataMainnet);
    if (res) {
      leaderboardDataMainnet = res.newData;
      lastSyncBlockMainnet = res.newLastSyncBlock;
    }
  }

  // Init Testnet
  if (CONTRACT_ADDRESS_TESTNET !== '0x0000000000000000000000000000000000000000') {
    if (!providerTestnet) {
      providerTestnet = new JsonRpcProvider(RPC_URL_TESTNET);
      contractTestnet = new Contract(CONTRACT_ADDRESS_TESTNET, ABI, providerTestnet);
    }
    const res = await syncNetwork(providerTestnet, contractTestnet, lastSyncBlockTestnet, leaderboardDataTestnet);
    if (res) {
      leaderboardDataTestnet = res.newData;
      lastSyncBlockTestnet = res.newLastSyncBlock;
    }
  }

  return getLeaderboard();
}

export function getLeaderboard() {
  return {
    mainnet: leaderboardDataMainnet,
    testnet: leaderboardDataTestnet,
  };
}
