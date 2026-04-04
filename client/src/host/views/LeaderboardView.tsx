import { motion } from 'framer-motion';
import { HostLayout } from '@/shared/components/HostLayout';
import { CharacterPortraitCard } from '@/shared/components/CharacterPortraitCard';
import { ScoreBoard } from '../components/ScoreBoard';
import { useGameActions, useGameState } from '@/context/GameContext';
import v4RoofBg from '@/assets/optimized/v4roof.webp';

export function LeaderboardView() {
  const { players, questionIndex } = useGameState();
  const { advancePhase } = useGameActions();
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const leader = sortedPlayers[0] ?? null;

  return (
    <HostLayout backgroundImage={v4RoofBg} minimalSettingsGear>
      <div className="flex min-h-0 flex-1 flex-row">
        <section className="flex h-full w-[42%] shrink-0 items-center justify-center px-8 py-10 md:px-12">
          <div className="flex max-w-xl flex-col items-center gap-6 text-center">
            <motion.p
              initial={{ y: -18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="question-numbering font-tradeWinds text-2xl md:text-3xl"
            >
              Round {questionIndex + 1}
            </motion.p>

            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.35 }}
              className="w-full rounded-[2rem] border border-white/10 bg-black/20 px-8 py-10 shadow-[0_22px_80px_rgba(0,0,0,0.35)]"
            >
              <p className="font-ui text-xs font-semibold uppercase tracking-[0.35em] text-vault-gold">
                Current Leader
              </p>

              {leader ? (
                <>
                  <motion.div
                    animate={{ y: [0, -4, 0], rotate: [0, -3, 3, 0] }}
                    transition={{ delay: 0.45, duration: 0.7 }}
                    className="my-6 flex justify-center"
                  >
                    <CharacterPortraitCard
                      characterIndex={leader.characterIndex}
                      name={leader.name}
                      size="xl"
                      isEliminated={leader.isEliminated}
                    />
                  </motion.div>

                  <p className="mt-4 font-ui text-lg leading-relaxed text-gray-300">
                    Sitting on top of the crew with the strongest score after the last question.
                  </p>
                  <div className="mx-auto mt-6 h-px w-24 bg-white/60" />
                  <p className="mt-4 font-ui text-sm uppercase tracking-[0.3em] text-gray-300">
                    Total ${leader.score}
                  </p>
                </>
              ) : (
                <div className="py-12">
                  <h1 className="font-title text-5xl text-vault-gold md:text-6xl">
                    No Scores Yet
                  </h1>
                  <p className="mt-4 font-ui text-lg text-gray-300">
                    The board will light up once the crew starts scoring.
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </section>

        <section className="flex h-full w-[58%] shrink-0 items-center px-6 pb-10 pt-16 md:px-10">
          <div className="grid w-full grid-cols-[minmax(0,1fr)_18rem] gap-6">
            <motion.div
              initial={{ x: -28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="rounded-[2rem] border border-white/10 bg-black/15 px-6 py-7"
            >
              <div className="mb-5">
                <p className="font-ui text-xs font-semibold uppercase tracking-[0.3em] text-vault-gold">
                  Standings
                </p>
                <h2 className="mt-2 font-title text-3xl text-white">
                  Leaderboard
                </h2>
                <p className="mt-1 font-ui text-sm text-gray-400">
                  Every question reshuffles the board. Watch the money move.
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
              className="flex h-full flex-col justify-center rounded-[2rem] border border-white/10 bg-black/15 px-6 py-7 text-center"
            >
              <div className="mb-6">
                <p className="font-ui text-xs font-semibold uppercase tracking-[0.3em] text-white/75">
                  Read
                </p>
                <h2 className="mt-2 font-title text-3xl text-white">
                  The Room
                </h2>
                <p className="mt-1 font-ui text-sm text-gray-400">
                  Use this beat to see who is surging, who is slipping, and who needs the next question most.
                </p>
              </div>

              <div className="space-y-4 font-ui text-sm text-gray-300">
                <p>Top score holds the pace for the next round.</p>
                <p>Big jumps here usually decide the endgame later.</p>
                <p>One good question can still flip the whole board.</p>
              </div>

              <button
                onClick={advancePhase}
                className="vault-button mt-8 w-full px-6 py-4 text-xl"
              >
                Next Round
              </button>
            </motion.div>
          </div>
        </section>
      </div>
    </HostLayout>
  );
}
