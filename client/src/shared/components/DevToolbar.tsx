import { useGame } from '@/context/GameContext';
import type { GamePhase } from '@/types/game';

const PHASES: { phase: GamePhase; label: string }[] = [
  { phase: 'home', label: 'Home' },
  { phase: 'room', label: 'Room' },
  { phase: 'intro', label: 'Intro' },
  { phase: 'profile', label: 'Profile' },
  { phase: 'question', label: 'Question' },
  { phase: 'results', label: 'Results' },
  { phase: 'leaderboard', label: 'Leaderboard' },
  { phase: 'win', label: 'Win' },
  { phase: 'gameover', label: 'Game Over' },
];

export function DevToolbar() {
  const { state, actions } = useGame();

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-black/90 border-t border-yellow-500/30 px-4 py-2 flex items-center gap-2 overflow-x-auto">
      <span className="text-yellow-400 font-mono text-xs shrink-0">DEV</span>
      <div className="h-4 w-px bg-yellow-500/30" />
      {PHASES.map(({ phase, label }) => (
        <button
          key={phase}
          onClick={() => actions.setPhase(phase)}
          className={`px-2 py-1 rounded text-xs font-mono whitespace-nowrap transition-colors ${
            state.phase === phase
              ? 'bg-yellow-500 text-black'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
      <div className="h-4 w-px bg-yellow-500/30" />
      <span className="text-gray-500 font-mono text-xs shrink-0">
        {state.roomCode || '----'} | {state.players.length}p
      </span>
    </div>
  );
}
