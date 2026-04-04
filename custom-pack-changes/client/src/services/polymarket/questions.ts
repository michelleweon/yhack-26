import type { Question } from '@/types/game';
import { POLYMARKET_CATEGORIES, getPolymarketCategoryName } from './categories';

const GAMMA_ORIGIN = 'https://gamma-api.polymarket.com';
const POOL_LIMIT = 50;

interface PolymarketMarket {
  groupItemTitle?: string | null;
  question?: string | null;
  outcomePrices?: string | number[] | null;
}

interface PolymarketEvent {
  id?: string | number;
  title?: string | null;
  slug?: string | null;
  markets?: PolymarketMarket[];
}

function gammaTagSlugForUiCategory(uiTag: string) {
  const row = POLYMARKET_CATEGORIES.find(category => category.tag === uiTag);
  return row?.gammaSlug ?? row?.tag ?? uiTag;
}

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

async function polyFetchJson<T>(url: string): Promise<T> {
  const primaryUrl =
    import.meta.env.DEV && url.startsWith(GAMMA_ORIGIN)
      ? `/polymarket-api${url.slice(GAMMA_ORIGIN.length)}`
      : url;

  try {
    const response = await fetch(primaryUrl);
    if (response.ok) {
      return response.json() as Promise<T>;
    }
  } catch {
    // Fall through to the public proxy list below.
  }

  const encodedUrl = encodeURIComponent(url);
  const fallbackUrls = [
    `https://api.allorigins.win/raw?url=${encodedUrl}`,
    `https://corsproxy.io/?${encodedUrl}`,
  ];

  for (const fallbackUrl of fallbackUrls) {
    try {
      const response = await fetch(fallbackUrl);
      if (response.ok) {
        return response.json() as Promise<T>;
      }
    } catch {
      // Try the next public proxy.
    }
  }

  throw new Error('Failed to fetch from Polymarket');
}

function parseOutcomePrices(raw: string | number[] | null | undefined) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(Number);

  try {
    return JSON.parse(raw).map(Number) as number[];
  } catch {
    return [];
  }
}

function normalizeChoiceLabel(label: string | null | undefined) {
  return label?.replace(/^Will\s+/i, '').replace(/\?$/, '').trim() || 'Unknown';
}

function eventToQuestion(event: PolymarketEvent, tag: string): Question | null {
  if (!event.markets?.length) {
    return null;
  }

  if (event.markets.length >= 4) {
    const markets = event.markets
      .map(market => ({
        label: normalizeChoiceLabel(market.groupItemTitle ?? market.question),
        prices: parseOutcomePrices(market.outcomePrices),
      }))
      .filter(market => market.label && market.label !== 'Unknown')
      .sort((a, b) => (b.prices[0] ?? 0) - (a.prices[0] ?? 0) || a.label.localeCompare(b.label))
      .slice(0, 4);
    const choices = markets.map(market => market.label);
    const probabilities = markets.map(market => {
      return market.prices[0] ?? 0;
    });

    if (choices.length < 4) {
      return null;
    }

    return {
      id: `poly-${event.id ?? event.slug ?? crypto.randomUUID()}`,
      question: event.title?.trim() || 'Untitled market',
      choices,
      probabilities,
      correct: probabilities.indexOf(Math.max(...probabilities)),
      keywords: ['polymarket', tag],
      category: getPolymarketCategoryName(tag),
      source: event.slug ? `https://polymarket.com/event/${event.slug}` : null,
    };
  }

  return null;
}

export async function fetchPolymarketQuestions(tag: string, count = 5) {
  const slug = gammaTagSlugForUiCategory(tag);

  try {
    const events = await polyFetchJson<PolymarketEvent[]>(
      `${GAMMA_ORIGIN}/events?tag_slug=${encodeURIComponent(slug)}&closed=false&active=true&limit=${POOL_LIMIT}&order=volume24hr&ascending=false`
    );

    if (!Array.isArray(events)) {
      return [];
    }

    const questions = events
      .map(event => eventToQuestion(event, tag))
      .filter((question): question is Question => question !== null);

    return shuffle(questions).slice(0, count);
  } catch (error) {
    console.warn(`Failed to fetch ${tag} questions from Polymarket`, error);
    return [];
  }
}

export async function fetchPolymarketQuestionDeck(categoryTags: string[], totalQuestions: number) {
  const uniqueTags = Array.from(
    new Set(categoryTags.map(tag => tag.trim()).filter(Boolean))
  );

  if (uniqueTags.length === 0) {
    return [];
  }

  const perCategory = Math.max(3, Math.ceil(totalQuestions / uniqueTags.length) * 2);
  const questionGroups = await Promise.all(
    uniqueTags.map(tag => fetchPolymarketQuestions(tag, perCategory))
  );

  return shuffle(questionGroups.flat()).slice(0, totalQuestions);
}
