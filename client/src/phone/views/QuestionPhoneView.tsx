import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PhoneLayout } from '@/shared/components/PhoneLayout';
import { AnswerButton } from '../components/AnswerButton';
import { useGameState, useGameActions } from '@/context/GameContext';
import { getAnswerMeta } from '@/constants/gameConfig';

interface QuestionPhoneViewProps {
  playerId: string;
}

export function QuestionPhoneView({ playerId }: QuestionPhoneViewProps) {
  const { currentQuestion, players } = useGameState();
  const { submitAnswer } = useGameActions();
  const [selected, setSelected] = useState<number | null>(null);

  const player = players.find(p => p.id === playerId);
  const submittedAnswer = player?.currentAnswer ?? null;
  const committedAnswer = selected ?? submittedAnswer;
  const selectedAnswerMeta = committedAnswer !== null ? getAnswerMeta(committedAnswer) : null;
  const locked = selected !== null || submittedAnswer !== null;

  useEffect(() => {
    setSelected(submittedAnswer);
  }, [currentQuestion?.id, submittedAnswer]);

  if (!currentQuestion) return null;

  const handleSelect = (index: number) => {
    if (locked) return;
    setSelected(index);
    submitAnswer(playerId, index);
  };

  return (
    <PhoneLayout contentClassName="justify-center">
      {locked ? (
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="phone-card-strong w-full rounded-[1.8rem] px-6 py-7"
          >
            <p className="phone-status-chip">
              Answer Saved
            </p>
            {selectedAnswerMeta && (
              <div
                className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: selectedAnswerMeta.bg }}
              >
                <span className="font-title text-4xl text-white">
                  {selectedAnswerMeta.label}
                </span>
              </div>
            )}
            {committedAnswer !== null && (
              <p className="mt-4 font-ui text-lg text-white/86">
                {currentQuestion.choices[committedAnswer]}
              </p>
            )}
            <p className="mt-3 font-ui text-sm text-white/60">
              Waiting for the round to finish.
            </p>
          </motion.div>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5">
          <div className="text-center">
            <p className="phone-status-chip">
              Question Live
            </p>
            <p className="mt-4 font-ui text-sm text-white/62">
              Choose your answer on this screen.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {currentQuestion.choices.map((choice, i) => (
              <AnswerButton
                key={i}
                index={i}
                label={choice}
                onSelect={() => handleSelect(i)}
              />
            ))}
          </div>
        </div>
      )}
    </PhoneLayout>
  );
}
