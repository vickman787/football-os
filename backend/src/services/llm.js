import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export const isLlmEnabled = () => Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);

const SYSTEM_PROMPT = `You are the Football OS AI engine. You analyse upcoming football fixtures
and produce a structured prediction. You MUST reply with ONLY a JSON object — no prose, no markdown,
no code fences. The JSON must match this shape exactly:

{
  "predictedWinner": "team name or 'Draw'",
  "confidence": 0-100,
  "reasoning": "2-3 sentences explaining the call",
  "riskLevel": "Low" | "Medium" | "High",
  "suggestedXPost": "<= 240 chars, punchy, no hashtags spam",
  "scorePrediction": "Most likely final score in the format H-A, e.g. 2-1"
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
  if (confidence > 0 && confidence <= 1) confidence = Math.round(confidence * 100);
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  const risk = String(obj.riskLevel || '').trim();
  const riskLevel = ['Low', 'Medium', 'High'].includes(risk) ? risk : (
    confidence >= 70 ? 'Low' : confidence >= 50 ? 'Medium' : 'High'
  );

  let scorePrediction = String(obj.scorePrediction || '').trim();
  if (scorePrediction && !/^\d+\s*-\s*\d+$/.test(scorePrediction)) scorePrediction = '';

  return {
    predictedWinner: String(obj.predictedWinner || '').trim() || 'Draw',
    confidence,
    reasoning: String(obj.reasoning || '').trim(),
    riskLevel,
    suggestedXPost: String(obj.suggestedXPost || '').trim().slice(0, 240),
    scorePrediction,
  };
}

export async function aiPredict({ teamA, teamB, matchContext }) {
  if (!isLlmEnabled()) {
    throw new Error('NO_API_KEY_CONFIGURED');
  }

  const provider = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
  
  try {
    let rawResponse = '';
    let usedModel = '';

    const userPrompt = buildUserPrompt({ teamA, teamB, matchContext });

    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      usedModel = process.env.OPENAI_MODEL || 'gpt-4o';
      
      const response = await openai.chat.completions.create({
        model: usedModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' }
      });
      rawResponse = response.choices[0]?.message?.content || '';
    } 
    else if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      usedModel = process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229';
      
      const response = await anthropic.messages.create({
        model: usedModel,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1024,
        temperature: 0.4,
      });
      rawResponse = response.content[0]?.text || '';
    } else {
      throw new Error(`Provider ${provider} selected but API key is missing.`);
    }

    const parsed = normalize(tryParseJson(rawResponse));
    if (!parsed) {
      throw new Error('model_returned_unparseable_json');
    }
    
    return { source: provider, model: usedModel, prediction: parsed };
  } catch (err) {
    console.warn(`[llm] aiPredict failed (${provider}):`, err.message);
    throw err;
  }
}
