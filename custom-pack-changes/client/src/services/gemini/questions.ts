import type { CustomPackSettings, Question } from '@/types/game';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';
const CACHE_KEY_PREFIX = 'custom-pack-gemini-v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const RATE_LIMIT_KEY = 'custom-pack-gemini-rate-limit-until';

const STYLE_LABELS: Record<CustomPackSettings['style'], string> = {
  funny: 'Funny',
  'kid-friendly': 'Kid-Friendly',
  'for-friends': 'For Friends',
  'for-family': 'For Family',
};

interface GeminiCandidate {
  content?: {
    parts?: Array<{
      text?: string;
    }>;
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: {
    message?: string;
    details?: Array<{
      ['@type']?: string;
      retryDelay?: string;
    }>;
  };
}

interface GeminiQuestionPayload {
  question?: unknown;
  options?: unknown;
  choices?: unknown;
  answers?: unknown;
  correct?: unknown;
  correctIndex?: unknown;
  answer?: unknown;
  probabilities?: unknown;
}

interface CachedQuestions {
  generatedAt: number;
  questions: Question[];
}

function clampQuestionCount(count: number) {
  return Math.max(3, Math.min(15, Math.floor(count)));
}

function normalizeProbabilities(raw: number[]) {
  const safe = raw.slice(0, 4).map(value => (Number.isFinite(value) && value >= 0 ? value : 0));
  const sum = safe.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) {
    return [0.25, 0.25, 0.25, 0.25];
  }
  return safe.map(value => value / sum);
}

function estimateMaxOutputTokens(numQuestions: number) {
  // Keep this bounded for cost, but less aggressive to avoid truncation.
  return Math.max(400, Math.min(2400, numQuestions * 120));
}

function buildCacheKey(settings: CustomPackSettings, playerNames: string[]) {
  const normalizedNames = playerNames.map(name => name.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
  return `${CACHE_KEY_PREFIX}:${JSON.stringify({
    numQuestions: clampQuestionCount(settings.numQuestions),
    style: settings.style,
    includeNames: settings.includeNames,
    names: normalizedNames,
  })}`;
}

function readRateLimitUntil() {
  try {
    const raw = window.sessionStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return 0;
    const until = Number(raw);
    return Number.isFinite(until) ? until : 0;
  } catch {
    return 0;
  }
}

function writeRateLimitUntil(until: number) {
  try {
    window.sessionStorage.setItem(RATE_LIMIT_KEY, String(until));
  } catch {
    // Ignore storage errors.
  }
}

function readCache(cacheKey: string) {
  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedQuestions;
    if (!parsed?.generatedAt || !Array.isArray(parsed.questions)) {
      return null;
    }
    if (Date.now() - parsed.generatedAt > CACHE_TTL_MS) {
      window.sessionStorage.removeItem(cacheKey);
      return null;
    }
    return parsed.questions;
  } catch {
    return null;
  }
}

function writeCache(cacheKey: string, questions: Question[]) {
  try {
    const payload: CachedQuestions = {
      generatedAt: Date.now(),
      questions,
    };
    window.sessionStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch {
    // Ignore storage errors; generation still succeeds.
  }
}

function toQuestion(payload: GeminiQuestionPayload, index: number): Question | null {
  if (typeof payload.question !== 'string') {
    return null;
  }

  const rawOptions = payload.options ?? payload.choices ?? payload.answers;
  if (!Array.isArray(rawOptions) || rawOptions.length !== 4) {
    return null;
  }

  const choices = rawOptions.map(option => String(option ?? '').trim()).filter(Boolean);
  if (choices.length !== 4) {
    return null;
  }

  const rawCorrect = payload.correct ?? payload.correctIndex ?? payload.answer;
  let correct = Number(rawCorrect);

  if (!Number.isInteger(correct) && typeof rawCorrect === 'string') {
    const normalized = rawCorrect.trim().toUpperCase();
    if (normalized.length === 1 && normalized >= 'A' && normalized <= 'D') {
      correct = normalized.charCodeAt(0) - 65;
    }
  }

  if (!Number.isInteger(correct) || correct < 0 || correct > 3) {
    return null;
  }

  const probabilities = Array.isArray(payload.probabilities)
    ? normalizeProbabilities(payload.probabilities.map(value => Number(value)))
    : [0.25, 0.25, 0.25, 0.25];

  return {
    id: `custom-${index}-${crypto.randomUUID()}`,
    question: payload.question.trim(),
    choices,
    correct,
    probabilities,
    keywords: ['custom-pack', 'gemini'],
    category: 'Custom Pack',
    source: null,
  };
}

function parseJsonArrayFromText(rawText: string) {
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }
    try {
      const sliced = cleaned.slice(start, end + 1);
      const parsed = JSON.parse(sliced) as unknown;
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function parseRetryDelayMs(errorData: GeminiResponse | null, rawBody: string) {
  const retryDetail = errorData?.error?.details?.find(detail => detail?.retryDelay)?.retryDelay;
  if (retryDetail) {
    const match = retryDetail.match(/(\d+(?:\.\d+)?)s/i);
    if (match) {
      return Math.ceil(Number(match[1]) * 1000);
    }
  }

  const bodyMatch = rawBody.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (bodyMatch) {
    return Math.ceil(Number(bodyMatch[1]) * 1000);
  }

  return 60_000;
}

export async function fetchGeminiCustomQuestions(
  settings: CustomPackSettings,
  playerNames: string[] = []
) {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing VITE_GEMINI_API_KEY.');
  }

  const numQuestions = clampQuestionCount(settings.numQuestions);
  const styleLabel = STYLE_LABELS[settings.style];
  const cacheKey = buildCacheKey(settings, playerNames);
  const cached = readCache(cacheKey);
  if (cached && cached.length >= numQuestions) {
    return cached.slice(0, numQuestions);
  }
  const blockedUntil = readRateLimitUntil();
  if (Date.now() < blockedUntil) {
    const waitSeconds = Math.max(1, Math.ceil((blockedUntil - Date.now()) / 1000));
    throw new Error(`Gemini is rate-limited. Retry in about ${waitSeconds}s.`);
  }
  const namesLine =
    settings.includeNames && playerNames.length > 0
      ? `Use some player names naturally: ${playerNames.join(', ')}.`
      : '';

  const prompt = `Create ${numQuestions} multiplayer party questions.
Tone: ${styleLabel}.
${namesLine}

Return only JSON array with exactly ${numQuestions} objects.
Each object: {"question": string, "options": [4 strings], "correct": 0..3}
Rules: concise, varied, safe, no markdown, no prose.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: estimateMaxOutputTokens(numQuestions),
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let parsedError: GeminiResponse | null = null;
    try {
      parsedError = JSON.parse(body) as GeminiResponse;
    } catch {
      parsedError = null;
    }

    if (response.status === 429) {
      const retryMs = parseRetryDelayMs(parsedError, body);
      writeRateLimitUntil(Date.now() + retryMs);
      throw new Error(`Gemini quota exceeded (429). Retry in about ${Math.ceil(retryMs / 1000)}s.`);
    }

    throw new Error(`Gemini API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('No response text from Gemini.');
  }

  const parsed = parseJsonArrayFromText(rawText);
  if (!parsed) {
    throw new Error('Gemini response was not a JSON array.');
  }

  const questions = parsed
    .map((item, index) => toQuestion(item as GeminiQuestionPayload, index))
    .filter((item): item is Question => item !== null);

  if (questions.length < numQuestions) {
    throw new Error('Gemini returned too few valid questions.');
  }
  const finalQuestions = questions.slice(0, numQuestions);
  writeCache(cacheKey, finalQuestions);
  return finalQuestions;
}
