import { useEffect, useMemo } from 'react';
import { HostLayout } from '@/shared/components/HostLayout';
import { LockTimer } from '@/shared/components/LockTimer';
import { useGameState } from '@/context/GameContext';
import { useAudioSettings } from '@/shared/context/AudioSettingsContext';
import {
  getQuestionNarrationAudioUrl,
  playQuestionNarration,
  stopQuestionNarration,
} from '@/services/questionNarration';
import b1Bg from '@/assets/backgrounds/b1.png';
import b2Bg from '@/assets/backgrounds/b2.png';
import b3Bg from '@/assets/backgrounds/b3.png';
import b4Bg from '@/assets/backgrounds/b4.png';
import v4RoofBg from '@/assets/optimized/v4roof.webp';

const QUESTION_BACKGROUNDS = [v4RoofBg, b1Bg, b2Bg, b3Bg, b4Bg];
const QUESTION_NARRATION_DELAY_MS = 2000;

function isExternalSourceUrl(source: string | null | undefined) {
  return typeof source === 'string' && /^https?:\/\//i.test(source.trim());
}

function getBackgroundIndex(questionId: string) {
  let hash = 0;

  for (let index = 0; index < questionId.length; index += 1) {
    hash = (hash * 31 + questionId.charCodeAt(index)) >>> 0;
  }

  return hash % QUESTION_BACKGROUNDS.length;
}

export function QuestionView() {
  const { currentQuestion, timerDuration, roundDeadlineAt } = useGameState();
  const { soundEffectsEnabled } = useAudioSettings();
  const answerRowStyles = [
    { rotate: 3, offsetX: 0 },
    { rotate: 1, offsetX: -18 },
    { rotate: -1, offsetX: 12 },
    { rotate: -2, offsetX: -8 },
  ];

  const backgroundImage = useMemo(
    () => currentQuestion
      ? QUESTION_BACKGROUNDS[getBackgroundIndex(currentQuestion.id)]
      : v4RoofBg,
    [currentQuestion?.id]
  );
  const sourceUrl = useMemo(() => {
    const source = currentQuestion?.source;
    return typeof source === 'string' && isExternalSourceUrl(source)
      ? source.trim()
      : undefined;
  }, [currentQuestion?.source]);

  useEffect(() => {
    if (!currentQuestion || !soundEffectsEnabled) {
      stopQuestionNarration();
      return;
    }

    void getQuestionNarrationAudioUrl(currentQuestion.id, currentQuestion.question).catch(error => {
      console.warn('Unable to prewarm question narration', error);
    });

    const narrationTimeoutId = window.setTimeout(() => {
      void playQuestionNarration(currentQuestion.id, currentQuestion.question);
    }, QUESTION_NARRATION_DELAY_MS);

    return () => {
      window.clearTimeout(narrationTimeoutId);
      stopQuestionNarration();
    };
  }, [currentQuestion?.id, currentQuestion?.question, soundEffectsEnabled]);

  if (!currentQuestion) return null;

  return (
    <HostLayout backgroundImage={backgroundImage} minimalSettingsGear>
      <div className="flex-1 relative flex flex-row min-h-0">
        <section className="w-1/2 h-full shrink-0 flex items-center justify-center px-6 md:px-10">
          <div className="question-prompt w-4/5 max-w-full flex flex-col items-center text-center gap-4">
            {(currentQuestion.displaySubtitle || currentQuestion.category) && (
              <p className={`font-tradeWinds text-xl md:text-2xl lg:text-3xl question-numbering ${
                currentQuestion.displaySubtitle ? 'text-vault-gold' : ''
              }`}>
                {currentQuestion.displaySubtitle ?? currentQuestion.category ?? 'Live Market Intelligence'}
              </p>
            )}
            <p className="font-newspaper text-3xl md:text-4xl lg:text-5xl leading-tight question-copy">
              {currentQuestion.question}
            </p>
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="font-ui text-xs uppercase tracking-[0.24em] text-white/60 transition-opacity hover:opacity-80"
              >
                View source
              </a>
            )}
          </div>
        </section>

        <section className="w-1/2 h-full shrink-0 flex flex-col items-center justify-center gap-3 md:gap-4 px-6 md:px-10">
          <div className="w-full max-w-xl translate-x-6 translate-y-1/2 md:translate-x-8 md:translate-y-1/2 flex flex-col gap-8 md:gap-9">
            {currentQuestion.choices.map((choice, i) => (
              <div
                key={i}
                className="font-newspaper text-lg md:text-xl lg:text-2xl question-copy flex items-baseline gap-3 md:gap-4"
                style={{
                  transform: `translateX(${answerRowStyles[i % answerRowStyles.length].offsetX}px) rotate(${answerRowStyles[i % answerRowStyles.length].rotate}deg)`,
                  transformOrigin: 'left center',
                }}
              >
                <span
                  className="shrink-0 inline-block w-8 md:w-10 text-[#fde047] text-[1.6em] leading-none"
                >
                  {String.fromCharCode(65 + i)}.
                </span>
                <span className="flex-1">{choice}</span>
              </div>
            ))}
          </div>
        </section>

        <div
          className="absolute z-10"
          style={{
            top: 20,
            left: 16,
          }}
        >
          <div style={{ transform: 'scale(0.7)', transformOrigin: 'top left' }}>
            <LockTimer deadlineAt={roundDeadlineAt} totalTime={timerDuration} size={200} />
          </div>
        </div>
      </div>
    </HostLayout>
  );
}
