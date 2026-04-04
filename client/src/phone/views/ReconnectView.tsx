import { motion } from 'framer-motion';
import { PhoneLayout } from '@/shared/components/PhoneLayout';

interface ReconnectViewProps {
  playerName: string;
  roomCode: string;
  onLeave: () => void;
}

export function ReconnectView({ playerName, roomCode, onLeave }: ReconnectViewProps) {
  return (
    <PhoneLayout contentClassName="justify-center">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4">
        <motion.div
          initial={{ scale: 0.84, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="phone-card-strong flex flex-col items-center gap-4 rounded-[1.8rem] px-6 py-7 text-center"
        >
          <p className="phone-status-chip">
            Reconnecting
          </p>
          <h2 className="font-title text-4xl text-white">{playerName}</h2>
          <p className="font-ui text-sm uppercase tracking-[0.16em] text-white/72">
            Room {roomCode}
          </p>
          <p className="max-w-[16rem] font-ui text-sm text-white/60">
            Rejoining the live room and waiting for the latest host state.
          </p>
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map(index => (
              <motion.div
                key={index}
                className="h-2 w-2 rounded-full bg-vault-gold"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: index * 0.3 }}
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
            Cancel Reconnect
          </button>
        </motion.div>
      </div>
    </PhoneLayout>
  );
}
