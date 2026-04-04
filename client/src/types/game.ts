import type { PlayerState } from './player';

export type GamePhase =
  | 'home'
  | 'room'
  | 'intro'
  | 'profile'
  | 'question'
  | 'results'
  | 'leaderboard'
  | 'win'
  | 'gameover';

export interface Question {
  id: string;
  question: string;
  displaySubtitle?: string;
  choices: string[];
  correct: number;
  keywords: string[];
  category?: string;
  source?: string | null;
  probabilities?: number[];
  answerPool?: string[];
  profileResponseMode?: 'multiple-choice' | 'free-text';
  profileResponseMaxLength?: number;
}

export type CustomPackSourceType =
  | 'transcript'
  | 'enemies'
  | 'trash'
  | 'viruses'
  | 'other';

export type FriendGroupPackStyle =
  | 'funny'
  | 'kid-friendly'
  | 'for-friends'
  | 'for-family'
  | 'outta-pocket';

export interface FriendGroupPackSettings {
  numQuestions: number;
  style: FriendGroupPackStyle;
  includeNames: boolean;
}

export interface CustomQuestionPack {
  id: string;
  filename: string;
  label: string;
  sourceType: CustomPackSourceType;
  sourceKind: 'pdf' | 'txt';
  questions: Question[];
  questionCount: number;
  enabled: boolean;
  createdAt: string | null;
}

export interface PendingFriendGroupPackDraft {
  id: string;
  suggestedLabel: string;
  questions: Question[];
  settings: FriendGroupPackSettings;
}

export interface GameStartOptions {
  polymarketCategories?: string[];
  customQuestions?: Question[];
  friendGroupPack?: FriendGroupPackSettings | null;
  playerNames?: string[];
  playerIds?: string[];
  saveFriendGroupPackAfterProfile?: boolean;
}

export interface QuestionResult {
  correctIndex: number;
  playerAnswers: Record<string, number | null>;
}

export type ProfileResponseValue = number | string;

export interface CustomResponseHistoryItem {
  questionId: string;
  question: string;
  choices: string[];
  playerAnswers: Record<string, ProfileResponseValue | null>;
}

export interface MinigameState {
  participantIds: string[];
  scores: Record<string, number>;
  timeRemaining: number;
  timerDuration: number;
  threshold: number;
}

export interface VaultRunState {
  positions: Record<string, number>;
  currentWagers: Record<string, number>;
  targetScore: number;
  currentQuestion: Question | null;
  phase: 'wager' | 'question' | 'reveal';
}

export interface PdfEntry {
  id: string;
  filename: string;
  uploadedBy: string | null;
  status: 'pending' | 'approved' | 'processing' | 'ready' | 'rejected';
  enabled: boolean;
  questionCount: number;
}

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  players: PlayerState[];
  selectedPolymarketCategories: string[];
  questionDeck: Question[];
  profileAssignments: Record<string, Question[]>;
  profileResponses: Record<string, ProfileResponseValue[]>;
  currentQuestion: Question | null;
  questionIndex: number;
  totalQuestions: number;
  timeRemaining: number;
  timerDuration: number;
  roundDeadlineAt: string | null;
  results: QuestionResult | null;
  minigame: MinigameState | null;
  vaultRun: VaultRunState | null;
  winnerId: string | null;
  pdfs: PdfEntry[];
  customPacks: CustomQuestionPack[];
  isPreparingGame: boolean;
  preparationMessage: string | null;
  customResponseHistory: CustomResponseHistoryItem[];
  activeFriendGroupPackSettings: FriendGroupPackSettings | null;
  saveFriendGroupPackAfterProfile: boolean;
  pendingFriendGroupPackDraft: PendingFriendGroupPackDraft | null;
}
