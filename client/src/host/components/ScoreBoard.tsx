import { CharacterAvatar } from '@/shared/components/CharacterAvatar';
import type { PlayerState } from '@/types/player';

interface ScoreBoardProps {
  players: PlayerState[];
  compact?: boolean;
  showRank?: boolean;
}

export function ScoreBoard({ players, compact = false, showRank = false }: ScoreBoardProps) {
  return (
    <div className={`space-y-${compact ? '2' : '3'}`}>
      {players.map((player, i) => (
        <div
          key={player.id}
          className={`flex items-center gap-3 ${
            compact ? 'py-1' : 'p-2 rounded-lg bg-vault-dark/30'
          }`}
        >
          {showRank && (
            <span className={`font-title text-lg w-6 text-center ${
              i === 0 ? 'text-vault-gold' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-500'
            }`}>
              {i + 1}
            </span>
          )}
          <CharacterAvatar
            characterIndex={player.characterIndex}
            size={compact ? 28 : 36}
            isEliminated={player.isEliminated}
          />
          <span className={`font-ui ${compact ? 'text-sm' : 'text-base'} text-white flex-1 truncate`}>
            {player.name}
          </span>
          <span className={`font-title ${compact ? 'text-base' : 'text-lg'} text-vault-gold`}>
            ${player.score}
          </span>
        </div>
      ))}
    </div>
  );
}
