import type { CustomPackSettings, Question } from '@/types/game';
import { supabase } from '@/services/supabaseClient';

interface CustomPackQuestionRow {
  id: string;
  style: CustomPackSettings['style'];
  question: string;
  options: unknown;
  correct: number;
  probabilities: unknown;
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) return null;
  const parsed = value.map(item => String(item ?? '').trim()).filter(Boolean);
  if (parsed.length !== 4) return null;
  return parsed;
}

function parseProbabilityArray(value: unknown) {
  if (!Array.isArray(value)) return [0.25, 0.25, 0.25, 0.25];
  const nums = value.slice(0, 4).map(item => Number(item));
  const clean = nums.map(item => (Number.isFinite(item) && item >= 0 ? item : 0));
  const sum = clean.reduce((acc, item) => acc + item, 0);
  if (sum <= 0) return [0.25, 0.25, 0.25, 0.25];
  return clean.map(item => item / sum);
}

function personalizeText(text: string, playerNames: string[], counter: { value: number }) {
  if (!text.includes('{player}') || playerNames.length === 0) return text;
  return text.split('{player}').reduce((acc, part, index) => {
    if (index === 0) return part;
    const name = playerNames[counter.value % playerNames.length];
    counter.value += 1;
    return `${acc}${name}${part}`;
  }, '');
}

function personalizeQuestions(questions: Question[], playerNames: string[]) {
  const counter = { value: 0 };
  return questions.map(question => ({
    ...question,
    question: personalizeText(question.question, playerNames, counter),
    choices: question.choices.map(choice => personalizeText(choice, playerNames, counter)),
  }));
}

export async function fetchCustomPackQuestionsFromSupabase(
  settings: CustomPackSettings,
  playerNames: string[] = []
) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('custom_pack_questions')
    .select('id,style,question,options,correct,probabilities')
    .eq('style', settings.style);

  if (error) {
    throw new Error(`Unable to load custom pack questions: ${error.message}`);
  }

  const rows = (data ?? []) as CustomPackQuestionRow[];
  const normalized = rows
    .map(row => {
      const options = parseStringArray(row.options);
      if (!options) return null;
      if (!Number.isInteger(row.correct) || row.correct < 0 || row.correct > 3) return null;
      return {
        id: `custom-db-${row.id}`,
        question: row.question,
        choices: options,
        correct: row.correct,
        probabilities: parseProbabilityArray(row.probabilities),
        keywords: ['custom-pack', row.style],
        category: `Custom Pack: ${row.style}`,
        source: null,
      } as Question;
    })
    .filter((row): row is Question => row !== null);

  if (normalized.length === 0) {
    throw new Error(`No custom questions found for style "${settings.style}".`);
  }

  const selected = shuffle(normalized).slice(0, settings.numQuestions);
  if (selected.length < settings.numQuestions) {
    throw new Error(
      `Only ${selected.length} custom questions available for style "${settings.style}".`
    );
  }

  if (!settings.includeNames) {
    return selected;
  }

  const cleanNames = playerNames.map(name => name.trim()).filter(Boolean);
  if (cleanNames.length === 0) {
    return selected;
  }

  return personalizeQuestions(selected, cleanNames);
}
