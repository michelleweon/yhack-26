-- Run in the Supabase SQL editor once.

create extension if not exists pgcrypto;

create table if not exists public.custom_question_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  label text not null,
  source_type text not null check (source_type in ('transcript', 'enemies', 'trash', 'viruses', 'other')),
  source_kind text not null check (source_kind in ('pdf', 'txt')),
  questions jsonb not null,
  question_count integer not null default 0,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'custom_question_packs_questions_array_check'
      and conrelid = 'public.custom_question_packs'::regclass
  ) then
    alter table public.custom_question_packs
      add constraint custom_question_packs_questions_array_check
      check (jsonb_typeof(questions) = 'array');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'custom_question_packs_question_count_matches_questions_check'
      and conrelid = 'public.custom_question_packs'::regclass
  ) then
    alter table public.custom_question_packs
      add constraint custom_question_packs_question_count_matches_questions_check
      check (question_count = jsonb_array_length(questions));
  end if;
end $$;

alter table public.custom_question_packs enable row level security;

drop policy if exists "custom packs are readable by owner" on public.custom_question_packs;
create policy "custom packs are readable by owner"
on public.custom_question_packs
for select
using (auth.uid() = user_id);

drop policy if exists "custom packs are insertable by owner" on public.custom_question_packs;
create policy "custom packs are insertable by owner"
on public.custom_question_packs
for insert
with check (auth.uid() = user_id);

drop policy if exists "custom packs are updatable by owner" on public.custom_question_packs;
create policy "custom packs are updatable by owner"
on public.custom_question_packs
for update
using (auth.uid() = user_id);

drop policy if exists "custom packs are deletable by owner" on public.custom_question_packs;
create policy "custom packs are deletable by owner"
on public.custom_question_packs
for delete
using (auth.uid() = user_id);
