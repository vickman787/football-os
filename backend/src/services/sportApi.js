import axios from 'axios';

const SPORTAPI_KEY = process.env.SPORTAPI_KEY || '';
const API_HOST = 'sportapi7.p.rapidapi.com';
const BASE_URL = `https://${API_HOST}/api/v1`;

export const isSportApiEnabled = () => Boolean(SPORTAPI_KEY);

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: {
    'x-rapidapi-key': SPORTAPI_KEY,
    'x-rapidapi-host': API_HOST,
  },
});

/* ---------- tiny in-memory cache ---------- */

const cache = new Map();

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

/* ---------- public surface ---------- */

// We keep the function name `getPredictionsFeed` so we don't have to change 
// too much of server.js, but it's really just "getUpcomingMatches" now.
export async function getPredictionsFeed({ limit = 15 } = {}) {
  if (!isSportApiEnabled()) {
    throw Object.assign(new Error('SportAPI key not configured'), { code: 'NO_KEY' });
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const path = `/category/1/scheduled-events/${today}`;
  
  const cached = cacheGet(path);
  if (cached) return cached.slice(0, limit);

  const res = await client.get(path);
  const body = res.data;
  
  if (body?.message) {
    throw new Error(`SportAPI error: ${body.message}`);
  }

  const events = body.events || body || [];
  
  const formatted = events.slice(0, limit).map(e => ({
    fixtureId: e.id,
    league: e.tournament?.name || 'Football',
    home: { 
      id: e.homeTeam?.id, 
      name: e.homeTeam?.name || 'Home' 
    },
    away: { 
      id: e.awayTeam?.id, 
      name: e.awayTeam?.name || 'Away' 
    },
    advice: null, // SportAPI doesn't have predictions
    kickoff: e.startTimestamp ? new Date(e.startTimestamp * 1000).toISOString() : null,
  }));

  cacheSet(path, formatted, 5 * 60_000);
  return formatted;
}
