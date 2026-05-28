# Football OS

AI-powered onchain operating system for football intelligence on X Layer.

A hackathon MVP combining AI match predictions, a live signal feed, an alpha leaderboard, and onchain prediction proofs anchored to X Layer.

## Stack

- **Frontend:** React + Vite, ethers v6, custom dark futuristic CSS
- **Backend:** Node.js + Express, dotenv, CORS, mock data layer
- **Contracts:** Solidity, targeted at X Layer (EVM-compatible)

## Project structure

```
FootballOS/
├── frontend/           # React + Vite app (dark futuristic UI)
├── backend/            # Node + Express API (mock data)
│   ├── .env.example
│   └── src/
│       ├── server.js
│       └── data/        # matches, signals, leaderboard mocks
├── contracts/          # X Layer Solidity contracts
└── README.md
```

## Run locally

You need **Node.js 18+**. Open two terminals.

### 1. Backend

```bash
cd backend
cp .env.example .env       # optional — defaults to PORT=5000
npm install
npm run dev
```

API runs on http://localhost:5000

### 2. Frontend

```bash
cd frontend
cp .env.example .env       # sets VITE_API_URL=http://localhost:5000
npm install
npm run dev
```

App runs on http://localhost:5173

The frontend reads `VITE_API_URL` from `.env` and calls the backend directly.
CORS is enabled on the API so cross-origin from `5173 → 5000` works out of the box.

## API routes

| Method | Path                  | Returns                                       |
| ------ | --------------------- | --------------------------------------------- |
| GET    | `/api/health`         | health probe                                  |
| GET    | `/api/matches`        | upcoming fixtures with embedded model picks   |
| GET    | `/api/matches/:id`    | one match                                     |
| GET    | `/api/signals`        | live alpha feed (auto-refreshing)             |
| GET    | `/api/leaderboard`    | top onchain predictors                        |
| POST   | `/api/predict`        | AI prediction + onchain-ready proof hash      |

`POST /api/predict` body: `{ "matchId": "epl-ars-mci", "wallet": "0x..." }`

## Features (MVP)

- **AI Predictions** — model output for upcoming fixtures with confidence scores
- **Signal Feed** — live alpha drops streamed from the backend (mock)
- **Leaderboard** — top onchain predictors ranked by accuracy and ROI
- **Wallet Connect** — connect MetaMask / OKX Wallet, auto-add X Layer
- **Onchain Proofs** — `PredictionProof.sol` anchors prediction hashes on X Layer

## X Layer

X Layer is OKX's zkEVM L2. Contracts are EVM-compatible Solidity.

- Mainnet chainId: `196`
- Testnet chainId: `195`
- RPC: see [okx.com/xlayer](https://www.okx.com/xlayer)

Deploy `contracts/PredictionProof.sol` with Hardhat or Foundry once you have a funded key.

## Roadmap past MVP

- Replace mock data with real fixtures + odds providers
- Plug in a real prediction model (LLM + statistical ensemble)
- Stream signals via WebSocket instead of polling
- Index onchain proofs and surface them in the leaderboard
