export const WRONG_QUIP_TEMPLATES = [
  'Breaking news: [user_name] has entered their flop era.',
  'You moved with confidence. The problem is-you moved.',
  'listen closely [user_name], not everyone is cut out to be raccoon',
  "utterly shocking. i suppose [user_name] doesn't know ball",
  'That was a generational choke. Future textbooks will study this.',
  '[user_name], log out for me.',
  'You had ONE job. One.',
  'This is more embarrassing than when harvard lost against yale',
  'That answer just tanked your GPA.',
  'The curve is NOT saving you this time.',
] as const;

export const GOOD_QUIP_TEMPLATES = [
  "Oh so NOW you're smart? Where was this during midterms, [user_name]?",
  'Congrats [user_name], you finally justified your tuition.',
  "Congratulations, [user_name]. You've peaked. It's all downhill from here.",
  'The market believed in you... which is honestly the biggest surprise.',
  'Give it up for [user_name]-the only raccoon here with a functioning brain cell.',
  "That was so clean I'm adding it to your LinkedIn.",
  'Congrats [user_name]... even a broken clock is right twice a day.',
  "It's giving academic weapon but like... Temu version.",
  'Everyone lost money because of YOU. Reflect on that.',
  'Vegas would like a word with you.',
] as const;

export type QuipOutcome = 'correct' | 'wrong';

function replacePlayerName(template: string, playerName: string) {
  return template.replace(/\[user_name\]/g, playerName);
}

function getPresetTemplates(outcome: QuipOutcome) {
  return outcome === 'wrong' ? WRONG_QUIP_TEMPLATES : GOOD_QUIP_TEMPLATES;
}

export function getRandomPresetQuip({
  playerName,
  outcome,
  excludingTemplate,
}: {
  playerName: string;
  outcome: QuipOutcome;
  excludingTemplate?: string | null;
}) {
  const templates = getPresetTemplates(outcome);
  const availableTemplates = excludingTemplate
    ? templates.filter(template => template !== excludingTemplate)
    : templates;
  const templatePool = availableTemplates.length > 0 ? availableTemplates : templates;
  const template = templatePool[Math.floor(Math.random() * templatePool.length)] ?? templates[0];

  return {
    template,
    quip: replacePlayerName(template, playerName),
  };
}
