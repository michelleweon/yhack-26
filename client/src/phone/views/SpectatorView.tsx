import { motion } from 'framer-motion';
import { PhoneLayout } from '@/shared/components/PhoneLayout';
import { CharacterAvatar } from '@/shared/components/CharacterAvatar';
import type { PlayerState } from '@/types/player';

interface SpectatorViewProps {
  player: PlayerState;
}

export function SpectatorView({ player }: SpectatorViewProps) {
  return (
    <PhoneLayout contentClassName="justify-center">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="phone-card-strong flex w-full flex-col items-center gap-4 rounded-[1.8rem] px-6 py-7"
        >
          <p className="phone-status-chip">
            {player.isEliminated ? 'Eliminated' : 'Spectating'}
          </p>
          <CharacterAvatar
            characterIndex={player.characterIndex}
            size={84}
            isEliminated={player.isEliminated}
          />
          <h2 className="font-title text-4xl text-gray-100">{player.name}</h2>
          <p className="max-w-[17rem] font-ui text-sm text-white/62">
            {player.isEliminated
              ? "Watch the rest of the crew from here."
              : 'Keep an eye on the host screen for the next reveal.'}
          </p>
          <p className="font-ui text-sm text-white/52">
            Score: <span className="text-vault-gold">${player.score}</span>
          </p>
        </motion.div>
      </div>
    </PhoneLayout>
  );
}
