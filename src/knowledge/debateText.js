// Plain-language framing for a debate card: the question both statements answer, how the two
// statements relate, and what that means for the traveller. Only uses what the data supports:
// a contradiction is claimed only when the language-model check said so.
import { ASPECTS } from './contradictions.js';

const QUESTION = {
  crowds: (s) => `How busy is ${s}?`,
  price: (s) => `Is ${s} good value for money?`,
  safety: (s) => `How safe is ${s}?`,
  quality: (s) => `Is ${s} worth it?`,
  food: (s) => `How good is the food in ${s}?`,
  cleanliness: (s) => `How clean is ${s}?`,
  opening: (s) => `When can you visit ${s}, and do you need to book?`,
  transport: (s) => `How easy is it to get around ${s}?`,
  weather: (s) => `What is the weather like in ${s}?`,
  noise: (s) => `How quiet is ${s}?`,
};

const ASPECT_NAME = {
  crowds: 'how busy it is', price: 'prices', safety: 'safety', quality: 'whether it is worth it', food: 'the food',
  cleanliness: 'cleanliness', opening: 'opening times and booking', transport: 'getting around', weather: 'the weather', noise: 'noise',
};

const FOR_YOU = {
  crowds: 'Matters if you dislike crowds or queues. The day and time of your visit may decide which statement applies.',
  price: 'Matters for your budget. Prices change, so check current ones before you go.',
  safety: 'These are travellers\' impressions, not official advice. Check your government\'s travel advice.',
  quality: 'Largely a matter of taste: think about which description fits your interests.',
  food: 'A matter of taste, and of where exactly you eat.',
  cleanliness: 'May differ by area and time of day.',
  opening: 'Check the official website for current opening hours and booking.',
  transport: 'Matters for how you plan the way between your stops.',
  weather: 'Matters for when you travel and what you pack.',
  noise: 'Matters if you look for calm places, for example for staying overnight.',
};

// City-wide topic cards: the topic says more about the subject than a shared keyword
// (e.g. "daylight hours" in a Climate pair is about the weather, not opening hours)
const TOPIC_ASPECT = {
  'Climate': 'weather', 'Safety & Health': 'safety', 'Transport': 'transport', 'Food & Drink': 'food', 'Money & Costs': 'price',
};
export const subjectAspect = (card) => (!card.onMap && TOPIC_ASPECT[card.topic]) || card.aspect;

/** Words both statements share about their subject, e.g. ["crowded", "queues"]. */
export function sharedWords(card) {
  const re = ASPECTS[card.aspect];
  if (!re) return [];
  const words = (t) => (t.match(new RegExp(re.source, 'gi')) || []).map((w) => w.toLowerCase());
  return [...new Set([...words(card.a.text), ...words(card.b.text)])].slice(0, 4);
}

/** The place or city the card is about, as it reads in a sentence. */
export function subjectOf(card) {
  if (card.onMap) return card.place;
  return (card.city || String(card.place || '').split(' · ')[0] || 'this city').split(',')[0];
}

export function centralQuestion(card) {
  const s = subjectOf(card);
  const q = QUESTION[subjectAspect(card)];
  return q ? q(s) : card.onMap ? `What is ${s} really like?` : `What do sources say about ${card.topic.toLowerCase()} in ${s}?`;
}

export const aspectName = (aspect) => ASPECT_NAME[aspect] || 'this subject';

/**
 * How the two statements relate.
 * kind: 'context' (both can be right, under different conditions), 'contradiction' (model-checked),
 *       'tone' (opposite tone, not checked)
 */
export function relationOf(card) {
  if (card.conditionSides || card.label === 'depends') {
    const c = card.conditionSides;
    return {
      kind: 'context', title: 'Probably both right, in different situations',
      text: c ? `One statement is about ${c.a}, the other about ${c.b} (${c.label}).` : (card.condition || 'The check found that the answer depends on the situation.'),
    };
  }
  if (card.kind === 'checked' && card.label === 'contradiction') {
    return { kind: 'contradiction', title: 'Possible contradiction', text: 'An automatic language check found that these statements contradict each other. It can be wrong.' };
  }
  return { kind: 'tone', title: 'Different views, not checked', text: `One source sounds positive about ${aspectName(subjectAspect(card))}, the other critical. Whether they really contradict each other has not been checked.` };
}

export function forYou(card) {
  const base = FOR_YOU[subjectAspect(card)] || 'Read both statements and decide which fits your trip.';
  return relationOf(card).kind === 'context' ? `Both may be right. ${base}` : base;
}

/** Splits a statement into parts, marking the words that name the shared subject (for highlighting). */
export function markAspect(text, aspect) {
  const re = ASPECTS[aspect];
  if (!re) return [{ text, mark: false }];
  const g = new RegExp(re.source, 'gi');
  const parts = []; let last = 0; let m;
  while ((m = g.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), mark: false });
    parts.push({ text: m[0], mark: true });
    last = m.index + m[0].length;
    if (m[0].length === 0) g.lastIndex++;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mark: false });
  return parts;
}
