import { useState } from 'react';
import { motion } from 'framer-motion';
import { PhoneLayout } from '@/shared/components/PhoneLayout';
import { useGameActions } from '@/context/GameContext';
import { GAME_CONFIG } from '@/constants/gameConfig';
import { getBrowserStorage } from '@/shared/services/browserStorage';

const PLAYER_NAME_STORAGE_KEY = 'heist_player_name';
const ROOM_CODE_STORAGE_KEY = 'heist_room_code';

interface JoinViewProps {
  onJoin: (playerId: string) => void;
}

export function JoinView({ onJoin }: JoinViewProps) {
  const storage = getBrowserStorage();
  const storedPlayerName = storage.getItem(PLAYER_NAME_STORAGE_KEY)?.slice(0, 16) ?? '';
  const [roomCode, setRoomCode] = useState(() =>
    storage.getItem(ROOM_CODE_STORAGE_KEY)?.toUpperCase().slice(0, GAME_CONFIG.roomCodeLength) ?? ''
  );
  const [playerName, setPlayerName] = useState(() => storedPlayerName);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const { joinRoom } = useGameActions();
  const effectivePlayerName = playerName.trim() || storedPlayerName;

  const canJoin =
    roomCode.length === GAME_CONFIG.roomCodeLength
    && effectivePlayerName.length > 0
    && !isJoining;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canJoin) return;
    setErrorMessage(null);
    setIsJoining(true);

    storage.setItem(ROOM_CODE_STORAGE_KEY, roomCode.toUpperCase());
    storage.setItem(PLAYER_NAME_STORAGE_KEY, effectivePlayerName);

    const id = await joinRoom(roomCode.toUpperCase(), effectivePlayerName);
    setIsJoining(false);

    if (!id) {
      setErrorMessage('That room code is not active right now.');
      return;
    }

    onJoin(id);
  };

  return (
    <PhoneLayout contentClassName="justify-center">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center"
        >
          <p className="font-ui text-[11px] uppercase tracking-[0.32em] text-white/58">
            Phone Controller
          </p>
          <h1 className="mt-3 font-title text-5xl leading-[0.92] text-vault-gold drop-shadow-lg">
            R.A.C.C.O.O.N.
          </h1>
          <p className="mt-4 font-ui text-sm uppercase tracking-[0.18em] text-white/72 [text-wrap:balance]">
            Join with the room code from the host screen.
          </p>
          {storedPlayerName && (
            <p className="mt-2 font-ui text-sm text-white/52">
              Re-enter the same code to reclaim your spot as {storedPlayerName}.
            </p>
          )}
        </motion.div>

        <motion.form
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          onSubmit={handleSubmit}
          className="phone-card-strong flex w-full flex-col gap-4 rounded-[1.8rem] p-5"
        >
          <div className="space-y-2">
            <label className="block font-ui text-xs uppercase tracking-[0.24em] text-white/55">
              Room Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={e => {
                const nextRoomCode = e.target.value.toUpperCase().slice(0, GAME_CONFIG.roomCodeLength);
                setRoomCode(nextRoomCode);
                storage.setItem(ROOM_CODE_STORAGE_KEY, nextRoomCode);
              }}
              placeholder="ABCD"
              maxLength={GAME_CONFIG.roomCodeLength}
              className="minimal-input text-center font-title text-4xl tracking-[0.38em] text-vault-gold placeholder:text-white/20"
              autoFocus
              inputMode="text"
              autoComplete="off"
              disabled={isJoining}
            />
          </div>

          <div className="space-y-2">
            <label className="block font-ui text-xs uppercase tracking-[0.24em] text-white/55">
              Your Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={e => {
                const nextPlayerName = e.target.value.slice(0, 16);
                setPlayerName(nextPlayerName);
                storage.setItem(PLAYER_NAME_STORAGE_KEY, nextPlayerName);
              }}
              placeholder="Enter name..."
              maxLength={16}
              className="minimal-input text-center font-ui text-xl"
              autoComplete="off"
              disabled={isJoining}
            />
          </div>

          <button
            type="submit"
            disabled={!canJoin}
            data-button-click-sound="accent"
            className="minimal-button-primary mt-2 w-full py-4 text-lg text-white"
          >
            {isJoining ? 'Searching...' : 'Join Room'}
          </button>

          {errorMessage && (
            <p className="rounded-[1.2rem] border border-vault-red/35 bg-vault-red/10 px-4 py-3 text-center font-ui text-sm text-white/85">
              {errorMessage}
            </p>
          )}
        </motion.form>
      </div>
    </PhoneLayout>
  );
}
