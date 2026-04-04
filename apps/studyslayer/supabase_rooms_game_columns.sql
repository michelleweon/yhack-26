-- Run in Supabase SQL editor (once) for Kahoot-style synced rounds:
alter table public.rooms add column if not exists game_phase text default 'question';
alter table public.rooms add column if not exists round_deadline timestamptz;
