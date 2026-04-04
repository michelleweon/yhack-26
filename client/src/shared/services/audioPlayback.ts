const RETRY_EVENTS: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];

function stopListening(listeners: Array<() => void>) {
  listeners.forEach(removeListener => removeListener());
}

export function stopAudioPlayback(audio: HTMLAudioElement) {
  audio.pause();
  audio.currentTime = 0;
}

export function playAudioWithRetry(audio: HTMLAudioElement) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  let isDisposed = false;
  let retryListeners: Array<() => void> = [];

  const clearRetryListeners = () => {
    stopListening(retryListeners);
    retryListeners = [];
  };

  const attemptPlay = () => {
    if (isDisposed) {
      return;
    }

    const playPromise = audio.play();

    if (!playPromise || typeof playPromise.catch !== 'function') {
      return;
    }

    void playPromise.catch(() => {
      if (isDisposed || retryListeners.length > 0) {
        return;
      }

      retryListeners = RETRY_EVENTS.map(eventName => {
        const retryPlayback = () => {
          clearRetryListeners();

          if (audio.paused) {
            attemptPlay();
          }
        };

        window.addEventListener(eventName, retryPlayback, { once: true });

        return () => {
          window.removeEventListener(eventName, retryPlayback);
        };
      });
    });
  };

  attemptPlay();

  return () => {
    isDisposed = true;
    clearRetryListeners();
  };
}
