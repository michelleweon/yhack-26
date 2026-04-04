import { motion } from 'framer-motion';
import { CharacterPortraitCard } from '@/shared/components/CharacterPortraitCard';
import type { PlayerState } from '@/types/player';

interface PlayerReactionProps {
  player: PlayerState;
  isCorrect: boolean;
  scale?: number;
}

export function PlayerReaction({ player, isCorrect, scale = 1 }: PlayerReactionProps) {
  const size = scale >= 1.15 ? 'xl' : scale >= 1 ? 'lg' : 'md';

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="flex w-full min-w-0 flex-col items-center gap-3 text-center"
    >
      <motion.div
        animate={isCorrect
          ? { y: [0, -8, 0], rotate: [0, 5, -5, 0] }
          : { x: [0, -4, 4, -4, 4, 0] }
        }
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <CharacterPortraitCard
          characterIndex={player.characterIndex}
          name={player.name}
          size={size}
          isEliminated={player.isEliminated}
        />
      </motion.div>
    </motion.div>
  );
}
