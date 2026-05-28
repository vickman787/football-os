import axios from 'axios';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

export const isOpenRouterEnabled = () => Boolean(process.env.OPENROUTER_API_KEY);

const SYSTEM_PROMPT = `You are the Football OS AI engine. You analyse upcoming football fixtures
and produce a structured prediction. You MUST reply with ONLY a JSON object — no prose, no markdown,
no code fences. The JSON must match this shape exactly:

{
  "predictedWinner": "team name or 'Draw'",
  "confidence": 0-100,
  "reasoning": "2-3 sentences explaining the call",
  "riskLevel": "Low" | "Medium" | "High",
  "suggestedXPost": "<= 240 chars, punchy, no hashtags spam"
}`;

function buildUserPrompt({ teamA, teamB, matchContext }) {
  return [
    `Match: ${teamA} vs ${teamB}`,
    matchContext ? `Context: ${matchContext}` : 'Context: none provided',
    '',
    'Return only the JSON object.',
  ].join('\n');
}

function tryParseJson(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {}
  // Sometimes models wrap JSON in fences or trailing prose. Extract the first {...} block.
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  return null;
}

function normalize(obj) {
  if (!obj || typeof obj !== 'object') return null;
  let confidence = Number(obj.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  if (confidence > 0 && confidence <= 1) confidence = Math.round(confidence * 100); // tolerate 0-1 scale
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  const risk = String(obj.riskLevel || '').trim();
  const riskLevel = ['Low', 'Medium', 'High'].includes(risk) ? risk : (
    confidence >= 70 ? 'Low' : confidence >= 50 ? 'Medium' : 'High'
  );

  return {
    predictedWinner: String(obj.predictedWinner || '').trim() || 'Draw',
    confidence,
    reasoning: String(obj.reasoning || '').trim(),
    riskLevel,
    suggestedXPost: String(obj.suggestedXPost || '').trim().slice(0, 240),
  };
}

export function mockAiPrediction({ teamA, teamB, matchContext }) {
  const winner = Math.random() < 0.5 ? teamA : teamB;
  const confidence = 55 + Math.floor(Math.random() * 25);
  return {
    predictedWinner: winner,
    confidence,
    reasoning: `Heuristic call: ${winner} edges this on recent form and home/away splits. ${
      matchContext ? `Context noted: ${matchContext}.` : ''
    }`.trim(),
    riskLevel: confidence >= 70 ? 'Low' : confidence >= 60 ? 'Medium' : 'High',
    suggestedXPost: `Football OS call: ${winner} to win vs ${winner === teamA ? teamB : teamA}. Confidence ${confidence}%. Anchored onchain on X Layer.`,
  };
}

export async function aiPredict({ teamA, teamB, matchContext }) {
  if (!isOpenRouterEnabled()) {
    const mock = mockAiPrediction({ teamA, teamB, matchContext });
    return { source: 'mock', reason: 'NO_KEY', model: null, prediction: mock };
  }

  try {
    const res = await axios.post(
      ENDPOINT,
      {
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt({ teamA, teamB, matchContext }) },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      },
      {
        timeout: 20_000,
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://footballos.local',
          'X-Title': 'Football OS',
        },
      }
    );

    const raw = res.data?.choices?.[0]?.message?.content ?? '';
    const parsed = normalize(tryParseJson(raw));
    if (!parsed) {
      throw new Error('model_returned_unparseable_json');
    }
    return { source: 'openrouter', model: MODEL, prediction: parsed };
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.warn('[openrouter] aiPredict failed:', detail);
    const mock = mockAiPrediction({ teamA, teamB, matchContext });
    return {
      source: 'mock',
      reason: typeof detail === 'string' ? detail : (err.code || 'upstream_error'),
      model: MODEL,
      prediction: mock,
    };
  }
}
