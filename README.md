# Football OS

AI-powered onchain operating system for football intelligence on X Layer.

A hackathon MVP combining live AI match predictions (OpenAI/Anthropic), dual data feeds (SportAPI + Sportmonks), live Polymarket signal feeds, a real-time onchain synced leaderboard, and verifiable prediction proofs anchored to X Layer Mainnet and Testnet.

## Stack

- **Frontend:** React + Vite, ethers v6, custom dark futuristic CSS
- **Backend:** Node.js + Express, dotenv, CORS, ethers v6 (for event indexing)
- **Contracts:** Solidity, deployed on X Layer Mainnet & Testnet

## Project Structure

```
FootballOS/
├── frontend/           # React + Vite app
├── backend/            # Node + Express API
│   ├── .env            # Private API keys
│   └── src/
│       ├── server.js               # Express routing
│       └── services/               
│           ├── sportApi.js         # SportAPI (RapidAPI) integration
│           ├── llm.js              # OpenAI / Anthropic integration
│           ├── polymarket.js       # Polymarket GraphQL integration
│           └── leaderboardSync.js  # X Layer onchain event indexer
├── contracts/          # Solidity smart contracts
└── README.md
```

## Environment Variables Needed

To run the full suite, you need to configure `.env` files in both the frontend and backend directories.

### 1. Backend (`backend/.env`)

Create a `.env` file in the `backend/` directory with the following variables:

```env
PORT=5000

# AI Configuration (Choose one provider)
AI_PROVIDER=openai # or anthropic
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-your-anthropic-key

# Data Providers (Optional but recommended)
SPORTAPI_KEY=your_rapidapi_sportapi_key
SPORTMONKS_API_TOKEN=your_sportmonks_api_token

# Blockchain Configuration (For Leaderboard Sync)
RPC_URL_MAINNET=https://rpc.xlayer.tech
RPC_URL_TESTNET=https://testrpc.xlayer.tech
```

### 2. Frontend (`frontend/.env`)

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_URL=http://localhost:5000
```

## Run Locally

You need **Node.js 18+**. Open two terminals.

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

API runs on http://localhost:5000

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs on http://localhost:5173

## Features

- **Live AI Predictions** — Provide any two teams and get an instant AI analysis (powered by GPT-4o-mini or Claude 3.5 Sonnet) complete with confidence ratings and expected goals.
- **Dual Data Integration** — Fetches live scores and upcoming fixtures concurrently from both Sportmonks and SportAPI.
- **Live Signal Feed** — Detects high volume/liquidity alpha drops in real-time by polling the Polymarket GraphQL API.
- **Live Leaderboard** — A background worker constantly indexes the X Layer blockchain to pick up new `PredictionPublished` events and builds a dynamic leaderboard.
- **Onchain Proofs** — Smart contracts dynamically route prediction transactions to either the X Layer Mainnet (`196`) or Testnet (`1952`) depending on the user's connected wallet.

## Smart Contracts (X Layer)

- **Mainnet (196):** `0x8BCdd0c4FE9F5B86E848e4251443cB089b74f53B`
- **Testnet (1952):** `0x5C5B0d40513af02Ab2F3164E6C7F413411B79f0d`
