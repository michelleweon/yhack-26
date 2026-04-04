import { handleSpecialQuipRequest } from '../server/gemini-special-quip.js';

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let rawBody = '';

    req.on('data', chunk => {
      rawBody += chunk;
    });

    req.on('end', () => {
      resolve(rawBody);
    });

    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const body = await readRequestBody(req);
  const response = await handleSpecialQuipRequest({
    method: req.method ?? 'GET',
    body,
  });

  Object.entries(response.headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.statusCode = response.status;
  res.end(response.body);
}
