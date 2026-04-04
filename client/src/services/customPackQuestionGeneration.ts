import type { CustomPackSourceType, Question } from '@/types/game';

interface GenerateCustomPackQuestionsInput {
  filename: string;
  label: string;
  sourceType: CustomPackSourceType;
  text: string;
}

interface GeneratedQuestionPayload {
  question?: string;
  choices?: string[];
  options?: string[];
  answers?: string[];
  answerChoices?: string[];
  correct?: number | string;
  correctAnswer?: number | string;
  answer?: number | string;
}

interface GeneratedQuestionResponse {
  questions?: GeneratedQuestionPayload[];
}

interface CustomPackErrorResponse {
  error?: string;
  rawTextSnippet?: string | null;
  rawApiResponse?: string | null;
  finishReason?: string | null;
  promptText?: string | null;
}

interface CustomPackSuccessDebugResponse {
  rawModelText?: string | null;
  rawApiResponse?: string | null;
  finishReason?: string | null;
  promptText?: string | null;
}

interface GeneratedQuestionSuccessResponse {
  questions?: GeneratedQuestionPayload[];
  debug?: CustomPackSuccessDebugResponse;
}

function getSuccessDebugPayload(
  payload: GeneratedQuestionPayload[] | GeneratedQuestionResponse | GeneratedQuestionSuccessResponse
) {
  if (Array.isArray(payload) || !('debug' in payload)) {
    return null;
  }

  return payload.debug ?? null;
}

export interface CustomPackQuestionGenerationDebug {
  strategy:
    | 'fallback-short-input'
    | 'gemini-success'
    | 'fallback-invalid-response'
    | 'fallback-request-error';
  normalizedTextLength: number;
  responseStatus: number | null;
  rawQuestionCount: number;
  normalizedQuestionCount: number;
  fallbackReason: string | null;
  responseText: string | null;
  rawApiResponse: string | null;
  finishReason: string | null;
  promptText: string | null;
  invalidQuestionReasons: string[];
}

export interface CustomPackQuestionGenerationResult {
  questions: Question[];
  debug: CustomPackQuestionGenerationDebug;
}

function getFileLabel(filename: string) {
  return filename.replace(/\.[^/.]+$/, '');
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildKeywords(sourceType: CustomPackSourceType, label: string) {
  return [sourceType, slugify(label)].filter(Boolean);
}

function sanitizeChoiceLabel(choice: string) {
  return choice
    .replace(/^[A-D][\)\].:-]\s*/i, '')
    .replace(/^\d+[\)\].:-]\s*/, '')
    .trim();
}

function getChoiceList(payload: GeneratedQuestionPayload) {
  const rawChoices =
    payload.choices
    ?? payload.options
    ?? payload.answers
    ?? payload.answerChoices
    ?? [];

  return Array.isArray(rawChoices)
    ? rawChoices
      .map(choice => (typeof choice === 'string' ? sanitizeChoiceLabel(choice) : ''))
      .filter(Boolean)
      .slice(0, 4)
    : [];
}

function getCorrectValue(payload: GeneratedQuestionPayload) {
  return payload.correct ?? payload.correctAnswer ?? payload.answer;
}

function getCorrectIndexFromString(correctValue: string, choices: string[]) {
  const normalizedValue = correctValue.trim();
  const upperValue = normalizedValue.toUpperCase();

  if (/^[A-D]$/.test(upperValue)) {
    return upperValue.charCodeAt(0) - 65;
  }

  const letterPrefixMatch = upperValue.match(/^([A-D])[\)\].:-]?/);
  if (letterPrefixMatch) {
    return letterPrefixMatch[1].charCodeAt(0) - 65;
  }

  const numericValue = Number.parseInt(normalizedValue, 10);
  if (Number.isFinite(numericValue)) {
    if (numericValue >= 0 && numericValue <= 3) {
      return numericValue;
    }

    if (numericValue >= 1 && numericValue <= 4) {
      return numericValue - 1;
    }
  }

  const normalizedChoiceIndex = choices.findIndex(choice => (
    choice.localeCompare(sanitizeChoiceLabel(normalizedValue), undefined, { sensitivity: 'base' }) === 0
  ));

  return normalizedChoiceIndex;
}

function getCorrectIndex(payload: GeneratedQuestionPayload, choices: string[]) {
  const correctValue = getCorrectValue(payload);

  if (typeof correctValue === 'number' && Number.isFinite(correctValue)) {
    if (correctValue >= 0 && correctValue <= 3) {
      return correctValue;
    }

    if (correctValue >= 1 && correctValue <= 4) {
      return correctValue - 1;
    }
  }

  if (typeof correctValue === 'string') {
    return getCorrectIndexFromString(correctValue, choices);
  }

  return -1;
}

function buildFallbackQuestionSet({
  filename,
  label,
  sourceType,
}: Omit<GenerateCustomPackQuestionsInput, 'text'>): Question[] {
  const sourceLabel = getFileLabel(filename);
  const keywords = buildKeywords(sourceType, label);

  return [
    {
      id: `fallback-${slugify(sourceLabel)}-1`,
      question: `Which upload was so empty it became its own trivia category?`,
      choices: [sourceLabel, 'The vault manifest', 'A random market feed', 'Nobody knows'],
      correct: 0,
      keywords,
      category: label,
      source: null,
    },
    {
      id: `fallback-${slugify(sourceLabel)}-2`,
      question: `How many reliable facts were available in ${sourceLabel}?`,
      choices: ['Zero', 'One hundred', 'Exactly twelve', 'More than enough'],
      correct: 0,
      keywords,
      category: label,
      source: null,
    },
    {
      id: `fallback-${slugify(sourceLabel)}-3`,
      question: `What should the crew probably do before trusting ${sourceLabel}?`,
      choices: ['Upload a fuller file', 'Publish it as-is', 'Throw out all answer choices', 'Assume it contains secrets'],
      correct: 0,
      keywords,
      category: label,
      source: null,
    },
    {
      id: `fallback-${slugify(sourceLabel)}-4`,
      question: `Why did this pack turn into backup trivia instead of deep source questions?`,
      choices: ['The upload was too short on usable content', 'Gemini forgot how to read', 'The room code expired', 'The raccoons ate the PDF'],
      correct: 0,
      keywords,
      category: label,
      source: null,
    },
    {
      id: `fallback-${slugify(sourceLabel)}-5`,
      question: `What is the safest fact to remember about ${sourceLabel}?`,
      choices: ['It needs more source material', 'It proves everything', 'It contains 500 pages', 'It came from Polymarket'],
      correct: 0,
      keywords,
      category: label,
      source: null,
    },
  ];
}

function describeInvalidQuestion({
  payload,
  index,
  filename,
  label,
  sourceType,
}: {
  payload: GeneratedQuestionPayload;
  index: number;
  filename: string;
  label: string;
  sourceType: CustomPackSourceType;
}): { question: Question | null; invalidReason: string | null } {
  const question = typeof payload.question === 'string' ? payload.question.trim() : '';
  const choices = getChoiceList(payload);
  const correct = getCorrectIndex(payload, choices);

  if (!question) {
    return {
      question: null,
      invalidReason: `Question ${index + 1}: missing "question" string.`,
    };
  }

  if (choices.length !== 4) {
    return {
      question: null,
      invalidReason: `Question ${index + 1}: expected 4 answer choices but got ${choices.length}.`,
    };
  }

  if (correct < 0 || correct > 3) {
    return {
      question: null,
      invalidReason: `Question ${index + 1}: could not resolve a valid correct-answer index from ${JSON.stringify(getCorrectValue(payload))}.`,
    };
  }

  return {
      question: {
        id: `${slugify(label)}-${slugify(filename)}-${index + 1}`,
        question,
        choices,
        correct,
        keywords: buildKeywords(sourceType, label),
        category: label,
        source: null,
      },
    invalidReason: null,
  };
}

export async function generateCustomPackQuestionsDetailed(
  input: GenerateCustomPackQuestionsInput
): Promise<CustomPackQuestionGenerationResult> {
  const normalizedText = input.text.trim();

  if (normalizedText.length < 80) {
    return {
      questions: buildFallbackQuestionSet(input),
      debug: {
        strategy: 'fallback-short-input',
        normalizedTextLength: normalizedText.length,
        responseStatus: null,
        rawQuestionCount: 0,
        normalizedQuestionCount: 5,
        fallbackReason: 'Converted text was too short to send to Gemini.',
        responseText: null,
        rawApiResponse: null,
        finishReason: null,
        promptText: null,
        invalidQuestionReasons: [],
      },
    };
  }

  try {
    const response = await fetch('/api/gemini-custom-pack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: input.filename,
        label: input.label,
        sourceType: input.sourceType,
        text: normalizedText,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = responseText || 'Unable to generate custom pack';
      let errorSnippet: string | null = null;
      let rawApiResponse: string | null = null;
      let finishReason: string | null = null;
      let promptText: string | null = null;

      try {
        const errorPayload = JSON.parse(responseText) as CustomPackErrorResponse;
        errorMessage = errorPayload.error || errorMessage;
        errorSnippet = errorPayload.rawTextSnippet ?? null;
        rawApiResponse = errorPayload.rawApiResponse ?? null;
        finishReason = errorPayload.finishReason ?? null;
        promptText = errorPayload.promptText ?? null;
      } catch {
        // Keep the raw text body when the error payload is not JSON.
      }

      return {
        questions: buildFallbackQuestionSet(input),
        debug: {
          strategy: 'fallback-request-error',
          normalizedTextLength: normalizedText.length,
          responseStatus: response.status,
          rawQuestionCount: 0,
          normalizedQuestionCount: 5,
          fallbackReason: errorMessage,
          responseText: errorSnippet ?? responseText,
          rawApiResponse,
          finishReason,
          promptText,
          invalidQuestionReasons: [],
        },
      };
    }

    const payload = JSON.parse(responseText) as
      GeneratedQuestionPayload[]
      | GeneratedQuestionResponse
      | GeneratedQuestionSuccessResponse;
    const successDebugPayload = getSuccessDebugPayload(payload);
    const rawQuestions = Array.isArray(payload) ? payload : (payload.questions ?? []);
    const normalizedResults = rawQuestions
      .map((questionPayload, index) => describeInvalidQuestion({
        payload: questionPayload,
        index,
        filename: input.filename,
        label: input.label,
        sourceType: input.sourceType,
      }));
    const questions = normalizedResults
      .map(result => result.question)
      .filter((question): question is Question => question !== null)
      .slice(0, 5);
    const invalidQuestionReasons = normalizedResults
      .map(result => result.invalidReason)
      .filter((reason): reason is string => Boolean(reason));

    if (questions.length === 5) {
      return {
        questions,
        debug: {
          strategy: 'gemini-success',
          normalizedTextLength: normalizedText.length,
          responseStatus: response.status,
          rawQuestionCount: rawQuestions.length,
          normalizedQuestionCount: questions.length,
          fallbackReason: null,
          responseText: successDebugPayload?.rawModelText ?? responseText,
          rawApiResponse: successDebugPayload?.rawApiResponse ?? null,
          finishReason: successDebugPayload?.finishReason ?? null,
          promptText: successDebugPayload?.promptText ?? null,
          invalidQuestionReasons,
        },
      };
    }

    return {
      questions: buildFallbackQuestionSet(input),
      debug: {
        strategy: 'fallback-invalid-response',
        normalizedTextLength: normalizedText.length,
        responseStatus: response.status,
        rawQuestionCount: rawQuestions.length,
        normalizedQuestionCount: questions.length,
        fallbackReason: 'Gemini returned questions, but they were missing required fields or did not normalize to 5 usable entries.',
        responseText: successDebugPayload?.rawModelText ?? responseText,
        rawApiResponse: successDebugPayload?.rawApiResponse ?? null,
        finishReason: successDebugPayload?.finishReason ?? null,
        promptText: successDebugPayload?.promptText ?? null,
        invalidQuestionReasons,
      },
    };
  } catch (error) {
    console.warn('Custom pack question generation fell back to local defaults', error);

    return {
      questions: buildFallbackQuestionSet(input),
      debug: {
        strategy: 'fallback-request-error',
        normalizedTextLength: normalizedText.length,
        responseStatus: null,
        rawQuestionCount: 0,
        normalizedQuestionCount: 5,
        fallbackReason: error instanceof Error ? error.message : 'Unknown Gemini request failure.',
        responseText: null,
        rawApiResponse: null,
        finishReason: null,
        promptText: null,
        invalidQuestionReasons: [],
      },
    };
  }
}

export async function generateCustomPackQuestions(input: GenerateCustomPackQuestionsInput) {
  const result = await generateCustomPackQuestionsDetailed(input);
  return result.questions;
}
