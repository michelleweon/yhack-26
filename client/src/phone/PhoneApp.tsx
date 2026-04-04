import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getStoredPlayerSession } from '@/app/sessionRouting';
import { useGameActions, useGameState } from '@/context/GameContext';
import { JoinView } from './views/JoinView';
import { ReconnectView } from './views/ReconnectView';
import { WaitingView } from './views/WaitingView';
import { ProfilePhoneView } from './views/ProfilePhoneView';
import { QuestionPhoneView } from './views/QuestionPhoneView';
import { ResultsPhoneView } from './views/ResultsPhoneView';
import { SpectatorView } from './views/SpectatorView';
import type { GamePhase } from '@/types/game';
import { getBrowserStorage } from '@/shared/services/browserStorage';

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3 },
};

function getHostPhaseSignal(phase: GamePhase) {
  switch (phase) {
    case 'home':
      return 'Home Base';
    case 'room':
      return 'Lobby Open';
    case 'intro':
      return 'Intro Rolling';
    case 'profile':
      return 'Survey Live';
    case 'question':
      return 'Question Live';
    case 'results':
      return 'Results Reveal';
    case 'leaderboard':
      return 'Scores Updating';
    case 'win':
      return 'Victory Screen';
    case 'gameover':
      return 'Game Over';
    default:
      return 'Syncing';
  }
}

export function PhoneApp() {
  const { phase, players } = useGameState();
  const { leaveRoom } = useGameActions();
  const storage = getBrowserStorage();
  const [playerId, setPlayerId] = useState<string | null>(() =>
    storage.getItem('heist_player_id')
  );
  const storedPlayerSession = getStoredPlayerSession();

  useEffect(() => {
    if (playerId) storage.setItem('heist_player_id', playerId);
  }, [playerId, storage]);

  const player = players.find(p => p.id === playerId);
  const isEliminated = player?.isEliminated ?? false;

  const handleJoin = (id: string) => setPlayerId(id);
  const handleLeave = () => {
    void leaveRoom();
    storage.removeItem('heist_player_id');
    setPlayerId(null);
  };

  if (!playerId) {
    return (
      <>
        <JoinView onJoin={handleJoin} />
      </>
    );
  }

  if (!player) {
    if (storedPlayerSession && storedPlayerSession.playerId === playerId) {
      return (
        <ReconnectView
          playerName={storedPlayerSession.playerName}
          roomCode={storedPlayerSession.roomCode}
          onLeave={handleLeave}
        />
      );
    }

    return (
      <>
        <JoinView onJoin={handleJoin} />
      </>
    );
  }

  const viewKey = isEliminated ? 'spectator' : phase;
  const hostPhaseSignal = getHostPhaseSignal(phase);

  return (
    <div className="relative h-full w-full">
      <AnimatePresence mode="wait">
        <motion.div key={viewKey} className="w-full h-full" {...PAGE_TRANSITION}>
          {isEliminated ? (
            <SpectatorView player={player} />
          ) : phase === 'room' || phase === 'home' || phase === 'intro' ? (
            <WaitingView player={player} onLeave={handleLeave} />
          ) : phase === 'profile' ? (
            <ProfilePhoneView playerId={playerId} />
          ) : phase === 'question' ? (
            <QuestionPhoneView playerId={playerId} />
          ) : phase === 'results' ? (
            <ResultsPhoneView playerId={playerId} />
          ) : phase === 'leaderboard' ? (
            <WaitingView
              player={player}
              onLeave={handleLeave}
              statusLabel="Scores Updating"
              message="The host is showing the standings. Your phone will sync into the next round automatically."
            />
          ) : phase === 'win' ? (
            <WaitingView
              player={player}
              onLeave={handleLeave}
              statusLabel="Heist Complete"
              message="The final winner reveal is on the host screen."
            />
          ) : phase === 'gameover' ? (
            <WaitingView
              player={player}
              onLeave={handleLeave}
              statusLabel="Vault Sealed"
              message="The game is over on the host screen."
            />
          ) : (
            <SpectatorView player={player} />
          )}
        </motion.div>
      </AnimatePresence>

      <div
        className="pointer-events-none fixed left-1/2 z-[60] -translate-x-1/2"
        style={{ top: 'max(0.9rem, calc(env(safe-area-inset-top) + 0.45rem))' }}
      >
        <AnimatePresence mode="wait">
          <motion.p
            key={`host-phase-${phase}`}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="phone-status-chip min-w-[11rem] bg-black/45 px-4 py-2 text-center shadow-[0_10px_26px_rgba(0,0,0,0.22)]"
          >
            Host: {hostPhaseSignal}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
