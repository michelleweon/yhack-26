import { motion } from 'framer-motion';
import { PhoneLayout } from '@/shared/components/PhoneLayout';
import { CharacterAvatar } from '@/shared/components/CharacterAvatar';
import type { PlayerState } from '@/types/player';

interface WaitingViewProps {
  player: PlayerState;
  onLeave: () => void;
  statusLabel?: string;
  message?: string;
}

export function WaitingView({
  player,
  onLeave,
  statusLabel = 'Ready',
  message = 'Waiting for the host to start the next screen.',
}: WaitingViewProps) {
  return (
    <PhoneLayout contentClassName="justify-center">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="phone-card-strong flex flex-col items-center gap-4 rounded-[1.8rem] px-6 py-7 text-center"
        >
          <p className="phone-status-chip">
            {statusLabel}
          </p>
          <CharacterAvatar characterIndex={player.characterIndex} size={84} />
          <h2 className="font-title text-4xl text-white">{player.name}</h2>
          <p className="max-w-[16rem] font-ui text-sm text-white/60">
            {message}
          </p>
          <p className="font-ui text-sm uppercase tracking-[0.16em] text-white/72">
            Stay on this page
          </p>
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="h-2 w-2 rounded-full bg-vault-gold"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.3 }}
              />
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="w-full"
        >
          <button
            onClick={onLeave}
            className="minimal-button-secondary w-full py-3 text-sm tracking-[0.24em] text-white/80"
          >
            Leave Room
          </button>
        </motion.div>
      </div>
    </PhoneLayout>
  );
}
