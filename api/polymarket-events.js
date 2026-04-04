import { handlePolymarketEventsRequest } from '../server/polymarket-events.js';

export default async function handler(req, res) {
  const response = await handlePolymarketEventsRequest({
    method: req.method ?? 'GET',
    query: req.query ?? {},
  });

  Object.entries(response.headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.statusCode = response.status;
  res.end(response.body);
}
