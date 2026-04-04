import { handleQuestionAudioRequest } from '../server/elevenlabs-question-audio.js';

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
  const response = await handleQuestionAudioRequest({
    method: req.method ?? 'GET',
    body,
  });

  Object.entries(response.headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.statusCode = response.status;
  res.end(response.body);
}
