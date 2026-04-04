import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameActions, useGameState } from '@/context/GameContext';
import { JoinView } from './views/JoinView';
import { WaitingView } from './views/WaitingView';
import { ProfilePhoneView } from './views/ProfilePhoneView';
import { QuestionPhoneView } from './views/QuestionPhoneView';
import { ResultsPhoneView } from './views/ResultsPhoneView';
import { SpectatorView } from './views/SpectatorView';

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3 },
};

export function PhoneApp() {
  const { phase, players } = useGameState();
  const { leaveRoom } = useGameActions();
  const [playerId, setPlayerId] = useState<string | null>(() =>
    localStorage.getItem('heist_player_id')
  );

  useEffect(() => {
    if (playerId) localStorage.setItem('heist_player_id', playerId);
  }, [playerId]);

  const player = players.find(p => p.id === playerId);
  const isEliminated = player?.isEliminated ?? false;

  const handleJoin = (id: string) => setPlayerId(id);
  const handleLeave = () => {
    void leaveRoom();
    localStorage.removeItem('heist_player_id');
    setPlayerId(null);
  };

  if (!playerId || !player) {
    return (
      <>
        <JoinView onJoin={handleJoin} />
      </>
    );
  }

  const viewKey = isEliminated ? 'spectator' : phase;

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div key={viewKey} className="w-full h-full" {...PAGE_TRANSITION}>
          {isEliminated ? (
            <SpectatorView player={player} />
          ) : phase === 'room' || phase === 'home' || phase === 'intro' ? (
            <WaitingView player={player} onLeave={handleLeave} />
          ) : phase === 'question' ? (
            <QuestionPhoneView playerId={playerId} />
          ) : phase === 'profile' ? (
            <ProfilePhoneView playerId={playerId} />
          ) : phase === 'results' ? (
            <ResultsPhoneView playerId={playerId} />
          ) : (
            <SpectatorView player={player} />
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
