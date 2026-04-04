const narrationCache = new Map<string, Promise<string>>();

let activeNarrationAudio: HTMLAudioElement | null = null;
let activeNarrationToken = 0;

function getNarrationCacheKey(questionId: string, text: string) {
  return `${questionId}::${text.trim()}`;
}

function isPlaybackAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function stopActiveNarrationAudio() {
  if (!activeNarrationAudio) {
    return;
  }

  activeNarrationAudio.pause();
  activeNarrationAudio.currentTime = 0;
  activeNarrationAudio.src = '';
  activeNarrationAudio.load();
  activeNarrationAudio = null;
}

export function stopNarration() {
  activeNarrationToken += 1;
  stopActiveNarrationAudio();
}

export function getNarrationAudioUrl(audioId: string, text: string) {
  const cacheKey = getNarrationCacheKey(audioId, text);
  const cached = narrationCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const request = fetch('/api/elevenlabs-question-audio', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  }).then(async response => {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Unable to load question narration');
    }

    const audioBlob = await response.blob();
    return URL.createObjectURL(audioBlob);
  }).catch(error => {
    narrationCache.delete(cacheKey);
    throw error;
  });

  narrationCache.set(cacheKey, request);

  return request;
}

export async function playNarration(audioId: string, text: string) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    stopNarration();
    return;
  }

  const playbackToken = activeNarrationToken + 1;
  activeNarrationToken = playbackToken;
  stopActiveNarrationAudio();

  try {
    const audioUrl = await getNarrationAudioUrl(audioId, normalizedText);

    if (playbackToken !== activeNarrationToken) {
      return;
    }

    const narrationAudio = new Audio(audioUrl);
    narrationAudio.preload = 'auto';
    narrationAudio.volume = 0.9;
    narrationAudio.setAttribute('playsinline', 'true');
    narrationAudio.addEventListener('ended', () => {
      if (activeNarrationAudio === narrationAudio) {
        activeNarrationAudio = null;
      }
    }, { once: true });
    activeNarrationAudio = narrationAudio;

    await narrationAudio.play();
  } catch (error) {
    if (!isPlaybackAbortError(error)) {
      console.warn('Narration unavailable', error);
    }
  }
}

export const stopQuestionNarration = stopNarration;
export const getQuestionNarrationAudioUrl = getNarrationAudioUrl;
export const playQuestionNarration = playNarration;
