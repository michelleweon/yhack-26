import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/auth/AuthContext';
import { HostLayout } from '@/shared/components/HostLayout';
import { CharacterPortraitCard } from '@/shared/components/CharacterPortraitCard';
import { useAudioSettings } from '@/shared/context/AudioSettingsContext';
import { playSelectionDing } from '@/shared/services/selectionDing';
import { useAppFlow } from '@/app/AppFlowContext';
import { POLYMARKET_CATEGORIES, getPolymarketCategoryName } from '@/services/polymarket/categories';
import { createCustomQuestionPack, deleteCustomQuestionPack } from '@/services/customQuestionPacks';
import { MiscPackManager } from '../components/MiscPackManager';
import { PdfManager } from '../components/PdfManager';
import { useGameState, useGameActions } from '@/context/GameContext';
import { GAME_CONFIG } from '@/constants/gameConfig';
import type { CustomQuestionPack, FriendGroupPackSettings, Question } from '@/types/game';

const FRIEND_GROUP_PACK_STYLES: Array<{
  id: FriendGroupPackSettings['style'];
  label: string;
}> = [
  { id: 'outta-pocket', label: 'Outta Pocket' },
  { id: 'for-friends', label: 'Get to Know ya' },
  { id: 'kid-friendly', label: "I'm playing with Mom" },
];

type ScrapSectionId = 'polymarket' | 'coursework' | 'friends' | 'misc';

const getCourseworkDisplayName = (filename: string) => filename.replace(/\.[^/.]+$/, '');
const JOIN_URL = 'yhack-26-opal.vercel.app/play';
const INITIAL_OPEN_SCRAP_SECTIONS: Record<ScrapSectionId, boolean> = {
  polymarket: false,
  coursework: false,
  friends: false,
  misc: false,
};

function createFriendPackFilename(label: string) {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return `${slug || 'friend-pack'}.txt`;
}

function getCustomPackDisplayName(pack: CustomQuestionPack) {
  return pack.label.trim() || getCourseworkDisplayName(pack.filename);
}

function isFriendGroupSavedPack(pack: CustomQuestionPack) {
  return pack.questions.some(question => question.keywords.includes('friend-group-generated'));
}

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function interleaveSelectedPackQuestions(
  packs: CustomQuestionPack[],
  totalQuestions: number,
) {
  const questionGroups = packs
    .map(pack => {
      const packLabel = getCustomPackDisplayName(pack);
      const questions = isFriendGroupSavedPack(pack)
        ? pack.questions.map(question => ({
          ...question,
          displaySubtitle: question.displaySubtitle ?? packLabel,
        }))
        : pack.questions;

      return shuffle(questions);
    })
    .filter(group => group.length > 0);
  const mixedQuestions: Question[] = [];
  let questionIndex = 0;

  while (mixedQuestions.length < totalQuestions) {
    let appendedInPass = false;

    for (const group of shuffle(questionGroups)) {
      const nextQuestion = group[questionIndex];

      if (!nextQuestion) {
        continue;
      }

      mixedQuestions.push(nextQuestion);
      appendedInPass = true;

      if (mixedQuestions.length >= totalQuestions) {
        break;
      }
    }

    if (!appendedInPass) {
      break;
    }

    questionIndex += 1;
  }

  return mixedQuestions;
}

export function RoomView() {
  const {
    roomCode,
    players,
    customPacks,
    isPreparingGame,
    pendingFriendGroupPackDraft,
    selectedPolymarketCategories,
  } = useGameState();
  const { user } = useAuth();
  const {
    startGame,
    setSelectedPolymarketCategories,
    clearSelectedMaterials,
    simulateDevPlayerJoin,
    upsertCustomPack,
    toggleCustomPack,
    removeCustomPack,
    clearPendingFriendGroupPackDraft,
  } = useGameActions();
  const { soundEffectsEnabled } = useAudioSettings();
  const { flow } = useAppFlow();
  const [openScrapSections, setOpenScrapSections] = useState(INITIAL_OPEN_SCRAP_SECTIONS);
  const [isFriendGroupCustomEnabled, setIsFriendGroupCustomEnabled] = useState(false);
  const [isFriendPackNameModalOpen, setIsFriendPackNameModalOpen] = useState(false);
  const [friendPackName, setFriendPackName] = useState('');
  const [friendPackError, setFriendPackError] = useState<string | null>(null);
  const [isCreatingFriendPack, setIsCreatingFriendPack] = useState(false);
  const [dismissedFriendPackDraftId, setDismissedFriendPackDraftId] = useState<string | null>(null);
  const [pendingDeleteFriendPackId, setPendingDeleteFriendPackId] = useState<string | null>(null);
  const [deletingFriendPackId, setDeletingFriendPackId] = useState<string | null>(null);
  const [showCopiedJoinUrl, setShowCopiedJoinUrl] = useState(false);
  const copiedJoinUrlTimeoutRef = useRef<number | null>(null);
  const [friendGroupPackSettings, setFriendGroupPackSettings] = useState<FriendGroupPackSettings>({
    numQuestions: GAME_CONFIG.defaultQuestionCount,
    style: 'for-friends',
    includeNames: false,
  });
  const isDevMode = flow === 'dev';

  const hasPlayers = players.length >= GAME_CONFIG.minPlayers;
  const hasMultiplePlayers = players.length > 1;
  const courseworkPacks = customPacks.filter(pack => pack.sourceType === 'transcript');
  const friendGroupPacks = customPacks.filter(isFriendGroupSavedPack);
  const pendingDeleteFriendPack =
    friendGroupPacks.find(candidate => candidate.id === pendingDeleteFriendPackId) ?? null;
  const miscPacks = customPacks.filter(pack => pack.sourceType !== 'transcript' && !isFriendGroupSavedPack(pack));
  const selectedCourseworkPacks = courseworkPacks.filter(pack => pack.enabled);
  const selectedFriendGroupPacks = friendGroupPacks.filter(pack => pack.enabled);
  const selectedMiscPacks = miscPacks.filter(pack => pack.enabled);
  const selectedCustomPacks = [...selectedCourseworkPacks, ...selectedFriendGroupPacks, ...selectedMiscPacks];
  const selectedCustomQuestions = interleaveSelectedPackQuestions(
    selectedCustomPacks,
    GAME_CONFIG.defaultQuestionCount
  );
  const hasCustomPackSelections = selectedCustomQuestions.length > 0;
  const isFriendGroupMode = isFriendGroupCustomEnabled;
  const hasValidFriendGroupSettings =
    friendGroupPackSettings.numQuestions >= 3
    && friendGroupPackSettings.numQuestions <= 15
    && Boolean(friendGroupPackSettings.style);
  const canStart =
    isFriendGroupMode
      ? hasPlayers
        && hasValidFriendGroupSettings
        && !isPreparingGame
        && !isCreatingFriendPack
        && !pendingFriendGroupPackDraft
      : hasPlayers
        && !isPreparingGame;
  const selectedCoursework = selectedCourseworkPacks.map(pack => getCourseworkDisplayName(pack.filename));
  const friendGroupStyleLabel =
    FRIEND_GROUP_PACK_STYLES.find(style => style.id === friendGroupPackSettings.style)?.label
    ?? friendGroupPackSettings.style;
  const selectedMaterials = isFriendGroupMode
    ? [
      ...selectedFriendGroupPacks.map(getCustomPackDisplayName),
      `Friend Pack · ${friendGroupStyleLabel} · ${friendGroupPackSettings.numQuestions} Q`,
    ]
    : (() => {
      const materials = [
        ...selectedPolymarketCategories.map(getPolymarketCategoryName),
        ...selectedCoursework,
        ...selectedFriendGroupPacks.map(getCustomPackDisplayName),
        ...selectedMiscPacks.map(pack => getCourseworkDisplayName(pack.filename)),
      ];

      return materials.length > 0 ? materials : ['Fallback Deck'];
    })();
  const playerSlots = Array.from({ length: GAME_CONFIG.maxPlayers }, (_unused, slotIndex) => {
    const player = players.find(candidate => candidate.characterIndex === slotIndex) ?? null;

    return {
      player,
      characterIndex: player?.characterIndex ?? slotIndex,
      key: player?.id ?? `open-slot-${slotIndex}`,
    };
  });

  const toggleSelection = (value: string, isSelected: boolean) => {
    if (soundEffectsEnabled) {
      playSelectionDing();
    }

    setSelectedPolymarketCategories(
      isSelected
        ? selectedPolymarketCategories.filter(item => item !== value)
        : [...selectedPolymarketCategories, value]
    );
  };

  const toggleScrapSection = (sectionId: ScrapSectionId) => {
    setOpenScrapSections(current => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  };

  useEffect(() => {
    const hasValidSelectedStyle = FRIEND_GROUP_PACK_STYLES.some(
      style => style.id === friendGroupPackSettings.style
    );

    if (hasValidSelectedStyle) {
      return;
    }

    setFriendGroupPackSettings(previous => ({
      ...previous,
      style: FRIEND_GROUP_PACK_STYLES[0].id,
    }));
  }, [friendGroupPackSettings.style]);

  useEffect(() => {
    if (hasMultiplePlayers || !friendGroupPackSettings.includeNames) {
      return;
    }

    setFriendGroupPackSettings(previous => ({
      ...previous,
      includeNames: false,
    }));
  }, [friendGroupPackSettings.includeNames, hasMultiplePlayers]);

  useEffect(() => {
    if (!isFriendGroupMode) {
      return;
    }

    if (selectedPolymarketCategories.length === 0 && selectedCustomPacks.length === 0) {
      return;
    }

    clearSelectedMaterials();
  }, [
    clearSelectedMaterials,
    isFriendGroupMode,
    selectedCustomPacks.length,
    selectedPolymarketCategories.length,
  ]);

  useEffect(() => {
    if (!pendingFriendGroupPackDraft) {
      setDismissedFriendPackDraftId(null);
      setIsFriendPackNameModalOpen(false);
      setFriendPackName('');
      return;
    }

    if (pendingFriendGroupPackDraft.id === dismissedFriendPackDraftId) {
      return;
    }

    setFriendPackError(null);
    setFriendPackName(pendingFriendGroupPackDraft.suggestedLabel);
    setIsFriendPackNameModalOpen(true);
  }, [dismissedFriendPackDraftId, pendingFriendGroupPackDraft]);

  useEffect(() => (
    () => {
      if (copiedJoinUrlTimeoutRef.current !== null) {
        window.clearTimeout(copiedJoinUrlTimeoutRef.current);
      }
    }
  ), []);

  const handleSaveFriendPack = async () => {
    const trimmedName = friendPackName.trim();

    if (!trimmedName) {
      setFriendPackError('Give the pack a name first.');
      return;
    }

    if (!pendingFriendGroupPackDraft) {
      setFriendPackError('Finish creating the friend pack first.');
      return;
    }

    if (!user) {
      setFriendPackError('Sign in to save friend packs.');
      return;
    }

    setIsCreatingFriendPack(true);
    setFriendPackError(null);

    try {
      const friendPackQuestions = pendingFriendGroupPackDraft.questions.map(question => ({
        ...question,
        displaySubtitle: trimmedName,
      }));
      const savedPack = await createCustomQuestionPack({
        userId: user.id,
        filename: createFriendPackFilename(trimmedName),
        label: trimmedName,
        sourceType: 'other',
        sourceKind: 'txt',
        questions: friendPackQuestions,
      });

      upsertCustomPack({ ...savedPack, enabled: true });
      clearPendingFriendGroupPackDraft();
      setIsFriendPackNameModalOpen(false);
      setFriendPackName('');
      setDismissedFriendPackDraftId(null);
    } catch (error) {
      setFriendPackError(
        error instanceof Error ? error.message : 'Unable to create that friend pack right now.'
      );
    } finally {
      setIsCreatingFriendPack(false);
    }
  };

  const handleDeleteFriendPack = async () => {
    const pack = friendGroupPacks.find(candidate => candidate.id === pendingDeleteFriendPackId) ?? null;

    if (!user || !pack) {
      return;
    }

    setDeletingFriendPackId(pack.id);
    setFriendPackError(null);

    try {
      await deleteCustomQuestionPack(user.id, pack.id);
      removeCustomPack(pack.id);
      setPendingDeleteFriendPackId(null);
    } catch (error) {
      setFriendPackError(error instanceof Error ? error.message : 'Unable to delete that friend pack right now.');
    } finally {
      setDeletingFriendPackId(null);
    }
  };

  const handleCopyJoinUrl = async () => {
    try {
      await navigator.clipboard.writeText(JOIN_URL);

      if (copiedJoinUrlTimeoutRef.current !== null) {
        window.clearTimeout(copiedJoinUrlTimeoutRef.current);
      }

      setShowCopiedJoinUrl(true);
      copiedJoinUrlTimeoutRef.current = window.setTimeout(() => {
        setShowCopiedJoinUrl(false);
        copiedJoinUrlTimeoutRef.current = null;
      }, 1600);
    } catch (error) {
      console.error('Unable to copy join URL', error);
    }
  };

  return (
    <HostLayout settingsGearSide="right">
      <div className="relative flex flex-1 flex-col gap-6 overflow-hidden p-8">
        <div className="absolute left-4 top-4 z-20 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {roomCode.split('').map((char, index) => (
              <div
                key={`${char}-${index}`}
                className="vault-panel flex h-10 w-10 items-center justify-center rounded-lg font-title text-xl tracking-widest text-[#f59e0b]"
              >
                {char}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 px-1 text-left">
            <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90">
              Join at
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  void handleCopyJoinUrl();
                }}
                className="font-ui text-sm font-semibold text-[#f7c87b] transition-opacity hover:opacity-80"
              >
                {JOIN_URL}
              </button>
              {showCopiedJoinUrl && (
                <motion.span
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                  className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-3 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.3)]"
                >
                  Copied
                </motion.span>
              )}
            </div>
          </div>
        </div>

        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col items-center gap-5 pt-2 text-center"
        >
          <div>
            <h1 className="font-title text-5xl text-vault-gold">Lobby</h1>
            <p className="mt-1 font-ui text-gray-400">Waiting for players to join...</p>
          </div>
        </motion.div>

        <div className="flex min-h-0 flex-1 gap-6">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex h-full min-h-0 w-[24rem] flex-col px-2 pt-4"
          >
            <div className="mb-5">
              <div className="flex flex-col items-center">
                <h2 className="font-title text-2xl text-white">Materials</h2>
                <div className="mt-1.5 h-px w-1/2 bg-white/80" />
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {selectedMaterials.length > 0 &&
                selectedMaterials.map(item => (
                  <span
                    key={item}
                    className="inline-flex items-center justify-center rounded-full border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-1 text-center font-ui text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f3c77a]"
                  >
                    {item}
                  </span>
                ))}
            </div>

            <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto pr-2">
              <div className="grid grid-cols-1 gap-3">
              <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <button
                  type="button"
                  onClick={() => toggleScrapSection('polymarket')}
                  className="flex w-full items-start justify-between px-4 py-4 text-left"
                >
                  <div>
                    <h3 className="font-ui text-sm font-bold uppercase tracking-[0.25em] text-white/90">
                      Polymarket
                    </h3>
                    <p className="mt-1 font-ui text-sm text-gray-400">
                      Test your wits against live market categories.
                    </p>
                  </div>
                  <span className="font-ui text-xl leading-none text-white/70">
                    {openScrapSections.polymarket ? '−' : '+'}
                  </span>
                </button>

                {openScrapSections.polymarket && (
                  <div className="space-y-3 border-t border-white/10 px-4 py-4">
                    <div className="grid grid-cols-2 gap-2">
                      {POLYMARKET_CATEGORIES.map(category => {
                        const isSelected = selectedPolymarketCategories.includes(category.tag);

                        return (
                          <button
                            key={category.tag}
                            type="button"
                            onClick={() => toggleSelection(category.tag, isSelected)}
                            className={`rounded-full border px-3 py-2 text-left font-ui text-sm transition-colors ${
                              isSelected
                                ? 'border-[#f59e0b]/45 bg-[#f59e0b]/18 text-[#f7c87b]'
                                : 'border-white/15 text-white hover:border-white/35 hover:bg-white/5'
                            }`}
                          >
                            <span className="mr-2">{category.emoji}</span>
                            {category.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <button
                  type="button"
                  onClick={() => toggleScrapSection('coursework')}
                  className="flex w-full items-start justify-between px-4 py-4 text-left"
                >
                  <div>
                    <h3 className="font-ui text-sm font-bold uppercase tracking-[0.25em] text-white/90">
                      Coursework
                    </h3>
                    <p className="mt-1 font-ui text-sm text-gray-400">
                      Study with R.A.C.C.O.O.N. to steal the show!
                    </p>
                  </div>
                  <span className="font-ui text-xl leading-none text-white/70">
                    {openScrapSections.coursework ? '−' : '+'}
                  </span>
                </button>

                {openScrapSections.coursework && (
                  <div className="border-t border-white/10 px-4 py-4">
                    <PdfManager packs={courseworkPacks} />
                  </div>
                )}
              </section>

              <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <button
                  type="button"
                  onClick={() => toggleScrapSection('friends')}
                  className="flex w-full items-start justify-between px-4 py-4 text-left"
                >
                  <div>
                    <h3 className="font-ui text-sm font-bold uppercase tracking-[0.25em] text-white/90">
                      Friend Group
                    </h3>
                    <p className="mt-1 font-ui text-sm text-gray-400">
                      Make packs for your own circle.
                    </p>
                  </div>
                  <span className="font-ui text-xl leading-none text-white/70">
                    {openScrapSections.friends ? '−' : '+'}
                  </span>
                </button>

                {openScrapSections.friends && (
                  <div className="space-y-3 border-t border-white/10 px-4 py-4">
                    {friendGroupPacks.length > 0 && (
                      <div className="space-y-2">
                        <p className="font-ui text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                          Saved Packs
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {friendGroupPacks.map(pack => {
                            const isDeleting = deletingFriendPackId === pack.id;

                            return (
                              <div key={pack.id} className="group relative">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (soundEffectsEnabled) {
                                      playSelectionDing();
                                    }

                                    toggleCustomPack(pack.id, !pack.enabled);
                                  }}
                                  disabled={isDeleting}
                                  className={`max-w-full whitespace-normal break-words rounded-full border px-3 py-2 text-center font-ui text-sm transition-[padding,color,border-color,background-color,opacity] duration-200 group-hover:pr-9 ${
                                    pack.enabled
                                      ? 'border-[#f59e0b]/45 bg-[#f59e0b]/18 text-[#f7c87b]'
                                      : 'border-white/15 text-white/85 hover:border-white/35 hover:bg-white/5'
                                  } ${isDeleting ? 'cursor-wait opacity-60' : ''}`}
                                >
                                  {getCustomPackDisplayName(pack)}
                                </button>

                                <button
                                  type="button"
                                  aria-label={`Delete ${getCustomPackDisplayName(pack)}`}
                                  onClick={event => {
                                    event.stopPropagation();
                                    setFriendPackError(null);
                                    setPendingDeleteFriendPackId(pack.id);
                                  }}
                                  disabled={isDeleting}
                                  className="pointer-events-none invisible absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/35 font-ui text-xs font-bold uppercase text-white/70 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 hover:border-white/25 hover:bg-black/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  x
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {isFriendGroupMode && (
                      <div className="w-full rounded-2xl border border-[#f59e0b]/20 bg-[#f59e0b]/8 p-4">
                        <div className="mb-3 font-ui text-sm font-bold uppercase tracking-[0.2em] text-[#f3c77a]">
                          Friend Group Custom Pack
                        </div>

                        <div className="mb-4">
                          <label className="mb-2 block font-ui text-xs font-semibold uppercase tracking-[0.2em] text-vault-gold/80">
                            Number of Questions: {friendGroupPackSettings.numQuestions}
                          </label>
                          <input
                            type="range"
                            min={3}
                            max={15}
                            step={1}
                            value={friendGroupPackSettings.numQuestions}
                            onChange={event => {
                              setFriendGroupPackSettings(previous => ({
                                ...previous,
                                numQuestions: Number(event.target.value),
                              }));
                            }}
                            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-vault-gold"
                          />
                          <div className="mt-1 flex justify-between font-ui text-[11px] uppercase tracking-[0.2em] text-white/50">
                            <span>3</span>
                            <span>15</span>
                          </div>
                        </div>

                        <div className="mb-4">
                          <label className="mb-2 block font-ui text-xs font-semibold uppercase tracking-[0.2em] text-vault-gold/80">
                            Style / Audience
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {FRIEND_GROUP_PACK_STYLES.map(style => (
                              <button
                                key={style.id}
                                type="button"
                                onClick={() => {
                                  setFriendGroupPackSettings(previous => ({
                                    ...previous,
                                    style: style.id,
                                  }));
                                }}
                                className={`max-w-full whitespace-normal break-words rounded-full border px-3 py-2 text-center font-ui text-sm transition-colors ${
                                  friendGroupPackSettings.style === style.id
                                    ? 'border-[#f59e0b]/45 bg-[#f59e0b]/18 text-[#f7c87b]'
                                    : 'border-white/20 bg-white/5 text-white/85 hover:border-white/40 hover:bg-white/10'
                                }`}
                              >
                                {style.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mb-4 flex items-center justify-between">
                          <div className="font-ui text-sm font-semibold text-vault-gold/80">Include player names</div>
                          <button
                            type="button"
                            disabled={!hasMultiplePlayers}
                            onClick={() => {
                              if (!hasMultiplePlayers) {
                                return;
                              }

                              setFriendGroupPackSettings(previous => ({
                                ...previous,
                                includeNames: !previous.includeNames,
                              }));
                            }}
                            className={`relative h-6 w-11 rounded-full transition-colors ${
                              friendGroupPackSettings.includeNames ? 'bg-vault-gold' : 'bg-white/25'
                            } ${!hasMultiplePlayers ? 'cursor-not-allowed opacity-50' : ''}`}
                            aria-label="Toggle include player names"
                            aria-disabled={!hasMultiplePlayers}
                          >
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                                friendGroupPackSettings.includeNames ? 'left-[22px]' : 'left-0.5'
                            }`}
                            />
                          </button>
                        </div>
                        {!hasMultiplePlayers && (
                          <p className="mb-4 font-ui text-xs text-white/55">
                            Add at least one more player to turn names on.
                          </p>
                        )}

                        {pendingFriendGroupPackDraft && !isFriendPackNameModalOpen && (
                          <button
                            type="button"
                            onClick={() => {
                              setDismissedFriendPackDraftId(null);
                              setFriendPackError(null);
                              setFriendPackName(pendingFriendGroupPackDraft.suggestedLabel);
                              setIsFriendPackNameModalOpen(true);
                            }}
                            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-ui text-sm text-white/85 transition-colors hover:border-white/35 hover:bg-white/10"
                          >
                            Finish naming saved pack
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (soundEffectsEnabled) {
                          playSelectionDing();
                        }

                        setIsFriendGroupCustomEnabled(current => !current);
                      }}
                      className={`max-w-full whitespace-normal break-words rounded-full border px-4 py-2 text-center font-ui text-sm transition-colors ${
                        isFriendGroupMode
                          ? 'border-[#f59e0b]/45 bg-[#f59e0b]/18 text-[#f7c87b]'
                          : 'border-dashed border-white/25 bg-white/5 text-gray-300 hover:border-white/45 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {isFriendGroupMode ? 'Hide custom friend pack' : 'Build custom friend pack'}
                    </button>
                  </div>
                )}
              </section>

              <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <button
                  type="button"
                  onClick={() => toggleScrapSection('misc')}
                  className="flex w-full items-start justify-between px-4 py-4 text-left"
                >
                  <div>
                    <h3 className="font-ui text-sm font-bold uppercase tracking-[0.25em] text-white/90">
                      Misc Scraps
                    </h3>
                    <p className="mt-1 font-ui text-sm text-gray-400">
                      Our expert R.A.C.C.O.O.Ns will sift transform your scraps to find treasure.
                    </p>
                  </div>
                  <span className="font-ui text-xl leading-none text-white/70">
                    {openScrapSections.misc ? '−' : '+'}
                  </span>
                </button>

                {openScrapSections.misc && (
                  <div className="border-t border-white/10 px-4 py-4">
                    <MiscPackManager packs={miscPacks} />
                  </div>
                )}
              </section>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="grid flex-1 content-center grid-cols-4 grid-rows-[repeat(2,auto)] gap-x-3 gap-y-[70px] overflow-hidden rounded-[2rem] bg-black/15 px-6 py-5"
          >
            {playerSlots.map(({ key, player, characterIndex }, slotIndex) => {
              const isClickableDevSlot = isDevMode && !player;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (isClickableDevSlot) {
                      simulateDevPlayerJoin(slotIndex);
                    }
                  }}
                  disabled={!isClickableDevSlot}
                  className={`flex h-40 items-center justify-center rounded-2xl pb-4 -translate-y-[30px] transition-colors ${
                    isClickableDevSlot
                      ? 'cursor-pointer hover:bg-white/5'
                      : 'cursor-default'
                  }`}
                  aria-label={
                    isClickableDevSlot
                      ? `Add a simulated player to slot ${slotIndex + 1}`
                      : undefined
                  }
                >
                  <CharacterPortraitCard
                    characterIndex={characterIndex}
                    name={player?.name}
                    size="md"
                    imageScaleMultiplier={1.3}
                    isDimmed={!player}
                    nameVariant="heading"
                  />
                </button>
              );
            })}
          </motion.div>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center"
        >
          <button
            onClick={() => {
              if (isFriendGroupMode) {
                setFriendPackError(null);
                void startGame({
                  friendGroupPack: friendGroupPackSettings,
                  polymarketCategories: selectedPolymarketCategories,
                  customQuestions: selectedCustomQuestions,
                  playerNames: players.map(player => player.name).filter(Boolean),
                  playerIds: players.map(player => player.id),
                  saveFriendGroupPackAfterProfile: true,
                });
                return;
              }

              void startGame({
                polymarketCategories: selectedPolymarketCategories,
                customQuestions: selectedCustomQuestions,
              });
            }}
            disabled={!canStart}
            className={`vault-button px-16 py-4 text-2xl transition-opacity ${
              canStart ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            {isPreparingGame
              ? isFriendGroupMode
                ? 'Generating...'
                : 'Loading...'
              : isFriendGroupMode
                ? 'Create Friend Pack'
                : 'Start'}
          </button>
        </motion.div>

        {isFriendPackNameModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <button
              type="button"
              className="absolute inset-0 bg-black/65"
              aria-label="Close friend pack naming dialog"
              onClick={() => {
                if (!isCreatingFriendPack) {
                  setIsFriendPackNameModalOpen(false);
                  setFriendPackError(null);
                }
              }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative mx-4 w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#10151f] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
            >
              <p className="font-ui text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                Name Friend Pack
              </p>
              <p className="mt-3 font-ui text-sm text-white/75">
                Your crew pack is ready. Pick a name to save it under Friend Group.
              </p>

              <label className="mt-5 block">
                <span className="mb-2 block font-ui text-xs font-semibold uppercase tracking-[0.2em] text-vault-gold/80">
                  Pack Name
                </span>
                <input
                  type="text"
                  value={friendPackName}
                  onChange={event => setFriendPackName(event.target.value.slice(0, 60))}
                  className="minimal-input w-full text-left font-ui text-lg"
                  placeholder="Crew Favorites"
                  autoFocus
                  disabled={isCreatingFriendPack}
                />
              </label>

              {friendPackError && (
                <p className="mt-4 rounded-[1rem] border border-vault-red/20 bg-vault-red/10 px-4 py-3 font-ui text-sm text-white/82">
                  {friendPackError}
                </p>
              )}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveFriendPack();
                  }}
                  disabled={isCreatingFriendPack}
                  className="vault-button flex-1 px-5 py-3 text-base disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingFriendPack ? 'Creating...' : 'Save Pack'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFriendPackNameModalOpen(false);
                    setFriendPackError(null);
                    if (pendingFriendGroupPackDraft) {
                      setDismissedFriendPackDraftId(pendingFriendGroupPackDraft.id);
                    }
                  }}
                  disabled={isCreatingFriendPack}
                  className="flex-1 rounded-full border border-white/15 bg-white/5 px-5 py-3 font-ui text-base font-semibold text-white/85 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Not Now
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {pendingDeleteFriendPack && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <button
              type="button"
              className="absolute inset-0 bg-black/65"
              aria-label="Close friend pack delete dialog"
              onClick={() => {
                if (!deletingFriendPackId) {
                  setPendingDeleteFriendPackId(null);
                }
              }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative mx-4 w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#10151f] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
            >
              <p className="font-ui text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                Delete Friend Pack
              </p>
              <p className="mt-3 font-ui text-lg leading-relaxed text-white/88">
                Delete <span className="font-semibold">{getCustomPackDisplayName(pendingDeleteFriendPack)}</span> from your saved packs?
              </p>
              <p className="mt-2 font-ui text-sm text-white/52">
                This permanently removes it from your account.
              </p>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void handleDeleteFriendPack();
                  }}
                  disabled={Boolean(deletingFriendPackId)}
                  className="rounded-full border border-red-500/20 bg-red-600 px-5 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingFriendPackId ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingDeleteFriendPackId(null);
                  }}
                  disabled={Boolean(deletingFriendPackId)}
                  className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 font-ui text-sm font-semibold text-white/85 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </HostLayout>
  );
}
