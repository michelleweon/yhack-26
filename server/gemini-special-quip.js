const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const quipCache = new Map();

function getEnvValue(explicitValue, key) {
  if (typeof explicitValue === 'string' && explicitValue.trim()) {
    return explicitValue.trim();
  }

  const processValue = process.env[key];
  return typeof processValue === 'string' && processValue.trim()
    ? processValue.trim()
    : '';
}

function buildCacheKey(payload) {
  return JSON.stringify(payload);
}

function extractTextFromGeminiResponse(responseJson) {
  const candidates = Array.isArray(responseJson?.candidates) ? responseJson.candidates : [];

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];

    for (const part of parts) {
      if (typeof part?.text === 'string' && part.text.trim()) {
        return part.text.trim();
      }
    }
  }

  throw new Error('Gemini returned no quip text');
}

function buildPrompt({ playerName, outcome, category, question, correctAnswer }) {
  return [
    'Project context: R.A.C.O.O.N. means Risk Arbitrage & Chaotic Odds Ops Network.',
    'It is a heist-themed party quiz game with raccoon energy and a dry, sarcastic host voice.',
    'Write one short quip reacting to the player performance.',
    'Tone requirements: dry humour, sarcastic, lightly mean, negative even when they got it right.',
    'Rules: mention the player name exactly once, no quotes, no bullets, no emojis, no profanity, under 18 words.',
    'Return only the quip text.',
    `Player name: ${playerName}`,
    `Outcome: ${outcome}`,
    `Question category: ${category || 'Unknown'}`,
    `Question: ${question}`,
    `Correct answer: ${correctAnswer || 'Unknown'}`,
  ].join('\n');
}

async function synthesizeSpecialQuip({ apiKey, playerName, outcome, category, question, correctAnswer }) {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: buildPrompt({ playerName, outcome, category, question, correctAnswer }),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 1,
        topP: 0.9,
        maxOutputTokens: 60,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  const responseJson = await response.json();
  return extractTextFromGeminiResponse(responseJson);
}

export async function createSpecialQuip({
  apiKey: explicitApiKey,
  playerName,
  outcome,
  category,
  question,
  correctAnswer,
}) {
  const apiKey = getEnvValue(explicitApiKey, 'GEMINI_API_KEY');

  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  if (!playerName || !question) {
    throw new Error('Missing quip context');
  }

  const payload = {
    playerName: playerName.trim(),
    outcome: outcome === 'correct' ? 'correct' : 'wrong',
    category: typeof category === 'string' ? category.trim() : '',
    question: question.trim(),
    correctAnswer: typeof correctAnswer === 'string' ? correctAnswer.trim() : '',
  };
  const cacheKey = buildCacheKey(payload);
  const cached = quipCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const quip = await synthesizeSpecialQuip({
    apiKey,
    ...payload,
  });

  quipCache.set(cacheKey, quip);
  return quip;
}

export async function handleSpecialQuipRequest({ method, body, apiKey }) {
  if (method !== 'POST') {
    return {
      status: 405,
      headers: { Allow: 'POST', 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({ error: 'Method not allowed' })),
    };
  }

  let payload;

  try {
    payload = typeof body === 'string' ? JSON.parse(body) : body;
  } catch {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({ error: 'Invalid JSON body' })),
    };
  }

  try {
    const quip = await createSpecialQuip({
      apiKey,
      playerName: payload?.playerName,
      outcome: payload?.outcome,
      category: payload?.category,
      question: payload?.question,
      correctAnswer: payload?.correctAnswer,
    });

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
      body: Buffer.from(JSON.stringify({ quip })),
    };
  } catch (error) {
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to generate special quip',
      })),
    };
  }
}
