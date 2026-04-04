const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const customPackCache = new Map();
class GeminiCustomPackJsonError extends Error {
  constructor(message, rawTextSnippet, rawApiResponse, finishReason, promptText) {
    super(message);
    this.name = 'GeminiCustomPackJsonError';
    this.rawTextSnippet = rawTextSnippet;
    this.rawApiResponse = rawApiResponse;
    this.finishReason = finishReason;
    this.promptText = promptText;
  }
}

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
    const textParts = parts
      .map(part => (typeof part?.text === 'string' ? part.text : ''))
      .filter(partText => partText.trim().length > 0);

    if (textParts.length > 0) {
      return textParts.join('').trim();
    }
  }

  throw new Error('Gemini returned no custom-pack text');
}

function repairCommonJsonIssues(text) {
  return text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

function extractJsonPayload(text, responseJson, promptText) {
  const candidateTexts = [
    text,
    repairCommonJsonIssues(text),
  ];

  for (const candidateText of candidateTexts) {
    const firstBrace = candidateText.indexOf('{');
    const lastBrace = candidateText.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      continue;
    }

    const jsonSlice = candidateText.slice(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(jsonSlice);
    } catch {
      // Try the next repaired variant.
    }
  }

  const firstCandidate = Array.isArray(responseJson?.candidates) ? responseJson.candidates[0] : null;

  throw new GeminiCustomPackJsonError(
    'Gemini returned invalid custom-pack JSON',
    text,
    JSON.stringify(responseJson, null, 2),
    typeof firstCandidate?.finishReason === 'string' ? firstCandidate.finishReason : null,
    promptText
  );
}

function buildPrompt({ filename, label, sourceType, text }) {
  return [
    'You are generating a quiz pack for a heist-themed party game.',
    'Return compact JSON only. No markdown. No commentary.',
    'Schema: {"questions":[{"question":"string","choices":["a","b","c","d"],"correct":0}]}',
    'Rules:',
    '- exactly 5 questions',
    '- exactly 4 answer choices per question',
    '- exactly one correct answer, expressed as a 0-based integer in "correct"',
    '- use only facts supported by the source excerpt',
    '- keep questions and answers concise',
    '- keep each question under 18 words',
    '- keep each answer choice under 10 words',
    '- prefer the shortest valid wording that preserves meaning',
    '- make distractors plausible',
    '- the source excerpt below is plain text converted from the uploaded file',
    '- every key and string value must use double quotes',
    '- do not wrap the JSON in markdown fences',
    '- do not include trailing commas',
    `Uploaded file: ${filename}`,
    `Pack label: ${label}`,
    `Scrap type: ${sourceType}`,
    'Source excerpt:',
    text,
  ].join('\n');
}

async function synthesizeCustomPack({ apiKey, filename, label, sourceType, text }) {
  const promptText = buildPrompt({ filename, label, sourceType, text });
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
              text: promptText,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.35,
        topP: 0.9,
        maxOutputTokens: 2200,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  const responseJson = await response.json();
  const responseText = extractTextFromGeminiResponse(responseJson);
  const parsedPayload = extractJsonPayload(responseText, responseJson, promptText);
  const firstCandidate = Array.isArray(responseJson?.candidates) ? responseJson.candidates[0] : null;

  return {
    parsedPayload,
    rawText: responseText,
    rawApiResponse: JSON.stringify(responseJson, null, 2),
    finishReason: typeof firstCandidate?.finishReason === 'string' ? firstCandidate.finishReason : null,
    promptText,
  };
}

export async function createCustomPackQuestions({
  apiKey: explicitApiKey,
  filename,
  label,
  sourceType,
  text,
}) {
  const apiKey = getEnvValue(explicitApiKey, 'GEMINI_API_KEY');

  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const payload = {
    filename: typeof filename === 'string' ? filename.trim() : '',
    label: typeof label === 'string' ? label.trim() : '',
    sourceType: typeof sourceType === 'string' ? sourceType.trim() : '',
    text: typeof text === 'string' ? text.trim() : '',
  };

  if (!payload.filename || !payload.label || !payload.sourceType || !payload.text) {
    throw new Error('Missing custom pack context');
  }

  const cacheKey = buildCacheKey(payload);
  const cached = customPackCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const nextQuestions = await synthesizeCustomPack({
    apiKey,
    ...payload,
  });

  customPackCache.set(cacheKey, nextQuestions);
  return nextQuestions;
}

export async function handleCustomPackRequest({ method, body, apiKey }) {
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
    const result = await createCustomPackQuestions({
      apiKey,
      filename: payload?.filename,
      label: payload?.label,
      sourceType: payload?.sourceType,
      text: payload?.text,
    });

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
      body: Buffer.from(JSON.stringify({
        questions: result.parsedPayload?.questions ?? result.parsedPayload,
        debug: {
          rawModelText: result.rawText,
          rawApiResponse: result.rawApiResponse,
          finishReason: result.finishReason,
          promptText: result.promptText,
        },
      })),
    };
  } catch (error) {
    const rawTextSnippet =
      typeof error === 'object'
      && error !== null
      && 'rawTextSnippet' in error
      && typeof error.rawTextSnippet === 'string'
        ? error.rawTextSnippet
        : null;
    const rawApiResponse =
      typeof error === 'object'
      && error !== null
      && 'rawApiResponse' in error
      && typeof error.rawApiResponse === 'string'
        ? error.rawApiResponse
        : null;
    const finishReason =
      typeof error === 'object'
      && error !== null
      && 'finishReason' in error
      && typeof error.finishReason === 'string'
        ? error.finishReason
        : null;
    const promptText =
      typeof error === 'object'
      && error !== null
      && 'promptText' in error
      && typeof error.promptText === 'string'
        ? error.promptText
        : null;

    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to generate custom pack',
        rawTextSnippet,
        rawApiResponse,
        finishReason,
        promptText,
      })),
    };
  }
}
