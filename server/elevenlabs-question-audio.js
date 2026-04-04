const DEFAULT_VOICE_ID = 'UFO0Yv86wqRxAt1DmXUu';
const DEFAULT_MODEL_ID = 'eleven_flash_v2_5';
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

const audioCache = new Map();

function getEnvValue(explicitValue, key) {
  if (typeof explicitValue === 'string' && explicitValue.trim()) {
    return explicitValue.trim();
  }

  const processValue = process.env[key];
  return typeof processValue === 'string' && processValue.trim()
    ? processValue.trim()
    : '';
}

function buildCacheKey(voiceId, text) {
  return `${voiceId}::${text}`;
}

async function synthesizeQuestionAudio({ apiKey, voiceId, text }) {
  const response = await fetch(
    `${ELEVENLABS_API_URL}/${voiceId}?enable_logging=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: DEFAULT_MODEL_ID,
        output_format: 'mp3_44100_128',
        voice_settings: {
          speed: 1,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs request failed: ${response.status} ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    contentType: response.headers.get('content-type') ?? 'audio/mpeg',
    buffer: Buffer.from(arrayBuffer),
  };
}

export async function createQuestionAudioResponse({
  apiKey: explicitApiKey,
  voiceId: explicitVoiceId,
  text,
}) {
  const apiKey = getEnvValue(explicitApiKey, 'ELEVENLABS_API_KEY');
  const voiceId = getEnvValue(explicitVoiceId, 'ELEVENLABS_VOICE_ID') || DEFAULT_VOICE_ID;
  const normalizedText = typeof text === 'string' ? text.trim() : '';

  if (!apiKey) {
    throw new Error('Missing ELEVENLABS_API_KEY');
  }

  if (!normalizedText) {
    throw new Error('Question text is required');
  }

  const cacheKey = buildCacheKey(voiceId, normalizedText);
  const cached = audioCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const nextAudio = await synthesizeQuestionAudio({
    apiKey,
    voiceId,
    text: normalizedText,
  });

  audioCache.set(cacheKey, nextAudio);

  return nextAudio;
}

export async function handleQuestionAudioRequest({
  method,
  body,
  apiKey,
  voiceId,
}) {
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
    const audio = await createQuestionAudioResponse({
      apiKey,
      voiceId,
      text: payload?.text,
    });

    return {
      status: 200,
      headers: {
        'Content-Type': audio.contentType,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
      body: audio.buffer,
    };
  } catch (error) {
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to generate question narration',
      })),
    };
  }
}
