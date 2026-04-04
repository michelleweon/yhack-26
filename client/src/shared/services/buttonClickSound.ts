import buttonClickSoundSrc from '@/assets/audio/buttonclick.mp3';

const audioPool: HTMLAudioElement[] = [];

function getAudioInstance() {
  let audio = audioPool.find(candidate => candidate.paused || candidate.ended);

  if (!audio) {
    audio = new Audio(buttonClickSoundSrc);
    audio.preload = 'auto';
    audio.volume = 0.55;
    audioPool.push(audio);
  }

  audio.currentTime = 0;
  return audio;
}

export function playButtonClickSound() {
  if (typeof Audio === 'undefined') {
    return;
  }

  const audio = getAudioInstance();

  void audio.play().catch(() => {
    // Ignore autoplay restrictions; the next user interaction can retry.
  });
}
