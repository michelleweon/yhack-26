-- Run this in the Supabase SQL editor to scrub the repeated
-- "most likely to forget at home" friend-group prompt.

delete from public.custom_pack_questions
where style = 'for-friends'
  and lower(trim(question)) like '%most likely to forget at home%';

update public.custom_question_packs as pack
set questions = (
  select coalesce(jsonb_agg(question_entry), '[]'::jsonb)
  from jsonb_array_elements(pack.questions) as question_entry
  where not (
    lower(trim(question_entry->>'question')) like '%most likely to forget at home%'
    and exists (
      select 1
      from jsonb_array_elements_text(coalesce(question_entry->'keywords', '[]'::jsonb)) as keyword
      where keyword in ('friend-group-generated', 'friend-group-pack')
    )
  )
),
question_count = jsonb_array_length((
  select coalesce(jsonb_agg(question_entry), '[]'::jsonb)
  from jsonb_array_elements(pack.questions) as question_entry
  where not (
    lower(trim(question_entry->>'question')) like '%most likely to forget at home%'
    and exists (
      select 1
      from jsonb_array_elements_text(coalesce(question_entry->'keywords', '[]'::jsonb)) as keyword
      where keyword in ('friend-group-generated', 'friend-group-pack')
    )
  )
))
where exists (
  select 1
  from jsonb_array_elements(pack.questions) as question_entry
  where lower(trim(question_entry->>'question')) like '%most likely to forget at home%'
    and exists (
      select 1
      from jsonb_array_elements_text(coalesce(question_entry->'keywords', '[]'::jsonb)) as keyword
      where keyword in ('friend-group-generated', 'friend-group-pack')
    )
);
