import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { matches } from './data/matches.js';
import { signals, generateSignal } from './data/signals.js';
import { leaderboard } from './data/leaderboard.js';
import { mockLiveMatches, mockTeams, mockPredictionsFeed } from './data/liveMocks.js';
import {
  isApiFootballEnabled,
  getLiveMatches,
  getTeam,
  getPredictionsFeed,
} from './services/apiFootball.js';
import { aiPredict, isOpenRouterEnabled } from './services/openrouter.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'footballos-api',
    apiFootball: isApiFootballEnabled() ? 'live' : 'mock',
    openrouter: isOpenRouterEnabled() ? 'live' : 'mock',
    time: Date.now(),
  });
});

/* ---------- Matches (with embedded AI prediction) ---------- */

app.get('/api/matches', (_req, res) => {
  res.json({ matches });
});

app.get('/api/matches/:id', (req, res) => {
  const match = matches.find((m) => m.id === req.params.id);
  if (!match) return res.status(404).json({ error: 'not_found' });
  res.json(match);
});

/* ---------- Signals (live mock feed) ---------- */

const liveSignals = [...signals];
setInterval(() => {
  liveSignals.unshift(generateSignal());
  if (liveSignals.length > 40) liveSignals.pop();
}, 8000);

app.get('/api/signals', (_req, res) => {
  res.json({ signals: liveSignals.slice(0, 20) });
});

/* ---------- Leaderboard ---------- */

app.get('/api/leaderboard', (_req, res) => {
  res.json({ leaderboard });
});

/* ---------- POST /api/predict ----------
 * Generates an AI prediction for a given matchId (or arbitrary fixture)
 * and returns a deterministic onchain-ready hash for X Layer anchoring.
 * --------------------------------------- */

function deterministicHash(seed) {
  // Small, dependency-free pseudo-hash for the MVP.
  let h = 0n;
  for (const c of seed) h = (h * 131n + BigInt(c.charCodeAt(0))) & ((1n << 256n) - 1n);
  return '0x' + h.toString(16).padStart(64, '0').slice(0, 64);
}

app.post('/api/predict', (req, res) => {
  const { matchId, wallet } = req.body || {};
  if (!matchId) return res.status(400).json({ error: 'matchId_required' });

  const match = matches.find((m) => m.id === matchId);
  if (!match) return res.status(404).json({ error: 'match_not_found' });

  const m = match.model;
  const top = ['home', 'draw', 'away'].reduce((a, b) =>
    m.probabilities[a] >= m.probabilities[b] ? a : b
  );

  const prediction = {
    matchId,
    pick: m.pick,
    confidence: m.confidence,
    probabilities: m.probabilities,
    topOutcome: top,
    expectedGoals: m.expectedGoals,
    reasoning: m.reasoning,
    generatedAt: new Date().toISOString(),
  };

  const seed = `${wallet ?? 'anon'}:${matchId}:${m.pick}:${prediction.generatedAt}`;
  const proof = {
    hash: deterministicHash(seed),
    network: 'X Layer',
    chainId: 196,
    contract: 'PredictionProof',
  };

  res.json({ ok: true, prediction, proof });
});

/* ---------- API-Football integration ----------
 * Each route: hit RapidAPI when FOOTBALL_API_KEY is set, fall back to
 * mock fixtures otherwise so the demo always renders something useful.
 * --------------------------------------------- */

function withFallback(label, mockValue) {
  return (err, res) => {
    console.warn(`[api-football] ${label} failed: ${err.message}`);
    res.json({ source: 'mock', reason: err.code || err.message, data: mockValue });
  };
}

app.get('/api/live-matches', async (_req, res) => {
  if (!isApiFootballEnabled()) {
    return res.json({ source: 'mock', reason: 'NO_KEY', data: mockLiveMatches });
  }
  try {
    const data = await getLiveMatches();
    res.json({ source: 'api-football', data });
  } catch (err) {
    withFallback('live-matches', mockLiveMatches)(err, res);
  }
});

app.get('/api/team/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad_id' });

  if (!isApiFootballEnabled()) {
    const mock = mockTeams[id] ?? null;
    if (!mock) return res.status(404).json({ error: 'not_found_in_mock' });
    return res.json({ source: 'mock', reason: 'NO_KEY', data: mock });
  }
  try {
    const data = await getTeam(id);
    if (!data) return res.status(404).json({ error: 'team_not_found' });
    res.json({ source: 'api-football', data });
  } catch (err) {
    const mock = mockTeams[id] ?? null;
    if (!mock) return res.status(502).json({ error: 'upstream_error', detail: err.message });
    withFallback(`team/${id}`, mock)(err, res);
  }
});

app.get('/api/predictions-feed', async (req, res) => {
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));

  if (!isApiFootballEnabled()) {
    return res.json({ source: 'mock', reason: 'NO_KEY', data: mockPredictionsFeed.slice(0, limit) });
  }
  try {
    const data = await getPredictionsFeed({ limit });
    res.json({ source: 'api-football', data });
  } catch (err) {
    withFallback('predictions-feed', mockPredictionsFeed.slice(0, limit))(err, res);
  }
});

/* ---------- OpenRouter AI engine ---------- */

app.post('/api/ai-predict', async (req, res) => {
  const { teamA, teamB, matchContext } = req.body || {};
  if (!teamA || !teamB) {
    return res.status(400).json({ error: 'teamA_and_teamB_required' });
  }
  const result = await aiPredict({
    teamA: String(teamA).slice(0, 80),
    teamB: String(teamB).slice(0, 80),
    matchContext: matchContext ? String(matchContext).slice(0, 1000) : '',
  });
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`[footballos-api] listening on http://localhost:${PORT}`);
  console.log(`[api-football] mode: ${isApiFootballEnabled() ? 'LIVE (RapidAPI)' : 'MOCK (no key)'}`);
  console.log(`[openrouter]   mode: ${isOpenRouterEnabled() ? 'LIVE' : 'MOCK (no key)'}`);
});
