import type { FriendGroupPackStyle } from '@/types/game';

export interface FriendGroupQuestionSeed {
  style: FriendGroupPackStyle;
  question: string;
  answers: string[];
}

const OUTTA_POCKET_BASE_QUESTION_SEEDS = [
  {
    question: 'What would get you canceled the fastest?',
    answers: [
      'posting something bad and then defending it',
      'accidentally liking something questionable',
      'arguing in comments way too hard',
      'old tweets resurfacing',
      'somehow talking my way out of it',
    ],
  },
  {
    question: 'What is the most obvious red flag about you?',
    answers: [
      'taking forever to reply while still being online',
      'saying I am just honest right before being rude',
      'loving drama a little too much',
      'never saying sorry first',
      'caring a lot but pretending I do not',
    ],
  },
  {
    question: 'What kind of situationship would you fall into?',
    answers: [
      'a we are just vibing thing that lasts way too long',
      'only talking late at night',
      'basically dating but refusing to call it that',
      'doing all the emotional work',
      'catching real feelings first',
    ],
  },
  {
    question: 'What is the most irrational pet peeve for you?',
    answers: [
      'loud chewing',
      'slow walkers',
      'bad grammar',
      'wet bathroom floors',
      'people FaceTiming in public',
    ],
  },
  {
    question: 'Would someone in the group secretly date you?',
    answers: [
      'yes but it would get messy fast',
      'no I like peace',
      'maybe just for the plot',
      'honestly yes',
      'depends which version of me shows up',
    ],
  },
  {
    question: 'Are you fake nice or just misunderstood?',
    answers: [
      'fake nice',
      'misunderstood',
      'depends who I am around',
      'nice but a little shady',
      'actually nice and people read me wrong',
    ],
  },
  {
    question: 'What terrible advice would you give with full confidence?',
    answers: [
      'text them again',
      'quit and figure it out later',
      'they will change trust me',
      'ignore it until it goes away',
      'bad advice that somehow works',
    ],
  },
  {
    question: 'What double standard do you definitely have?',
    answers: [
      'getting mad at late replies while doing the same thing',
      'saying I hate drama while staying in it',
      'judging people while asking for grace',
      'wanting honesty until it hurts my feelings',
      'telling people to be direct while still hinting',
    ],
  },
  {
    question: 'How would you ruin a group plan?',
    answers: [
      'showing up late',
      'canceling last minute',
      'changing the plan halfway through',
      'not replying at all',
      'somehow being the only organized one there',
    ],
  },
  {
    question: 'Why would someone avoid swapping lives with you?',
    answers: [
      'too chaotic',
      'too stressful',
      'too unpredictable',
      'impossible to keep up with',
      'honestly my life seems fun',
    ],
  },
  {
    question: 'What embarrassing moment did you probably have recently?',
    answers: [
      'tripping in public and pretending it did not happen',
      'waving at someone who was not waving at me',
      'sending a message to the wrong person',
      "forgetting someone's name mid-conversation",
      'walking into the wrong place with confidence',
    ],
  },
  {
    question: 'When do you give "did not shower" energy?',
    answers: [
      'early mornings',
      'after a long day',
      'during stressful weeks',
      'lazy weekends',
      'when I say I am not even going out anyway',
    ],
  },
  {
    question: 'What weird thing do you do when nobody is around?',
    answers: [
      'talking to myself',
      'replaying fake arguments',
      'checking my angles in mirrors',
      'making up fake speeches',
      'rewatching the same clip ten times',
    ],
  },
  {
    question: 'How often do you check yourself out in reflections?',
    answers: [
      'every reflective surface',
      'whenever I pass a mirror',
      'more than I would admit',
      'lowkey all the time',
      'only when I feel cute',
    ],
  },
  {
    question: 'What do you pretend not to care about?',
    answers: [
      'what people think',
      'attention',
      'my crush',
      'being included',
      'how I look',
    ],
  },
  {
    question: 'What phrase do you say way too much?',
    answers: [
      'literally',
      'I am dead',
      'it is not that serious',
      'lowkey',
      'be so for real',
    ],
  },
  {
    question: 'Why do you have questionable taste in people?',
    answers: [
      'ignoring red flags',
      'falling for potential every time',
      'confusing chaos with chemistry',
      'getting bored by normal people',
      'trusting too fast',
    ],
  },
  {
    question: 'What makes your job the worst for you?',
    answers: [
      'the hours',
      'the people',
      'the pay',
      'nonstop stress',
      'pretending I do not hate it',
    ],
  },
  {
    question: 'Would you choose loyal but boring or toxic but exciting?',
    answers: [
      'saying loyal and still picking toxic',
      'toxic every time',
      'loyal but still complaining',
      'depends on the mood',
      'avoiding both somehow',
    ],
  },
  {
    question: 'What lie would you get caught in immediately?',
    answers: [
      'I am on the way',
      'I did not see the message',
      'I am almost done',
      'I forgot',
      'I was not even thinking about it',
    ],
  },
] satisfies Array<Omit<FriendGroupQuestionSeed, 'style'>>;

export function getFriendGroupBuildPackName(includeNames: boolean) {
  return includeNames
    ? 'Friend Group: Build Custom Pack Names'
    : 'Friend Group: Build Custom Pack No Names';
}

const NAMED_FRIEND_GROUP_BASE_QUESTION_SEEDS = [
  {
    question: 'what would get [user_name] canceled the fastest',
    answers: [
      "posting something and then saying y'all are too sensitive",
      'Accidentally liking something questionable',
      "arguing in comments like it's their job",
      'Old tweets coming back up',
      "honestly probably nothing they'd talk their way out of it",
    ],
  },
  {
    question: "what is [user_name]'s most obvious red flag",
    answers: [
      'takes forever to reply but is always online',
      "Says i'm just honest before being rude",
      'lowkey loves drama',
      'Never says sorry first',
      "cares too much but pretends they don't",
    ],
  },
  {
    question: 'what kind of situationship would [user_name] fall into',
    answers: [
      "the we're just vibing one that lasts way too long",
      'Only talks late at night',
      "basically dating but won't admit it",
      'Doing all the emotional work',
      'one where they actually catch real feelings',
    ],
  },
  {
    question: "what's [user_name]'s most irrational pet peeve",
    answers: [
      'people chewing loud',
      'Slow walkers',
      'people who say literally wrong',
      'Dry texters',
      'when something just feels off for no reason',
    ],
  },
  {
    question: 'would you ever date [user_name] in secret why or why not',
    answers: [
      "yeah but it'd be messy",
      'No i like peace',
      'maybe just for the plot',
      "Honestly yeah they're actually kinda great",
      'depends how things are going',
    ],
  },
  {
    question: 'is [user_name] fake nice or just misunderstood',
    answers: [
      'Fake nice',
      'misunderstood',
      "Depends who they're with",
      'nice but a little shady',
      'actually just nice people read them wrong',
    ],
  },
  {
    question: 'what terrible advice would [user_name] give with full confidence',
    answers: [
      'just text them again who cares',
      "Quit your job you'll figure it out",
      "they'll change trust me",
      "Ignore it it'll go away",
      'honestly sometimes their advice lowkey works',
    ],
  },
  {
    question: 'what double standard does [user_name] definitely have',
    answers: [
      'gets mad at late replies but does it too',
      'Says they hate drama but stays in it',
      'judges people but wants grace',
      "Wants honesty but can't handle it",
      'holds themselves to a higher standard than others',
    ],
  },
  {
    question: 'how would [user_name] ruin a group plan',
    answers: [
      'showing up late',
      'Canceling last minute',
      'changing the plan halfway',
      'Not replying at all',
      'or somehow being the only one who keeps it together',
    ],
  },
  {
    question: 'why would you avoid swapping lives with [user_name]',
    answers: [
      'too chaotic',
      'Too stressful',
      'too unpredictable',
      "i wouldn't survive a day",
      "honestly i wouldn't avoid it their life seems fun",
    ],
  },
  {
    question: 'what embarrassing moment has [user_name] definitely had recently',
    answers: [
      'tripped in public and kept walking',
      "Waved at someone who wasn't waving at them",
      'sent a message to the wrong person',
      "Forgot someone's name mid convo",
      'walked into the wrong place confidently',
    ],
  },
  {
    question: "when does [user_name] give didn't shower energy",
    answers: [
      'early mornings',
      'After a long day',
      'during stressful weeks',
      'Lazy weekends',
      "when they say i'm not going out anyway",
    ],
  },
  {
    question: 'what weird thing does [user_name] do when alone',
    answers: [
      'talks to themselves',
      'Replays conversations over and over',
      'makes up fake scenarios',
      'Just stands there thinking',
      'randomly dances',
    ],
  },
  {
    question: 'how often does [user_name] check themselves out',
    answers: [
      'every reflective surface',
      'Whenever they pass a mirror',
      "more than they'd admit",
      'Lowkey all the time',
      'only when they feel cute',
    ],
  },
  {
    question: 'what does [user_name] pretend not to care about',
    answers: [
      'what people think',
      'Likes and attention',
      'their crush',
      'Being included',
      'how they look',
    ],
  },
  {
    question: 'what phrase does [user_name] overuse',
    answers: [
      'literally',
      "I'm dead",
      "it's not that serious",
      'Lowkey',
      'be so for real',
    ],
  },
  {
    question: 'why does [user_name] have questionable taste in people',
    answers: [
      'ignores red flags',
      'Falls for potential every time',
      'confuses chaos with chemistry',
      'Gets bored of normal people',
      'trusts too fast',
    ],
  },
  {
    question: "what makes [user_name]'s job the worst",
    answers: [
      'the hours',
      'The people',
      'the pay',
      "It's just stressful",
      "they don't even like it",
    ],
  },
  {
    question: 'would [user_name] choose loyal-but-boring or toxic-but-exciting',
    answers: [
      'says loyal but picks toxic',
      'Toxic every time',
      'loyal but complains',
      'Depends on the mood',
      'avoids both somehow',
    ],
  },
  {
    question: 'what lie would [user_name] get caught in immediately',
    answers: [
      "i'm on the way",
      "I didn't see your message",
      "i'm almost done",
      'I forgot my bad',
      "i wasn't even thinking about it",
    ],
  },
] satisfies Array<Omit<FriendGroupQuestionSeed, 'style'>>;

function applyStyle(
  style: FriendGroupPackStyle,
  seeds: Array<Omit<FriendGroupQuestionSeed, 'style'>>
): FriendGroupQuestionSeed[] {
  return seeds.map(seed => ({
    style,
    question: seed.question,
    answers: seed.answers,
  }));
}

export function getLocalFriendGroupQuestionSeeds(
  style: FriendGroupPackStyle,
  options?: { includeNames?: boolean }
) {
  return applyStyle(
    style,
    options?.includeNames
      ? NAMED_FRIEND_GROUP_BASE_QUESTION_SEEDS
      : OUTTA_POCKET_BASE_QUESTION_SEEDS
  );
}
