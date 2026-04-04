-- Run this in Supabase SQL Editor.
-- Stores per-player answers to early custom profile questions.

create extension if not exists pgcrypto;

create table if not exists public.player_custom_profiles (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  player_name text not null,
  style text not null check (style in ('kid-friendly', 'for-friends', 'for-family', 'funny', 'outta-pocket')),
  question_id text not null,
  question_text text not null,
  answer_index integer check (answer_index is null or answer_index between 0 and 3),
  answer_text text,
  answered_at timestamptz not null default now(),
  unique (player_id, question_id)
);

alter table public.player_custom_profiles
  add column if not exists player_name text;

alter table public.player_custom_profiles
  add column if not exists style text;

alter table public.player_custom_profiles
  add column if not exists question_text text;

alter table public.player_custom_profiles
  add column if not exists answer_text text;

alter table public.player_custom_profiles
  add column if not exists answered_at timestamptz default now();

alter table public.player_custom_profiles
  alter column answer_index drop not null;

alter table public.player_custom_profiles
  alter column answered_at set default now();

update public.player_custom_profiles
set answered_at = now()
where answered_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.player_custom_profiles'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (player_id, question_id)'
  ) then
    alter table public.player_custom_profiles
      add constraint player_custom_profiles_player_question_key
      unique (player_id, question_id);
  end if;
end $$;

alter table public.player_custom_profiles
  drop constraint if exists player_custom_profiles_style_check;

alter table public.player_custom_profiles
  add constraint player_custom_profiles_style_check
  check (style in ('kid-friendly', 'for-friends', 'for-family', 'funny', 'outta-pocket'));

alter table public.player_custom_profiles
  drop constraint if exists player_custom_profiles_answer_index_check;

alter table public.player_custom_profiles
  add constraint player_custom_profiles_answer_index_check
  check (answer_index is null or answer_index between 0 and 3);

alter table public.player_custom_profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'player_custom_profiles'
      and policyname = 'player_custom_profiles_insert_all'
  ) then
    create policy player_custom_profiles_insert_all
      on public.player_custom_profiles
      for insert
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'player_custom_profiles'
      and policyname = 'player_custom_profiles_update_all'
  ) then
    create policy player_custom_profiles_update_all
      on public.player_custom_profiles
      for update
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'player_custom_profiles'
      and policyname = 'player_custom_profiles_read_all'
  ) then
    create policy player_custom_profiles_read_all
      on public.player_custom_profiles
      for select
      using (true);
  end if;
end $$;
