import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useLocation } from 'react-router-dom';
import { GameContext, type GameActions } from './GameContext';
import type {
  CustomResponseHistoryItem,
  CustomQuestionPack,
  FriendGroupPackStyle,
  FriendGroupPackSettings,
  GamePhase,
  GameStartOptions,
  GameState,
  PendingFriendGroupPackDraft,
  ProfileResponseValue,
  Question,
  QuestionResult,
} from '@/types/game';
import type { PlayerState } from '@/types/player';
import { GAME_CONFIG } from '@/constants/gameConfig';
import { fetchPolymarketQuestionDeck } from '@/services/polymarket/questions';
import { listCustomQuestionPacks, normalizePackQuestions } from '@/services/customQuestionPacks';
import {
  buildLocalFriendGroupCustomPackQuestions,
  fetchFriendGroupCustomPackQuestions,
} from '@/services/friendGroupCustomPack';
import { getLocalFriendGroupQuestionSeeds } from '@/services/friendGroupQuestionSeeds';
import { supabase } from '@/services/supabaseClient';
import { useAuth } from '@/auth/AuthContext';
import { getBrowserStorage } from '@/shared/services/browserStorage';
import {
  createInitialState,
  generateRoomCode,
  getMockQuestion,
} from './mockData';

const STORAGE_KEYS = {
  roomCode: 'heist_room_code',
  playerId: 'heist_player_id',
  playerName: 'heist_player_name',
  hostRoomCode: 'heist_host_room_code',
} as const;

const SNAPSHOT_PREFIX = 'heist_host_snapshot:';
const JOIN_REQUEST_TIMEOUT_MS = 12000;
const RESTORE_SYNC_TIMEOUT_MS = 6000;
const PLAYER_STATE_STALE_AFTER_MS = 7000;
const RECONNECT_BASE_DELAY_MS = 800;
const RECONNECT_MAX_DELAY_MS = 5000;
const HOST_ROOM_CLAIM_RETRIES = 12;
const HOST_ROOM_CONFLICT_ERROR = 'HOST_ROOM_CONFLICT';
const DEFAULT_FRIEND_GROUP_PROFILE_QUESTION_COUNT = 3;
const FRIEND_GROUP_PROFILE_TIMER_SECONDS = 60;
const DEFAULT_PROFILE_RESPONSE_MAX_LENGTH = 30;
const FRIEND_GROUP_PACK_STYLES = new Set<FriendGroupPackStyle>([
  'kid-friendly',
  'for-friends',
  'for-family',
  'funny',
  'outta-pocket',
]);

interface JoinRequestPayload {
  roomCode: string;
  playerId: string;
  playerName: string;
}

interface SubmitAnswerPayload {
  playerId: string;
  answer: ProfileResponseValue;
}

interface LeaveRoomPayload {
  playerId: string;
}

interface PresencePayload {
  role: 'host' | 'player';
  playerId?: string;
}

function normalizeProfileResponseValue(
  question: Question | undefined,
  response: ProfileResponseValue,
) {
  if (question?.profileResponseMode === 'free-text') {
    const maxLength = question.profileResponseMaxLength ?? DEFAULT_PROFILE_RESPONSE_MAX_LENGTH;
    const textValue = String(response ?? '').trim().slice(0, maxLength);
    return textValue || null;
  }

  if (typeof response !== 'number' || !Number.isInteger(response) || response < 0) {
    return null;
  }

  return response;
}

type StateUpdater = GameState | ((previousState: GameState) => GameState);

function pickRandomItem<T>(items: T[]) {
  if (items.length === 0) {
    return undefined;
  }

  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex];
}

function normalizeSelectedPolymarketCategories(categories: string[]) {
  return Array.from(
    new Set(categories.map(category => category.trim()).filter(Boolean))
  );
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<GameState>(createInitialState);
  const storage = getBrowserStorage();

  const stateRef = useRef(state);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const latestReceivedStateSyncAtRef = useRef(0);
  const channelStatusRef = useRef<'idle' | 'connecting' | 'subscribed'>('idle');
  const isHostRef = useRef(false);
  const isFinalizingQuestionRef = useRef(false);
  const isCreatingRoomRef = useRef(false);
  const persistSnapshotTimeoutRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const resumeSessionRef = useRef<(reason: string) => void>(() => {});
  const activeSessionRef = useRef<{
    role: 'host' | 'player' | null;
    roomCode: string | null;
    playerId: string | null;
  }>({
    role: null,
    roomCode: null,
    playerId: null,
  });
  const pendingJoinRef = useRef<{
    playerId: string;
    resolve: (playerId: string | null) => void;
    timeoutId: number;
    retryIntervalId: number | null;
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
        storage.setItem(getSnapshotStorageKey(state.roomCode), JSON.stringify(stateRef.current));
        persistSnapshotTimeoutRef.current = null;
      }, 150);
    }
  }, [state, storage]);

  const clearScheduledReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

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

  const disposeChannel = useCallback(async (channel: RealtimeChannel | null) => {
    if (!channel || !supabase) {
      return;
    }

    try {
      await channel.untrack();
    } catch (error) {
      console.error('Unable to clear Supabase presence', error);
    }

    try {
      await supabase.removeChannel(channel);
    } catch (error) {
      console.error('Unable to remove Supabase channel', error);
    }
  }, []);

  const scheduleReconnect = useCallback((reason: string) => {
    const activeSession = activeSessionRef.current;

    if (!activeSession.role || !activeSession.roomCode || reconnectTimeoutRef.current !== null) {
      return;
    }

    reconnectAttemptRef.current += 1;
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * (2 ** Math.max(0, reconnectAttemptRef.current - 1)),
      RECONNECT_MAX_DELAY_MS,
    );

    reconnectTimeoutRef.current = window.setTimeout(() => {
      reconnectTimeoutRef.current = null;

      if (!activeSessionRef.current.role || channelStatusRef.current === 'subscribed') {
        return;
      }

      resumeSessionRef.current(reason);
    }, delay);
  }, []);

  const teardownChannel = useCallback(async () => {
    const activeChannel = channelRef.current;
    clearScheduledReconnect();

    activeSessionRef.current = {
      role: null,
      roomCode: null,
      playerId: null,
    };
    isHostRef.current = false;
    latestReceivedStateSyncAtRef.current = 0;
    channelStatusRef.current = 'idle';
    reconnectAttemptRef.current = 0;

    if (!activeChannel) {
      channelRef.current = null;
      return;
    }

    channelRef.current = null;

    await disposeChannel(activeChannel);
  }, [clearScheduledReconnect, disposeChannel]);

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

    sendBroadcast('state-sync', { reason, state: snapshot, sentAt: Date.now() });
  }, [sendBroadcast]);

  const sendJoinHandshake = useCallback((roomCode: string, playerId: string, playerName: string) => {
    sendBroadcast('request-state', { roomCode });
    sendBroadcast('join-request', {
      roomCode,
      playerId,
      playerName,
    });
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

  const updateResourceState = useCallback((updater: StateUpdater, reason: string) => {
    if (isHostRef.current && stateRef.current.roomCode) {
      commitHostState(updater, reason);
      return;
    }

    setLocalState(updater);
  }, [commitHostState, setLocalState]);

  const finalizeQuestionRound = useCallback((reason: string) => {
    if (!isHostRef.current || isFinalizingQuestionRef.current) {
      return;
    }

    isFinalizingQuestionRef.current = true;

    try {
      const currentState = stateRef.current;

      if (currentState.phase === 'profile') {
        void persistFriendGroupProfileAnswers(
          currentState.profileAssignments,
          currentState.profileResponses,
          currentState.players
        );
        commitHostState(createAfterProfilePhaseState(currentState), `profile:${reason}`);
      } else {
        commitHostState(createResultsPhaseState(currentState), `results:${reason}`);
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
    void broadcastSnapshot(nextState, 'presence-sync');
  }, [broadcastSnapshot, setLocalState]);

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
      if (existingPlayer.name === normalizedName && existingPlayer.isConnected) {
        void broadcastSnapshot(currentState, 'join-request-refresh');
        return;
      }

      nextPlayers = currentState.players.map(player => (
        player.id === existingPlayer.id
          ? { ...player, name: normalizedName, isConnected: true }
          : player
      ));
    } else {
      const usedIndices = new Set(currentState.players.map(player => player.characterIndex));
      const availableCharacterIndices = Array.from(
        { length: GAME_CONFIG.maxPlayers },
        (_unused, index) => index
      ).filter(index => !usedIndices.has(index));
      const characterIndex = pickRandomItem(availableCharacterIndices) ?? 0;

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
      const activeQuestion = assignedQuestions[existingResponses.length];
      const normalizedResponse = normalizeProfileResponseValue(activeQuestion, payload.answer);

      if (existingResponses.length >= assignedQuestions.length || normalizedResponse === null) {
        return;
      }

      const nextState = {
        ...currentState,
        profileResponses: {
          ...currentState.profileResponses,
          [payload.playerId]: [...existingResponses, normalizedResponse],
        },
      };

      setLocalState(nextState);
      void broadcastSnapshot(nextState, 'submit-answer');
      return;
    }

    let hasChanges = false;
    if (typeof payload.answer !== 'number' || !Number.isInteger(payload.answer)) {
      return;
    }

    const submittedAnswer = payload.answer;
    const nextPlayers = currentState.players.map(player => {
      if (player.id !== payload.playerId || player.currentAnswer !== null) {
        return player;
      }

      hasChanges = true;
      return {
        ...player,
        currentAnswer: submittedAnswer,
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
    void broadcastSnapshot(nextState, 'submit-answer');
  }, [broadcastSnapshot, setLocalState]);

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
      currentState.phase === 'room'
      || currentState.phase === 'intro'
      || currentState.phase === 'win'
      || currentState.phase === 'gameover'
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
      playerName?: string;
      initialState?: GameState;
      rejectIfOccupiedByHost?: boolean;
    },
  ) => {
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const client = supabase;
    let hasReceivedStateSync = false;

    await teardownChannel();
    isHostRef.current = options.asHost;
    latestReceivedStateSyncAtRef.current = 0;
    channelStatusRef.current = 'connecting';

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
        const incomingSentAt =
          typeof payload?.sentAt === 'number' && Number.isFinite(payload.sentAt)
            ? payload.sentAt
            : 0;

        if (!incomingState || isHostRef.current) {
          return;
        }

        if (incomingSentAt > 0 && incomingSentAt < latestReceivedStateSyncAtRef.current) {
          return;
        }

        if (incomingSentAt > 0) {
          latestReceivedStateSyncAtRef.current = incomingSentAt;
        } else {
          latestReceivedStateSyncAtRef.current = Date.now();
        }

        hasReceivedStateSync = true;
        setLocalState(incomingState);

        const pendingJoin = pendingJoinRef.current;
        if (pendingJoin && incomingState.players.some(player => player.id === pendingJoin.playerId)) {
          window.clearTimeout(pendingJoin.timeoutId);
          if (pendingJoin.retryIntervalId !== null) {
            window.clearInterval(pendingJoin.retryIntervalId);
          }
          pendingJoinRef.current = null;
          storage.setItem(STORAGE_KEYS.roomCode, incomingState.roomCode);
          storage.removeItem(STORAGE_KEYS.hostRoomCode);
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
      let hasResolved = false;

      channel.subscribe(async (status, error) => {
        if (channelRef.current !== channel) {
          return;
        }

        if (status === 'SUBSCRIBED') {
          clearScheduledReconnect();
          reconnectAttemptRef.current = 0;
          channelStatusRef.current = 'subscribed';
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

            storage.setItem(STORAGE_KEYS.roomCode, roomCode);
            storage.setItem(STORAGE_KEYS.hostRoomCode, roomCode);

            setLocalState(initialState);
            broadcastSnapshot(initialState, 'host-subscribed');
          } else {
            storage.setItem(STORAGE_KEYS.roomCode, roomCode);
            storage.removeItem(STORAGE_KEYS.hostRoomCode);

            if (options.playerId && options.playerName) {
              sendJoinHandshake(roomCode, options.playerId, options.playerName);
            } else {
              sendBroadcast('request-state', { roomCode });
            }

            const pendingJoinPlayerId = pendingJoinRef.current?.playerId;
            const isPendingJoin = Boolean(options.playerId && pendingJoinPlayerId === options.playerId);

            if (!isPendingJoin) {
              window.setTimeout(() => {
                if (channelRef.current !== channel || hasReceivedStateSync || isHostRef.current) {
                  return;
                }

                void teardownChannel();
                clearStoredRoomSession();
                setLocalState(createInitialState());
              }, RESTORE_SYNC_TIMEOUT_MS);
            }
          }

          activeSessionRef.current = {
            role: options.asHost ? 'host' : 'player',
            roomCode,
            playerId: options.playerId ?? null,
          };

          hasResolved = true;
          resolve();
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          channelStatusRef.current = 'idle';
          channelRef.current = null;

          if (hasResolved) {
            void disposeChannel(channel);
            scheduleReconnect(status.toLowerCase());
            return;
          }

          reject(error ?? new Error(`Supabase realtime channel failed with status ${status}`));
          return;
        }

        if (status === 'CLOSED') {
          channelStatusRef.current = 'idle';
          channelRef.current = null;

          if (hasResolved) {
            void disposeChannel(channel);
            scheduleReconnect('closed');
            return;
          }

          reject(error ?? new Error(`Supabase realtime channel failed with status ${status}`));
        }
      });
    });
  }, [
    broadcastSnapshot,
    clearScheduledReconnect,
    disposeChannel,
    handleAnswerSubmission,
    handleJoinRequest,
    handleLeaveMessage,
    sendJoinHandshake,
    sendBroadcast,
    setLocalState,
    syncPresenceToHostState,
    teardownChannel,
    scheduleReconnect,
  ]);

  const resetToLocalIdleState = useCallback(() => {
    setLocalState(previousState => (
      previousState.roomCode || previousState.phase !== 'home' || previousState.players.length > 0
        ? createInitialState()
        : previousState
    ));
  }, [setLocalState]);

  const syncSessionToRoute = useCallback((forceReconnect = false) => {
    if (!supabase) {
      return;
    }

    const routeRole =
      location.pathname.startsWith('/host')
        ? 'host'
        : location.pathname.startsWith('/play')
          ? 'player'
          : 'neutral';
    const storedRoomCode = storage.getItem(STORAGE_KEYS.roomCode);
    const hostRoomCode = storage.getItem(STORAGE_KEYS.hostRoomCode);
    const storedPlayerId = storage.getItem(STORAGE_KEYS.playerId);
    const storedPlayerName = storage.getItem(STORAGE_KEYS.playerName)?.trim() ?? '';
    const activeSession = activeSessionRef.current;
    const hasLiveChannel = channelStatusRef.current === 'subscribed' && channelRef.current !== null;

    if (routeRole === 'host') {
      if (activeSession.role === 'player') {
        void teardownChannel();
        resetToLocalIdleState();
        return;
      }

      if (!storedRoomCode || hostRoomCode !== storedRoomCode) {
        if (activeSession.role === 'host') {
          void teardownChannel();
        }

        resetToLocalIdleState();
        return;
      }

      if (!user) {
        if (activeSession.role === 'host') {
          void teardownChannel();
          resetToLocalIdleState();
        }
        return;
      }

      if (
        !forceReconnect
        && hasLiveChannel
        && activeSession.role === 'host'
        && activeSession.roomCode === storedRoomCode
      ) {
        return;
      }

      void subscribeToRoom(storedRoomCode, {
        asHost: true,
        presenceKey: createHostPresenceKey(user.id),
      });
      return;
    }

    if (routeRole === 'player') {
      if (hostRoomCode === storedRoomCode) {
        if (activeSession.role === 'host') {
          void teardownChannel();
        }
        resetToLocalIdleState();
        return;
      }

      if (!storedRoomCode || !storedPlayerId || !storedPlayerName) {
        if (activeSession.role !== null) {
          void teardownChannel();
        }
        resetToLocalIdleState();
        return;
      }

      if (
        !forceReconnect
        && hasLiveChannel
        && activeSession.role === 'player'
        && activeSession.roomCode === storedRoomCode
        && activeSession.playerId === storedPlayerId
      ) {
        return;
      }

      void subscribeToRoom(storedRoomCode, {
        asHost: false,
        presenceKey: storedPlayerId,
        playerId: storedPlayerId,
        playerName: storedPlayerName,
      });
      return;
    }

    if (activeSession.role !== null) {
      void teardownChannel();
    }

    resetToLocalIdleState();
  }, [location.pathname, resetToLocalIdleState, subscribeToRoom, teardownChannel, user]);

  useEffect(() => {
    resumeSessionRef.current = () => {
      syncSessionToRoute(true);
    };
  }, [syncSessionToRoute]);

  useEffect(() => {
    syncSessionToRoute();
  }, [syncSessionToRoute]);

  useEffect(() => {
    if (!user || !supabase) {
      setLocalState(previousState => ({
        ...previousState,
        customPacks: [],
      }));
      return;
    }

    let isActive = true;

    void listCustomQuestionPacks(user.id)
      .then(packs => {
        if (!isActive) {
          return;
        }

        setLocalState(previousState => ({
          ...previousState,
          customPacks: mergeCustomPackSelections(previousState.customPacks, packs),
        }));
      })
      .catch(error => {
        console.error('Unable to load custom question packs', error);
      });

    return () => {
      isActive = false;
    };
  }, [user, setLocalState]);

  useEffect(() => {
    if (!isHostRef.current || (state.phase !== 'question' && state.phase !== 'profile')) {
      return;
    }

    const activePlayers = state.players.filter(player => !player.isEliminated);
    const everyoneAnswered =
      state.phase === 'profile'
        ? activePlayers.length > 0
          && activePlayers.every(player => {
            const assignedQuestions = state.profileAssignments[player.id] ?? [];
            const answers = state.profileResponses[player.id] ?? [];
            return assignedQuestions.length > 0 && answers.length >= assignedQuestions.length;
          })
        : activePlayers.length > 0
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
  }, [
    finalizeQuestionRound,
    state.phase,
    state.players,
    state.profileAssignments,
    state.profileResponses,
    state.roundDeadlineAt,
  ]);

  useEffect(() => {
    if (isHostRef.current || !state.roomCode || !channelRef.current) {
      return;
    }

    const requestLatestState = () => {
      if (
        latestReceivedStateSyncAtRef.current > 0
        && Date.now() - latestReceivedStateSyncAtRef.current > PLAYER_STATE_STALE_AFTER_MS
      ) {
        channelStatusRef.current = 'idle';

        if (channelRef.current) {
          const staleChannel = channelRef.current;
          channelRef.current = null;
          void disposeChannel(staleChannel);
        }

        scheduleReconnect('state-stale');
        return;
      }

      const storedPlayerId = storage.getItem(STORAGE_KEYS.playerId);
      const storedPlayerName = storage.getItem(STORAGE_KEYS.playerName)?.trim() ?? '';
      const shouldReassertPlayer = Boolean(
        storedPlayerId
        && storedPlayerName
        && !state.players.some(player => player.id === storedPlayerId && player.isConnected)
      );

      if (shouldReassertPlayer && storedPlayerId) {
        sendJoinHandshake(state.roomCode, storedPlayerId, storedPlayerName);
        return;
      }

      sendBroadcast('request-state', { roomCode: state.roomCode });
    };

    requestLatestState();
    const intervalId = window.setInterval(requestLatestState, 2000);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        requestLatestState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [disposeChannel, scheduleReconnect, sendBroadcast, sendJoinHandshake, state.players, state.roomCode]);

  useEffect(() => {
    const resumeIfNeeded = () => {
      if (document.hidden || (channelStatusRef.current === 'subscribed' && channelRef.current)) {
        return;
      }

      syncSessionToRoute(true);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        resumeIfNeeded();
      }
    };

    window.addEventListener('online', resumeIfNeeded);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', resumeIfNeeded);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncSessionToRoute]);

  useEffect(() => {
    return () => {
      clearScheduledReconnect();
      if (persistSnapshotTimeoutRef.current !== null) {
        window.clearTimeout(persistSnapshotTimeoutRef.current);
      }
      if (pendingJoinRef.current) {
        window.clearTimeout(pendingJoinRef.current.timeoutId);
        if (pendingJoinRef.current.retryIntervalId !== null) {
          window.clearInterval(pendingJoinRef.current.retryIntervalId);
        }
        pendingJoinRef.current.resolve(null);
        pendingJoinRef.current = null;
      }
      void teardownChannel();
    };
  }, [clearScheduledReconnect, teardownChannel]);

  const createRoom = useCallback(async () => {
    if (!supabase || !user || isCreatingRoomRef.current) {
      return;
    }

    isCreatingRoomRef.current = true;
    const previousState = stateRef.current;
    const previousStoredRoomCode = storage.getItem(STORAGE_KEYS.roomCode);
    const previousStoredHostRoomCode = storage.getItem(STORAGE_KEYS.hostRoomCode);

    try {
      for (let attempt = 0; attempt < HOST_ROOM_CLAIM_RETRIES; attempt += 1) {
        const roomCode = generateRoomCode();
        const initialState = {
          ...createRealtimeRoomState(roomCode),
          pdfs: resetPdfSelections(previousState.pdfs),
          customPacks: resetCustomPackSelections(previousState.customPacks),
        };

        storage.setItem(STORAGE_KEYS.roomCode, roomCode);
        storage.setItem(STORAGE_KEYS.hostRoomCode, roomCode);
        setLocalState(initialState);

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

          throw error;
        }
      }

      console.error('Unable to claim a unique realtime room code after multiple attempts');
    } catch (error) {
      console.error('Unable to subscribe host room', error);
    } finally {
      if (activeSessionRef.current.role !== 'host') {
        restoreStoredRoomSession(previousStoredRoomCode, previousStoredHostRoomCode);
        setLocalState(previousState);
      }

      isCreatingRoomRef.current = false;
    }
  }, [subscribeToRoom, supabase, user]);

  const joinRoom = useCallback(async (roomCode: string, playerName: string): Promise<string | null> => {
    if (!supabase) {
      return null;
    }

    const normalizedRoomCode = roomCode.trim().toUpperCase();
    const storedPlayerName = storage.getItem(STORAGE_KEYS.playerName)?.trim() ?? '';
    const normalizedName = (playerName.trim() || storedPlayerName).slice(0, 16);

    if (!normalizedRoomCode || !normalizedName) {
      return null;
    }

    const playerId = storage.getItem(STORAGE_KEYS.playerId) ?? crypto.randomUUID();
    storage.setItem(STORAGE_KEYS.playerId, playerId);
    storage.setItem(STORAGE_KEYS.playerName, normalizedName);

    return new Promise(resolve => {
      const timeoutId = window.setTimeout(() => {
        if (pendingJoinRef.current?.playerId === playerId) {
          if (pendingJoinRef.current.retryIntervalId !== null) {
            window.clearInterval(pendingJoinRef.current.retryIntervalId);
          }
          pendingJoinRef.current = null;
        }

        void teardownChannel();
        storage.removeItem(STORAGE_KEYS.roomCode);
        resolve(null);
      }, JOIN_REQUEST_TIMEOUT_MS);

      pendingJoinRef.current = {
        playerId,
        resolve,
        timeoutId,
        retryIntervalId: null,
      };

      void subscribeToRoom(normalizedRoomCode, {
        asHost: false,
        presenceKey: playerId,
        playerId,
        playerName: normalizedName,
      }).then(() => {
        sendJoinHandshake(normalizedRoomCode, playerId, normalizedName);

        const retryIntervalId = window.setInterval(() => {
          if (pendingJoinRef.current?.playerId !== playerId) {
            window.clearInterval(retryIntervalId);
            return;
          }

          sendJoinHandshake(normalizedRoomCode, playerId, normalizedName);
        }, 1200);

        if (pendingJoinRef.current?.playerId === playerId) {
          pendingJoinRef.current = {
            ...pendingJoinRef.current,
            retryIntervalId,
          };
        } else {
          window.clearInterval(retryIntervalId);
        }
      }).catch(error => {
        console.error('Unable to subscribe player room', error);
        if (pendingJoinRef.current?.playerId === playerId) {
          window.clearTimeout(timeoutId);
          if (pendingJoinRef.current.retryIntervalId !== null) {
            window.clearInterval(pendingJoinRef.current.retryIntervalId);
          }
          pendingJoinRef.current = null;
        }
        resolve(null);
      });
    });
  }, [sendJoinHandshake, subscribeToRoom, teardownChannel]);

  const leaveRoom = useCallback(async () => {
    const playerId = storage.getItem(STORAGE_KEYS.playerId);

    if (!isHostRef.current && playerId) {
      sendBroadcast('leave-room', { playerId });
    }

    await teardownChannel();

    isHostRef.current = false;
    clearStoredRoomSession();
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

    commitHostState(previousState => {
      const baseStartedState: GameState = {
        ...previousState,
        phase: 'intro',
        questionDeck,
        currentQuestion: openingQuestion,
        questionIndex: 0,
        totalQuestions: questionDeck.length,
        timeRemaining: GAME_CONFIG.questionTimerSeconds,
        timerDuration: GAME_CONFIG.questionTimerSeconds,
        roundDeadlineAt: null,
        results: null,
        profileAssignments: {},
        profileResponses: {},
        players: previousState.players.map(player => ({
          ...player,
          score: GAME_CONFIG.startingBalance,
          isEliminated: false,
          currentAnswer: null,
          minigameScore: 0,
        })),
        isPreparingGame: false,
        preparationMessage,
        customResponseHistory: customResponseHistorySeed,
        activeFriendGroupPackSettings: options.friendGroupPack ?? null,
        saveFriendGroupPackAfterProfile: Boolean(options.friendGroupPack && options.saveFriendGroupPackAfterProfile),
        pendingFriendGroupPackDraft: null,
      };

      if (!options.friendGroupPack) {
        return baseStartedState;
      }

      return shouldUseProfilePhase(baseStartedState, 0)
        ? createProfilePhaseState(baseStartedState, 0)
        : createQuestionPhaseState(baseStartedState, 0);
    }, 'start-game:ready');
  }, [commitHostState]);

  const setSelectedPolymarketCategories = useCallback((categories: string[]) => {
    const nextCategories = normalizeSelectedPolymarketCategories(categories);

    updateResourceState(previousState => ({
      ...previousState,
      selectedPolymarketCategories: nextCategories,
    }), 'polymarket-categories-selected');
  }, [updateResourceState]);

  const clearSelectedMaterials = useCallback(() => {
    updateResourceState(previousState => ({
      ...previousState,
      selectedPolymarketCategories: [],
      pdfs: resetPdfSelections(previousState.pdfs),
      customPacks: resetCustomPackSelections(previousState.customPacks),
    }), 'selected-materials-cleared');
  }, [updateResourceState]);

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

  const submitAnswer = useCallback((playerId: string, answer: ProfileResponseValue) => {
    if (isHostRef.current) {
      return;
    }

    setLocalState(previousState => {
      if (previousState.phase === 'profile') {
        const assignedQuestions = previousState.profileAssignments[playerId] ?? [];
        const existingResponses = previousState.profileResponses[playerId] ?? [];
        const activeQuestion = assignedQuestions[existingResponses.length];
        const normalizedResponse = normalizeProfileResponseValue(activeQuestion, answer);

        if (existingResponses.length >= assignedQuestions.length || normalizedResponse === null) {
          return previousState;
        }

        return {
          ...previousState,
          profileResponses: {
            ...previousState.profileResponses,
            [playerId]: [...existingResponses, normalizedResponse],
          },
        };
      }

      if (typeof answer !== 'number' || !Number.isInteger(answer)) {
        return previousState;
      }

      return {
        ...previousState,
        players: previousState.players.map(player => (
          player.id === playerId
            ? { ...player, currentAnswer: answer }
            : player
        )),
      };
    });

    void sendBroadcast('submit-answer', { playerId, answer });
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

  const upsertCustomPack = useCallback((pack: CustomQuestionPack) => {
    updateResourceState(previousState => {
      const existingPackIndex = previousState.customPacks.findIndex(
        existingPack => existingPack.id === pack.id
      );

      if (existingPackIndex === -1) {
        return {
          ...previousState,
          customPacks: [pack, ...previousState.customPacks],
        };
      }

      const nextCustomPacks = [...previousState.customPacks];
      nextCustomPacks[existingPackIndex] = {
        ...pack,
        enabled: pack.enabled ?? nextCustomPacks[existingPackIndex].enabled,
      };

      return {
        ...previousState,
        customPacks: nextCustomPacks,
      };
    }, 'custom-pack-upserted');
  }, [updateResourceState]);

  const toggleCustomPack = useCallback((packId: string, enabled: boolean) => {
    updateResourceState(previousState => ({
      ...previousState,
      customPacks: previousState.customPacks.map(pack => (
        pack.id === packId ? { ...pack, enabled } : pack
      )),
    }), 'custom-pack-toggled');
  }, [updateResourceState]);

  const removeCustomPack = useCallback((packId: string) => {
    updateResourceState(previousState => ({
      ...previousState,
      customPacks: previousState.customPacks.filter(pack => pack.id !== packId),
    }), 'custom-pack-removed');
  }, [updateResourceState]);

  const clearPendingFriendGroupPackDraft = useCallback(() => {
    updateResourceState(previousState => ({
      ...previousState,
      pendingFriendGroupPackDraft: null,
    }), 'friend-group-pack-draft-cleared');
  }, [updateResourceState]);

  const playAgain = useCallback(() => {
    commitHostState(playAgainState(stateRef.current), 'play-again');
  }, [commitHostState]);

  const returnToLobby = useCallback(() => {
    if (!isHostRef.current) {
      return;
    }

    commitHostState(playAgainState(stateRef.current), 'return-to-lobby');
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
      case 'profile':
        finalizeQuestionRound('manual-advance');
        break;
      case 'results':
        commitHostState(getStateForPhase(currentState, 'leaderboard'), 'advance:results');
        break;
      case 'leaderboard': {
        const nextIndex = currentState.questionIndex + 1;
        const deckLength = currentState.questionDeck.length || GAME_CONFIG.defaultQuestionCount;

        if (nextIndex < deckLength) {
          const preparedState = maybePrepareFriendGroupFollowUpQuestion(currentState, nextIndex);
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
    setSelectedPolymarketCategories,
    clearSelectedMaterials,
    simulateDevPlayerJoin,
    submitAnswer,
    submitMinigameAnswer,
    submitWager,
    uploadPdf,
    togglePdf,
    removePdf,
    approvePdf,
    rejectPdf,
    upsertCustomPack,
    toggleCustomPack,
    removeCustomPack,
    clearPendingFriendGroupPackDraft,
    playAgain,
    returnToLobby,
    setPhase,
    advancePhase,
  }), [
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    setSelectedPolymarketCategories,
    clearSelectedMaterials,
    simulateDevPlayerJoin,
    submitAnswer,
    submitMinigameAnswer,
    submitWager,
    uploadPdf,
    togglePdf,
    removePdf,
    approvePdf,
    rejectPdf,
    upsertCustomPack,
    toggleCustomPack,
    removeCustomPack,
    clearPendingFriendGroupPackDraft,
    playAgain,
    returnToLobby,
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
  interface IndexedChoice {
    choice: string;
    wasCorrect: boolean;
    sortKey: number;
  }

  const shuffleQuestionChoices = (question: Question): Question => {
    const indexedChoices: IndexedChoice[] = question.choices.map((choice, index) => ({
      choice,
      wasCorrect: index === question.correct,
      sortKey: Math.random(),
    }));

    indexedChoices.sort((left, right) => left.sortKey - right.sortKey);

    return {
      ...question,
      choices: indexedChoices.map(entry => entry.choice),
      correct: indexedChoices.findIndex(entry => entry.wasCorrect),
    };
  };

  const shuffleQuestionDeck = (questions: Question[]) =>
    questions.map(question => shuffleQuestionChoices(question));

  const shuffleItems = <T,>(items: T[]) => {
    const copy = [...items];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }

    return copy;
  };

  const interleaveQuestionSources = (questionSources: Question[][], totalQuestions: number) => {
    const preparedSources = questionSources
      .map(source => shuffleItems(source))
      .filter(source => source.length > 0);
    const mixedQuestions: Question[] = [];
    let questionIndex = 0;

    while (mixedQuestions.length < totalQuestions) {
      let appendedInPass = false;

      for (const source of shuffleItems(preparedSources)) {
        const nextQuestion = source[questionIndex];

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
  };

  const buildFallbackQuestions = (count: number, startIndex = 0) =>
    Array.from({ length: count }, (_unused, index) => getMockQuestion(startIndex + index));

  const combinePreparationMessages = (...messages: Array<string | null>) => {
    const validMessages = messages.filter((message): message is string => Boolean(message));
    return validMessages.length > 0 ? validMessages.join(' ') : null;
  };

  const buildGameplaySection = (
    questionSources: Question[][],
    questionCount: number,
    fallbackOffset: number
  ) => {
    if (questionCount <= 0) {
      return {
        questions: [] as Question[],
        preparationMessage: null as string | null,
      };
    }

    const selectedQuestionCount = questionSources.reduce(
      (count, source) => count + source.length,
      0
    );

    if (selectedQuestionCount === 0) {
      return {
        questions: buildFallbackQuestions(questionCount, fallbackOffset),
        preparationMessage: 'No live market categories or custom packs were selected, so this round uses the local fallback deck.',
      };
    }

    const mixedQuestions = interleaveQuestionSources(questionSources, questionCount);

    if (mixedQuestions.length >= questionCount) {
      return {
        questions: mixedQuestions,
        preparationMessage: null,
      };
    }

    if (mixedQuestions.length > 0) {
      return {
        questions: [
          ...mixedQuestions,
          ...buildFallbackQuestions(questionCount - mixedQuestions.length, fallbackOffset + mixedQuestions.length),
        ],
        preparationMessage: 'Selected packs were limited, so the remaining slots were filled with local fallback questions.',
      };
    }

    return {
      questions: buildFallbackQuestions(questionCount, fallbackOffset),
      preparationMessage: 'Selected packs were unavailable, so this round fell back to the local question deck.',
    };
  };

  const requestedQuestionCount = options.friendGroupPack?.numQuestions ?? GAME_CONFIG.defaultQuestionCount;
  const friendGroupProfileQuestionCount = getFriendGroupProfileQuestionCount(options.friendGroupPack);
  const gameplayQuestionCount = options.friendGroupPack
    ? options.saveFriendGroupPackAfterProfile
      ? 0
      : requestedQuestionCount
    : GAME_CONFIG.defaultQuestionCount;
  const selectedCategories = Array.from(
    new Set((options.polymarketCategories ?? []).map(category => category.trim()).filter(Boolean))
  );
  const selectedCustomQuestions = normalizePackQuestions(options.customQuestions ?? [])
    .slice(0, gameplayQuestionCount);

  if (selectedCategories.length === 0 && selectedCustomQuestions.length === 0) {
    if (!options.friendGroupPack) {
      const gameplaySection = buildGameplaySection([], gameplayQuestionCount, 0);

      return {
        questionDeck: shuffleQuestionDeck(gameplaySection.questions),
        preparationMessage: gameplaySection.preparationMessage,
        customResponseHistorySeed: [],
      };
    }
  }

  let liveQuestions: Question[] = [];

  try {
    if (selectedCategories.length > 0 && gameplayQuestionCount > 0) {
      liveQuestions = await fetchPolymarketQuestionDeck(
        selectedCategories,
        gameplayQuestionCount
      );
    }
  } catch (error) {
    console.error('Unable to build Polymarket-backed deck', error);
  }

  const gameplaySection = buildGameplaySection(
    [selectedCustomQuestions, liveQuestions],
    gameplayQuestionCount,
    friendGroupProfileQuestionCount
  );

  if (!options.friendGroupPack) {
    return {
      questionDeck: shuffleQuestionDeck(gameplaySection.questions),
      preparationMessage: gameplaySection.preparationMessage,
      customResponseHistorySeed: [],
    };
  }

  const fallbackProfileQuestions = buildFallbackQuestions(friendGroupProfileQuestionCount);

  try {
    const friendGroupQuestions = await fetchFriendGroupCustomPackQuestions(
      {
        ...options.friendGroupPack,
        numQuestions: friendGroupProfileQuestionCount,
      },
      options.playerNames ?? []
    );
    const customResponseHistorySeed = await fetchStoredFriendGroupProfileHistory(
      options.friendGroupPack.style,
      options.playerIds ?? []
    );

    return {
      questionDeck: shuffleQuestionDeck([...friendGroupQuestions, ...gameplaySection.questions]),
      preparationMessage: gameplaySection.preparationMessage,
      customResponseHistorySeed,
    };
  } catch (error) {
    console.error('Unable to build friend-group custom pack deck', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    return {
      questionDeck: shuffleQuestionDeck([...fallbackProfileQuestions, ...gameplaySection.questions]),
      preparationMessage: combinePreparationMessages(
        `Friend group custom pack loading failed (${message}). Using the local fallback deck.`,
        gameplaySection.preparationMessage
      ),
      customResponseHistorySeed: [],
    };
  }
}

async function fetchStoredFriendGroupProfileHistory(
  style: FriendGroupPackStyle,
  playerIds: string[]
) {
  if (!supabase || playerIds.length === 0) {
    return [] as CustomResponseHistoryItem[];
  }

  const answerPoolByQuestion = new Map<string, string[]>();

  try {
    const { data: questionRows, error: questionError } = await supabase
      .from('custom_pack_questions')
      .select('question, options')
      .eq('style', style);

    if (questionError) {
      throw questionError;
    }

    if (Array.isArray(questionRows)) {
      questionRows.forEach(row => {
        const questionText = String(row.question ?? '').trim();
        const options = Array.isArray(row.options)
          ? row.options.map(option => String(option ?? '').trim()).filter(Boolean)
          : [];

        if (questionText && options.length >= 4) {
          answerPoolByQuestion.set(questionText, options);
        }
      });
    }
  } catch (error) {
    console.error('Unable to load friend-group answer pools', error);
  }

  if (answerPoolByQuestion.size === 0) {
    getLocalFriendGroupQuestionSeeds(style).forEach(seed => {
      answerPoolByQuestion.set(seed.question, seed.answers);
    });
  }

  const { data, error } = await supabase
    .from('player_custom_profiles')
    .select('player_id, question_id, question_text, answer_text, answered_at')
    .eq('style', style)
    .in('player_id', playerIds)
    .order('answered_at', { ascending: false })
    .limit(300);

  if (error || !Array.isArray(data)) {
    if (error) {
      console.error('Unable to load stored friend-group profile history', error);
    }

    return [] as CustomResponseHistoryItem[];
  }

  const groupedHistory = new Map<string, CustomResponseHistoryItem>();

  for (const row of data) {
    const questionId = String(row.question_id ?? '').trim();
    const question = String(row.question_text ?? '').trim();
    const playerId = String(row.player_id ?? '').trim();
    const answerText = String(row.answer_text ?? '').trim();

    if (!questionId || !question || !playerId || !answerText) {
      continue;
    }

    const mapKey = `${questionId}::${question}`;
    const existingEntry = groupedHistory.get(mapKey) ?? {
      questionId: `stored-${questionId}`,
      question,
      choices: answerPoolByQuestion.get(question) ?? [],
      playerAnswers: {},
    };

    existingEntry.playerAnswers[playerId] = answerText;
    groupedHistory.set(mapKey, existingEntry);
  }

  return Array.from(groupedHistory.values()).filter(entry => entry.choices.length > 0);
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
        customPacks: resetCustomPackSelections(previousState.customPacks),
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
    case 'profile':
      return createProfilePhaseState(previousState, previousState.questionIndex);
    case 'question':
      return createQuestionPhaseState(previousState, previousState.questionIndex);
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

function createResultsPhaseState(previousState: GameState): GameState {
  if (previousState.phase === 'results' && previousState.results) {
    return previousState;
  }

  const currentQuestion =
    previousState.currentQuestion
    ?? previousState.questionDeck[previousState.questionIndex]
    ?? getMockQuestion(previousState.questionIndex);
  const results = buildQuestionResults(previousState.players, currentQuestion.correct);
  const nextHistory = appendFriendGroupResponseHistory(previousState, currentQuestion, results);

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

function createProfilePhaseState(previousState: GameState, questionIndex: number): GameState {
  const deckLength = previousState.questionDeck.length || GAME_CONFIG.defaultQuestionCount;
  const boundedIndex = Math.max(0, Math.min(questionIndex, deckLength - 1));
  const roundDeadlineAt = new Date(
    Date.now() + FRIEND_GROUP_PROFILE_TIMER_SECONDS * 1000
  ).toISOString();
  const profileAssignments =
    Object.keys(previousState.profileAssignments).length > 0
      ? previousState.profileAssignments
      : buildProfileAssignments(previousState, boundedIndex);
  const firstAssignedQuestion = Object.values(profileAssignments)[0]?.[0];
  const currentQuestion = firstAssignedQuestion
    ?? previousState.questionDeck[boundedIndex]
    ?? getMockQuestion(boundedIndex);

  return {
    ...previousState,
    phase: 'profile',
    profileAssignments,
    profileResponses: previousState.profileResponses ?? {},
    currentQuestion,
    questionIndex: boundedIndex,
    totalQuestions: previousState.questionDeck.length || previousState.totalQuestions,
    timeRemaining: FRIEND_GROUP_PROFILE_TIMER_SECONDS,
    timerDuration: FRIEND_GROUP_PROFILE_TIMER_SECONDS,
    roundDeadlineAt,
    results: null,
    players: resetPlayerAnswers(previousState.players),
  };
}

function createAfterProfilePhaseState(previousState: GameState): GameState {
  const nextHistory = appendProfileAssignmentsHistory(previousState);

  if (previousState.saveFriendGroupPackAfterProfile && previousState.activeFriendGroupPackSettings) {
    const pendingFriendGroupPackDraft = buildPendingFriendGroupPackDraft(
      {
        ...previousState,
        customResponseHistory: nextHistory,
      },
      previousState.activeFriendGroupPackSettings
    );

    return {
      ...playAgainState(previousState),
      pendingFriendGroupPackDraft,
      activeFriendGroupPackSettings: null,
      saveFriendGroupPackAfterProfile: false,
    };
  }

  const deckLength = previousState.questionDeck.length || GAME_CONFIG.defaultQuestionCount;
  const nextIndex = Math.min(getFriendGroupProfileQuestionCount(previousState), deckLength);

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
      activeFriendGroupPackSettings: null,
      saveFriendGroupPackAfterProfile: false,
    },
    nextIndex
  );
}

function buildPendingFriendGroupPackDraft(
  previousState: GameState,
  settings: FriendGroupPackSettings
): PendingFriendGroupPackDraft | null {
  const questions = buildSavedFriendGroupPackQuestions(previousState, settings);

  if (questions.length === 0) {
    return null;
  }

  return {
    id: `friend-group-pack-draft-${crypto.randomUUID()}`,
    suggestedLabel: `${formatFriendGroupStyleLabel(settings.style)} Crew Pack`,
    questions,
    settings,
  };
}

function buildSavedFriendGroupPackQuestions(
  previousState: GameState,
  settings: FriendGroupPackSettings
) {
  const uniqueQuestions: Question[] = [];
  const usedSignatures = new Set<string>();
  const profileQuestionCount = getFriendGroupProfileQuestionCount(settings);
  const followUpCandidates = buildFriendGroupFollowUpQuestionCandidates(previousState, profileQuestionCount);
  const fallbackQuestions = buildLocalFriendGroupCustomPackQuestions({
    style: settings.style,
    // Generic local prompts are safer than saving fewer questions.
    includeNames: false,
  });

  [...followUpCandidates, ...fallbackQuestions].forEach(candidate => {
    if (uniqueQuestions.length >= settings.numQuestions) {
      return;
    }

    if (
      !settings.includeNames
      && questionUsesPlayerNamesOnlyInChoices(candidate, previousState.players)
    ) {
      return;
    }

    const signature = createQuestionSignature(candidate);

    if (usedSignatures.has(signature)) {
      return;
    }

    usedSignatures.add(signature);
    uniqueQuestions.push(sanitizeSavedFriendGroupQuestion(candidate, settings.style, uniqueQuestions.length));
  });

  if (uniqueQuestions.length > settings.numQuestions) {
    return uniqueQuestions.slice(0, settings.numQuestions);
  }

  return uniqueQuestions;
}

function sanitizeSavedFriendGroupQuestion(
  question: Question,
  style: FriendGroupPackStyle,
  index: number,
): Question {
  const preservedKeywords = question.keywords.filter(keyword => keyword === 'player-history');

  return {
    id: `friend-group-generated-${style}-${index + 1}-${crypto.randomUUID()}`,
    displaySubtitle: question.displaySubtitle,
    question: question.question,
    choices: question.choices,
    correct: question.correct,
    probabilities: question.probabilities,
    keywords: ['friend-group-generated', style, ...preservedKeywords],
    category: `Friend Group: ${formatFriendGroupStyleLabel(style)}`,
    source: preservedKeywords.includes('player-history') ? 'player-history' : question.source,
  };
}

function formatFriendGroupStyleLabel(style: FriendGroupPackStyle) {
  return style
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function appendFriendGroupResponseHistory(
  previousState: GameState,
  currentQuestion: Question,
  results: QuestionResult
) {
  if (!isFriendGroupCustomQuestion(currentQuestion)) {
    return previousState.customResponseHistory;
  }

  if (previousState.customResponseHistory.some(entry => entry.questionId === currentQuestion.id)) {
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

function shouldUseProfilePhase(state: GameState, questionIndex: number) {
  if (questionIndex >= getFriendGroupProfileQuestionCount(state)) {
    return false;
  }

  const question = state.questionDeck[questionIndex];
  return isFriendGroupCustomQuestion(question);
}

function isFriendGroupCustomQuestion(question: Question | null | undefined) {
  if (!question) {
    return false;
  }

  return question.keywords.includes('friend-group-pack');
}

function buildProfileAssignments(state: GameState, questionIndex: number) {
  const activePlayers = state.players.filter(player => !player.isEliminated);

  if (activePlayers.length === 0) {
    return {} as Record<string, Question[]>;
  }

  const sourceQuestions = state.questionDeck.filter(question =>
    isFriendGroupCustomQuestion(question) && !question.keywords.includes('friend-group-follow-up')
  );

  if (sourceQuestions.length === 0) {
    return {} as Record<string, Question[]>;
  }

  const startIndex = questionIndex * activePlayers.length;
  const assignments: Record<string, Question[]> = {};
  const profileQuestionCount = getFriendGroupProfileQuestionCount(state);

  activePlayers.forEach((player, playerIndex) => {
    const otherPlayerNames = activePlayers
      .filter(candidate => candidate.id !== player.id)
      .map(candidate => candidate.name)
      .filter(Boolean);

    assignments[player.id] = Array.from({ length: profileQuestionCount }, (_unused, slotIndex) => {
      const template = sourceQuestions[
        (startIndex + playerIndex + slotIndex * activePlayers.length) % sourceQuestions.length
      ];

      return personalizeProfileQuestionForPlayer(template, player.name, otherPlayerNames);
    });
  });

  return assignments;
}

function personalizeProfileQuestionForPlayer(
  question: Question,
  playerName: string,
  otherPlayerNames: string[]
) {
  const otherPlayerName = pickRandomItem(otherPlayerNames) ?? 'someone in your group';
  const personalizeText = (text: string) => applyNamedFriendGroupTemplate(
    applyProfileTemplate(text, playerName, otherPlayerName),
    otherPlayerName
  );

  return {
    ...question,
    question: personalizeText(question.question),
    choices: question.choices.map(personalizeText),
    answerPool: question.answerPool?.map(personalizeText),
  };
}

function applyProfileTemplate(text: string, playerName: string, otherPlayerName: string) {
  return text
    .split('{player}').join(playerName)
    .split('{other}').join(otherPlayerName);
}

function applyNamedFriendGroupTemplate(text: string, targetPlayerName: string) {
  return text
    .split('[user_name]').join(targetPlayerName)
    .replace(/someone in your group/gi, targetPlayerName);
}

function applyFriendGroupYouTemplate(text: string, playerName: string) {
  const phrasedReplacements: Array<[RegExp, string]> = [
    [/\bWhat is the most obvious red flag about you\?/gi, `What is the most obvious red flag about ${playerName}?`],
    [/\bWhat is the most irrational pet peeve for you\?/gi, `What is the most irrational pet peeve for ${playerName}?`],
    [/\bWould someone in the group secretly date you\?/gi, `Would someone in the group secretly date ${playerName}?`],
    [/\bWhat kind of situationship would you\b/gi, `What kind of situationship would ${playerName}`],
    [/\bWhat terrible advice would you\b/gi, `What terrible advice would ${playerName}`],
    [/\bWhat double standard do you\b/gi, `What double standard does ${playerName}`],
    [/\bHow would you\b/gi, `How would ${playerName}`],
    [/\bWhy would someone avoid swapping lives with you\?/gi, `Why would someone avoid swapping lives with ${playerName}?`],
    [/\bWhat embarrassing moment did you\b/gi, `What embarrassing moment did ${playerName}`],
    [/\bWhen do you\b/gi, `When does ${playerName}`],
    [/\bWhat weird thing do you\b/gi, `What weird thing does ${playerName}`],
    [/\bHow often do you\b/gi, `How often does ${playerName}`],
    [/\bWhat do you\b/gi, `What does ${playerName}`],
    [/\bWhat phrase do you\b/gi, `What phrase does ${playerName}`],
    [/\bWhy do you\b/gi, `Why does ${playerName}`],
    [/\bWhat makes your\b/gi, `What makes ${playerName}'s`],
    [/\bWould you\b/gi, `Would ${playerName}`],
    [/\bWhat lie would you\b/gi, `What lie would ${playerName}`],
    [/\bAre you\b/gi, `Is ${playerName}`],
    [/\bYou are\b/g, `${playerName} is`],
    [/\bYou have\b/g, `${playerName} has`],
    [/\bYou get\b/g, `${playerName} gets`],
    [/\bYou fall\b/g, `${playerName} falls`],
    [/\bYou confuse\b/g, `${playerName} confuses`],
    [/\bYou ignore\b/g, `${playerName} ignores`],
    [/\bYou trust\b/g, `${playerName} trusts`],
    [/\bYou say\b/g, `${playerName} says`],
  ];

  let personalizedText = text;

  phrasedReplacements.forEach(([pattern, replacement]) => {
    personalizedText = personalizedText.replace(pattern, replacement);
  });

  return personalizedText
    .replace(/\bYou\b/g, playerName)
    .replace(/\byou\b/g, playerName);
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

    assignedQuestions.slice(0, answers.length).forEach((assignedQuestion, index) => {
      const existingEntry = nextByQuestionId.get(assignedQuestion.id) ?? {
        questionId: assignedQuestion.id,
        question: assignedQuestion.question,
        choices: assignedQuestion.answerPool ?? assignedQuestion.choices,
        playerAnswers: {},
      };

      existingEntry.playerAnswers[player.id] = answers[index] ?? null;
      nextByQuestionId.set(assignedQuestion.id, existingEntry);
    });
  });

  return Array.from(nextByQuestionId.values());
}

function getFriendGroupPackStyleFromQuestion(question: Question) {
  const styleKeyword = question.keywords.find(keyword => FRIEND_GROUP_PACK_STYLES.has(keyword as FriendGroupPackStyle));

  if (styleKeyword && FRIEND_GROUP_PACK_STYLES.has(styleKeyword as FriendGroupPackStyle)) {
    return styleKeyword as FriendGroupPackStyle;
  }

  const category = (question.category ?? '').toLowerCase();

  if (category.includes('kid-friendly')) return 'kid-friendly';
  if (category.includes('for-friends')) return 'for-friends';
  if (category.includes('for-family')) return 'for-family';
  if (category.includes('funny')) return 'funny';
  if (category.includes('outta-pocket')) return 'outta-pocket';

  return null;
}

async function persistFriendGroupProfileAnswers(
  profileAssignments: Record<string, Question[]>,
  profileResponses: Record<string, ProfileResponseValue[]>,
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
    .flatMap(player => {
      const assignedQuestions = profileAssignments[player.id] ?? [];
      const answers = profileResponses[player.id] ?? [];

      return assignedQuestions.slice(0, answers.length).map((question, index) => {
        const style = getFriendGroupPackStyleFromQuestion(question);

        if (!style) {
          return null;
        }

        const response = answers[index];
        const answerIndex =
          typeof response === 'number' && Number.isInteger(response) ? response : null;
        const answerText =
          typeof response === 'string'
            ? response.trim()
            : answerIndex !== null
              ? question.choices[answerIndex] ?? null
              : null;

        if (!answerText) {
          return null;
        }

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
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from('player_custom_profiles')
    .upsert(rows, { onConflict: 'player_id,question_id' });

  if (error) {
    console.error('Unable to persist friend-group profile answers', error);
  }
}

function maybePrepareFriendGroupFollowUpQuestion(previousState: GameState, nextIndex: number) {
  const nextQuestion = previousState.questionDeck[nextIndex];

  if (!isFriendGroupCustomQuestion(nextQuestion)) {
    return previousState;
  }

  if (nextIndex < getFriendGroupProfileQuestionCount(previousState)) {
    return previousState;
  }

  if (nextQuestion.keywords.includes('friend-group-follow-up')) {
    return previousState;
  }

  const generatedQuestion = buildFriendGroupFollowUpQuestion(previousState, nextIndex);

  if (!generatedQuestion) {
    return previousState;
  }

  const nextDeck = [...previousState.questionDeck];
  nextDeck[nextIndex] = generatedQuestion;

  return {
    ...previousState,
    questionDeck: nextDeck,
  };
}

function getFriendGroupPackDisplaySubtitle(previousState: GameState) {
  return previousState.questionDeck.find(question =>
    isFriendGroupCustomQuestion(question) && !question.keywords.includes('friend-group-follow-up')
  )?.displaySubtitle ?? 'Friend Group Pack';
}

function isStoredFriendGroupHistoryEntry(entry: CustomResponseHistoryItem) {
  return entry.questionId.startsWith('stored-');
}

function createQuestionSignature(question: Question) {
  return [
    question.question.trim().toLowerCase(),
    question.correct,
    ...question.choices.map(choice => choice.trim().toLowerCase()),
  ].join('::');
}

function buildFriendGroupFollowUpQuestion(previousState: GameState, nextIndex: number): Question | null {
  const candidates = buildFriendGroupFollowUpQuestionCandidates(previousState, nextIndex);

  if (candidates.length === 0) {
    return null;
  }

  return pickRandomItem(candidates) ?? null;
}

function buildFriendGroupFollowUpQuestionCandidates(previousState: GameState, startIndex: number) {
  const currentSessionHistory = previousState.customResponseHistory.filter(entry =>
    !isStoredFriendGroupHistoryEntry(entry)
  );
  const textAnsweredHistory = currentSessionHistory.filter(entry =>
    Object.values(entry.playerAnswers).some(
      answer => typeof answer === 'string' && answer.trim().length > 0,
    )
  );
  const textCandidates = textAnsweredHistory.flatMap((historyEntry, historyIndex) =>
    Object.entries(historyEntry.playerAnswers)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0)
      .map(([playerId, answer], playerIndex) =>
        buildFriendGroupTextHistoryCandidate(
          previousState,
          historyEntry,
          playerId,
          answer.trim(),
          startIndex + historyIndex + playerIndex
        )
      )
      .filter((candidate): candidate is Question => candidate !== null)
  );

  const answeredHistory = currentSessionHistory.filter(entry =>
    Object.values(entry.playerAnswers).some(answer => typeof answer === 'number' && answer >= 0)
  );

  const choiceCandidates = answeredHistory.flatMap((historyEntry, historyIndex) =>
    Object.entries(historyEntry.playerAnswers)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] >= 0)
      .map(([playerId], playerIndex) =>
        buildFriendGroupChoiceHistoryCandidate(
          previousState,
          historyEntry,
          playerId,
          startIndex + textCandidates.length + historyIndex + playerIndex
        )
      )
      .filter((candidate): candidate is Question => candidate !== null)
  );

  return [...textCandidates, ...choiceCandidates];
}

function buildFriendGroupTextHistoryCandidate(
  previousState: GameState,
  historyEntry: CustomResponseHistoryItem,
  playerId: string,
  answer: string,
  nextIndex: number
): Question | null {
  const selectedPlayer = previousState.players.find(player => player.id === playerId);

  if (!selectedPlayer) {
    return null;
  }

  const publicQuestion = applyFriendGroupYouTemplate(historyEntry.question, selectedPlayer.name);
  const followUpSubtitle = `In ${selectedPlayer.name}'s view`;
  const distractors = shuffleArray(
    (historyEntry.choices ?? []).filter(choice =>
      choice.trim()
      && choice.trim().toLowerCase() !== answer.toLowerCase(),
    )
  ).slice(0, 3);
  const choicePool = [answer, ...distractors];

  while (choicePool.length < 4) {
    choicePool.push(`No comment ${choicePool.length}`);
  }

  const choices = shuffleArray(choicePool);
  const correct = Math.max(0, choices.indexOf(answer));

  return {
    id: `friend-group-follow-up-${nextIndex}-${crypto.randomUUID()}`,
    displaySubtitle: followUpSubtitle,
    question: publicQuestion,
    choices,
    correct,
    probabilities: choices.map((_, index) => (index === correct ? 0.58 : 0.14)),
    keywords: ['friend-group-pack', 'friend-group-follow-up', 'player-history'],
    category: 'Friend Group Pack: About Your Crew',
    source: null,
  };
}

function buildFriendGroupChoiceHistoryCandidate(
  previousState: GameState,
  historyEntry: CustomResponseHistoryItem,
  playerId: string,
  nextIndex: number
): Question | null {
  const selectedPlayer = previousState.players.find(player => player.id === playerId);

  if (!selectedPlayer) {
    return null;
  }

  const publicQuestion = applyFriendGroupYouTemplate(historyEntry.question, selectedPlayer.name);
  const followUpSubtitle = `In ${selectedPlayer.name}'s view`;
  const allPlayerNames = previousState.players.map(player => player.name).filter(Boolean);
  const distractors = shuffleArray(allPlayerNames.filter(name => name !== selectedPlayer.name));
  const choicePool = [selectedPlayer.name, ...distractors].slice(0, 4);

  while (choicePool.length < 4) {
    choicePool.push(`Player ${choicePool.length + 1}`);
  }

  const choices = shuffleArray(choicePool);
  const correct = Math.max(0, choices.indexOf(selectedPlayer.name));

  return {
    id: `friend-group-follow-up-${nextIndex}-${crypto.randomUUID()}`,
    displaySubtitle: followUpSubtitle,
    question: publicQuestion,
    choices,
    correct,
    probabilities: choices.map((_, index) => (index === correct ? 0.58 : 0.14)),
    keywords: ['friend-group-pack', 'friend-group-follow-up', 'player-history'],
    category: 'Friend Group Pack: About Your Crew',
    source: null,
  };
}

function getFriendGroupProfileQuestionCount(
  source:
    | Pick<FriendGroupPackSettings, 'numQuestions'>
    | Pick<GameState, 'activeFriendGroupPackSettings'>
    | FriendGroupPackSettings
    | null
    | undefined
) {
  if (!source) {
    return DEFAULT_FRIEND_GROUP_PROFILE_QUESTION_COUNT;
  }

  if ('activeFriendGroupPackSettings' in source) {
    return Math.max(
      1,
      source.activeFriendGroupPackSettings?.numQuestions ?? DEFAULT_FRIEND_GROUP_PROFILE_QUESTION_COUNT
    );
  }

  return Math.max(1, source.numQuestions || DEFAULT_FRIEND_GROUP_PROFILE_QUESTION_COUNT);
}

function questionMentionsKnownPlayer(question: string, players: PlayerState[]) {
  const normalizedQuestion = question.toLowerCase();

  return players.some(player =>
    player.name.trim().length > 0
    && normalizedQuestion.includes(player.name.trim().toLowerCase())
  );
}

function questionUsesPlayerNamesOnlyInChoices(question: Question, players: PlayerState[]) {
  if (questionMentionsKnownPlayer(question.question, players)) {
    return false;
  }

  return question.choices.some(choice => questionMentionsKnownPlayer(choice, players));
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
    pdfs: resetPdfSelections(previousState.pdfs),
    customPacks: resetCustomPackSelections(previousState.customPacks),
    profileAssignments: {},
    profileResponses: {},
    customResponseHistory: [],
    phase: 'room',
  };
}

function resetPdfSelections(pdfs: GameState['pdfs']) {
  return pdfs.map(pdf => ({ ...pdf, enabled: false }));
}

function resetCustomPackSelections(customPacks: GameState['customPacks']) {
  return customPacks.map(pack => ({ ...pack, enabled: false }));
}

function mergeCustomPackSelections(
  previousCustomPacks: GameState['customPacks'],
  nextCustomPacks: GameState['customPacks'],
) {
  const enabledPackIds = new Set(
    previousCustomPacks
      .filter(pack => pack.enabled)
      .map(pack => pack.id)
  );

  return nextCustomPacks.map(pack => ({
    ...pack,
    enabled: enabledPackIds.has(pack.id),
  }));
}

function getTimeRemaining(roundDeadlineAt: string): number {
  const deadlineMs = new Date(roundDeadlineAt).getTime();
  const diffMs = deadlineMs - Date.now();

  return Math.max(0, Math.ceil(diffMs / 1000));
}

function clearStoredRoomSession() {
  const storage = getBrowserStorage();
  storage.removeItem(STORAGE_KEYS.roomCode);
  storage.removeItem(STORAGE_KEYS.hostRoomCode);
}

function restoreStoredRoomSession(roomCode: string | null, hostRoomCode: string | null) {
  const storage = getBrowserStorage();

  if (roomCode) {
    storage.setItem(STORAGE_KEYS.roomCode, roomCode);
  } else {
    storage.removeItem(STORAGE_KEYS.roomCode);
  }

  if (hostRoomCode) {
    storage.setItem(STORAGE_KEYS.hostRoomCode, hostRoomCode);
  } else {
    storage.removeItem(STORAGE_KEYS.hostRoomCode);
  }
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
  const rawSnapshot = getBrowserStorage().getItem(getSnapshotStorageKey(roomCode));

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
    selectedPolymarketCategories:
      Array.isArray(candidate.selectedPolymarketCategories)
        ? normalizeSelectedPolymarketCategories(
          candidate.selectedPolymarketCategories.filter(
            (category): category is string => typeof category === 'string'
          )
        )
        : [],
    players: Array.isArray(candidate.players) ? candidate.players : [],
    questionDeck: Array.isArray(candidate.questionDeck) ? candidate.questionDeck : [],
    pdfs: Array.isArray(candidate.pdfs) ? candidate.pdfs : [],
    customPacks: Array.isArray(candidate.customPacks) ? candidate.customPacks : [],
    profileAssignments:
      candidate.profileAssignments && typeof candidate.profileAssignments === 'object'
        ? candidate.profileAssignments as Record<string, Question[]>
        : {},
    profileResponses:
      candidate.profileResponses && typeof candidate.profileResponses === 'object'
        ? candidate.profileResponses as Record<string, ProfileResponseValue[]>
        : {},
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
    customResponseHistory: Array.isArray(candidate.customResponseHistory)
      ? candidate.customResponseHistory
      : [],
    activeFriendGroupPackSettings:
      candidate.activeFriendGroupPackSettings && typeof candidate.activeFriendGroupPackSettings === 'object'
        ? candidate.activeFriendGroupPackSettings as FriendGroupPackSettings
        : null,
    saveFriendGroupPackAfterProfile: Boolean(candidate.saveFriendGroupPackAfterProfile),
    pendingFriendGroupPackDraft:
      candidate.pendingFriendGroupPackDraft && typeof candidate.pendingFriendGroupPackDraft === 'object'
        ? candidate.pendingFriendGroupPackDraft as PendingFriendGroupPackDraft
        : null,
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

  if (
    typeof payload.playerId !== 'string'
    || (typeof payload.answer !== 'number' && typeof payload.answer !== 'string')
  ) {
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
