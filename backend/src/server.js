import 'dotenv/config';
import axios from 'axios';
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
import { getFootballMarkets } from './services/polymarket.js';

const app = express();
const PORT = process.env.PORT || 5000;
const SPORTMONKS_BASE_URL = 'https://api.sportmonks.com/v3/football';
const liveMatchesCache = {
  data: null,
  mode: 'livescores',
  timestamp: 0,
  ttlMs: 5 * 60 * 1000,
};

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

/* ---------- Sportmonks live matches ---------- */

function getLiveMatchesCacheAgeSeconds() {
  return liveMatchesCache.timestamp
    ? Math.floor((Date.now() - liveMatchesCache.timestamp) / 1000)
    : 0;
}

function scoreFromSportmonksScores(scores, side) {
  const score = scores?.find((item) => {
    const location = item.score?.participant || item.participant?.meta?.location || item.description;
    return String(location || '').toLowerCase() === side;
  });

  return score?.score?.goals ?? score?.score?.score ?? null;
}

function normalizeSportmonksLiveMatch(item) {
  const participants = item.participants || [];
  const home = participants.find((participant) => participant.meta?.location === 'home') || participants[0];
  const away = participants.find((participant) => participant.meta?.location === 'away') || participants[1];
  const [fallbackHomeName, fallbackAwayName] = String(item.name || 'Home vs Away').split(' vs ');

  return {
    id: String(item.id),
    fixtureId: item.id,
    league: item.league?.name || item.league_name || 'Football',
    homeTeam: home?.name || fallbackHomeName || 'Home',
    awayTeam: away?.name || fallbackAwayName || 'Away',
    kickoff: item.starting_at || (item.starting_at_timestamp ? new Date(item.starting_at_timestamp * 1000).toISOString() : null),
    market: 'AI Match Prediction',
    status: item.state?.short_name || item.state?.name || item.result_info || 'Live',
    elapsed: item.periods?.[0]?.minutes || null,
    score: {
      home: scoreFromSportmonksScores(item.scores, 'home'),
      away: scoreFromSportmonksScores(item.scores, 'away'),
    },
  };
}

function isoDateOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeMockLiveMatch(item) {
  return {
    id: String(item.id),
    fixtureId: item.id,
    league: item.league,
    homeTeam: item.home?.name || 'Home',
    awayTeam: item.away?.name || 'Away',
    kickoff: item.kickoff,
    market: 'AI Match Prediction',
    status: item.status,
    elapsed: item.elapsed,
    score: {
      home: item.home?.goals ?? null,
      away: item.away?.goals ?? null,
    },
  };
}

async function fetchSportmonksLiveMatches() {
  if (!process.env.SPORTMONKS_API_TOKEN) {
    throw new Error('SPORTMONKS_API_TOKEN is not configured');
  }

  const response = await axios.get(`${SPORTMONKS_BASE_URL}/livescores`, {
    params: {
      api_token: process.env.SPORTMONKS_API_TOKEN,
    },
    timeout: 15000,
  });

  const liveMatches = (response.data?.data || []).map(normalizeSportmonksLiveMatch);

  if (liveMatches.length > 0) {
    return {
      data: liveMatches,
      mode: 'livescores',
    };
  }

  const fixtureWindow = [-1, 0, 1, 2, 3, 4, 5, 6, 7];
  const fixtureResponses = await Promise.all(
    fixtureWindow.map(async (dayOffset) => {
      const date = isoDateOffset(dayOffset);
      const fixtureResponse = await axios.get(`${SPORTMONKS_BASE_URL}/fixtures/date/${date}`, {
        params: {
          api_token: process.env.SPORTMONKS_API_TOKEN,
        },
        timeout: 15000,
      });

      return {
        date,
        fixtures: fixtureResponse.data?.data || [],
      };
    })
  );

  const fixtures = fixtureResponses
    .flatMap((item) => item.fixtures)
    .sort((a, b) => {
      const aTime = new Date(a.starting_at || a.starting_at_timestamp * 1000 || 0).getTime();
      const bTime = new Date(b.starting_at || b.starting_at_timestamp * 1000 || 0).getTime();
      return aTime - bTime;
    })
    .slice(0, 24)
    .map(normalizeSportmonksLiveMatch);

  return {
    data: fixtures,
    mode: fixtures.length > 0 ? 'fixtures-window' : 'fixtures-window-empty',
  };
}

async function liveMatchesHandler(_req, res) {
  const cacheAgeSeconds = getLiveMatchesCacheAgeSeconds();
  const hasCache = Array.isArray(liveMatchesCache.data);
  const cacheIsFresh = hasCache && cacheAgeSeconds * 1000 < liveMatchesCache.ttlMs;

  if (cacheIsFresh) {
    return res.json({
      data: liveMatchesCache.data,
      matches: liveMatchesCache.data,
      cached: true,
      stale: false,
      cacheAgeSeconds,
      source: 'Sportmonks',
      mode: liveMatchesCache.mode,
    });
  }

  try {
    const { data, mode } = await fetchSportmonksLiveMatches();
    liveMatchesCache.data = data;
    liveMatchesCache.mode = mode;
    liveMatchesCache.timestamp = Date.now();

    if (data.length === 0) {
      const fallbackMatches = mockLiveMatches.map(normalizeMockLiveMatch);

      return res.json({
        data: fallbackMatches,
        matches: fallbackMatches,
        cached: false,
        stale: false,
        cacheAgeSeconds: 0,
        source: 'Sportmonks',
        mode,
        warning: 'Sportmonks returned no live, recent, or upcoming fixtures in the checked window; showing demo fallback.',
      });
    }

    return res.json({
      data,
      matches: data,
      cached: false,
      stale: false,
      cacheAgeSeconds: 0,
      source: 'Sportmonks',
      mode,
    });
  } catch (err) {
    const upstreamStatus = err.response?.status;
    const upstreamCode = err.code;
    const upstreamMessage = err.response?.data?.message || err.response?.data?.error || err.message;
    const sportmonksWarning = upstreamStatus
      ? `Sportmonks request failed with status ${upstreamStatus}`
      : upstreamCode
        ? `Sportmonks request failed: ${upstreamCode}`
        : upstreamMessage || 'Sportmonks is temporarily unavailable';

    if (hasCache) {
      return res.json({
        data: liveMatchesCache.data,
        matches: liveMatchesCache.data,
        cached: true,
        stale: true,
        cacheAgeSeconds,
        source: 'Sportmonks',
        mode: liveMatchesCache.mode,
        warning: sportmonksWarning,
      });
    }

    const fallbackMatches = mockLiveMatches.map(normalizeMockLiveMatch);
    const warning = process.env.SPORTMONKS_API_TOKEN
      ? sportmonksWarning
      : 'SPORTMONKS_API_TOKEN is not configured';

    return res.json({
      data: fallbackMatches,
      matches: fallbackMatches,
      cached: false,
      stale: false,
      cacheAgeSeconds: 0,
      source: 'mock',
      mode: 'mock-fallback',
      warning: warning.replace('FOOTBALL_API_KEY', 'SPORTMONKS_API_TOKEN'),
    });
  }
}

app.get('/api/live-matches', liveMatchesHandler);
app.get('/api/football/live', liveMatchesHandler);

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
    res.json({ source: 'api-sports', live: true, data });
  } catch (err) {
    const status = err.response?.status;
    const apiError = err.response?.data;
    console.warn('[api-sports] live-matches failed:', { status, apiError });
    res.json({
      source: 'mock',
      reason: err.message,
      status,
      apiError,
      data: mockLiveMatches,
    });
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

/* ---------- Polymarket sentiment layer ---------- */

async function footballMarketsHandler(req, res) {
  console.log('[polymarket] received request:', req.originalUrl);
  try {
    const data = await getFootballMarkets();
    res.json(data);
  } catch (err) {
    console.warn('[polymarket] football-markets failed:', err.response?.status, err.response?.data || err.message);
    res.status(502).json({
      error: 'polymarket_unavailable',
      message: err.message,
      status: err.response?.status,
    });
  }
}

app.get('/api/polymarket/football-markets', footballMarketsHandler);
app.get('/polymarket/football-markets', footballMarketsHandler);

/* ---------- OpenRouter AI engine ---------- */

app.post('/api/ai-predict', async (req, res) => {
  const { teamA, teamB, matchContext } = req.body || {};
  if (!teamA || !teamB) {
    return res.status(400).json({ error: 'teamA_and_teamB_required' });
  }
  const teamAClean = String(teamA).slice(0, 80);
  const teamBClean = String(teamB).slice(0, 80);

  const { prediction, source, model } = await aiPredict({
    teamA: teamAClean,
    teamB: teamBClean,
    matchContext: matchContext ? String(matchContext).slice(0, 1000) : '',
  });

  // Derive a deterministic matchId from team names + today's date (UTC).
  // Format: XXX-YYY-YYYY-MM-DD where X/Y are 3-letter codes from each team name.
  const slug = (s) =>
    String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'XXX';
  const today = new Date().toISOString().slice(0, 10);
  const matchId = `${slug(teamAClean)}-${slug(teamBClean)}-${today}`;

  // Default scorePrediction to 2-1 if the model didn't supply one.
  const scorePrediction = prediction.scorePrediction || '2-1';

  // Flat shape — six spec fields at the top level. `source` / `model` are
  // sibling metadata so the UI can show a "Live AI" vs "Fallback" chip.
  res.json({ ...prediction, scorePrediction, matchId, source, model });
});

app.listen(PORT, () => {
  console.log(`[footballos-api] listening on http://localhost:${PORT}`);
  console.log(`[sportmonks]    live matches: ${process.env.SPORTMONKS_API_TOKEN ? 'LIVE' : 'MOCK (no key)'}`);
  console.log(`[api-football]  legacy routes: ${isApiFootballEnabled() ? 'LIVE (RapidAPI)' : 'MOCK (no key)'}`);
  console.log(`[openrouter]   mode: ${isOpenRouterEnabled() ? 'LIVE' : 'MOCK (no key)'}`);
});
