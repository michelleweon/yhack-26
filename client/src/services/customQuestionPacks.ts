import { supabase } from '@/services/supabaseClient';
import type { CustomPackSourceType, CustomQuestionPack, Question } from '@/types/game';

interface CustomQuestionPackRow {
  id: string;
  filename: string;
  label: string;
  source_type: CustomPackSourceType;
  source_kind: 'pdf' | 'txt';
  questions: Question[];
  question_count: number;
  created_at: string | null;
}

interface CreateCustomQuestionPackInput {
  userId: string;
  filename: string;
  label: string;
  sourceType: CustomPackSourceType;
  sourceKind: 'pdf' | 'txt';
  questions: Question[];
}

function normalizeCustomPackError(error: unknown): Error {
  if (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'PGRST205'
  ) {
    return new Error(
      'Custom packs are not set up in Supabase yet. Run apps/studyslayer/supabase_custom_question_packs.sql once in the Supabase SQL editor.'
    );
  }

  return error instanceof Error
    ? error
    : new Error('Unable to load custom packs right now.');
}

function mapPackRow(row: CustomQuestionPackRow): CustomQuestionPack {
  const questions = normalizePackQuestions(Array.isArray(row.questions) ? row.questions : []);

  return {
    id: row.id,
    filename: row.filename,
    label: row.label,
    sourceType: row.source_type,
    sourceKind: row.source_kind,
    questions,
    questionCount: questions.length,
    enabled: false,
    createdAt: row.created_at,
  };
}

function normalizePackQuestion(question: Question): Question | null {
  const normalizedQuestion = String(question.question ?? '').trim();
  const normalizedChoices = Array.isArray(question.choices)
    ? question.choices.map(choice => String(choice ?? '').trim()).filter(Boolean)
    : [];
  const normalizedKeywords = Array.isArray(question.keywords)
    ? question.keywords.map(keyword => String(keyword ?? '').trim()).filter(Boolean)
    : [];

  if (
    !normalizedQuestion
    || normalizedChoices.length < 4
    || !Number.isInteger(question.correct)
    || question.correct < 0
    || question.correct >= normalizedChoices.length
  ) {
    return null;
  }

  return {
    ...question,
    question: normalizedQuestion,
    choices: normalizedChoices,
    keywords: normalizedKeywords,
    displaySubtitle: question.displaySubtitle?.trim() || undefined,
    category: question.category?.trim() || undefined,
    source: typeof question.source === 'string'
      ? question.source.trim() || null
      : question.source ?? null,
    answerPool: Array.isArray(question.answerPool)
      ? question.answerPool.map(answer => String(answer ?? '').trim()).filter(Boolean)
      : question.answerPool,
  };
}

export function normalizePackQuestions(questions: Question[]) {
  return questions
    .map(question => normalizePackQuestion(question))
    .filter((question): question is Question => question !== null);
}

function preparePackQuestionsForSave(questions: Question[]) {
  const normalizedQuestions = normalizePackQuestions(questions);

  if (normalizedQuestions.length === 0) {
    throw new Error('This pack did not contain any valid questions to save.');
  }

  return normalizedQuestions;
}

export async function listCustomQuestionPacks(userId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('custom_question_packs')
    .select('id, filename, label, source_type, source_kind, questions, question_count, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw normalizeCustomPackError(error);
  }

  return (data ?? []).map(row => mapPackRow(row as CustomQuestionPackRow));
}

export async function createCustomQuestionPack({
  userId,
  filename,
  label,
  sourceType,
  sourceKind,
  questions,
}: CreateCustomQuestionPackInput) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const normalizedQuestions = preparePackQuestionsForSave(questions);

  const { data, error } = await supabase
    .from('custom_question_packs')
    .insert({
      user_id: userId,
      filename,
      label,
      source_type: sourceType,
      source_kind: sourceKind,
      questions: normalizedQuestions,
      question_count: normalizedQuestions.length,
    })
    .select('id, filename, label, source_type, source_kind, questions, question_count, created_at')
    .single();

  if (error) {
    throw normalizeCustomPackError(error);
  }

  return mapPackRow(data as CustomQuestionPackRow);
}

export async function deleteCustomQuestionPack(userId: string, packId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase
    .from('custom_question_packs')
    .delete()
    .eq('id', packId)
    .eq('user_id', userId);

  if (error) {
    throw normalizeCustomPackError(error);
  }
}
