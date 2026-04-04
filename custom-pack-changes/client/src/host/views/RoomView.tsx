import { useState, type Dispatch, type SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { HostLayout } from '@/shared/components/HostLayout';
import { useAppFlow } from '@/app/AppFlowContext';
import { POLYMARKET_CATEGORIES, getPolymarketCategoryName } from '@/services/polymarket/categories';
import { PdfManager } from '../components/PdfManager';
import { useGameState, useGameActions } from '@/context/GameContext';
import { GAME_CONFIG } from '@/constants/gameConfig';
import type { CustomPackSettings } from '@/types/game';
import brownStudent from '@/assets/characters/brown-student.png';
import harvardInfluencer from '@/assets/characters/harvard-influencer.png';
import mitFounder from '@/assets/characters/mit-founder.png';
import princetonNerd from '@/assets/characters/princeton-nerd.png';
import stanfordRaccoon from '@/assets/characters/stanford-raccoon.png';
import whartonRaccoon from '@/assets/characters/wharton-raccoon.png';
import yalePortrait from '@/assets/characters/yale-portrait.png';

const SCHOOL_CREW = [
  { label: 'Brown', image: brownStudent, scale: 1 },
  { label: 'Harvard', image: harvardInfluencer, scale: 2 },
  { label: 'MIT', image: mitFounder, scale: 2 },
  { label: 'Princeton', image: princetonNerd, scale: 2 },
  { label: 'Stanford', image: stanfordRaccoon, scale: 2 },
  { label: 'Wharton', image: whartonRaccoon, scale: 2 },
  { label: 'Yale', image: yalePortrait, scale: 2 },
];

const FRIEND_GROUP_PACKS = [
  'Inside jokes',
  'Who said it?',
  'Campus lore',
];

const CUSTOM_PACK_STYLES: Array<{ id: CustomPackSettings['style']; label: string; emoji: string }> = [
  { id: 'funny', label: 'Funny', emoji: '😂' },
  { id: 'kid-friendly', label: 'Kid-Friendly', emoji: '🧒' },
  { id: 'for-friends', label: 'For Friends', emoji: '👯' },
  { id: 'for-family', label: 'For Family', emoji: '👨‍👩‍👧' },
];

type ScrapSectionId = 'polymarket' | 'coursework' | 'friends';

const getCourseworkDisplayName = (filename: string) => filename.replace(/\.[^/.]+$/, '');
const INITIAL_OPEN_SCRAP_SECTIONS: Record<ScrapSectionId, boolean> = {
  polymarket: false,
  coursework: true,
  friends: false,
};

export function RoomView() {
  const { roomCode, players, pdfs, isPreparingGame } = useGameState();
  const { startGame, simulateDevPlayerJoin } = useGameActions();
  const { flow } = useAppFlow();
  const [openScrapSections, setOpenScrapSections] = useState(INITIAL_OPEN_SCRAP_SECTIONS);
  const [selectedPolymarket, setSelectedPolymarket] = useState<string[]>([]);
  const [selectedFriendPacks, setSelectedFriendPacks] = useState<string[]>([]);
  const [selectedQuestionSource, setSelectedQuestionSource] = useState<'polymarket' | 'custom' | null>(null);
  const [customPack, setCustomPack] = useState<CustomPackSettings>({
    numQuestions: GAME_CONFIG.defaultQuestionCount,
    style: 'funny',
    includeNames: false,
  });
  const [customPackReady, setCustomPackReady] = useState(false);
  const isDevMode = flow === 'dev';

  const hasPlayers = players.length >= GAME_CONFIG.minPlayers;
  const hasReadyPdfs = pdfs.some(p => p.status === 'ready' && p.enabled);
  const hasLivePolymarketSelections =
    selectedQuestionSource === 'polymarket' && selectedPolymarket.length > 0;
  const hasCustomPackReady = selectedQuestionSource === 'custom' && customPackReady;
  const canStart = selectedQuestionSource === 'custom'
    ? hasPlayers && hasCustomPackReady && !isPreparingGame
    : hasPlayers && (hasReadyPdfs || hasLivePolymarketSelections) && !isPreparingGame;
  const selectedCoursework = pdfs
    .filter(pdf => pdf.enabled)
    .map(pdf => getCourseworkDisplayName(pdf.filename));
  const customStyleLabel = CUSTOM_PACK_STYLES.find(style => style.id === customPack.style)?.label ?? customPack.style;
  const selectedMaterials = [
    ...selectedPolymarket.map(getPolymarketCategoryName),
    ...selectedCoursework,
    ...selectedFriendPacks,
    ...(selectedQuestionSource === 'custom'
      ? [`Custom Pack · ${customStyleLabel} · ${customPack.numQuestions} Q`]
      : []),
  ];
  const playerSlots = Array.from({ length: GAME_CONFIG.maxPlayers }, (_unused, slotIndex) => {
    const player = players.find(candidate => candidate.characterIndex === slotIndex) ?? null;
    const crewMember = SCHOOL_CREW[slotIndex % SCHOOL_CREW.length];

    return {
      player,
      crewMember,
      key: player?.id ?? `open-slot-${slotIndex}`,
    };
  });

  const toggleSelection = (
    value: string,
    setSelected: Dispatch<SetStateAction<string[]>>
  ) => {
    setSelected(current =>
      current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value]
    );
  };

  const toggleScrapSection = (sectionId: ScrapSectionId) => {
    setOpenScrapSections(current => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  };

  return (
    <HostLayout settingsGearSide="right">
      <div className="relative flex flex-1 flex-col gap-6 overflow-hidden p-8">
        <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
          {roomCode.split('').map((char, index) => (
            <div
              key={`${char}-${index}`}
              className="vault-panel flex h-10 w-10 items-center justify-center rounded-lg font-title text-xl tracking-widest text-[#f59e0b]"
            >
              {char}
            </div>
          ))}
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
            className={`flex h-full min-h-0 flex-col px-2 pt-4 transition-[width] duration-300 ${
              selectedQuestionSource === 'custom' ? 'w-[32rem]' : 'w-[24rem]'
            }`}
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

            <div className="min-h-0 flex-1 overflow-y-auto pr-2">
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
                      Build from live market categories.
                    </p>
                  </div>
                  <span className="font-ui text-xl leading-none text-white/70">
                    {openScrapSections.polymarket ? '−' : '+'}
                  </span>
                </button>

                {openScrapSections.polymarket && (
                  <div className="space-y-3 border-t border-white/10 px-4 py-4">
                    <div className="grid grid-cols-2 gap-2">
                      {POLYMARKET_CATEGORIES.map(category => (
                        <button
                          key={category.tag}
                          type="button"
                          onClick={() => {
                            setSelectedQuestionSource('polymarket');
                            toggleSelection(category.tag, setSelectedPolymarket);
                          }}
                          className={`rounded-full border px-3 py-2 text-left font-ui text-sm transition-colors ${
                            selectedPolymarket.includes(category.tag)
                              ? 'border-[#f59e0b]/45 bg-[#f59e0b]/18 text-[#f7c87b]'
                              : 'border-white/15 text-white hover:border-white/35 hover:bg-white/5'
                          }`}
                        >
                          <span className="mr-2">{category.emoji}</span>
                          {category.name}
                        </button>
                      ))}
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
                      Turn notes and slides into prompts.
                    </p>
                  </div>
                  <span className="font-ui text-xl leading-none text-white/70">
                    {openScrapSections.coursework ? '−' : '+'}
                  </span>
                </button>

                {openScrapSections.coursework && (
                  <div className="border-t border-white/10 px-4 py-4">
                    <PdfManager pdfs={pdfs} />
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
                    <div className="flex flex-wrap gap-2">
                      {FRIEND_GROUP_PACKS.map(pack => (
                        <button
                          key={pack}
                          type="button"
                          onClick={() => toggleSelection(pack, setSelectedFriendPacks)}
                          className={`rounded-full border px-3 py-2 font-ui text-sm transition-colors ${
                            selectedFriendPacks.includes(pack)
                              ? 'border-[#f59e0b]/45 bg-[#f59e0b]/18 text-[#f7c87b]'
                              : 'border-white/15 text-white/85 hover:border-white/35 hover:bg-white/5'
                          }`}
                        >
                          {pack}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedQuestionSource(current => (current === 'custom' ? null : 'custom'))}
                      className={`rounded-full border px-4 py-2 font-ui text-sm transition-colors ${
                        selectedQuestionSource === 'custom'
                          ? 'border-[#8b5cf6]/50 bg-[#8b5cf6]/20 text-[#d8b4fe]'
                          : 'border-dashed border-white/25 text-gray-300 hover:border-white/45 hover:text-white'
                      }`}
                    >
                      ✨ Custom pack
                    </button>

                    {selectedQuestionSource === 'custom' && (
                      <div className="w-full rounded-2xl border border-[#8b5cf6]/35 bg-[#8b5cf6]/10 p-4">
                        <div className="mb-1 font-ui text-sm font-bold uppercase tracking-[0.2em] text-violet-200">
                          Custom Pack
                        </div>
                        <p className="mb-4 font-ui text-sm text-violet-100/85">
                          Load curated custom questions for your selected style.
                        </p>

                        <div className="mb-4">
                          <label className="mb-2 block font-ui text-xs font-semibold uppercase tracking-[0.2em] text-violet-100/80">
                            Number of Questions: {customPack.numQuestions}
                          </label>
                          <input
                            type="range"
                            min={3}
                            max={15}
                            step={1}
                            value={customPack.numQuestions}
                            onChange={event => {
                              setCustomPack(previous => ({
                                ...previous,
                                numQuestions: Number(event.target.value),
                              }));
                              setCustomPackReady(false);
                            }}
                            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-violet-400"
                          />
                          <div className="mt-1 flex justify-between font-ui text-[11px] uppercase tracking-[0.2em] text-violet-100/65">
                            <span>3</span>
                            <span>15</span>
                          </div>
                        </div>

                        <div className="mb-4">
                          <label className="mb-2 block font-ui text-xs font-semibold uppercase tracking-[0.2em] text-violet-100/80">
                            Style / Audience
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {CUSTOM_PACK_STYLES.map(style => (
                              <button
                                key={style.id}
                                type="button"
                                onClick={() => {
                                  setCustomPack(previous => ({
                                    ...previous,
                                    style: style.id,
                                  }));
                                  setCustomPackReady(false);
                                }}
                                className={`rounded-full border px-3 py-2 font-ui text-sm transition-colors ${
                                  customPack.style === style.id
                                    ? 'border-violet-300/70 bg-violet-400/25 text-violet-100'
                                    : 'border-white/20 bg-white/5 text-white/85 hover:border-white/40 hover:bg-white/10'
                                }`}
                              >
                                {style.emoji} {style.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mb-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                          <div>
                            <div className="font-ui text-sm font-semibold text-white">Include player names</div>
                            <div className="font-ui text-xs text-gray-300">
                              Use player names in prompts that include {'{player}'} placeholders.
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomPack(previous => ({
                                ...previous,
                                includeNames: !previous.includeNames,
                              }));
                              setCustomPackReady(false);
                            }}
                            className={`relative h-6 w-11 rounded-full transition-colors ${
                              customPack.includeNames ? 'bg-violet-500' : 'bg-white/25'
                            }`}
                            aria-label="Toggle include player names"
                          >
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                                customPack.includeNames ? 'left-[22px]' : 'left-0.5'
                              }`}
                            />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setCustomPackReady(true)}
                          className="w-full rounded-full border border-violet-300/55 bg-violet-500/30 px-4 py-2 font-ui text-sm font-semibold text-violet-100 transition-colors hover:bg-violet-500/40"
                        >
                          {customPackReady ? '✓ Saved' : 'Save custom pack'}
                        </button>
                      </div>
                    )}
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
            className="grid flex-1 grid-cols-4 grid-rows-2 gap-x-3 gap-y-2 overflow-hidden rounded-[2rem] bg-black/15 px-6 py-5"
          >
            {playerSlots.map(({ key, player, crewMember }, slotIndex) => {
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
                  className={`flex h-36 items-end justify-center rounded-2xl transition-colors ${
                    isClickableDevSlot
                      ? 'cursor-pointer hover:bg-white/5'
                      : 'cursor-default'
                  }`}
                  aria-label={
                    isClickableDevSlot
                      ? `Add a simulated player to the ${crewMember.label} slot`
                      : undefined
                  }
                >
                  <img
                    src={crewMember.image}
                    alt={`${crewMember.label} raccoon`}
                    className="h-32 w-24 object-contain object-bottom"
                    style={{
                      transform: `scale(${crewMember.scale})`,
                      transformOrigin: 'bottom center',
                      filter: player ? 'none' : 'grayscale(100%)',
                    }}
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
          className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2"
        >
          <button
            onClick={() => {
              const options =
                selectedQuestionSource === 'custom' && customPackReady
                  ? {
                    customPack,
                    playerNames: players.map(player => player.name).filter(Boolean),
                    playerIds: players.map(player => player.id).filter(Boolean),
                  }
                  : {
                    polymarketCategories: selectedPolymarket,
                  };

              void startGame(options);
            }}
            disabled={!canStart}
            className={`vault-button px-16 py-4 text-2xl transition-opacity ${
              canStart ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            {isPreparingGame
              ? selectedQuestionSource === 'custom'
                ? 'Generating...'
                : 'Loading...'
              : selectedQuestionSource === 'custom'
                ? `Play (${customPack.numQuestions})`
                : 'Start'}
          </button>
        </motion.div>
      </div>
    </HostLayout>
  );
}
