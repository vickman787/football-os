const TEMPLATES = [
  { type: 'INJURY', text: 'Late fitness test flagged for star striker — line about to move.', tag: 'INJURY' },
  { type: 'LINEUP', text: 'Predicted XI leaked: rotation in midfield, expect tempo shift.', tag: 'LINEUP' },
  { type: 'ODDS', text: 'Sharp money detected on the underdog. Odds compressed 8% in 4 min.', tag: 'ODDS' },
  { type: 'WEATHER', text: 'Heavy rain forecast at kickoff. Under 2.5 historically +12% in this fixture.', tag: 'WEATHER' },
  { type: 'MODEL', text: 'Model retrained on last 6 fixtures: confidence on home win adjusted +5%.', tag: 'AI' },
  { type: 'WHALE', text: 'Onchain wallet 0x4f…b7 just staked 12 ETH on a draw. 92% historic ROI.', tag: 'ONCHAIN' },
  { type: 'PRESSER', text: 'Manager presser hint: top scorer "managing fatigue". Possible bench start.', tag: 'NEWS' },
  { type: 'XG', text: 'Rolling xG diff flipped negative for away side over last 3 — regression incoming.', tag: 'STATS' },
];

const MATCHES = ['ARS vs MCI', 'RMA vs BAR', 'INT vs JUV', 'BAY vs PSG', 'BVB vs LEV', 'LIV vs CHE'];

let counter = 1000;

export function generateSignal() {
  const t = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const m = MATCHES[Math.floor(Math.random() * MATCHES.length)];
  const conf = 0.5 + Math.random() * 0.49;
  return {
    id: `sig-${++counter}`,
    match: m,
    tag: t.tag,
    text: t.text,
    confidence: Number(conf.toFixed(2)),
    timestamp: new Date().toISOString(),
  };
}

export const signals = Array.from({ length: 12 }, () => generateSignal()).map((s, i) => ({
  ...s,
  timestamp: new Date(Date.now() - i * 60_000).toISOString(),
}));
