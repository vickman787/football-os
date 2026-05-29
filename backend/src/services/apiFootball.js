import axios from 'axios';

const API_KEY = process.env.FOOTBALL_API_KEY || '';
const API_HOST = process.env.FOOTBALL_API_HOST || 'api-football-v1.p.rapidapi.com';
const BASE_URL = `https://${API_HOST}/v3`;

export const isApiFootballEnabled = () => Boolean(API_KEY);

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: {
    'x-rapidapi-key': API_KEY,
    'x-rapidapi-host': API_HOST,
  },
});

/* ---------- tiny in-memory cache (RapidAPI quotas matter) ---------- */

const cache = new Map(); // key -> { at, ttl, value }

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > hit.ttl) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value, ttl) {
  cache.set(key, { at: Date.now(), ttl, value });
}

async function call(path, params = {}, { ttl = 30_000 } = {}) {
  if (!isApiFootballEnabled()) {
    throw Object.assign(new Error('API-Football key not configured'), { code: 'NO_KEY' });
  }
  const key = `${path}?${new URLSearchParams(params).toString()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const res = await client.get(path, { params });
  const body = res.data;
  if (Array.isArray(body?.errors) && body.errors.length) {
    throw new Error(`API-Football error: ${JSON.stringify(body.errors)}`);
  }
  cacheSet(key, body, ttl);
  return body;
}

/* ---------- shape helpers (trim API-Football payload to FE-friendly DTOs) ---------- */

function shapeFixture(f) {
  return {
    id: f.fixture.id,
    league: f.league?.name,
    country: f.league?.country,
    kickoff: f.fixture.date,
    status: f.fixture.status?.short,
    elapsed: f.fixture.status?.elapsed,
    venue: f.fixture.venue?.name,
    home: {
      id: f.teams.home.id,
      name: f.teams.home.name,
      logo: f.teams.home.logo,
      goals: f.goals?.home,
      winner: f.teams.home.winner,
    },
    away: {
      id: f.teams.away.id,
      name: f.teams.away.name,
      logo: f.teams.away.logo,
      goals: f.goals?.away,
      winner: f.teams.away.winner,
    },
  };
}

function shapeTeam(t) {
  return {
    id: t.team?.id,
    name: t.team?.name,
    code: t.team?.code,
    country: t.team?.country,
    founded: t.team?.founded,
    national: t.team?.national,
    logo: t.team?.logo,
    venue: t.venue
      ? { name: t.venue.name, city: t.venue.city, capacity: t.venue.capacity, image: t.venue.image }
      : null,
  };
}

function shapePrediction(p) {
  const teams = p.teams || {};
  const pred = p.predictions || {};
  return {
    fixtureId: p.fixture?.id ?? null,
    league: p.league?.name,
    home: { id: teams.home?.id, name: teams.home?.name, logo: teams.home?.logo },
    away: { id: teams.away?.id, name: teams.away?.name, logo: teams.away?.logo },
    advice: pred.advice,
    winner: pred.winner ? { id: pred.winner.id, name: pred.winner.name, comment: pred.winner.comment } : null,
    winOrDraw: pred.win_or_draw ?? null,
    underOver: pred.under_over ?? null,
    goals: pred.goals ?? null,
    percent: pred.percent ?? null,
  };
}

/* ---------- public surface ---------- */

export async function getLiveMatches() {
  if (!isApiFootballEnabled()) {
    throw Object.assign(new Error('API-Football key not configured'), { code: 'NO_KEY' });
  }

  const cacheKey = 'official:/fixtures?live=all';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const res = await axios.get('https://v3.football.api-sports.io/fixtures', {
    timeout: 10_000,
    params: { live: 'all' },
    headers: {
      'x-apisports-key': API_KEY,
    },
  });

  const body = res.data;
  if (Array.isArray(body?.errors) && body.errors.length) {
    const err = new Error(`API-Sports error: ${JSON.stringify(body.errors)}`);
    err.response = { status: res.status, data: body };
    throw err;
  }

  cacheSet(cacheKey, body, 15_000);
  return (body.response || []).map(shapeFixture);
}

export async function getTeam(id) {
  const body = await call('/teams', { id }, { ttl: 60 * 60_000 });
  const first = (body.response || [])[0];
  return first ? shapeTeam(first) : null;
}

export async function getPredictionsFeed({ limit = 10 } = {}) {
  // Pull a window of upcoming fixtures, then ask API-Football for predictions on each.
  const today = new Date().toISOString().slice(0, 10);
  const fixtures = await call('/fixtures', { date: today, status: 'NS' }, { ttl: 5 * 60_000 });
  const slate = (fixtures.response || []).slice(0, limit);

  const items = [];
  for (const f of slate) {
    try {
      const pBody = await call('/predictions', { fixture: f.fixture.id }, { ttl: 10 * 60_000 });
      const p = (pBody.response || [])[0];
      if (p) items.push(shapePrediction(p));
    } catch {
      // skip fixtures without a prediction available
    }
  }
  return items;
}
