import 'dotenv/config';
import axios from 'axios';
import express from 'express';
import cors from 'cors';
import {
  isSportApiEnabled,
  getPredictionsFeed,
} from './services/sportApi.js';
import { aiPredict, isLlmEnabled } from './services/llm.js';
import { getFootballMarkets } from './services/polymarket.js';
import { getLeaderboard, syncLeaderboard, isLeaderboardEnabled } from './services/leaderboardSync.js';

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

// Background sync for leaderboard
if (isLeaderboardEnabled()) {
  setInterval(() => {
    syncLeaderboard().catch(err => console.warn('Leaderboard sync err:', err.message));
  }, 15000);
  syncLeaderboard().catch(() => {});
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'footballos-api',
    apiFootball: isSportApiEnabled() ? 'live' : 'disabled',
    llm: isLlmEnabled() ? 'live' : 'disabled',
    leaderboard: isLeaderboardEnabled() ? 'live' : 'disabled',
    time: Date.now(),
  });
});

/* ---------- Data Endpoints ---------- */

app.get('/api/matches', async (_req, res) => {
  try {
    let sportApiMatches = [];
    if (isSportApiEnabled()) {
      sportApiMatches = await getPredictionsFeed({ limit: 15 }).catch(() => []);
    }

    let sportmonksMatches = [];
    if (process.env.SPORTMONKS_API_TOKEN) {
      const { data } = await fetchSportmonksLiveMatches().catch(() => ({ data: [] }));
      
      sportmonksMatches = data.map(m => ({
        fixtureId: m.fixtureId,
        league: m.league,
        home: { name: m.homeTeam },
        away: { name: m.awayTeam },
        kickoff: m.kickoff,
        source: 'Sportmonks',
      }));
    }

    const allMatches = [...sportApiMatches, ...sportmonksMatches];
    
    // Sort combined list by closest kickoff time
    allMatches.sort((a, b) => new Date(a.kickoff || 0) - new Date(b.kickoff || 0));

    res.json({ matches: allMatches });
  } catch (err) {
    const upstreamMessage = err.response?.data?.message || err.response?.data?.error || err.message;
    res.status(502).json({ error: 'failed_to_fetch_matches', message: upstreamMessage });
  }
});

app.get('/api/matches/:id', (_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.get('/api/signals', async (_req, res) => {
  try {
    const markets = await getFootballMarkets();
    const signals = [];
    markets.forEach(event => {
      // Find high volume/liquidity markets
      if (event.volume > 5000 || event.liquidity > 2000) {
        signals.push({
          id: `alpha-${event.id}`,
          tag: 'MARKET ALPHA',
          match: event.title,
          text: `Significant market activity detected: Volume $${event.volume.toLocaleString()}, Liquidity $${event.liquidity.toLocaleString()}`,
          confidence: null,
          timestamp: new Date().toISOString(),
        });
      }
    });
    res.json({ signals: signals.slice(0, 10) });
  } catch (err) {
    res.json({ signals: [] });
  }
});

app.get('/api/leaderboard', (_req, res) => {
  res.json({ leaderboard: getLeaderboard() }); // returns { mainnet: [], testnet: [] }
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

    return res.status(502).json({
      error: 'live_matches_unavailable',
      message: process.env.SPORTMONKS_API_TOKEN ? sportmonksWarning : 'SPORTMONKS_API_TOKEN is not configured',
    });
  }
}

app.get('/api/live-matches', liveMatchesHandler);
app.get('/api/football/live', liveMatchesHandler);

/* ---------- POST /api/predict ----------
 * Generates an onchain-ready proof hash.
 * --------------------------------------- */

function deterministicHash(seed) {
  let h = 0n;
  for (const c of seed) h = (h * 131n + BigInt(c.charCodeAt(0))) & ((1n << 256n) - 1n);
  return '0x' + h.toString(16).padStart(64, '0').slice(0, 64);
}

app.post('/api/predict', (req, res) => {
  const { matchId, wallet, pick, confidence, expectedGoals, reasoning, chainId } = req.body || {};
  if (!matchId) return res.status(400).json({ error: 'matchId_required' });

  const generatedAt = new Date().toISOString();
  
  const prediction = {
    matchId,
    pick: pick || 'Draw',
    confidence: confidence || 50,
    topOutcome: pick || 'Draw',
    expectedGoals: expectedGoals || '1.5-1.5',
    reasoning: reasoning || 'AI prediction',
    generatedAt,
  };

  const seed = `${wallet ?? 'anon'}:${matchId}:${prediction.pick}:${prediction.generatedAt}`;
  const isTestnet = chainId === 1952 || chainId === 195;
  const proof = {
    hash: deterministicHash(seed),
    network: isTestnet ? 'X Layer Testnet' : 'X Layer',
    chainId: isTestnet ? 1952 : 196,
    contract: 'PredictionProof',
  };

  res.json({ ok: true, prediction, proof });
});

/* ---------- API-Football integration ---------- */



app.get('/api/predictions-feed', async (req, res) => {
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));

  if (!isSportApiEnabled()) {
    return res.json({ source: 'none', data: [] });
  }
  
  try {
    const data = await getPredictionsFeed({ limit });
    res.json({ source: 'api-football', data });
  } catch (err) {
    res.status(502).json({ error: 'upstream_error', detail: err.message });
  }
});

/* ---------- Polymarket sentiment layer ---------- */

async function footballMarketsHandler(req, res) {
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

/* ---------- AI engine ---------- */

app.post('/api/ai-predict', async (req, res) => {
  const { teamA, teamB, matchContext } = req.body || {};
  if (!teamA || !teamB) {
    return res.status(400).json({ error: 'teamA_and_teamB_required' });
  }
  const teamAClean = String(teamA).slice(0, 80);
  const teamBClean = String(teamB).slice(0, 80);

  try {
    const { prediction, source, model } = await aiPredict({
      teamA: teamAClean,
      teamB: teamBClean,
      matchContext: matchContext ? String(matchContext).slice(0, 1000) : '',
    });

    const slug = (s) =>
      String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'XXX';
    const today = new Date().toISOString().slice(0, 10);
    const matchId = `${slug(teamAClean)}-${slug(teamBClean)}-${today}`;

    const scorePrediction = prediction.scorePrediction || '2-1';

    res.json({ ...prediction, scorePrediction, matchId, source, model });
  } catch (err) {
    console.error('[ai-predict] error:', err.message);
    res.status(502).json({ error: 'ai_prediction_failed', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[footballos-api] listening on http://localhost:${PORT}`);
  console.log(`[sportmonks]    live matches: ${process.env.SPORTMONKS_API_TOKEN ? 'LIVE' : 'DISABLED (no key)'}`);
  console.log(`[sport-api]     legacy routes: ${isSportApiEnabled() ? 'LIVE (RapidAPI)' : 'DISABLED (no key)'}`);
  console.log(`[llm]           mode: ${isLlmEnabled() ? 'LIVE' : 'DISABLED (no key)'}`);
  console.log(`[leaderboard]   sync: ${isLeaderboardEnabled() ? 'ACTIVE' : 'DISABLED (no contract)'}`);
});
