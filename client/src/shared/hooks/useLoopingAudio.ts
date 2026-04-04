import { useLayoutEffect, useRef } from 'react';
import { playAudioWithRetry, stopAudioPlayback } from '@/shared/services/audioPlayback';

interface UseLoopingAudioOptions {
  enabled: boolean;
  src: string;
  volume?: number;
}

export function useLoopingAudio({
  enabled,
  src,
  volume = 0.5,
}: UseLoopingAudioOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopRetryRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    if (typeof Audio === 'undefined') {
      return;
    }

    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = volume;
    audioRef.current = audio;

    return () => {
      stopRetryRef.current?.();
      stopRetryRef.current = null;
      stopAudioPlayback(audio);
      audioRef.current = null;
    };
  }, [src, volume]);

  useLayoutEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.volume = volume;
  }, [src, volume]);

  useLayoutEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    stopRetryRef.current?.();
    stopRetryRef.current = null;

    if (!enabled) {
      stopAudioPlayback(audio);
      return;
    }

    stopRetryRef.current = playAudioWithRetry(audio);

    return () => {
      stopRetryRef.current?.();
      stopRetryRef.current = null;
      stopAudioPlayback(audio);
    };
  }, [enabled, src]);
}
