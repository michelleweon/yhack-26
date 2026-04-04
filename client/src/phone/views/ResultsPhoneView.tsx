import { motion } from 'framer-motion';
import { PhoneLayout } from '@/shared/components/PhoneLayout';
import { useGameState } from '@/context/GameContext';
import { getAnswerMeta } from '@/constants/gameConfig';

interface ResultsPhoneViewProps {
  playerId: string;
}

export function ResultsPhoneView({ playerId }: ResultsPhoneViewProps) {
  const { results, currentQuestion, players } = useGameState();
  const player = players.find(p => p.id === playerId);

  if (!results || !currentQuestion) return null;

  const playerAnswer = results.playerAnswers[playerId];
  const isCorrect = playerAnswer === results.correctIndex;
  const correctChoice = currentQuestion.choices[results.correctIndex];
  const correctAnswerMeta = getAnswerMeta(results.correctIndex);

  return (
    <PhoneLayout contentClassName="justify-center">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
          className="phone-card-strong w-full rounded-[1.8rem] px-6 py-7"
        >
          <p className="phone-status-chip">
            {isCorrect ? 'Correct' : 'Wrong'}
          </p>
          <h2 className={`mt-4 font-title text-4xl ${isCorrect ? 'text-vault-green' : 'text-vault-red'}`}>
            {isCorrect ? '+$100' : 'No Payout'}
          </h2>

          <div className="phone-card mt-5 rounded-[1.4rem] px-4 py-4 text-left">
            <p className="font-ui text-[11px] uppercase tracking-[0.24em] text-white/50">
              Correct Answer
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-title text-2xl text-white"
                style={{ backgroundColor: correctAnswerMeta.bg }}
              >
                {correctAnswerMeta.label}
              </span>
              <p className="font-ui text-lg font-semibold text-white/90">
                {correctChoice}
              </p>
            </div>
          </div>

          <p className="mt-5 font-ui text-sm text-white/55">
            Score: <span className="text-vault-gold">${player?.score ?? 0}</span>
          </p>
        </motion.div>
      </div>
    </PhoneLayout>
  );
}
