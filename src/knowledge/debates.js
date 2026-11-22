// Debate cards: pairs of statements where sources may disagree, for the traveller to judge.
//   • checked pairs (the NLI model said "contradiction" / "depends") → "Which do you trust?"
//   • unchecked pairs (opposite tone, same aspect, different sources) → "Do these really disagree?"
// Your answers become labels on the pair (stored with the trip in knowledgeGraph.verified.pairs,
// marked by: 'you'), so the Truth lens, pins and itinerary badges use them right away.
import { candidatePairs, explainByConditions, aspectsOf, plainText } from './contradictions.js';

const JUNK = /\*\*|\]\(|={2,}|\* \*|^\W|\[\s/;
const OPPOSITE = (a, b) => (a === 'positive' && b === 'negative') || (a === 'negative' && b === 'positive');
const PRIORITY_ASPECTS = { safety: 3, crowds: 2.5, price: 2, opening: 2, weather: 1.5, food: 1 };

export const pairKey = (aId, bId) => [aId, bId].sort().join('|');
export const topicOf = (place) => String(place || '').replace(/^.*? · /, '');

/** Builds the card deck. answered: Set of pairKey already judged. */
export function buildDebates(nodes, verified, { answered = new Set(), limit = 40 } = {}) {
  const byId = new Map((nodes || []).map((n) => [n.id, n]));
  const cards = [];
  const used = new Set();
  // 1 · pairs the model already checked
  for (const p of verified?.pairs || []) {
    if (p.by === 'you' || (p.label !== 'contradiction' && p.label !== 'depends')) continue;
    const a = byId.get(p.aId), b = byId.get(p.bId);
    if (!a || !b) continue;
    const key = pairKey(a.id, b.id);
    if (answered.has(key) || used.has(key)) continue;
    used.add(key);
    cards.push(toCard(a, b, { kind: 'checked', label: p.label, condition: p.condition?.text || null, aspects: p.aspects, weight: 10 }));
  }
  // 2 · unchecked candidates with opposite tone
  for (const p of candidatePairs(nodes || [], { maxTotal: 400, maxLength: 240 })) {
    if (!OPPOSITE(p.a.evaluation?.sentiment, p.b.evaluation?.sentiment)) continue;
    if (JUNK.test(p.a.claim) || JUNK.test(p.b.claim)) continue;
    const key = pairKey(p.a.id, p.b.id);
    if (answered.has(key) || used.has(key)) continue;
    used.add(key);
    const cond = explainByConditions(p.a, p.b);
    const w = p.score + (cond ? 3 : 0) + Math.max(0, ...p.aspects.map((x) => PRIORITY_ASPECTS[x] || 0));
    cards.push(toCard(p.a, p.b, { kind: 'unchecked', condition: cond?.text || null, aspects: p.aspects, weight: w }));
  }
  // At most 3 cards per place/topic so one topic doesn't fill the deck
  cards.sort((x, y) => y.weight - x.weight);
  const perPlace = new Map(); const out = [];
  for (const c of cards) {
    const n = perPlace.get(c.place) || 0;
    if (n >= 3) continue;
    perPlace.set(c.place, n + 1); out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

function toCard(a, b, extra) {
  // Show the positive statement first so the two sides read as "yes … / but …"
  const [x, y] = a.evaluation?.sentiment === 'negative' && b.evaluation?.sentiment === 'positive' ? [b, a] : [a, b];
  const aspects = extra.aspects?.length ? extra.aspects : aspectsOf(x.claim).filter((k) => aspectsOf(y.claim).includes(k));
  return {
    key: pairKey(x.id, y.id), place: x.place, topic: topicOf(x.place), city: x.city || null,
    a: { id: x.id, text: plainText(x.claim, 240), source: x.source?.sourceType, sentiment: x.evaluation?.sentiment },
    b: { id: y.id, text: plainText(y.claim, 240), source: y.source?.sourceType, sentiment: y.evaluation?.sentiment },
    aspect: aspects[0] || null, ...extra, aspects,
  };
}

/**
 * Turns an answer into (1) a label stored with the pair and (2) a change in how much the aspect matters to you.
 * answer: 'a' | 'b' | 'both' | 'disagree' | 'agree' | 'unrelated' | 'skip'
 */
export function applyAnswer(card, answer, verified) {
  const now = new Date().toISOString();
  const label = { a: 'contradiction', b: 'contradiction', disagree: 'contradiction', both: 'depends', agree: 'agree', unrelated: 'unrelated' }[answer];
  let next = verified;
  if (label) {
    const pair = {
      by: 'you', aId: card.a.id, bId: card.b.id, placeKey: String(card.place).toLowerCase(), place: card.place,
      aspects: card.aspects, label, trusted: answer === 'a' ? card.a.id : answer === 'b' ? card.b.id : null,
      condition: label === 'depends' ? { text: card.condition || 'Depends on conditions (your answer)' } : null,
      scores: { contradiction: label === 'contradiction' ? 1 : 0, entailment: label === 'agree' ? 1 : 0 }, answeredAt: now,
    };
    const base = verified || { model: 'you', method: 'Your answers in Debates', date: now.slice(0, 10), pairs: [] };
    next = { ...base, pairs: [...(base.pairs || []).filter((p) => !(p.by === 'you' && pairKey(p.aId, p.bId) === card.key)), pair] };
  }
  // Siding with the cautionary statement, or saying they really disagree, means the aspect matters to you
  const trustedNegative = (answer === 'a' && card.a.sentiment === 'negative') || (answer === 'b' && card.b.sentiment === 'negative');
  const aspectDelta = answer === 'skip' ? 0 : trustedNegative || answer === 'disagree' ? 1 : answer === 'unrelated' || answer === 'agree' ? 0 : 0.5;
  return { verified: next, aspect: card.aspect, aspectDelta };
}

/** Keeps your own labels when the model check is re-run. */
export const keepYourLabels = (fresh, previous) => ({
  ...fresh,
  pairs: [...(fresh?.pairs || []), ...((previous?.pairs || []).filter((p) => p.by === 'you'))],
});

export const answeredKeys = (verified) => new Set((verified?.pairs || []).filter((p) => p.by === 'you').map((p) => pairKey(p.aId, p.bId)));
