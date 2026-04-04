import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PhoneLayout } from '@/shared/components/PhoneLayout';
import { useGameActions, useGameState } from '@/context/GameContext';
import { useLoopingAudio } from '@/shared/hooks/useLoopingAudio';
import { useAudioSettings } from '@/shared/context/AudioSettingsContext';
import levelMusicSrc from '@/assets/audio/level-music.mp3';
import type { Question } from '@/types/game';
import { AnswerButton } from '../components/AnswerButton';

interface ProfilePhoneViewProps {
  playerId: string;
}

export function ProfilePhoneView({ playerId }: ProfilePhoneViewProps) {
  const { profileAssignments, profileResponses, roundDeadlineAt } = useGameState();
  const { submitAnswer } = useGameActions();
  const { musicEnabled } = useAudioSettings();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draftAnswer, setDraftAnswer] = useState('');
  const [submittedText, setSubmittedText] = useState<string | null>(null);
  const [preloadedQuestions, setPreloadedQuestions] = useState<Question[]>([]);
  const [optimisticSubmittedCount, setOptimisticSubmittedCount] = useState(0);

  const assignedQuestions = profileAssignments[playerId] ?? [];
  const authoritativeSubmittedCount = profileResponses[playerId]?.length ?? 0;
  const questionSourceSignature = useMemo(() => (
    assignedQuestions.map(question => question.id).join('::')
  ), [assignedQuestions]);
  const preloadedQuestionCount = preloadedQuestions.length;
  const questionCount = Math.max(preloadedQuestionCount, assignedQuestions.length);
  const activeQuestion = preloadedQuestions[optimisticSubmittedCount] ?? assignedQuestions[optimisticSubmittedCount] ?? null;
  const isComplete = questionCount > 0 && optimisticSubmittedCount >= questionCount;
  const selectedText = selectedIndex !== null ? activeQuestion?.choices[selectedIndex] : null;
  const isFreeTextQuestion = activeQuestion?.profileResponseMode === 'free-text';
  const profileAnswerMaxLength = activeQuestion?.profileResponseMaxLength ?? 30;
  const canSubmitText = draftAnswer.trim().length > 0 && submittedText === null;
  const shouldPlayWaitingMusic = isComplete && Boolean(roundDeadlineAt);
  const shouldUseTwoColumnChoices = (activeQuestion?.choices.length ?? 0) > 4;

  useEffect(() => {
    if (assignedQuestions.length === 0) {
      return;
    }

    setPreloadedQuestions(previousQuestions => {
      const previousSignature = previousQuestions.map(question => question.id).join('::');
      return previousSignature === questionSourceSignature ? previousQuestions : assignedQuestions;
    });
  }, [assignedQuestions, questionSourceSignature]);

  useEffect(() => {
    setOptimisticSubmittedCount(previousCount => (
      authoritativeSubmittedCount > previousCount ? authoritativeSubmittedCount : previousCount
    ));
  }, [authoritativeSubmittedCount]);

  useLoopingAudio({
    enabled: musicEnabled && shouldPlayWaitingMusic,
    src: levelMusicSrc,
    volume: 0.35,
  });

  useEffect(() => {
    setSelectedIndex(null);
    setDraftAnswer('');
    setSubmittedText(null);
  }, [activeQuestion?.id, optimisticSubmittedCount]);

  if (!activeQuestion && !isComplete) {
    return (
      <PhoneLayout contentClassName="justify-center">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center text-center">
          <div className="phone-card-strong w-full rounded-[1.8rem] px-6 py-7">
            <p className="phone-status-chip">
              Preparing Survey
            </p>
            <p className="mt-4 font-ui text-sm text-white/62">
              Your friend-group questions are loading.
            </p>
          </div>
        </div>
      </PhoneLayout>
    );
  }

  const handleSelect = (answerIndex: number) => {
    if (!activeQuestion || selectedIndex !== null || isComplete) {
      return;
    }

    setSelectedIndex(answerIndex);
    setOptimisticSubmittedCount(previousCount => Math.min(previousCount + 1, questionCount));
    submitAnswer(playerId, answerIndex);
  };

  const handleTextSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!activeQuestion || !isFreeTextQuestion || !canSubmitText || isComplete) {
      return;
    }

    const normalizedAnswer = draftAnswer.trim().slice(0, profileAnswerMaxLength);

    if (!normalizedAnswer) {
      return;
    }

    setSubmittedText(normalizedAnswer);
    setOptimisticSubmittedCount(previousCount => Math.min(previousCount + 1, questionCount));
    submitAnswer(playerId, normalizedAnswer);
  };

  return (
    <PhoneLayout contentClassName="justify-center">
      {isComplete ? (
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="phone-card-strong w-full rounded-[1.8rem] px-6 py-7"
          >
            <p className="phone-status-chip">
              Survey Complete
            </p>
            <h2 className="mt-3 font-title text-4xl text-vault-gold">All Set</h2>
            <p className="mt-3 font-ui text-sm text-white/60">
              Waiting for everyone else to finish.
            </p>
          </motion.div>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5">
          <div className="text-center">
            <p className="phone-status-chip">
              Profile {optimisticSubmittedCount + 1} / {Math.max(questionCount, 1)}
            </p>
            {activeQuestion?.displaySubtitle && (
              <p className="mt-3 font-ui text-[11px] font-semibold uppercase tracking-[0.24em] text-vault-gold">
                {activeQuestion.displaySubtitle}
              </p>
            )}
            <p className="mt-4 font-ui text-xl leading-snug text-white">
              {activeQuestion?.question}
            </p>
          </div>

          {isFreeTextQuestion ? (
            <form className="flex flex-col gap-3" onSubmit={handleTextSubmit}>
              <input
                type="text"
                value={draftAnswer}
                onChange={event => setDraftAnswer(event.target.value.slice(0, profileAnswerMaxLength))}
                placeholder="Type your answer"
                maxLength={profileAnswerMaxLength}
                disabled={submittedText !== null}
                className="minimal-input text-center font-ui text-lg"
                autoComplete="off"
              />
              <p className="text-center font-ui text-xs uppercase tracking-[0.28em] text-white/45">
                {profileAnswerMaxLength} character max
              </p>
              <button
                type="submit"
                disabled={!canSubmitText}
                className="minimal-button-primary w-full py-4 text-lg text-white"
              >
                Save
              </button>
            </form>
          ) : (
            <div className={shouldUseTwoColumnChoices ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'}>
              {activeQuestion?.choices.map((choice, index) => (
                <AnswerButton
                  key={index}
                  index={index}
                  label={choice}
                  disabled={selectedIndex !== null}
                  selected={selectedIndex === index}
                  onSelect={() => handleSelect(index)}
                />
              ))}
            </div>
          )}

          {(selectedText || submittedText) && (
            <p className="text-center font-ui text-sm text-white/58">
              Saved: {submittedText ?? selectedText}
            </p>
          )}
        </div>
      )}
    </PhoneLayout>
  );
}
