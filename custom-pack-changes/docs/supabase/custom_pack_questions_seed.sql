-- Run this in the Supabase SQL Editor.
-- Creates a reusable custom-pack question bank and seeds:
-- 20 questions per style: kid-friendly, for-friends, for-family, funny, outta-pocket.

create extension if not exists pgcrypto;

create table if not exists public.custom_pack_questions (
  id uuid primary key default gen_random_uuid(),
  style text not null check (style in ('kid-friendly', 'for-friends', 'for-family', 'funny', 'outta-pocket')),
  question text not null,
  options jsonb not null,
  correct integer not null check (correct between 0 and 3),
  probabilities jsonb not null default '[0.25,0.25,0.25,0.25]'::jsonb,
  created_at timestamptz not null default now(),
  unique (style, question)
);

alter table public.custom_pack_questions
  add column if not exists probabilities jsonb not null default '[0.25,0.25,0.25,0.25]'::jsonb;

alter table public.custom_pack_questions
  add column if not exists created_at timestamptz default now();

alter table public.custom_pack_questions
  alter column probabilities set default '[0.25,0.25,0.25,0.25]'::jsonb;

update public.custom_pack_questions
set probabilities = '[0.25,0.25,0.25,0.25]'::jsonb
where probabilities is null;

update public.custom_pack_questions
set created_at = now()
where created_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.custom_pack_questions'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (style, question)'
  ) then
    alter table public.custom_pack_questions
      add constraint custom_pack_questions_style_question_key
      unique (style, question);
  end if;
end $$;

alter table public.custom_pack_questions
  drop constraint if exists custom_pack_questions_style_check;

alter table public.custom_pack_questions
  add constraint custom_pack_questions_style_check
  check (style in ('kid-friendly', 'for-friends', 'for-family', 'funny', 'outta-pocket'));

alter table public.custom_pack_questions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'custom_pack_questions'
      and policyname = 'custom_pack_questions_read_all'
  ) then
    create policy custom_pack_questions_read_all
      on public.custom_pack_questions
      for select
      using (true);
  end if;
end $$;

delete from public.custom_pack_questions
where style in ('kid-friendly', 'for-friends', 'for-family', 'funny', 'outta-pocket');

insert into public.custom_pack_questions (style, question, options, correct, probabilities) values
('kid-friendly','What time do you usually wake up on school days?','["Before 7 AM","7-8 AM","8-9 AM","After 9 AM"]'::jsonb,1,'[0.2,0.5,0.2,0.1]'::jsonb),
('kid-friendly','What is your favorite after-school activity?','["Sports","Gaming","Reading","Drawing/Crafts"]'::jsonb,0,'[0.4,0.25,0.15,0.2]'::jsonb),
('kid-friendly','Which snack do you pick most often?','["Fruit","Chips","Cookies","Yogurt"]'::jsonb,1,'[0.2,0.35,0.3,0.15]'::jsonb),
('kid-friendly','How do you usually get to school?','["Walk","Car","Bus","Bike"]'::jsonb,2,'[0.15,0.35,0.4,0.1]'::jsonb),
('kid-friendly','Which subject feels easiest right now?','["Math","Science","Reading","Art"]'::jsonb,2,'[0.2,0.25,0.35,0.2]'::jsonb),
('kid-friendly','What do you bring most days?','["Water bottle","Notebook","Both","Neither"]'::jsonb,2,'[0.2,0.15,0.55,0.1]'::jsonb),
('kid-friendly','What is your usual bedtime?','["Before 8 PM","8-9 PM","9-10 PM","After 10 PM"]'::jsonb,1,'[0.15,0.4,0.3,0.15]'::jsonb),
('kid-friendly','How do you like your room?','["Very tidy","Mostly tidy","A little messy","Creative chaos"]'::jsonb,2,'[0.15,0.25,0.35,0.25]'::jsonb),
('kid-friendly','Which pet would you choose?','["Dog","Cat","Fish","No pet"]'::jsonb,0,'[0.45,0.3,0.15,0.1]'::jsonb),
('kid-friendly','When homework is hard, what do you do first?','["Ask for help","Take a short break","Try another problem","Look it up"]'::jsonb,0,'[0.35,0.25,0.25,0.15]'::jsonb),
('kid-friendly','What is your favorite weekend vibe?','["Outdoors","Games at home","Family time","Sleep in"]'::jsonb,2,'[0.2,0.25,0.35,0.2]'::jsonb),
('kid-friendly','How do you usually celebrate a win?','["High five","Snack","Tell family","Happy dance"]'::jsonb,3,'[0.2,0.2,0.25,0.35]'::jsonb),
('kid-friendly','Which school lunch sounds best?','["Pizza","Sandwich","Pasta","Rice bowl"]'::jsonb,0,'[0.4,0.2,0.25,0.15]'::jsonb),
('kid-friendly','What helps you focus most?','["Quiet room","Music","Timer","Friend nearby"]'::jsonb,0,'[0.4,0.2,0.25,0.15]'::jsonb),
('kid-friendly','Who is most likely to finish chores first this week?','["{player}","A sibling","A parent","No one"]'::jsonb,0,'[0.42,0.24,0.24,0.1]'::jsonb),
('kid-friendly','Who probably packs the neatest backpack?','["{player}","Best friend","Teacher","Random guess"]'::jsonb,0,'[0.48,0.22,0.18,0.12]'::jsonb),
('kid-friendly','Who is most likely to remember every instruction?','["{player}","Class helper","Team captain","Nobody"]'::jsonb,0,'[0.46,0.24,0.2,0.1]'::jsonb),
('kid-friendly','Who is most likely to choose extra reading time?','["{player}","The quiet kid","The artist","The gamer"]'::jsonb,0,'[0.34,0.32,0.18,0.16]'::jsonb),
('kid-friendly','When you are tired, what do you want first?','["Nap","Snack","Cartoons","Go outside"]'::jsonb,1,'[0.28,0.34,0.2,0.18]'::jsonb),
('kid-friendly','How do you usually start your day?','["Quick breakfast","Slow morning","Rush out","Exercise"]'::jsonb,0,'[0.34,0.28,0.24,0.14]'::jsonb),

('for-friends','What is your go-to plan when everyone is free?','["Eat out","Watch a movie","Game night","Just vibe and talk"]'::jsonb,2,'[0.22,0.24,0.36,0.18]'::jsonb),
('for-friends','How quickly do you answer the group chat?','["Instantly","Within an hour","Later tonight","Next day"]'::jsonb,1,'[0.3,0.4,0.2,0.1]'::jsonb),
('for-friends','What role do you usually play in plans?','["Planner","Driver","Hype person","Last-minute joiner"]'::jsonb,2,'[0.24,0.2,0.34,0.22]'::jsonb),
('for-friends','How likely are you to be on time?','["Always","Usually","Sometimes","Rarely"]'::jsonb,1,'[0.26,0.42,0.22,0.1]'::jsonb),
('for-friends','What is your late-night craving?','["Fries","Pizza","Noodles","Sweet snacks"]'::jsonb,1,'[0.2,0.38,0.24,0.18]'::jsonb),
('for-friends','Who usually picks the music first?','["{player}","Whoever drives","The host","Random shuffle"]'::jsonb,1,'[0.28,0.34,0.22,0.16]'::jsonb),
('for-friends','Which friend group moment is most likely this week?','["Meme spam","Long voice note","Sudden plan","Plan canceled"]'::jsonb,0,'[0.38,0.2,0.28,0.14]'::jsonb),
('for-friends','How do you react to "we need to talk"?','["Panic","Ask for context","Ignore for now","Send a meme"]'::jsonb,1,'[0.24,0.38,0.18,0.2]'::jsonb),
('for-friends','What is your default hangout time?','["Morning","Afternoon","Evening","Late night"]'::jsonb,2,'[0.12,0.26,0.42,0.2]'::jsonb),
('for-friends','How many photos do you usually take?','["0-2","3-10","11-25","Too many"]'::jsonb,1,'[0.18,0.42,0.26,0.14]'::jsonb),
('for-friends','What is your most likely excuse for being late?','["Traffic","Still getting ready","Phone died","Lost track of time"]'::jsonb,1,'[0.24,0.34,0.14,0.28]'::jsonb),
('for-friends','Who is most likely to text "on my way" while still at home?','["{player}","The funny one","The busy one","No one"]'::jsonb,0,'[0.44,0.24,0.2,0.12]'::jsonb),
('for-friends','Who is most likely to suggest food first?','["{player}","The gym friend","The driver","The quiet one"]'::jsonb,0,'[0.5,0.16,0.18,0.16]'::jsonb),
('for-friends','Who is most likely to keep a backup charger?','["{player}","The tech friend","The host","Nobody"]'::jsonb,1,'[0.24,0.44,0.2,0.12]'::jsonb),
('for-friends','What is your "we made it" celebration?','["Food","Photos","Music","Go home"]'::jsonb,0,'[0.38,0.22,0.24,0.16]'::jsonb),
('for-friends','How do you usually pick a place?','["Vote in chat","First suggestion wins","Whoever is closest","Random"]'::jsonb,0,'[0.36,0.28,0.22,0.14]'::jsonb),
('for-friends','What kind of friend are you in group projects?','["Organizer","Researcher","Presenter","Polisher"]'::jsonb,0,'[0.36,0.26,0.2,0.18]'::jsonb),
('for-friends','When plans change suddenly, you usually...','["Adapt fast","Need a minute","Prefer to cancel","Suggest backup plan"]'::jsonb,3,'[0.28,0.2,0.18,0.34]'::jsonb),
('for-friends','Your ideal friend trip has...','["Packed itinerary","A few must-do spots","No plan","Mostly food stops"]'::jsonb,1,'[0.2,0.34,0.24,0.22]'::jsonb),
('for-family','Who usually sets the schedule at home?','["A parent","A grandparent","Everyone together","No one"]'::jsonb,0,'[0.52,0.14,0.24,0.1]'::jsonb),
('for-family','What is your family dinner vibe?','["Everyone together","Eat in shifts","Quick meals","Takeout night"]'::jsonb,0,'[0.44,0.2,0.18,0.18]'::jsonb),
('for-family','Who is most likely to remind others about plans?','["{player}","A parent","Sibling","Family group chat"]'::jsonb,1,'[0.24,0.42,0.18,0.16]'::jsonb),
('for-family','What starts most family conversations?','["Food","School/work","Travel","Funny stories"]'::jsonb,3,'[0.2,0.24,0.18,0.38]'::jsonb),
('for-family','How does your family usually spend weekends?','["Outing","Home projects","Sports/activities","Rest at home"]'::jsonb,3,'[0.22,0.2,0.22,0.36]'::jsonb),
('for-family','Who is most likely to keep old photos organized?','["{player}","Parent","Grandparent","Nobody"]'::jsonb,2,'[0.18,0.3,0.4,0.12]'::jsonb),
('for-family','What is the usual family movie vote result?','["Action","Comedy","Animated","No agreement"]'::jsonb,1,'[0.22,0.36,0.26,0.16]'::jsonb),
('for-family','How do decisions usually get made?','["One person decides","Group vote","By convenience","Last minute"]'::jsonb,1,'[0.2,0.42,0.24,0.14]'::jsonb),
('for-family','Who is most likely to check everyone got home safely?','["{player}","Parent","Sibling","Nobody"]'::jsonb,1,'[0.24,0.46,0.2,0.1]'::jsonb),
('for-family','What is most likely on the kitchen table?','["Fruit","Mail","Snacks","A random charger"]'::jsonb,1,'[0.2,0.36,0.3,0.14]'::jsonb),
('for-family','How does your family handle birthdays?','["Big celebration","Small dinner","Call/video only","Flexible"]'::jsonb,0,'[0.38,0.3,0.14,0.18]'::jsonb),
('for-family','Who starts cleanup first after meals?','["{player}","Parent","Whoever cooked","Nobody"]'::jsonb,2,'[0.2,0.28,0.4,0.12]'::jsonb),
('for-family','What causes the longest family debate?','["Where to eat","Travel plans","TV remote","Budget"]'::jsonb,0,'[0.4,0.24,0.18,0.18]'::jsonb),
('for-family','When someone is stressed, family usually...','["Gives space","Offers help","Cracks jokes","Changes topic"]'::jsonb,1,'[0.24,0.42,0.2,0.14]'::jsonb),
('for-family','Who is most likely to remember every relative birthday?','["{player}","Parent","Grandparent","Calendar app"]'::jsonb,2,'[0.16,0.24,0.44,0.16]'::jsonb),
('for-family','What is your family’s most common outing?','["Grocery run","Restaurant","Park","Visit relatives"]'::jsonb,3,'[0.2,0.22,0.2,0.38]'::jsonb),
('for-family','How often does your family eat together weekly?','["1-2 times","3-4 times","5-6 times","Every day"]'::jsonb,1,'[0.2,0.38,0.26,0.16]'::jsonb),
('for-family','Who is most likely to ask "did you eat yet?"','["{player}","Parent","Grandparent","Sibling"]'::jsonb,1,'[0.2,0.46,0.22,0.12]'::jsonb),
('for-family','What best describes your family group chat?','["Very active","Mostly updates","Only emergencies","Silent"]'::jsonb,1,'[0.24,0.4,0.2,0.16]'::jsonb),
('for-family','Who is most likely to plan the next gathering?','["{player}","Parent","Aunt/uncle","Nobody"]'::jsonb,2,'[0.22,0.3,0.36,0.12]'::jsonb),

('funny','What is your most dramatic "I am late" excuse?','["My alarm betrayed me","My sock disappeared","I time-traveled","I forgot physics"]'::jsonb,0,'[0.36,0.24,0.18,0.22]'::jsonb),
('funny','Which snack controls your personality after 10 PM?','["Chips","Chocolate","Instant noodles","Frozen leftovers"]'::jsonb,2,'[0.2,0.24,0.34,0.22]'::jsonb),
('funny','What is your chaos level in the kitchen?','["Measured chef","Mostly fine","Mild chaos","Fire alarm energy"]'::jsonb,2,'[0.16,0.24,0.38,0.22]'::jsonb),
('funny','Who is most likely to say "one more episode"?','["{player}","The responsible friend","The morning person","No one"]'::jsonb,0,'[0.48,0.18,0.18,0.16]'::jsonb),
('funny','What is your emergency confidence phrase?','["I got this","We improvise","Trust the process","Run"]'::jsonb,1,'[0.24,0.38,0.24,0.14]'::jsonb),
('funny','Which object disappears around you most often?','["Keys","Charger","Water bottle","Headphones"]'::jsonb,1,'[0.26,0.34,0.22,0.18]'::jsonb),
('funny','How do you react to "we need to present in 5"?','["Smile and go","Speed panic","Volunteer someone else","Crack a joke"]'::jsonb,3,'[0.2,0.28,0.18,0.34]'::jsonb),
('funny','What is your suspiciously specific talent?','["Remembering random facts","Finding good food","Making playlists","Napping anywhere"]'::jsonb,0,'[0.34,0.24,0.22,0.2]'::jsonb),
('funny','Who is most likely to send a voice note instead of texting?','["{player}","The storyteller","The driver","Nobody"]'::jsonb,1,'[0.24,0.42,0.2,0.14]'::jsonb),
('funny','What is your default pose in group photos?','["Peace sign","Awkward smile","Laughing mid-shot","Looking away"]'::jsonb,2,'[0.2,0.28,0.34,0.18]'::jsonb),
('funny','What is your "I am productive" soundtrack?','["Lofi beats","Movie soundtrack","Silence","Random chaos playlist"]'::jsonb,0,'[0.38,0.24,0.2,0.18]'::jsonb),
('funny','Who is most likely to clap when food arrives?','["{player}","The foodie","The polite one","Nobody"]'::jsonb,1,'[0.24,0.44,0.2,0.12]'::jsonb),
('funny','How do you respond to a tiny inconvenience?','["Stay calm","Comic monologue","Dramatic sigh","Ignore it"]'::jsonb,2,'[0.22,0.24,0.34,0.2]'::jsonb),
('funny','Which phrase are you most likely to say this week?','["I am locked in","It is what it is","Who planned this","We ball"]'::jsonb,1,'[0.26,0.34,0.2,0.2]'::jsonb),
('funny','Who is most likely to narrate their own life like a movie?','["{player}","The theatre kid","The introvert","The engineer"]'::jsonb,1,'[0.24,0.46,0.12,0.18]'::jsonb),
('funny','What turns a normal day into a saga for you?','["Missed bus","Wrong coffee order","Dead phone","Unexpected rain"]'::jsonb,0,'[0.34,0.22,0.24,0.2]'::jsonb),
('funny','What is your peak "I tried" meal?','["Cereal","Toast","Microwaved leftovers","Delivery"]'::jsonb,2,'[0.2,0.18,0.4,0.22]'::jsonb),
('funny','Who is most likely to open 20 tabs and forget why?','["{player}","The multitasker","The researcher","No one"]'::jsonb,1,'[0.24,0.44,0.2,0.12]'::jsonb),
('funny','How do you usually end a chaotic day?','["Gym","Long shower","Scroll and sleep","Late snack"]'::jsonb,2,'[0.16,0.24,0.4,0.2]'::jsonb),
('funny','What is your accidental superpower?','["Finding shortcuts","Overexplaining","Spotting drama","Remembering tiny details"]'::jsonb,3,'[0.22,0.24,0.2,0.34]'::jsonb),

('outta-pocket','If your group had a reality show, who is getting canceled first?','["The oversharer","The instigator","The fake nice one","The one with old tweets","The one who swears it was satire"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','What is your biggest red flag?','["I overthink everything","I ghost texts","I love attention too much","I get bored fast","I act fine when I am not"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','Who would accidentally start a situationship and stay in it for 2 years?','["The flirt","The busiest one","The one who hates labels","The serial texter","The ''we are just vibing'' one"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','What is your most irrational pet peeve?','["Loud chewing","Slow walkers","Bad grammar","Wet bathroom floors","People who FaceTime in public"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','Who here would you secretly date?','["The funniest one","The quiet one","The one with good style","No comment","The one with a bad attitude"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','Who is most likely to be fake nice?','["The people pleaser","The smooth talker","The one who says ''love ya'' to everyone","The gossip","The one who smiles through shade"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','Who gives the worst advice but with confidence?','["The loud one","The delusional one","The relationship expert with no relationships","The motivational speaker","The one who says ''trust me'' first"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','What is your biggest double standard?','["I hate clingy people but want attention","I judge replies then disappear","I want honesty but get defensive","I preach balance and choose chaos","I say be direct and still hint"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','Who is most likely to ruin a group plan?','["The late one","The flaky one","The one who changes the plan last minute","The broke one","The one who says ''let us see''"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','If you had to swap lives with someone here, who are you avoiding?','["The overbooked one","The dramatic one","The one with too much family drama","The one always in trouble","The one who never sleeps"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','Who here has definitely had a "bathroom emergency" recently?','["The lactose intolerant one","The one always leaving suddenly","The coffee addict","The chaotic eater","The one who trusted street food"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','Who here gives "I did not shower" energy?','["The hoodie repeater","The bedhead one","The gym-to-class speedrunner","The dry shampoo ambassador","The one in yesterday clothes"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','What is something weird you do when no one is watching?','["Talk to myself","Practice fake arguments","Check angles in mirrors","Make up fake speeches","Rewatch the same clip ten times"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','Who here checks themselves out in reflections way too often?','["The style icon","The one fixing their hair every minute","The gym one","The main character","The one who loves a mirror selfie"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','What is something you pretend not to care about?','["Who viewed my story","Getting invited first","Looking cool","Winning every argument","Being everyone favorite"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','What is something you say way too much?','["It is not that deep","I am dead","Lowkey","Be so serious","That is crazy"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','Who here do you think has the worst taste in people?','["The fixer","The one who loves red flags","The hopeless romantic","The one who says ''I can change them''","The one who ignores every warning"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','Who here has the worst job?','["The customer service survivor","The one with weird hours","The one underpaid for everything","The one with the nightmare boss","The one living on tips and vibes"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','What is the dumbest reason you have been mad at someone?','["They texted ''k''","They liked a story and said nothing","They walked too slow","They copied my joke","They did not share fries"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb),
('outta-pocket','Who here would get caught lying the fastest?','["The nervous laugher","The oversharer","The one who forgets details","The bad actor","The one who talks too much"]'::jsonb,0,'[0.25,0.25,0.25,0.25]'::jsonb)
on conflict (style, question) do nothing;
