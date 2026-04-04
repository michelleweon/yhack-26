import { motion } from 'framer-motion';
import { HostLayout } from '@/shared/components/HostLayout';
import { useGameActions, useGameState } from '@/context/GameContext';
import { useEffect } from 'react';

const LINES = [
  { text: 'The crew is assembled.', delay: 0.5 },
  { text: 'The vault awaits.', delay: 2.0 },
  { text: 'Answer questions to advance through the heist.', delay: 3.5 },
  { text: 'Every correct answer grows your haul.', delay: 5.0 },
  { text: 'Wrong answers leave cash on the table.', delay: 6.5 },
  { text: 'Finish with the biggest score. Win it all.', delay: 8.0 },
];

export function IntroView() {
  const { preparationMessage } = useGameState();
  const { advancePhase } = useGameActions();

  useEffect(() => {
    const timeout = setTimeout(() => advancePhase(), 11000);
    return () => clearTimeout(timeout);
  }, [advancePhase]);

  return (
    <HostLayout>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-16">
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
            transition={{ delay, duration: 0.6 }}
            className="font-ui text-2xl text-gray-200 text-center"
          >
            {text}
          </motion.p>
        ))}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 10 }}
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
