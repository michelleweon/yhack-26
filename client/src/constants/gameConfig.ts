export const GAME_CONFIG = {
  minPlayers: 1,
  maxPlayers: 8,
  defaultQuestionCount: 8,
  minQuestionCount: 8,
  questionTimerSeconds: 30,
  minigameTimerSeconds: 30,
  soloMinigameThreshold: 15,
  startingBalance: 100,
  correctAnswerReward: 100,
  roomCodeLength: 4,
  vaultRunTarget: 1000,
} as const;

export const ANSWER_LABELS = ['A', 'B', 'C', 'D'] as const;

export const ANSWER_COLORS = [
  { bg: '#e53e3e', hover: '#c53030', label: 'A' },
  { bg: '#3182ce', hover: '#2b6cb0', label: 'B' },
  { bg: '#38a169', hover: '#2f855a', label: 'C' },
  { bg: '#d69e2e', hover: '#b7791f', label: 'D' },
] as const;

export function getAnswerMeta(index: number) {
  const color = ANSWER_COLORS[index % ANSWER_COLORS.length];

  return {
    ...color,
    label: String.fromCharCode(65 + index),
  };
}
