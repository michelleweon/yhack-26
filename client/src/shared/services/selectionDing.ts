let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
    return null;
  }

  if (!audioContext) {
    audioContext = new window.AudioContext();
  }

  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => {
      // Ignore resume failures; the next interaction can try again.
    });
  }

  return audioContext;
}

export function playSelectionDing() {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startTime = context.currentTime;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(1046.5, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(1318.5, startTime + 0.08);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.09, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + 0.24);
}
