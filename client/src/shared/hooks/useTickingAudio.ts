import { useEffect, useRef } from 'react';
import { useAudioSettings } from '@/shared/context/AudioSettingsContext';
import { playAudioWithRetry, stopAudioPlayback } from '@/shared/services/audioPlayback';
import tickingAudioSrc from '@/assets/audio/clock-tick-tock.mp3';

interface UseTickingAudioOptions {
  enabled: boolean;
  timeRemaining: number;
  totalTime: number;
  deadlineAt?: string | null;
}

const UPDATE_INTERVAL_MS = 120;

export function useTickingAudio({
  enabled,
  timeRemaining,
  totalTime,
  deadlineAt = null,
}: UseTickingAudioOptions) {
  const { soundEffectsEnabled } = useAudioSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopRetryRef = useRef<(() => void) | null>(null);
  const stateRef = useRef({
    enabled,
    soundEffectsEnabled,
    timeRemaining,
    totalTime,
    deadlineAt,
  });

  useEffect(() => {
    stateRef.current = {
      enabled,
      soundEffectsEnabled,
      timeRemaining,
      totalTime,
      deadlineAt,
    };
  }, [deadlineAt, enabled, soundEffectsEnabled, timeRemaining, totalTime]);

  useEffect(() => {
    if (typeof Audio === 'undefined') {
      return;
    }

    const audio = new Audio(tickingAudioSrc);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.55;
    audioRef.current = audio;

    return () => {
      stopRetryRef.current?.();
      stopRetryRef.current = null;
      stopAudioPlayback(audio);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (!enabled || !soundEffectsEnabled || timeRemaining <= 0) {
      stopRetryRef.current?.();
      stopRetryRef.current = null;
      stopAudioPlayback(audio);
      return;
    }

    let isDisposed = false;

    const getLiveTimeRemaining = () => {
      const nextState = stateRef.current;

      if (!nextState.deadlineAt) {
        return nextState.timeRemaining;
      }

      const remainingMs = new Date(nextState.deadlineAt).getTime() - Date.now();
      return Math.max(0, remainingMs / 1000);
    };

    const syncPlayback = () => {
      if (isDisposed) {
        return;
      }

      const nextState = stateRef.current;

      if (!nextState.enabled || !nextState.soundEffectsEnabled) {
        stopRetryRef.current?.();
        stopRetryRef.current = null;
        stopAudioPlayback(audio);
        return;
      }

      const liveTimeRemaining = getLiveTimeRemaining();

      if (liveTimeRemaining <= 0) {
        stopRetryRef.current?.();
        stopRetryRef.current = null;
        stopAudioPlayback(audio);
        return;
      }

      audio.playbackRate = 1;

      if (audio.paused) {
        stopRetryRef.current?.();
        stopRetryRef.current = playAudioWithRetry(audio);
      }
    };

    syncPlayback();
    const intervalId = window.setInterval(syncPlayback, UPDATE_INTERVAL_MS);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
      stopRetryRef.current?.();
      stopRetryRef.current = null;
      stopAudioPlayback(audio);
    };
  }, [enabled, soundEffectsEnabled, timeRemaining]);
}
