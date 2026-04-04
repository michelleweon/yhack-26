import { useEffect, useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { HostLayout } from '@/shared/components/HostLayout';
import { useGameActions, useGameState } from '@/context/GameContext';
import { useAudioSettings } from '@/shared/context/AudioSettingsContext';
import { playAudioWithRetry, stopAudioPlayback } from '@/shared/services/audioPlayback';
import introTutorialAudioSrc from '@/assets/audio/intro-tutorial.mp3';

const INTRO_SEQUENCE_DURATION_SECONDS = 25.715;
const INTRO_TEXT_FADE_SECONDS = 0.45;
const STARTING_MESSAGE_DELAY_SECONDS = 24.1;

const LINES = [
  { text: 'The crew is assembled.', delay: 0 },
  { text: 'The vault awaits.', delay: 2.18 },
  { text: 'Answer questions to advance through the heist.', delay: 4.27 },
  { text: 'Every correct answer grows your haul.', delay: 8.91 },
  { text: 'Wrong answers leave cash on the table.', delay: 12.18 },
  { text: 'Finish with the biggest score.', delay: 15.52 },
  { text: 'Win it all.', delay: 17.51 },
];

export function IntroView() {
  const { preparationMessage } = useGameState();
  const { advancePhase } = useGameActions();
  const { soundEffectsEnabled } = useAudioSettings();
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const stopRetryRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => advancePhase(),
      Math.ceil(INTRO_SEQUENCE_DURATION_SECONDS * 1000)
    );

    return () => clearTimeout(timeout);
  }, [advancePhase]);

  useLayoutEffect(() => {
    if (typeof Audio === 'undefined') {
      return;
    }

    if (!introAudioRef.current) {
      const introAudio = new Audio(introTutorialAudioSrc);
      introAudio.preload = 'auto';
      introAudio.volume = 0.9;
      introAudioRef.current = introAudio;
    }

    const introAudio = introAudioRef.current;
    stopRetryRef.current?.();
    stopRetryRef.current = null;

    if (!soundEffectsEnabled) {
      stopAudioPlayback(introAudio);
      return;
    }

    stopRetryRef.current = playAudioWithRetry(introAudio);

    return () => {
      stopRetryRef.current?.();
      stopRetryRef.current = null;
      stopAudioPlayback(introAudio);
    };
  }, [soundEffectsEnabled]);

  return (
    <HostLayout>
      <div className="relative flex-1 flex flex-col items-center justify-center gap-6 px-16">
        <motion.h1
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, type: 'spring' }}
          className="font-title text-7xl text-vault-gold mb-8"
        >
          HEIST!
        </motion.h1>

        {LINES.map(({ text, delay }, i) => (
          <motion.p
            key={i}
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay, duration: INTRO_TEXT_FADE_SECONDS }}
            className="font-ui text-2xl text-gray-200 text-center"
          >
            {text}
          </motion.p>
        ))}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: STARTING_MESSAGE_DELAY_SECONDS }}
          className="mt-8 flex flex-col items-center gap-4"
        >
          <p className="font-handwritten text-xl text-vault-gold animate-pulse">
            Starting in a moment...
          </p>
          {preparationMessage && (
            <p className="max-w-2xl rounded-[1.4rem] border border-white/10 bg-black/20 px-5 py-3 text-center font-ui text-sm text-white/72">
              {preparationMessage}
            </p>
          )}
        </motion.div>
      </div>
    </HostLayout>
  );
}
