# Football OS · Contracts

Solidity contracts targeting **X Layer** (OKX zkEVM, EVM-compatible).

## `PredictionProof.sol`

Anchors a Football OS prediction as an immutable hash + metadata. Each predictor accumulates an onchain track record that the leaderboard reads from.

- `publish(matchId, pickHash, confidenceBps)` — anyone publishes their own pick
- `settle(id, won)` — owner/oracle settles the result
- `proofIdsOf(predictor)` — enumerate a wallet's full history
- Emits `ProofPublished` and `ProofSettled` for indexers

## Deploy

X Layer is EVM-compatible, so any standard EVM toolchain works.

### Foundry

```bash
forge create contracts/PredictionProof.sol:PredictionProof \
  --rpc-url https://rpc.xlayer.tech \
  --private-key $PRIVATE_KEY
```

### Hardhat

Add X Layer to `hardhat.config.js`:

```js
networks: {
  xlayer: {
    url: 'https://rpc.xlayer.tech',
    chainId: 196,
    accounts: [process.env.PRIVATE_KEY],
  },
  xlayerTestnet: {
    url: 'https://testrpc.xlayer.tech',
    chainId: 195,
    accounts: [process.env.PRIVATE_KEY],
  },
}
```

Then `npx hardhat run scripts/deploy.js --network xlayer`.

## Network reference

| Network          | chainId | RPC                              |
| ---------------- | ------- | -------------------------------- |
| X Layer Mainnet  | 196     | https://rpc.xlayer.tech          |
| X Layer Testnet  | 195     | https://testrpc.xlayer.tech      |

Block explorer: https://www.okx.com/web3/explorer/xlayer
