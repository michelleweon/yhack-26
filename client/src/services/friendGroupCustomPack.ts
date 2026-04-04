import type { FriendGroupPackSettings, Question } from '@/types/game';
import {
  getFriendGroupBuildPackName,
  getLocalFriendGroupQuestionSeeds,
} from '@/services/friendGroupQuestionSeeds';

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

export async function fetchFriendGroupCustomPackQuestions(
  settings: FriendGroupPackSettings,
  _playerNames: string[] = []
): Promise<Question[]> {
  const localQuestions = buildLocalFriendGroupCustomPackQuestions(settings);

  if (localQuestions.length < settings.numQuestions) {
    throw new Error(
      `Only ${localQuestions.length} friend group questions are available for style "${settings.style}".`
    );
  }

  return shuffle(localQuestions).slice(0, settings.numQuestions);
}

export function buildLocalFriendGroupCustomPackQuestions(
  settings: Pick<FriendGroupPackSettings, 'style' | 'includeNames'>
) {
  return buildQuestionsFromLocalSeeds(settings.style, settings.includeNames);
}

function buildQuestionsFromLocalSeeds(
  style: FriendGroupPackSettings['style'],
  includeNames: boolean
): Question[] {
  return getLocalFriendGroupQuestionSeeds(style, { includeNames })
    .map((seed, index) =>
      buildQuestion({
        id: `friend-group-pack-local-${style}-${index + 1}`,
        style: seed.style,
        question: seed.question,
        answers: seed.answers,
        probabilities: [0.25, 0.25, 0.25, 0.25],
        correct: 0,
        includeNames,
      })
    )
    .filter(isBuiltFriendGroupQuestion);
}

function buildQuestion({
  id,
  style,
  question,
  answers,
  probabilities,
  correct,
  includeNames,
}: {
  id: string;
  style: FriendGroupPackSettings['style'];
  question: string;
  answers: string[];
  probabilities: number[];
  correct: number;
  includeNames: boolean;
}): Question | null {
  const normalizedAnswerPool = answers.map(answer => answer.trim()).filter(Boolean);

  if (normalizedAnswerPool.length < 4) {
    return null;
  }

  return {
    id,
    question,
    choices: normalizedAnswerPool.slice(0, 4),
    answerPool: normalizedAnswerPool,
    correct,
    probabilities,
    displaySubtitle: getFriendGroupBuildPackName(includeNames),
    keywords: [
      'friend-group-pack',
      style,
      ...(!includeNames ? ['friend-group-personalize-you'] : []),
    ],
    category: `Friend Group Pack: ${style}`,
    source: null,
    profileResponseMode: 'free-text',
    profileResponseMaxLength: 30,
  } satisfies Question;
}

function isBuiltFriendGroupQuestion(
  question: ReturnType<typeof buildQuestion>
): question is Question {
  return question !== null;
}
