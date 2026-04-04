import { motion } from 'framer-motion';
import { HostLayout } from '@/shared/components/HostLayout';
import { CharacterPortraitCard } from '@/shared/components/CharacterPortraitCard';
import { ScoreBoard } from '../components/ScoreBoard';
import { useGameState, useGameActions } from '@/context/GameContext';
import v4RoofBg from '@/assets/optimized/v4roof.webp';

interface WinViewProps {
  isGameOver: boolean;
}

export function WinView({ isGameOver }: WinViewProps) {
  const { winnerId, players } = useGameState();
  const { playAgain } = useGameActions();

  const winner = players.find(p => p.id === winnerId);
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const title = isGameOver && !winner ? 'Vault Sealed' : `${winner?.name ?? 'Winner'} Wins`;
  const accentClass = isGameOver && !winner ? 'text-vault-red' : 'text-vault-gold';
  const eyebrow = isGameOver && !winner ? 'Heist Failed' : 'Heist Complete';
  const summary = isGameOver && !winner
    ? 'Nobody made it through the final stretch. The vault stays shut and the score sheet freezes where it fell.'
    : `${winner?.name ?? 'The winner'} cracked the vault and walks away with the biggest haul of the night.`;

  return (
    <HostLayout backgroundImage={v4RoofBg} minimalSettingsGear>
      <div className="flex min-h-0 flex-1 flex-row">
        <section className="flex h-full w-[44%] shrink-0 items-center justify-center px-8 py-10 md:px-12">
          <div className="flex max-w-xl flex-col items-center gap-6 text-center">
            <motion.p
              initial={{ y: -18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={`font-tradeWinds text-2xl md:text-3xl ${accentClass}`}
            >
              {eyebrow}
            </motion.p>

            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.35 }}
              className="w-full rounded-[2rem] border border-white/10 bg-black/20 px-8 py-10 shadow-[0_22px_80px_rgba(0,0,0,0.35)]"
            >
              {winner ? (
                <motion.div
                  animate={{ rotate: [0, -4, 4, -3, 0], y: [0, -4, 0] }}
                  transition={{ delay: 0.55, duration: 0.7 }}
                  className="mb-6 flex justify-center"
                >
                  <CharacterPortraitCard
                    characterIndex={winner.characterIndex}
                    name={winner.name}
                    size="xl"
                    isEliminated={winner.isEliminated}
                  />
                </motion.div>
              ) : (
                <div className="mb-6 flex justify-center">
                  <div className="flex h-32 w-32 items-center justify-center rounded-full border border-vault-red/40 bg-vault-red/10">
                    <span className="font-title text-6xl text-vault-red">X</span>
                  </div>
                </div>
              )}

              <h1 className={`font-title text-5xl md:text-6xl ${accentClass}`}>
                {title}
              </h1>
              <p className="mx-auto mt-4 max-w-md font-ui text-lg leading-relaxed text-gray-300">
                {summary}
              </p>
              <div className="mx-auto mt-6 h-px w-24 bg-white/60" />
              <p className="mt-4 font-ui text-sm uppercase tracking-[0.3em] text-gray-400">
                {winner ? `Final haul $${winner.score}` : 'No survivor bonus awarded'}
              </p>
            </motion.div>
          </div>
        </section>

        <section className="flex h-full w-[56%] shrink-0 items-center px-6 pb-10 pt-16 md:px-10">
          <div className="grid w-full grid-cols-[minmax(0,1fr)_18rem] gap-6">
            <motion.div
              initial={{ x: -28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.18 }}
              className="rounded-[2rem] border border-white/10 bg-black/15 px-6 py-7"
            >
              <div className="mb-5">
                <p className={`font-ui text-xs font-semibold uppercase tracking-[0.3em] ${accentClass}`}>
                  Final Standings
                </p>
                <h2 className="mt-2 font-title text-3xl text-white">
                  Leaderboard
                </h2>
                <p className="mt-1 font-ui text-sm text-gray-400">
                  The whole crew, ranked by the cash they managed to drag out.
                </p>
              </div>

              <div className="max-h-[28rem] overflow-y-auto pr-2">
                <ScoreBoard players={sortedPlayers} showRank />
              </div>
            </motion.div>

            <motion.div
              initial={{ x: 28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.28 }}
              className="rounded-[2rem] border border-white/10 bg-black/15 px-6 py-7"
            >
              <div className="mb-6">
                <p className="font-ui text-xs font-semibold uppercase tracking-[0.3em] text-white/75">
                  Next Move
                </p>
                <h2 className="mt-2 font-title text-3xl text-white">
                  Run It Back
                </h2>
                <p className="mt-1 font-ui text-sm text-gray-400">
                  Reset the room and send the crew back through another round.
                </p>
              </div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                onClick={playAgain}
                className="vault-button w-full px-8 py-4 text-2xl"
              >
                Play Again
              </motion.button>
            </motion.div>
          </div>
        </section>
      </div>
    </HostLayout>
  );
}
