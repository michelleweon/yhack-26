export interface PlayerState {
  id: string;
  name: string;
  characterIndex: number;
  score: number;
  isEliminated: boolean;
  isConnected: boolean;
  currentAnswer: number | null;
  minigameScore: number;
}
