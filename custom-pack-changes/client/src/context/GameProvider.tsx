import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { GameContext, type GameActions } from './GameContext';
import type {
  CustomResponseHistoryItem,
  GamePhase,
  GameStartOptions,
  GameState,
  Question,
  QuestionResult,
} from '@/types/game';
import type { PlayerState } from '@/types/player';
import { GAME_CONFIG } from '@/constants/gameConfig';
import { fetchPolymarketQuestionDeck } from '@/services/polymarket/questions';
import { fetchCustomPackQuestionsFromSupabase } from '@/services/custom/questions';
import { supabase } from '@/services/supabaseClient';
import { useAuth } from '@/auth/AuthContext';
import {
  createInitialState,
  generateRoomCode,
  getMockQuestion,
} from './mockData';

const STORAGE_KEYS = {
  roomCode: 'heist_room_code',
  playerId: 'heist_player_id',
  hostRoomCode: 'heist_host_room_code',
} as const;

const SNAPSHOT_PREFIX = 'heist_host_snapshot:';
const JOIN_REQUEST_TIMEOUT_MS = 4000;
const HOST_ROOM_CLAIM_RETRIES = 12;
const HOST_ROOM_CONFLICT_ERROR = 'HOST_ROOM_CONFLICT';
const CUSTOM_PROFILE_QUESTION_COUNT = 3;
const CUSTOM_STYLES = new Set(['kid-friendly', 'for-friends', 'for-family', 'funny']);

interface JoinRequestPayload {
  roomCode: string;
  playerId: string;
  playerName: string;
}

interface SubmitAnswerPayload {
  playerId: string;
  answerIndex: number;
}

interface LeaveRoomPayload {
  playerId: string;
}

interface PresencePayload {
  role: 'host' | 'player';
  playerId?: string;
}

type StateUpdater = GameState | ((previousState: GameState) => GameState);

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<GameState>(createInitialState);

  const stateRef = useRef(state);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isHostRef = useRef(false);
  const hasRestoredSessionRef = useRef(false);
  const isFinalizingQuestionRef = useRef(false);
  const persistSnapshotTimeoutRef = useRef<number | null>(null);
  const pendingJoinRef = useRef<{
    playerId: string;
    resolve: (playerId: string | null) => void;
    timeoutId: number;
  } | null>(null);

  useEffect(() => {
    stateRef.current = state;

    if (
      isHostRef.current
      && state.roomCode
      && state.phase !== 'question'
      && state.phase !== 'results'
    ) {
      if (persistSnapshotTimeoutRef.current !== null) {
        window.clearTimeout(persistSnapshotTimeoutRef.current);
      }

      persistSnapshotTimeoutRef.current = window.setTimeout(() => {
        window.localStorage.setItem(getSnapshotStorageKey(state.roomCode), JSON.stringify(stateRef.current));
        persistSnapshotTimeoutRef.current = null;
      }, 150);
    }
  }, [state]);

  const setLocalState = useCallback((updater: StateUpdater) => {
    setState(previousState => {
      const nextState =
        typeof updater === 'function'
          ? (updater as (previousState: GameState) => GameState)(previousState)
          : updater;

      stateRef.current = nextState;
      return nextState;
    });
  }, []);

  const teardownChannel = useCallback(async () => {
    const activeChannel = channelRef.current;

    if (!activeChannel || !supabase) {
      channelRef.current = null;
      return;
    }

    channelRef.current = null;

    try {
      await activeChannel.untrack();
    } catch (error) {
      console.error('Unable to clear Supabase presence', error);
    }

    try {
      await supabase.removeChannel(activeChannel);
    } catch (error) {
      console.error('Unable to remove Supabase channel', error);
    }
  }, []);

  const sendBroadcast = useCallback((event: string, payload: Record<string, unknown>) => {
    if (!channelRef.current) {
      return;
    }

    void channelRef.current.send({
      type: 'broadcast',
      event,
      payload,
    }).then(result => {
      if (result === 'error') {
        console.error(`Broadcast "${event}" failed`);
      }
    }).catch(error => {
      console.error(`Broadcast "${event}" failed`, error);
    });
  }, []);

  const broadcastSnapshot = useCallback((snapshot: GameState, reason: string) => {
    if (!isHostRef.current) {
      return;
    }

    sendBroadcast('state-sync', { reason, state: snapshot });
  }, [sendBroadcast]);

  const commitHostState = useCallback((updater: StateUpdater, reason: string) => {
    if (!isHostRef.current) {
      return;
    }

    let nextSnapshot = stateRef.current;
    setLocalState(previousState => {
      nextSnapshot =
        typeof updater === 'function'
          ? (updater as (previousState: GameState) => GameState)(previousState)
          : updater;
      return nextSnapshot;
    });

    void broadcastSnapshot(nextSnapshot, reason);
  }, [broadcastSnapshot, setLocalState]);

  const finalizeQuestionRound = useCallback((reason: string) => {
    if (!isHostRef.current || isFinalizingQuestionRef.current) {
      return;
    }

    isFinalizingQuestionRef.current = true;

    try {
      const currentState = stateRef.current;

      if (currentState.phase === 'profile') {
        const nextState = createAfterProfilePhaseState(currentState);
        void persistCustomProfileAnswers(
          currentState.profileAssignments,
          currentState.profileResponses,
          currentState.players
        );
        commitHostState(nextState, `profile:${reason}`);
      } else {
        const nextState = createResultsPhaseState(currentState);
        commitHostState(nextState, `results:${reason}`);
      }
    } finally {
      window.setTimeout(() => {
        isFinalizingQuestionRef.current = false;
      }, 50);
    }
  }, [commitHostState]);

  const syncPresenceToHostState = useCallback((channel: RealtimeChannel) => {
    if (!isHostRef.current) {
      return;
    }

    const presenceState = channel.presenceState<PresencePayload>();
    const connectedPlayerIds = new Set<string>();

    Object.values(presenceState).forEach(entries => {
      entries.forEach(entry => {
        if (entry.role === 'player' && entry.playerId) {
          connectedPlayerIds.add(entry.playerId);
        }
      });
    });

    const currentState = stateRef.current;
    let hasChanges = false;
    const nextPlayers = currentState.players.map(player => {
      const isConnected = connectedPlayerIds.has(player.id);

      if (player.isConnected === isConnected) {
        return player;
      }

      hasChanges = true;
      return { ...player, isConnected };
    });

    if (!hasChanges) {
      return;
    }

    const nextState = {
      ...currentState,
      players: nextPlayers,
    };

    setLocalState(nextState);
  }, [setLocalState]);

  const handleJoinRequest = useCallback((payload: JoinRequestPayload) => {
    if (!isHostRef.current || payload.roomCode !== stateRef.current.roomCode) {
      return;
    }

    const currentState = stateRef.current;
    const normalizedName = payload.playerName.trim().slice(0, 16);

    if (!normalizedName) {
      return;
    }

    const existingPlayer = currentState.players.find(player => player.id === payload.playerId);

    if (!existingPlayer && currentState.players.length >= GAME_CONFIG.maxPlayers) {
      return;
    }

    let nextPlayers: PlayerState[];

    if (existingPlayer) {
      nextPlayers = currentState.players.map(player => (
        player.id === existingPlayer.id
          ? { ...player, name: normalizedName, isConnected: true }
          : player
      ));
    } else {
      const usedIndices = new Set(currentState.players.map(player => player.characterIndex));
      const characterIndex = Array.from(
        { length: GAME_CONFIG.maxPlayers },
        (_unused, index) => index
      ).find(index => !usedIndices.has(index)) ?? 0;

      nextPlayers = [
        ...currentState.players,
        {
          id: payload.playerId,
          name: normalizedName,
          characterIndex,
          score: GAME_CONFIG.startingBalance,
          isEliminated: false,
          isConnected: true,
          currentAnswer: null,
          minigameScore: 0,
        },
      ];
    }

    const nextState = {
      ...currentState,
      players: nextPlayers,
    };

    setLocalState(nextState);
    void broadcastSnapshot(nextState, 'join-request');
  }, [broadcastSnapshot, sendBroadcast, setLocalState]);

  const handleAnswerSubmission = useCallback((payload: SubmitAnswerPayload) => {
    if (!isHostRef.current) {
      return;
    }

    const currentState = stateRef.current;

    if (currentState.phase !== 'question' && currentState.phase !== 'profile') {
      return;
    }

    if (currentState.phase === 'profile') {
      const assignedQuestions = currentState.profileAssignments[payload.playerId] ?? [];
      const existingResponses = currentState.profileResponses[payload.playerId] ?? [];

      if (assignedQuestions.length === 0 || existingResponses.length >= assignedQuestions.length) {
        return;
      }

      const nextState = {
        ...currentState,
        profileResponses: {
          ...currentState.profileResponses,
          [payload.playerId]: [...existingResponses, payload.answerIndex],
        },
      };
      setLocalState(nextState);
      return;
    }

    let hasChanges = false;
    const nextPlayers = currentState.players.map(player => {
      if (player.id !== payload.playerId || player.currentAnswer !== null) {
        return player;
      }

      hasChanges = true;
      return {
        ...player,
        currentAnswer: payload.answerIndex,
      };
    });

    if (!hasChanges) {
      return;
    }

    const nextState = {
      ...currentState,
      players: nextPlayers,
    };

    setLocalState(nextState);
  }, [setLocalState]);

  const handleLeaveMessage = useCallback((payload: LeaveRoomPayload) => {
    if (!isHostRef.current) {
      return;
    }

    const currentState = stateRef.current;
    const targetPlayer = currentState.players.find(player => player.id === payload.playerId);

    if (!targetPlayer) {
      return;
    }

    const nextPlayers =
      currentState.phase === 'room' || currentState.phase === 'intro'
        ? currentState.players.filter(player => player.id !== payload.playerId)
        : currentState.players.map(player => (
          player.id === payload.playerId
            ? { ...player, isConnected: false }
            : player
        ));

    const nextState = {
      ...currentState,
      players: nextPlayers,
    };

    setLocalState(nextState);
    void broadcastSnapshot(nextState, 'player-left');
  }, [broadcastSnapshot, setLocalState]);

  const subscribeToRoom = useCallback(async (
    roomCode: string,
    options: {
      asHost: boolean;
      presenceKey: string;
      playerId?: string;
      initialState?: GameState;
      rejectIfOccupiedByHost?: boolean;
    },
  ) => {
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const client = supabase;

    await teardownChannel();
    isHostRef.current = options.asHost;

    const channel = client.channel(`heist-room:${roomCode}`, {
      config: {
        broadcast: { ack: true },
        presence: {
          enabled: true,
          key: options.presenceKey,
        },
      },
    });

    channel
      .on('broadcast', { event: 'state-sync' }, ({ payload }) => {
        const incomingState = coerceIncomingState(payload?.state);

        if (!incomingState || isHostRef.current) {
          return;
        }

        setLocalState(incomingState);

        const pendingJoin = pendingJoinRef.current;
        if (pendingJoin && incomingState.players.some(player => player.id === pendingJoin.playerId)) {
          window.clearTimeout(pendingJoin.timeoutId);
          pendingJoinRef.current = null;
          window.localStorage.setItem(STORAGE_KEYS.roomCode, incomingState.roomCode);
          window.localStorage.removeItem(STORAGE_KEYS.hostRoomCode);
          pendingJoin.resolve(pendingJoin.playerId);
        }
      })
      .on('broadcast', { event: 'request-state' }, () => {
        if (!isHostRef.current) {
          return;
        }

        void broadcastSnapshot(stateRef.current, 'request-state');
      })
      .on('broadcast', { event: 'join-request' }, ({ payload }) => {
        const parsedPayload = coerceJoinRequest(payload);
        if (parsedPayload) {
          handleJoinRequest(parsedPayload);
        }
      })
      .on('broadcast', { event: 'submit-answer' }, ({ payload }) => {
        const parsedPayload = coerceSubmitAnswer(payload);
        if (parsedPayload) {
          handleAnswerSubmission(parsedPayload);
        }
      })
      .on('broadcast', { event: 'leave-room' }, ({ payload }) => {
        const parsedPayload = coerceLeaveRoom(payload);
        if (parsedPayload) {
          handleLeaveMessage(parsedPayload);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        syncPresenceToHostState(channel);
      });

    channelRef.current = channel;

    await new Promise<void>((resolve, reject) => {
      channel.subscribe(async (status, error) => {
        if (status === 'SUBSCRIBED') {
          const presencePayload =
            options.asHost
              ? { role: 'host' }
              : { role: 'player', playerId: options.playerId };

          try {
            await channel.track(presencePayload);
          } catch (trackError) {
            console.error('Unable to track Supabase presence', trackError);
          }

          if (options.asHost && options.rejectIfOccupiedByHost) {
            const hostAlreadyPresent = await detectOtherHostPresence(channel, options.presenceKey);

            if (hostAlreadyPresent) {
              if (channelRef.current === channel) {
                channelRef.current = null;
              }

              try {
                await channel.untrack();
              } catch (error) {
                console.error('Unable to clear Supabase presence', error);
              }

              try {
                await client.removeChannel(channel);
              } catch (error) {
                console.error('Unable to remove Supabase channel', error);
              }

              reject(new Error(HOST_ROOM_CONFLICT_ERROR));
              return;
            }
          }

          if (options.asHost) {
            const initialState =
              options.initialState
              ?? readStoredSnapshot(roomCode)
              ?? createRealtimeRoomState(roomCode);

            window.localStorage.setItem(STORAGE_KEYS.roomCode, roomCode);
            window.localStorage.setItem(STORAGE_KEYS.hostRoomCode, roomCode);

            setLocalState(initialState);
            broadcastSnapshot(initialState, 'host-subscribed');
          } else {
            window.localStorage.setItem(STORAGE_KEYS.roomCode, roomCode);
            window.localStorage.removeItem(STORAGE_KEYS.hostRoomCode);
            sendBroadcast('request-state', { roomCode });
          }

          resolve();
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(error ?? new Error(`Supabase realtime channel failed with status ${status}`));
        }
      });
    });
  }, [
    broadcastSnapshot,
    handleAnswerSubmission,
    handleJoinRequest,
    handleLeaveMessage,
    sendBroadcast,
    setLocalState,
    syncPresenceToHostState,
    teardownChannel,
  ]);

  useEffect(() => {
    if (hasRestoredSessionRef.current || !supabase) {
      return;
    }

    const storedRoomCode = window.localStorage.getItem(STORAGE_KEYS.roomCode);

    if (!storedRoomCode) {
      hasRestoredSessionRef.current = true;
      return;
    }

    const hostRoomCode = window.localStorage.getItem(STORAGE_KEYS.hostRoomCode);
    const storedPlayerId = window.localStorage.getItem(STORAGE_KEYS.playerId);

    if (hostRoomCode === storedRoomCode) {
      if (!user) {
        return;
      }

      hasRestoredSessionRef.current = true;
      void subscribeToRoom(storedRoomCode, {
        asHost: true,
        presenceKey: createHostPresenceKey(user.id),
      });
      return;
    }

    hasRestoredSessionRef.current = true;
    void subscribeToRoom(storedRoomCode, {
      asHost: false,
      presenceKey: storedPlayerId ?? crypto.randomUUID(),
      playerId: storedPlayerId ?? undefined,
    });
  }, [subscribeToRoom, user]);

  useEffect(() => {
    if (!isHostRef.current || state.phase !== 'question') {
      return;
    }

    const activePlayers = state.players.filter(player => !player.isEliminated);
    const everyoneAnswered =
      activePlayers.length > 0
      && activePlayers.every(player => player.currentAnswer !== null);

    if (everyoneAnswered) {
      finalizeQuestionRound('all-answered');
      return;
    }

    if (!state.roundDeadlineAt) {
      return;
    }

    const timeoutMs = Math.max(0, new Date(state.roundDeadlineAt).getTime() - Date.now());
    const timeoutId = window.setTimeout(() => {
      finalizeQuestionRound('timer-expired');
    }, timeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [finalizeQuestionRound, state.phase, state.players, state.roundDeadlineAt]);

  useEffect(() => {
    if (!isHostRef.current || state.phase !== 'profile') {
      return;
    }

    const activePlayers = state.players.filter(player => !player.isEliminated);
    if (activePlayers.length === 0) {
      return;
    }

    const everyoneFinished = activePlayers.every(player => {
      const assigned = state.profileAssignments[player.id] ?? [];
      const answers = state.profileResponses[player.id] ?? [];
      return assigned.length > 0 && answers.length >= assigned.length;
    });

    if (everyoneFinished) {
      finalizeQuestionRound('profile-complete');
    }
  }, [finalizeQuestionRound, state.phase, state.players, state.profileAssignments, state.profileResponses]);

  useEffect(() => {
    return () => {
      if (persistSnapshotTimeoutRef.current !== null) {
        window.clearTimeout(persistSnapshotTimeoutRef.current);
      }
      if (pendingJoinRef.current) {
        window.clearTimeout(pendingJoinRef.current.timeoutId);
        pendingJoinRef.current.resolve(null);
        pendingJoinRef.current = null;
      }
      void teardownChannel();
    };
  }, [teardownChannel]);

  const createRoom = useCallback(async () => {
    if (!supabase || !user) {
      return;
    }

    for (let attempt = 0; attempt < HOST_ROOM_CLAIM_RETRIES; attempt += 1) {
      const roomCode = generateRoomCode();
      const initialState = createRealtimeRoomState(roomCode);

      try {
        await subscribeToRoom(roomCode, {
          asHost: true,
          presenceKey: createHostPresenceKey(user.id),
          initialState,
          rejectIfOccupiedByHost: true,
        });
        return;
      } catch (error) {
        if (error instanceof Error && error.message === HOST_ROOM_CONFLICT_ERROR) {
          continue;
        }

        console.error('Unable to subscribe host room', error);
        return;
      }
    }

    console.error('Unable to claim a unique realtime room code after multiple attempts');
  }, [subscribeToRoom, supabase, user]);

  const joinRoom = useCallback(async (roomCode: string, playerName: string): Promise<string | null> => {
    if (!supabase) {
      return null;
    }

    const normalizedRoomCode = roomCode.trim().toUpperCase();
    const normalizedName = playerName.trim().slice(0, 16);

    if (!normalizedRoomCode || !normalizedName) {
      return null;
    }

    const playerId = window.localStorage.getItem(STORAGE_KEYS.playerId) ?? crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEYS.playerId, playerId);

    return new Promise(resolve => {
      const timeoutId = window.setTimeout(() => {
        if (pendingJoinRef.current?.playerId === playerId) {
          pendingJoinRef.current = null;
        }

        void teardownChannel();
        window.localStorage.removeItem(STORAGE_KEYS.roomCode);
        resolve(null);
      }, JOIN_REQUEST_TIMEOUT_MS);

      pendingJoinRef.current = {
        playerId,
        resolve,
        timeoutId,
      };

      void subscribeToRoom(normalizedRoomCode, {
        asHost: false,
        presenceKey: playerId,
        playerId,
      }).then(() => {
        sendBroadcast('join-request', {
          roomCode: normalizedRoomCode,
          playerId,
          playerName: normalizedName,
        });
      }).catch(error => {
        console.error('Unable to subscribe player room', error);
        if (pendingJoinRef.current?.playerId === playerId) {
          window.clearTimeout(timeoutId);
          pendingJoinRef.current = null;
        }
        resolve(null);
      });
    });
  }, [sendBroadcast, subscribeToRoom, teardownChannel]);

  const leaveRoom = useCallback(async () => {
    const playerId = window.localStorage.getItem(STORAGE_KEYS.playerId);

    if (!isHostRef.current && playerId) {
      sendBroadcast('leave-room', { playerId });
    }

    await teardownChannel();

    isHostRef.current = false;
    window.localStorage.removeItem(STORAGE_KEYS.roomCode);
    window.localStorage.removeItem(STORAGE_KEYS.hostRoomCode);
    setLocalState(createInitialState());
  }, [sendBroadcast, setLocalState, teardownChannel]);

  const startGame = useCallback(async (options: GameStartOptions = {}) => {
    if (!isHostRef.current) {
      return;
    }

    commitHostState(previousState => ({
      ...previousState,
      isPreparingGame: true,
      preparationMessage: null,
    }), 'start-game:preparing');

    const { questionDeck, preparationMessage, customResponseHistorySeed } = await buildQuestionDeck(options);
    const openingQuestion = questionDeck[0] ?? getMockQuestion(0);

    commitHostState(previousState => ({
      ...previousState,
      phase: 'intro',
      questionDeck,
      profileAssignments: {},
      profileResponses: {},
      currentQuestion: openingQuestion,
      questionIndex: 0,
      totalQuestions: questionDeck.length,
      timeRemaining: GAME_CONFIG.questionTimerSeconds,
      timerDuration: GAME_CONFIG.questionTimerSeconds,
      roundDeadlineAt: null,
      results: null,
      customResponseHistory: customResponseHistorySeed,
      players: previousState.players.map(player => ({
        ...player,
        score: GAME_CONFIG.startingBalance,
        isEliminated: false,
        currentAnswer: null,
        minigameScore: 0,
      })),
      isPreparingGame: false,
      preparationMessage,
    }), 'start-game:ready');
  }, [commitHostState]);

  const simulateDevPlayerJoin = useCallback((characterIndex: number) => {
    if (import.meta.env.PROD || !isHostRef.current) {
      return;
    }

    commitHostState(previousState => {
      if (
        characterIndex < 0
        || characterIndex >= GAME_CONFIG.maxPlayers
        || previousState.players.length >= GAME_CONFIG.maxPlayers
        || previousState.players.some(player => player.characterIndex === characterIndex)
      ) {
        return previousState;
      }

      const nextPlayerNumber = previousState.players.length + 1;

      return {
        ...previousState,
        players: [
          ...previousState.players,
          {
            id: `dev-player-${characterIndex}-${crypto.randomUUID()}`,
            name: `Player ${nextPlayerNumber}`,
            characterIndex,
            score: GAME_CONFIG.startingBalance,
            isEliminated: false,
            isConnected: true,
            currentAnswer: null,
            minigameScore: 0,
          },
        ],
      };
    }, `dev-player:${characterIndex}`);
  }, [commitHostState]);

  const submitAnswer = useCallback((playerId: string, answerIndex: number) => {
    if (isHostRef.current) {
      return;
    }

    setLocalState(previousState => {
      if (previousState.phase === 'profile') {
        const assigned = previousState.profileAssignments[playerId] ?? [];
        const responses = previousState.profileResponses[playerId] ?? [];

        if (assigned.length === 0 || responses.length >= assigned.length) {
          return previousState;
        }

        return {
          ...previousState,
          profileResponses: {
            ...previousState.profileResponses,
            [playerId]: [...responses, answerIndex],
          },
        };
      }

      return {
        ...previousState,
        players: previousState.players.map(player => (
          player.id === playerId
            ? { ...player, currentAnswer: answerIndex }
            : player
        )),
      };
    });

    void sendBroadcast('submit-answer', { playerId, answerIndex });
  }, [sendBroadcast, setLocalState]);

  const submitMinigameAnswer = useCallback((_playerId: string, _answer: number) => {
    // Reserved for the next multiplayer iteration.
  }, []);

  const submitWager = useCallback((_playerId: string, _percentage: number) => {
    // Reserved for the next multiplayer iteration.
  }, []);

  const uploadPdf = useCallback((filename: string, uploadedBy: string | null) => {
    const status: 'pending' | 'ready' = uploadedBy ? 'pending' : 'ready';
    const nextEntry = {
      id: crypto.randomUUID(),
      filename,
      uploadedBy,
      status,
      enabled: false,
      questionCount: uploadedBy ? 0 : GAME_CONFIG.defaultQuestionCount,
    };

    commitHostState(previousState => ({
      ...previousState,
      pdfs: [...previousState.pdfs, nextEntry],
    }), 'pdf-uploaded');
  }, [commitHostState]);

  const togglePdf = useCallback((pdfId: string, enabled: boolean) => {
    commitHostState(previousState => ({
      ...previousState,
      pdfs: previousState.pdfs.map(pdf => (
        pdf.id === pdfId ? { ...pdf, enabled } : pdf
      )),
    }), 'pdf-toggled');
  }, [commitHostState]);

  const removePdf = useCallback((pdfId: string) => {
    commitHostState(previousState => ({
      ...previousState,
      pdfs: previousState.pdfs.filter(pdf => pdf.id !== pdfId),
    }), 'pdf-removed');
  }, [commitHostState]);

  const approvePdf = useCallback((pdfId: string) => {
    commitHostState(previousState => ({
      ...previousState,
      pdfs: previousState.pdfs.map(pdf => (
        pdf.id === pdfId
          ? {
            ...pdf,
            status: 'ready' as const,
            enabled: false,
            questionCount: pdf.questionCount || GAME_CONFIG.defaultQuestionCount,
          }
          : pdf
      )),
    }), 'pdf-approved');
  }, [commitHostState]);

  const rejectPdf = useCallback((pdfId: string) => {
    commitHostState(previousState => ({
      ...previousState,
      pdfs: previousState.pdfs.map(pdf => (
        pdf.id === pdfId ? { ...pdf, status: 'rejected' as const } : pdf
      )),
    }), 'pdf-rejected');
  }, [commitHostState]);

  const playAgain = useCallback(() => {
    commitHostState(playAgainState(stateRef.current), 'play-again');
  }, [commitHostState]);

  const setPhase = useCallback((phase: GamePhase) => {
    if (!isHostRef.current) {
      return;
    }

    if (phase === 'results') {
      finalizeQuestionRound('manual');
      return;
    }

    commitHostState(getStateForPhase(stateRef.current, phase), `set-phase:${phase}`);
  }, [commitHostState, finalizeQuestionRound]);

  const advancePhase = useCallback(() => {
    if (!isHostRef.current) {
      return;
    }

    const currentState = stateRef.current;

    switch (currentState.phase) {
      case 'home':
        commitHostState(getStateForPhase(currentState, 'room'), 'advance:home');
        break;
      case 'room':
        commitHostState(getStateForPhase(currentState, 'intro'), 'advance:room');
        break;
      case 'intro':
        if (shouldUseProfilePhase(currentState, currentState.questionIndex)) {
          commitHostState(createProfilePhaseState(currentState, currentState.questionIndex), 'advance:intro-profile');
        } else {
          commitHostState(getStateForPhase(currentState, 'question'), 'advance:intro');
        }
        break;
      case 'question':
        finalizeQuestionRound('manual-advance');
        break;
      case 'results':
        commitHostState(getStateForPhase(currentState, 'leaderboard'), 'advance:results');
        break;
      case 'leaderboard': {
        const nextIndex = currentState.questionIndex + 1;
        const deckLength = currentState.questionDeck.length || GAME_CONFIG.defaultQuestionCount;

        if (nextIndex < deckLength) {
          const preparedState = maybePrepareCustomFollowUpQuestion(currentState, nextIndex);
          commitHostState(createQuestionPhaseState(preparedState, nextIndex), 'advance:leaderboard');
        } else {
          commitHostState(getStateForPhase(currentState, 'win'), 'advance:leaderboard-win');
        }
        break;
      }
      case 'win':
      case 'gameover':
        commitHostState(playAgainState(currentState), 'advance:reset');
        break;
      default:
        break;
    }
  }, [commitHostState, finalizeQuestionRound]);

  const actions: GameActions = useMemo(() => ({
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    simulateDevPlayerJoin,
    submitAnswer,
    submitMinigameAnswer,
    submitWager,
    uploadPdf,
    togglePdf,
    removePdf,
    approvePdf,
    rejectPdf,
    playAgain,
    setPhase,
    advancePhase,
  }), [
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    simulateDevPlayerJoin,
    submitAnswer,
    submitMinigameAnswer,
    submitWager,
    uploadPdf,
    togglePdf,
    removePdf,
    approvePdf,
    rejectPdf,
    playAgain,
    setPhase,
    advancePhase,
  ]);

  return (
    <GameContext.Provider value={{ state, actions }}>
      {children}
    </GameContext.Provider>
  );
}

async function buildQuestionDeck(options: GameStartOptions) {
  const requestedGameQuestions = options.customPack?.numQuestions ?? GAME_CONFIG.defaultQuestionCount;
  const totalQuestions =
    options.customPack
      ? requestedGameQuestions + CUSTOM_PROFILE_QUESTION_COUNT
      : requestedGameQuestions;
  const fallbackDeck = Array.from(
    { length: totalQuestions },
    (_unused, index) => getMockQuestion(index)
  );
  if (options.customPack) {
    try {
      const customQuestions = await fetchCustomPackQuestionsFromSupabase(
        {
          ...options.customPack,
          numQuestions: totalQuestions,
        },
        options.playerNames ?? []
      );
      console.log('[custom-pack] Loaded Supabase questions:', customQuestions);

      if (customQuestions.length > 0) {
        const customResponseHistorySeed = await fetchStoredCustomProfileHistory(
          options.customPack.style,
          options.playerIds ?? []
        );
        return {
          questionDeck: customQuestions,
          preparationMessage: null,
          customResponseHistorySeed,
        };
      }
    } catch (error) {
      console.error('Unable to build custom Supabase-backed deck', error);
      const reason = error instanceof Error ? error.message : 'Unknown error';
      return {
        questionDeck: fallbackDeck,
        preparationMessage: `Custom pack loading failed (${reason}). Using the local fallback deck.`,
        customResponseHistorySeed: [],
      };
    }
  }

  const selectedCategories = Array.from(
    new Set((options.polymarketCategories ?? []).map(category => category.trim()).filter(Boolean))
  );

  if (selectedCategories.length === 0) {
    return {
      questionDeck: fallbackDeck,
      preparationMessage: 'No live market categories were selected, so this round uses the local fallback deck.',
      customResponseHistorySeed: [],
    };
  }

  try {
    const liveQuestions = await fetchPolymarketQuestionDeck(
      selectedCategories,
      GAME_CONFIG.defaultQuestionCount
    );

    if (liveQuestions.length >= GAME_CONFIG.minQuestionCount) {
      return {
        questionDeck: liveQuestions,
        preparationMessage: null,
        customResponseHistorySeed: [],
      };
    }

    if (liveQuestions.length > 0) {
      return {
        questionDeck: [...liveQuestions, ...fallbackDeck].slice(0, GAME_CONFIG.defaultQuestionCount),
        preparationMessage: 'Live markets were limited, so the remaining slots were filled with local fallback questions.',
        customResponseHistorySeed: [],
      };
    }
  } catch (error) {
    console.error('Unable to build Polymarket-backed deck', error);
  }

  return {
    questionDeck: fallbackDeck,
    preparationMessage: 'Polymarket was unavailable, so this round fell back to the local question deck.',
    customResponseHistorySeed: [],
  };
}

async function fetchStoredCustomProfileHistory(style: string, playerIds: string[]) {
  if (!supabase || playerIds.length === 0) {
    return [] as CustomResponseHistoryItem[];
  }

  const { data, error } = await supabase
    .from('player_custom_profiles')
    .select('player_id,question_id,question_text,answer_text,answered_at')
    .eq('style', style)
    .in('player_id', playerIds)
    .order('answered_at', { ascending: false })
    .limit(300);

  if (error || !Array.isArray(data)) {
    if (error) {
      console.error('Unable to load stored custom profile history', error);
    }
    return [] as CustomResponseHistoryItem[];
  }

  const grouped = new Map<string, {
    questionId: string;
    question: string;
    options: string[];
    playerAnswers: Record<string, number | null>;
  }>();

  for (const row of data) {
    const questionId = String(row.question_id ?? '');
    const questionText = String(row.question_text ?? '');
    const playerId = String(row.player_id ?? '');
    const answerText = String(row.answer_text ?? '').trim();

    if (!questionId || !questionText || !playerId || !answerText) {
      continue;
    }

    const key = `${questionId}::${questionText}`;
    const entry = grouped.get(key) ?? {
      questionId,
      question: questionText,
      options: [],
      playerAnswers: {},
    };

    let answerIndex = entry.options.indexOf(answerText);
    if (answerIndex === -1 && entry.options.length < 4) {
      entry.options.push(answerText);
      answerIndex = entry.options.length - 1;
    }
    if (answerIndex === -1) {
      answerIndex = 0;
    }

    entry.playerAnswers[playerId] = answerIndex;
    grouped.set(key, entry);
  }

  return Array.from(grouped.values())
    .map(entry => ({
      questionId: `stored-${entry.questionId}`,
      question: entry.question,
      choices: entry.options.length > 0 ? entry.options : ['Option A', 'Option B', 'Option C', 'Option D'],
      playerAnswers: entry.playerAnswers,
    }))
    .filter(entry => entry.choices.length > 0);
}

async function persistCustomProfileAnswers(
  profileAssignments: Record<string, Question[]>,
  profileResponses: Record<string, number[]>,
  players: PlayerState[]
) {
  if (!supabase) {
    return;
  }

  const rows = players
    .filter(player =>
      profileAssignments[player.id] !== undefined
      && Array.isArray(profileResponses[player.id])
      && profileResponses[player.id].length > 0
    )
    .map(player => {
      const assignedQuestions = profileAssignments[player.id] ?? [];
      const answers = profileResponses[player.id] ?? [];

      return assignedQuestions
        .slice(0, answers.length)
        .map((question, index) => {
          const style = getCustomStyleFromQuestion(question);
          if (!style) {
            return null;
          }
          const answerIndex = Number(answers[index]);
          const answerText = question.choices[answerIndex] ?? null;
          return {
            player_id: player.id,
            player_name: player.name,
            style,
            question_id: question.id,
            question_text: question.question,
            answer_index: answerIndex,
            answer_text: answerText,
          };
        });
    })
    .flat()
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from('player_custom_profiles')
    .upsert(rows, { onConflict: 'player_id,question_id' });

  if (error) {
    console.error('Unable to persist custom profile answers', error);
  }
}

function createRealtimeRoomState(roomCode: string): GameState {
  return {
    ...createInitialState(),
    roomCode,
    phase: 'room',
  };
}

function getStateForPhase(previousState: GameState, phase: GamePhase): GameState {
  switch (phase) {
    case 'home':
      return {
        ...createInitialState(),
      };
    case 'room':
      return {
        ...playAgainState(previousState),
        phase,
      };
    case 'intro':
      return {
        ...previousState,
        phase,
        roundDeadlineAt: null,
        timeRemaining: GAME_CONFIG.questionTimerSeconds,
        timerDuration: GAME_CONFIG.questionTimerSeconds,
      };
    case 'question':
      return createQuestionPhaseState(previousState, previousState.questionIndex);
    case 'profile':
      return createProfilePhaseState(previousState, previousState.questionIndex);
    case 'results':
      return createResultsPhaseState(previousState);
    case 'leaderboard':
      return {
        ...previousState,
        phase,
        roundDeadlineAt: null,
      };
    case 'win':
      return {
        ...previousState,
        phase,
        roundDeadlineAt: null,
        winnerId: getWinnerId(previousState.players),
      };
    case 'gameover':
      return {
        ...previousState,
        phase,
        roundDeadlineAt: null,
        winnerId: null,
      };
    default:
      return previousState;
  }
}

function createQuestionPhaseState(previousState: GameState, questionIndex: number): GameState {
  const deckLength = previousState.questionDeck.length || GAME_CONFIG.defaultQuestionCount;
  const boundedIndex = Math.max(0, Math.min(questionIndex, deckLength - 1));
  const question = previousState.questionDeck[boundedIndex] ?? getMockQuestion(boundedIndex);
  const roundDeadlineAt = new Date(
    Date.now() + GAME_CONFIG.questionTimerSeconds * 1000
  ).toISOString();

  return {
    ...previousState,
    phase: 'question',
    profileAssignments: {},
    profileResponses: {},
    currentQuestion: question,
    questionIndex: boundedIndex,
    totalQuestions: previousState.questionDeck.length || previousState.totalQuestions,
    timeRemaining: GAME_CONFIG.questionTimerSeconds,
    timerDuration: GAME_CONFIG.questionTimerSeconds,
    roundDeadlineAt,
    results: null,
    players: resetPlayerAnswers(previousState.players),
  };
}

function createProfilePhaseState(previousState: GameState, questionIndex: number): GameState {
  const deckLength = previousState.questionDeck.length || GAME_CONFIG.defaultQuestionCount;
  const boundedIndex = Math.max(0, Math.min(questionIndex, deckLength - 1));
  const profileAssignments =
    Object.keys(previousState.profileAssignments).length > 0
      ? previousState.profileAssignments
      : buildProfileAssignments(previousState, boundedIndex);
  const question = Object.values(profileAssignments)[0]?.[0] ?? previousState.questionDeck[boundedIndex] ?? getMockQuestion(boundedIndex);

  return {
    ...previousState,
    phase: 'profile',
    profileAssignments,
    profileResponses: previousState.profileResponses ?? {},
    currentQuestion: question,
    questionIndex: boundedIndex,
    totalQuestions: previousState.questionDeck.length || previousState.totalQuestions,
    timeRemaining: GAME_CONFIG.questionTimerSeconds,
    timerDuration: GAME_CONFIG.questionTimerSeconds,
    roundDeadlineAt: null,
    results: null,
    players: resetPlayerAnswers(previousState.players),
  };
}

function createAfterProfilePhaseState(previousState: GameState): GameState {
  const nextHistory = appendProfileAssignmentsHistory(previousState);
  const deckLength = previousState.questionDeck.length || GAME_CONFIG.defaultQuestionCount;
  const nextIndex = Math.min(CUSTOM_PROFILE_QUESTION_COUNT, deckLength);

  if (nextIndex >= deckLength || deckLength === 0) {
    return getStateForPhase(
      {
        ...previousState,
        profileAssignments: {},
        profileResponses: {},
        customResponseHistory: nextHistory,
      },
      'win'
    );
  }

  return createQuestionPhaseState(
    {
      ...previousState,
      profileAssignments: {},
      profileResponses: {},
      customResponseHistory: nextHistory,
    },
    nextIndex
  );
}

function createResultsPhaseState(previousState: GameState): GameState {
  if (previousState.phase === 'results' && previousState.results) {
    return previousState;
  }

  const currentQuestion =
    previousState.currentQuestion
    ?? previousState.questionDeck[previousState.questionIndex]
    ?? getMockQuestion(previousState.questionIndex);
  const results = buildQuestionResults(previousState.players, currentQuestion.correct);
  const nextHistory = appendCustomResponseHistory(previousState, currentQuestion, results);

  return {
    ...previousState,
    phase: 'results',
    currentQuestion,
    roundDeadlineAt: null,
    timeRemaining: 0,
    results,
    players: previousState.players.map(player => (
      results.playerAnswers[player.id] === currentQuestion.correct
        ? { ...player, score: player.score + GAME_CONFIG.correctAnswerReward }
        : player
    )),
    customResponseHistory: nextHistory,
  };
}

function appendCustomResponseHistory(
  previousState: GameState,
  currentQuestion: Question,
  results: QuestionResult
) {
  if (!isCustomQuestion(currentQuestion)) {
    return previousState.customResponseHistory;
  }

  if (
    previousState.customResponseHistory.some(historyItem => historyItem.questionId === currentQuestion.id)
  ) {
    return previousState.customResponseHistory;
  }

  const historyItem: CustomResponseHistoryItem = {
    questionId: currentQuestion.id,
    question: currentQuestion.question,
    choices: currentQuestion.choices,
    playerAnswers: results.playerAnswers,
  };

  return [...previousState.customResponseHistory, historyItem];
}

function isCustomQuestion(question: Question | null | undefined) {
  if (!question) return false;
  const category = (question.category ?? '').toLowerCase();
  return category.startsWith('custom pack');
}

function shouldUseProfilePhase(state: GameState, questionIndex: number) {
  if (questionIndex >= CUSTOM_PROFILE_QUESTION_COUNT) {
    return false;
  }
  const question = state.questionDeck[questionIndex];
  return isCustomQuestion(question);
}

function buildProfileAssignments(state: GameState, questionIndex: number) {
  const activePlayers = state.players.filter(player => !player.isEliminated);
  if (activePlayers.length === 0) {
    return {} as Record<string, Question[]>;
  }

  const sourceQuestions = state.questionDeck.filter(question =>
    isCustomQuestion(question) && !question.keywords.includes('custom-follow-up')
  );
  if (sourceQuestions.length === 0) {
    return {} as Record<string, Question[]>;
  }

  const startIndex = questionIndex * activePlayers.length;
  const assignments: Record<string, Question[]> = {};

  activePlayers.forEach((player, playerIdx) => {
    const others = state.players
      .filter(candidate => candidate.id !== player.id)
      .map(candidate => candidate.name)
      .filter(Boolean);

    assignments[player.id] = Array.from({ length: CUSTOM_PROFILE_QUESTION_COUNT }, (_unused, slot) => {
      const template = sourceQuestions[(startIndex + playerIdx + slot * activePlayers.length) % sourceQuestions.length];
      return personalizeProfileQuestionForPlayer(template, player.name, others);
    });
  });

  return assignments;
}

function personalizeProfileQuestionForPlayer(question: Question, playerName: string, otherNames: string[]) {
  const otherName = otherNames[0] ?? 'someone in your group';

  return {
    ...question,
    question: applyTemplate(question.question, playerName, otherName),
    choices: question.choices.map(choice => applyTemplate(choice, playerName, otherName)),
  };
}

function applyTemplate(text: string, playerName: string, otherName: string) {
  return text
    .split('{player}').join(playerName)
    .split('{other}').join(otherName);
}

function appendProfileAssignmentsHistory(previousState: GameState) {
  const nextByQuestionId = new Map<string, CustomResponseHistoryItem>(
    previousState.customResponseHistory.map(item => [item.questionId, item])
  );

  previousState.players.forEach(player => {
    const assignedQuestions = previousState.profileAssignments[player.id] ?? [];
    const answers = previousState.profileResponses[player.id] ?? [];
    if (assignedQuestions.length === 0 || answers.length === 0) {
      return;
    }

    assignedQuestions.slice(0, answers.length).forEach((assignedQuestion, idx) => {
      const existing = nextByQuestionId.get(assignedQuestion.id) ?? {
        questionId: assignedQuestion.id,
        question: assignedQuestion.question,
        choices: assignedQuestion.choices,
        playerAnswers: {},
      };

      existing.playerAnswers[player.id] = Number(answers[idx]);
      nextByQuestionId.set(assignedQuestion.id, existing);
    });
  });

  return Array.from(nextByQuestionId.values());
}

function getCustomStyleFromQuestion(question: Question) {
  const styleFromKeywords = question.keywords.find(keyword => CUSTOM_STYLES.has(keyword));
  if (styleFromKeywords) {
    return styleFromKeywords;
  }

  const category = (question.category ?? '').toLowerCase();
  if (category.includes('kid-friendly')) return 'kid-friendly';
  if (category.includes('for-friends')) return 'for-friends';
  if (category.includes('for-family')) return 'for-family';
  if (category.includes('funny')) return 'funny';
  return null;
}

function maybePrepareCustomFollowUpQuestion(previousState: GameState, nextIndex: number) {
  const nextQuestion = previousState.questionDeck[nextIndex];
  if (!isCustomQuestion(nextQuestion)) {
    return previousState;
  }

  if (nextIndex < CUSTOM_PROFILE_QUESTION_COUNT) {
    return previousState;
  }

  if (nextQuestion?.keywords?.includes('custom-follow-up')) {
    return previousState;
  }

  const generated = buildPersonalizedFollowUpQuestion(previousState, nextIndex);
  if (!generated) {
    return previousState;
  }

  const nextDeck = [...previousState.questionDeck];
  nextDeck[nextIndex] = generated;

  return {
    ...previousState,
    questionDeck: nextDeck,
  };
}

function buildPersonalizedFollowUpQuestion(previousState: GameState, nextIndex: number): Question | null {
  const historyWithAnswers = previousState.customResponseHistory.filter(item =>
    Object.values(item.playerAnswers).some(answer => typeof answer === 'number' && answer >= 0)
  );
  if (historyWithAnswers.length === 0) {
    return null;
  }

  const randomHistory = historyWithAnswers[Math.floor(Math.random() * historyWithAnswers.length)];
  const answeredPlayerIds = Object.entries(randomHistory.playerAnswers)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] >= 0)
    .map(([playerId, answer]) => ({ playerId, answer }));

  if (answeredPlayerIds.length === 0) {
    return null;
  }

  const target = answeredPlayerIds[Math.floor(Math.random() * answeredPlayerIds.length)];
  const targetPlayer = previousState.players.find(player => player.id === target.playerId);
  if (!targetPlayer) {
    return null;
  }

  const chosenOption = randomHistory.choices[target.answer] ?? 'that option';
  const allPlayerNames = previousState.players.map(player => player.name).filter(Boolean);
  const distractors = shuffleArray(allPlayerNames.filter(name => name !== targetPlayer.name));
  const choicePool = [targetPlayer.name, ...distractors].slice(0, 4);
  while (choicePool.length < 4) {
    choicePool.push(`Player ${choicePool.length + 1}`);
  }
  const choices = shuffleArray(choicePool);
  const correct = Math.max(0, choices.indexOf(targetPlayer.name));

  const probabilities = choices.map((_, index) => {
    if (index === correct) return 0.58;
    return 0.14;
  });

  return {
    id: `custom-follow-up-${nextIndex}-${crypto.randomUUID()}`,
    question: `For "${randomHistory.question}", who picked "${chosenOption}"?`,
    choices,
    correct,
    probabilities,
    keywords: ['custom-pack', 'custom-follow-up', 'player-history'],
    category: 'Custom Pack: About Your Crew',
    source: null,
  };
}

function shuffleArray<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function buildQuestionResults(players: PlayerState[], correctIndex: number): QuestionResult {
  return {
    correctIndex,
    playerAnswers: Object.fromEntries(
      players.map(player => [player.id, player.currentAnswer ?? null])
    ),
  };
}

function resetPlayerAnswers(players: PlayerState[]) {
  return players.map(player => ({ ...player, currentAnswer: null }));
}

function getWinnerId(players: PlayerState[]) {
  if (players.length === 0) {
    return null;
  }

  return [...players]
    .sort((left, right) => right.score - left.score)[0]
    ?.id ?? null;
}

function playAgainState(previousState: GameState): GameState {
  return {
    ...createInitialState(),
    roomCode: previousState.roomCode,
    players: previousState.players.map(player => ({
      ...player,
      score: GAME_CONFIG.startingBalance,
      isEliminated: false,
      currentAnswer: null,
      minigameScore: 0,
    })),
    pdfs: previousState.pdfs,
    phase: 'room',
  };
}

function getTimeRemaining(roundDeadlineAt: string): number {
  const deadlineMs = new Date(roundDeadlineAt).getTime();
  const diffMs = deadlineMs - Date.now();

  return Math.max(0, Math.ceil(diffMs / 1000));
}

function getSnapshotStorageKey(roomCode: string) {
  return `${SNAPSHOT_PREFIX}${roomCode}`;
}

function createHostPresenceKey(userId: string) {
  return `host:${userId}:${crypto.randomUUID()}`;
}

async function detectOtherHostPresence(
  channel: RealtimeChannel,
  ownPresenceKey: string,
  attempts = 4,
  delayMs = 120,
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const presenceState = channel.presenceState<PresencePayload>();
    const hasOtherHost = Object.entries(presenceState).some(([presenceKey, entries]) =>
      presenceKey !== ownPresenceKey
      && entries.some(entry => entry.role === 'host')
    );

    if (hasOtherHost) {
      return true;
    }

    await new Promise(resolve => {
      window.setTimeout(resolve, delayMs);
    });
  }

  return false;
}

function readStoredSnapshot(roomCode: string): GameState | null {
  const rawSnapshot = window.localStorage.getItem(getSnapshotStorageKey(roomCode));

  if (!rawSnapshot) {
    return null;
  }

  try {
    return coerceIncomingState(JSON.parse(rawSnapshot));
  } catch (error) {
    console.error('Unable to restore host room snapshot', error);
    return null;
  }
}

function coerceIncomingState(value: unknown): GameState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<GameState>;

  if (typeof candidate.roomCode !== 'string' || typeof candidate.phase !== 'string') {
    return null;
  }

  return {
    ...createInitialState(),
    ...candidate,
    roundDeadlineAt: candidate.roundDeadlineAt ?? null,
    players: Array.isArray(candidate.players) ? candidate.players : [],
    questionDeck: Array.isArray(candidate.questionDeck) ? candidate.questionDeck : [],
    pdfs: Array.isArray(candidate.pdfs) ? candidate.pdfs : [],
    timeRemaining:
      typeof candidate.timeRemaining === 'number'
        ? candidate.timeRemaining
        : GAME_CONFIG.questionTimerSeconds,
    timerDuration:
      typeof candidate.timerDuration === 'number'
        ? candidate.timerDuration
        : GAME_CONFIG.questionTimerSeconds,
    totalQuestions:
      typeof candidate.totalQuestions === 'number'
        ? candidate.totalQuestions
        : GAME_CONFIG.defaultQuestionCount,
    profileAssignments:
      candidate.profileAssignments && typeof candidate.profileAssignments === 'object'
        ? candidate.profileAssignments as Record<string, Question[]>
        : {},
    profileResponses:
      candidate.profileResponses && typeof candidate.profileResponses === 'object'
        ? candidate.profileResponses as Record<string, number[]>
        : {},
    customResponseHistory: Array.isArray(candidate.customResponseHistory)
      ? candidate.customResponseHistory
      : [],
  };
}

function coerceJoinRequest(value: unknown): JoinRequestPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Partial<JoinRequestPayload>;

  if (
    typeof payload.roomCode !== 'string'
    || typeof payload.playerId !== 'string'
    || typeof payload.playerName !== 'string'
  ) {
    return null;
  }

  return payload as JoinRequestPayload;
}

function coerceSubmitAnswer(value: unknown): SubmitAnswerPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Partial<SubmitAnswerPayload>;

  if (typeof payload.playerId !== 'string' || typeof payload.answerIndex !== 'number') {
    return null;
  }

  return payload as SubmitAnswerPayload;
}

function coerceLeaveRoom(value: unknown): LeaveRoomPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Partial<LeaveRoomPayload>;

  if (typeof payload.playerId !== 'string') {
    return null;
  }

  return payload as LeaveRoomPayload;
}
