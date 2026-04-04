import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { HostLayout } from '@/shared/components/HostLayout';
import { PlayerReaction } from '../components/PlayerReaction';
import { useGameActions, useGameState } from '@/context/GameContext';
import { GAME_CONFIG, getAnswerMeta } from '@/constants/gameConfig';
import { useAudioSettings } from '@/shared/context/AudioSettingsContext';
import {
  getRandomPresetQuip,
  type QuipOutcome,
} from '@/services/resultsQuips';
import {
  getNarrationAudioUrl,
  playNarration,
  stopNarration,
} from '@/services/questionNarration';
import v4RoofBg from '@/assets/optimized/v4roof.webp';

function getReactionLayout(playerCount: number) {
  if (playerCount >= 7) {
    return { columns: 4, gapPx: 6, scale: 0.58 };
  }

  if (playerCount >= 5) {
    return { columns: 3, gapPx: 8, scale: 0.72 };
  }

  if (playerCount === 4) {
    return { columns: 4, gapPx: 6, scale: 0.58 };
  }

  if (playerCount === 3) {
    return { columns: 3, gapPx: 8, scale: 0.72 };
  }

  if (playerCount === 2) {
    return { columns: 2, gapPx: 12, scale: 1 };
  }

  return { columns: 1, gapPx: 12, scale: 1 };
}

function pickRandomItem<T>(items: T[]) {
  if (items.length === 0) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)] ?? null;
}

export function ResultsView() {
  const { currentQuestion, results, players } = useGameState();
  const { advancePhase } = useGameActions();
  const { soundEffectsEnabled } = useAudioSettings();
  const currentQuestionId = currentQuestion?.id ?? null;
  const activePlayers = players.filter(p => !p.isEliminated);
  const correctPlayers = activePlayers.filter(
    p => results && results.playerAnswers[p.id] === results.correctIndex
  );
  const wrongPlayers = activePlayers.filter(
    p => results && results.playerAnswers[p.id] !== results.correctIndex
  );

  const correctAnswer = currentQuestion && results
    ? currentQuestion.choices[results.correctIndex]
    : '';
  const answerMeta = getAnswerMeta(results?.correctIndex ?? 0);
  const correctLayout = getReactionLayout(correctPlayers.length);
  const wrongLayout = getReactionLayout(wrongPlayers.length);
  const quipOutcome: QuipOutcome = wrongPlayers.length > 0 ? 'wrong' : 'correct';
  const quipCandidates = quipOutcome === 'wrong' ? wrongPlayers : correctPlayers;
  const quipCandidateIds = useMemo(
    () => quipCandidates.map(player => player.id).join('::'),
    [quipCandidates]
  );
  const [resultsQuip, setResultsQuip] = useState('');
  const [isQuipReady, setIsQuipReady] = useState(true);
  const resultsEnteredAtRef = useRef(Date.now());
  const previousQuipTemplateRef = useRef<string | null>(null);

  useEffect(() => {
    resultsEnteredAtRef.current = Date.now();

    if (!currentQuestion) {
      setResultsQuip('');
      setIsQuipReady(false);
      return;
    }

    const chosenPlayer = pickRandomItem(quipCandidates);

    if (!chosenPlayer) {
      setResultsQuip('');
      setIsQuipReady(true);
      return;
    }

    const { template, quip } = getRandomPresetQuip({
      playerName: chosenPlayer.name,
      outcome: quipOutcome,
      excludingTemplate: previousQuipTemplateRef.current,
    });

    setResultsQuip(quip);
    setIsQuipReady(Boolean(quip));
    previousQuipTemplateRef.current = template;
  }, [currentQuestionId, quipCandidateIds, quipOutcome]);

  useEffect(() => {
    if (!currentQuestionId || !resultsQuip || !isQuipReady || !soundEffectsEnabled) {
      return;
    }

    void getNarrationAudioUrl(`results-quip:${currentQuestionId}`, resultsQuip).catch(error => {
      console.warn('Unable to prewarm results narration', error);
    });
  }, [currentQuestionId, isQuipReady, resultsQuip, soundEffectsEnabled]);

  useEffect(() => {
    if (!currentQuestionId || !resultsQuip || !isQuipReady || !soundEffectsEnabled) {
      stopNarration();
      return;
    }

    const elapsedMs = Date.now() - resultsEnteredAtRef.current;
    const delayMs = Math.max(0, 2000 - elapsedMs);
    const timeoutId = window.setTimeout(() => {
      void playNarration(`results-quip:${currentQuestionId}`, resultsQuip);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
      stopNarration();
    };
  }, [currentQuestionId, isQuipReady, resultsQuip, soundEffectsEnabled]);

  if (!currentQuestion || !results) return null;

  return (
    <HostLayout backgroundImage={v4RoofBg} minimalSettingsGear>
      <div className="flex min-h-0 flex-1 flex-row">
        <section className="flex h-full w-[42%] shrink-0 items-center justify-center px-8 md:px-12">
          <div className="flex max-w-xl flex-col items-center gap-5 text-center">
            <motion.p
              initial={{ y: -18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="question-numbering font-tradeWinds text-2xl md:text-3xl"
            >
              The answer was...
            </motion.p>

            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.35 }}
              className="relative w-full rounded-[2rem] border border-white/10 bg-black/20 px-8 py-10 shadow-[0_22px_80px_rgba(0,0,0,0.35)]"
            >
              <div className="mb-5 flex justify-center">
                <span
                  className="inline-flex min-w-[4.5rem] items-center justify-center rounded-full px-5 py-2 font-title text-3xl text-white"
                  style={{ backgroundColor: answerMeta.bg }}
                >
                  {answerMeta.label}
                </span>
              </div>
              <p className="question-copy font-newspaper text-4xl leading-tight md:text-5xl">
                {correctAnswer}
              </p>
              <div className="mx-auto mt-6 h-px w-24 bg-white/60" />
              <p className="mt-4 font-ui text-sm uppercase tracking-[0.3em] text-gray-300">
                Correct answers pay ${GAME_CONFIG.correctAnswerReward}
              </p>
            </motion.div>
          </div>
        </section>

        <section className="flex h-full w-[58%] shrink-0 items-center px-6 pb-10 pt-16 md:px-10">
          <div className="grid w-full grid-cols-2 gap-6">
            <motion.div
              initial={{ x: -28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="rounded-[2rem] border border-white/10 bg-black/15 px-6 py-7"
            >
              <div className="mb-5">
                <p className="font-ui text-xs font-semibold uppercase tracking-[0.3em] text-vault-green">
                  Clean Getaway
                </p>
                <h2 className="mt-2 font-title text-3xl text-white">
                  Correct
                </h2>
                <p className="mt-1 font-ui text-sm text-gray-400">
                  {correctPlayers.length === 0
                    ? 'Nobody cleared this one.'
                    : `${correctPlayers.length} player${correctPlayers.length === 1 ? '' : 's'} move on.`}
                </p>
              </div>

              <div
                className="grid min-h-[16rem] w-full justify-items-center content-start"
                style={{
                  gridTemplateColumns: `repeat(${correctLayout.columns}, minmax(0, 1fr))`,
                  gap: `${correctLayout.gapPx}px`,
                }}
              >
                {correctPlayers.map(p => (
                  <PlayerReaction
                    key={p.id}
                    player={p}
                    isCorrect
                    scale={correctLayout.scale}
                  />
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ x: 28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.28 }}
              className="rounded-[2rem] border border-white/10 bg-black/15 px-6 py-7"
            >
              <div className="mb-5">
                <p className="font-ui text-xs font-semibold uppercase tracking-[0.3em] text-vault-red">
                  Alarm Triggered
                </p>
                <h2 className="mt-2 font-title text-3xl text-white">
                  Missed It
                </h2>
                <p className="mt-1 font-ui text-sm text-gray-400">
                  {wrongPlayers.length === 0
                    ? 'Everyone escaped the trap.'
                    : `${wrongPlayers.length} player${wrongPlayers.length === 1 ? '' : 's'} missed this question.`}
                </p>
              </div>

              <div
                className="grid min-h-[16rem] w-full justify-items-center content-start"
                style={{
                  gridTemplateColumns: `repeat(${wrongLayout.columns}, minmax(0, 1fr))`,
                  gap: `${wrongLayout.gapPx}px`,
                }}
              >
                {wrongPlayers.map(p => (
                  <PlayerReaction
                    key={p.id}
                    player={p}
                    isCorrect={false}
                    scale={wrongLayout.scale}
                  />
                ))}
              </div>
              <button
                onClick={advancePhase}
                className="vault-button mt-8 w-full px-6 py-4 text-xl"
              >
                Continue
              </button>
            </motion.div>
          </div>
        </section>
      </div>
    </HostLayout>
  );
}
