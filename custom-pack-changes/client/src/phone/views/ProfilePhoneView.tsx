import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PhoneLayout } from '@/shared/components/PhoneLayout';
import { AnswerButton } from '../components/AnswerButton';
import { useGameState, useGameActions } from '@/context/GameContext';

interface ProfilePhoneViewProps {
  playerId: string;
}

export function ProfilePhoneView({ playerId }: ProfilePhoneViewProps) {
  const { currentQuestion, profileAssignments, profileResponses, players } = useGameState();
  const { submitAnswer } = useGameActions();
  const [selected, setSelected] = useState<number | null>(null);

  const player = players.find(p => p.id === playerId);
  const assignedQuestions = profileAssignments[playerId] ?? (currentQuestion ? [currentQuestion] : []);
  const submittedCount = profileResponses[playerId]?.length ?? 0;
  const assignedQuestion = assignedQuestions[submittedCount] ?? null;
  const isComplete = submittedCount >= assignedQuestions.length && assignedQuestions.length > 0;
  const selectedText = selected !== null ? assignedQuestion?.choices[selected] : null;

  useEffect(() => {
    setSelected(null);
  }, [submittedCount]);

  if (!assignedQuestion && !isComplete) return null;

  const handleSelect = (index: number) => {
    if (selected !== null || isComplete) return;
    setSelected(index);
    submitAnswer(playerId, index);
  };

  return (
    <PhoneLayout minimalSettingsGear contentClassName="justify-center">
      {isComplete ? (
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-5 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="soft-glass-panel w-full rounded-[2rem] px-6 py-8"
          >
            <p className="font-ui text-xs uppercase tracking-[0.3em] text-violet-200/80">
              Survey Complete
            </p>
            <h2 className="mt-3 font-title text-4xl text-vault-gold">All Set</h2>
            <p className="mt-3 font-ui text-sm text-white/65">
              Waiting for the rest of your group...
            </p>
          </motion.div>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <div className="mb-5 text-center">
            <p className="font-ui text-xs uppercase tracking-[0.3em] text-violet-200/80">
              Quick Profile Check
            </p>
            <p className="mt-3 font-ui text-lg text-white/85">
              Choose what fits you best.
            </p>
            <p className="mt-2 font-ui text-xs uppercase tracking-[0.3em] text-violet-100/70">
              Preference {submittedCount + 1} of {Math.max(assignedQuestions.length, 1)}
            </p>
            <p className="mt-4 font-ui text-base text-white/75">
              {assignedQuestion.question}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {assignedQuestion.choices.map((choice, i) => (
              <AnswerButton
                key={i}
                index={i}
                label={choice}
                disabled={selected !== null}
                selected={selected === i}
                onSelect={() => handleSelect(i)}
              />
            ))}
          </div>
          {selectedText && (
            <p className="mt-4 text-center font-ui text-sm text-white/65">
              Saved: {selectedText}
            </p>
          )}
        </div>
      )}
    </PhoneLayout>
  );
}
