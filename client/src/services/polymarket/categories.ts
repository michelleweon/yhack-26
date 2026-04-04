import type { PolymarketCategory } from './types';

export const POLYMARKET_CATEGORIES: PolymarketCategory[] = [
  { tag: 'sports', name: 'Sports', emoji: '⚽' },
  { tag: 'nba', name: 'NBA', emoji: '🏀' },
  { tag: 'nfl', name: 'NFL', emoji: '🏈' },
  { tag: 'soccer', name: 'Soccer', emoji: '🏟️' },
  { tag: 'politics', name: 'Politics', emoji: '🏛️' },
  { tag: 'us-politics', name: 'U.S. Politics', emoji: '🇺🇸' },
  { tag: 'elections', name: 'Elections', emoji: '🗳️' },
  { tag: 'geopolitics', name: 'Geopolitics', emoji: '🌍' },
  { tag: 'crypto', name: 'Crypto', emoji: '₿' },
  { tag: 'crypto-prices', name: 'Crypto Prices', emoji: '💱' },
  { tag: 'pop-culture', name: 'Pop Culture', emoji: '🎬' },
  { tag: 'music', name: 'Music', emoji: '🎵' },
  { tag: 'movies', name: 'Movies', emoji: '🍿' },
  { tag: 'youtube', name: 'YouTube', emoji: '▶️' },
  { tag: 'business', name: 'Business', emoji: '💼' },
  { tag: 'finance', name: 'Finance', emoji: '🏦' },
  { tag: 'economy', name: 'Economy', emoji: '📈' },
  { tag: 'stocks', name: 'Stocks', emoji: '📉' },
  { tag: 'fed', name: 'Fed & Rates', emoji: '💸' },
  { tag: 'commodities', name: 'Commodities', emoji: '🛢️' },
  { tag: 'science', gammaSlug: 'tech', name: 'Science & Tech', emoji: '🔬' },
  { tag: 'ai', name: 'AI', emoji: '🤖' },
  { tag: 'space', name: 'Space', emoji: '🛰️' },
  { tag: 'climate', name: 'Climate', emoji: '🌡️' },
  { tag: 'weather', name: 'Weather', emoji: '⛈️' },
  { tag: 'health', name: 'Health', emoji: '⚕️' },
  { tag: 'esports', name: 'Esports', emoji: '🎮' },
  { tag: 'chess', name: 'Chess', emoji: '♟️' },
];

const CATEGORY_LOOKUP = new Map(POLYMARKET_CATEGORIES.map(category => [category.tag, category]));

export function getPolymarketCategory(tag: string) {
  return CATEGORY_LOOKUP.get(tag);
}

export function getPolymarketCategoryName(tag: string) {
  return getPolymarketCategory(tag)?.name ?? tag;
}
