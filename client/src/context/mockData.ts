import type { GameState, Question, PdfEntry } from '@/types/game';
import type { PlayerState } from '@/types/player';
import { GAME_CONFIG } from '@/constants/gameConfig';

export const MOCK_PLAYERS: PlayerState[] = [
  { id: 'p1', name: 'Alice', characterIndex: 0, score: 300, isEliminated: false, isConnected: true, currentAnswer: null, minigameScore: 0 },
  { id: 'p2', name: 'Bob', characterIndex: 1, score: 200, isEliminated: false, isConnected: true, currentAnswer: null, minigameScore: 0 },
  { id: 'p3', name: 'Charlie', characterIndex: 2, score: 100, isEliminated: false, isConnected: true, currentAnswer: null, minigameScore: 0 },
  { id: 'p4', name: 'Diana', characterIndex: 3, score: 400, isEliminated: false, isConnected: true, currentAnswer: null, minigameScore: 0 },
  { id: 'p5', name: 'Eddie', characterIndex: 4, score: 100, isEliminated: true, isConnected: true, currentAnswer: null, minigameScore: 0 },
];

export const MOCK_QUESTIONS: Question[] = [
  {
    id: 'mock-oreo',
    question: 'What design is on each Oreo?',
    choices: ['A flower', 'The word "Oreo"', 'A spiral maze', 'Nothing — they are plain'],
    correct: 1,
    keywords: ['food', 'trivia'],
  },
  {
    id: 'mock-gold',
    question: 'Which element has the chemical symbol "Au"?',
    choices: ['Silver', 'Aluminum', 'Gold', 'Argon'],
    correct: 2,
    keywords: ['chemistry', 'elements'],
  },
  {
    id: 'mock-berlin-wall',
    question: 'In what year did the Berlin Wall fall?',
    choices: ['1987', '1989', '1991', '1993'],
    correct: 1,
    keywords: ['history', 'europe'],
  },
];

export const MOCK_PDFS: PdfEntry[] = [
  { id: 'pdf1', filename: 'World History 101.pdf', uploadedBy: null, status: 'ready', enabled: false, questionCount: 12 },
  { id: 'pdf2', filename: 'Chemistry Notes.pdf', uploadedBy: 'p2', status: 'ready', enabled: false, questionCount: 8 },
  { id: 'pdf3', filename: 'Astronomy Basics.pdf', uploadedBy: 'p3', status: 'pending', enabled: false, questionCount: 0 },
];

export function createInitialState(): GameState {
  return {
    roomCode: '',
    phase: 'home',
    players: [],
    selectedPolymarketCategories: [],
    questionDeck: [],
    profileAssignments: {},
    profileResponses: {},
    currentQuestion: null,
    questionIndex: 0,
    totalQuestions: GAME_CONFIG.defaultQuestionCount,
    timeRemaining: GAME_CONFIG.questionTimerSeconds,
    timerDuration: GAME_CONFIG.questionTimerSeconds,
    roundDeadlineAt: null,
    results: null,
    minigame: null,
    vaultRun: null,
    winnerId: null,
    pdfs: [],
    customPacks: [],
    isPreparingGame: false,
    preparationMessage: null,
    customResponseHistory: [],
    activeFriendGroupPackSettings: null,
    saveFriendGroupPackAfterProfile: false,
    pendingFriendGroupPackDraft: null,
  };
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: GAME_CONFIG.roomCodeLength }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

export function createMockRoomState(): Partial<GameState> {
  return {
    roomCode: generateRoomCode(),
    phase: 'room',
    players: MOCK_PLAYERS,
    pdfs: MOCK_PDFS,
  };
}

export function createMockQuestionState(questionIndex: number): Partial<GameState> {
  const q = getMockQuestion(questionIndex);
  return {
    phase: 'question',
    currentQuestion: q,
    questionDeck: MOCK_QUESTIONS,
    questionIndex,
    timeRemaining: GAME_CONFIG.questionTimerSeconds,
    timerDuration: GAME_CONFIG.questionTimerSeconds,
  };
}

export function createMockResultsState(questionIndex: number): Partial<GameState> {
  const q = getMockQuestion(questionIndex);
  return {
    phase: 'results',
    currentQuestion: q,
    results: {
      correctIndex: q.correct,
      playerAnswers: { p1: q.correct, p2: 0, p3: q.correct, p4: 3, p5: null },
    },
  };
}

export function createMockWinState(): Partial<GameState> {
  return {
    phase: 'win',
    winnerId: 'p4',
  };
}

export function createMockGameOverState(): Partial<GameState> {
  return {
    phase: 'gameover',
    winnerId: null,
  };
}

export function getMockQuestion(questionIndex: number): Question {
  return MOCK_QUESTIONS[questionIndex % MOCK_QUESTIONS.length];
}

export { generateRoomCode };
