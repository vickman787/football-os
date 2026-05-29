import axios from 'axios';

const GAMMA_BASE_URL = 'https://gamma-api.polymarket.com';
const FOOTBALL_KEYWORDS = [
  'football',
  'soccer',
  'premier league',
  'champions league',
  'europa league',
  'laliga',
  'serie a',
  'bundesliga',
  'world cup',
  'afcon',
  'uefa',
  'fifa',
];

const client = axios.create({
  baseURL: GAMMA_BASE_URL,
  timeout: 10_000,
});

function parseMaybeJson(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value ?? [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function eventText(event) {
  return [
    event.title,
    event.slug,
    event.category,
    event.description,
    ...(event.markets || []).flatMap((market) => [market.question, market.slug]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isFootballEvent(event) {
  const text = eventText(event);
  return FOOTBALL_KEYWORDS.some((keyword) => text.includes(keyword));
}

function normalizeMarket(market) {
  return {
    id: market.id,
    question: market.question,
    slug: market.slug,
    outcomes: parseMaybeJson(market.outcomes),
    outcomePrices: parseMaybeJson(market.outcomePrices),
    volume: asNumber(market.volume),
    liquidity: asNumber(market.liquidity),
    active: Boolean(market.active),
    closed: Boolean(market.closed),
  };
}

function normalizeEvent(event) {
  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    category: event.category,
    volume: asNumber(event.volume),
    liquidity: asNumber(event.liquidity),
    startDate: event.startDate,
    endDate: event.endDate,
    active: Boolean(event.active),
    closed: Boolean(event.closed),
    markets: (event.markets || [])
      .filter((market) => market.active && !market.closed)
      .map(normalizeMarket),
    source: 'Polymarket',
  };
}

export async function getFootballMarkets() {
  const res = await client.get('/events', {
    params: {
      active: true,
      closed: false,
      limit: 100,
    },
  });

  const events = Array.isArray(res.data) ? res.data : res.data?.events || [];
  return events
    .filter(isFootballEvent)
    .map(normalizeEvent)
    .filter((event) => event.markets.length > 0);
}
