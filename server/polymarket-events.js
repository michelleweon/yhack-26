const GAMMA_ORIGIN = 'https://gamma-api.polymarket.com';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function readQueryValue(value) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }

  return typeof value === 'string' ? value : '';
}

function clampLimit(rawValue) {
  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function buildGammaEventsUrl(tagSlug, limit) {
  const url = new URL('/events', GAMMA_ORIGIN);
  url.searchParams.set('tag_slug', tagSlug);
  url.searchParams.set('closed', 'false');
  url.searchParams.set('active', 'true');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('order', 'volume24hr');
  url.searchParams.set('ascending', 'false');
  return url;
}

export async function handlePolymarketEventsRequest({ method, query }) {
  if (method !== 'GET') {
    return {
      status: 405,
      headers: { Allow: 'GET', 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({ error: 'Method not allowed' })),
    };
  }

  const tagSlug = readQueryValue(query?.tagSlug).trim();
  const limit = clampLimit(readQueryValue(query?.limit));

  if (!tagSlug) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({ error: 'Missing tagSlug query parameter' })),
    };
  }

  try {
    const response = await fetch(buildGammaEventsUrl(tagSlug, limit), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from(JSON.stringify({
          error: `Polymarket upstream error: ${response.status} ${errorText}`,
        })),
      };
    }

    const responseText = await response.text();

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      },
      body: Buffer.from(responseText),
    };
  } catch (error) {
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to fetch Polymarket events',
      })),
    };
  }
}
