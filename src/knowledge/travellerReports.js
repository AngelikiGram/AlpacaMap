// The traveller as a source: what you saw on the trip becomes a statement in the knowledge
// graph (source type "manual", reliability 1.0 in credibility.js), and your answers in the
// Debate cards tell the app which aspects matter to you (used by relevance.js).
import { extractConditions } from './contradictions.js';

const SEASON_BY_MONTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];

/** Quick verdicts a traveller can give about a place they visited. */
export const QUICK_REPORTS = [
  { id: 'worth',   emoji: '👍', label: 'Worth it',       sentiment: 'positive', text: (p) => `${p} was worth the visit.` },
  { id: 'skip',    emoji: '👎', label: 'Not worth it',   sentiment: 'negative', text: (p) => `${p} was not worth the visit.` },
  { id: 'crowded', emoji: '🧍', label: 'Very crowded',   sentiment: 'negative', text: (p) => `${p} was very crowded with long queues.` },
  { id: 'quiet',   emoji: '🌿', label: 'Quiet',          sentiment: 'positive', text: (p) => `${p} was quiet and not crowded.` },
  { id: 'pricey',  emoji: '💸', label: 'Overpriced',     sentiment: 'negative', text: (p) => `${p} was overpriced.` },
  { id: 'closed',  emoji: '🚪', label: 'Was closed',     sentiment: 'negative', text: (p) => `${p} was closed when we went.` },
];

/** Conditions of a visit (season, time of day, weekday/weekend) from a Date. */
export function visitConditions(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return {};
  const h = d.getHours(), wd = d.getDay();
  return {
    season: SEASON_BY_MONTH[d.getMonth()],
    timeOfDay: h < 9 ? 'early morning' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night',
    week: wd === 0 || wd === 6 ? 'weekend' : 'weekday',
  };
}

/** A statement from the traveller about a place. */
export function makeTravellerStatement({ place, city = null, claim, sentiment = 'neutral', when = new Date(), kind = 'report' }) {
  const date = when instanceof Date ? when : new Date(when);
  const iso = Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  return {
    id: `you-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    place, city, claim,
    claimType: 'evaluation',
    knowledge_type: 'volatile',
    conditions: { ...visitConditions(date), ...extractConditions(claim) },
    advice: null,
    evaluation: { sentiment, intensity: 0.9 },
    source: { sourceType: 'manual', sourceLabel: 'You', label: 'You (on the trip)', date: iso.slice(0, 10), publishedAt: iso.slice(0, 10), kind },
    extractedAt: iso,
  };
}

export const quickReport = (reportId, place, city, when) => {
  const r = QUICK_REPORTS.find((x) => x.id === reportId);
  return r ? makeTravellerStatement({ place, city, claim: r.text(place), sentiment: r.sentiment, when }) : null;
};

export const isTravellerStatement = (n) => n?.source?.sourceType === 'manual';

/** Traveller statements already recorded for a place name. */
export const reportsFor = (nodes, place) => {
  const k = (place || '').toLowerCase();
  return (nodes || []).filter((n) => isTravellerStatement(n) && (n.place || '').toLowerCase() === k);
};

// ── Aspect weights learned from Debate answers ────────────────────────────────
const WEIGHTS_KEY = 'alpacamap_aspect_weights';

export function readAspectWeights(storage = globalThis.localStorage) {
  try { const w = JSON.parse(storage?.getItem(WEIGHTS_KEY) || '{}'); return w && typeof w === 'object' ? w : {}; }
  catch { return {}; }
}

/** Nudges how much an aspect matters (+1 = you sided with the warning, −0.5 = you dismissed it). */
export function bumpAspectWeight(aspect, delta, storage = globalThis.localStorage) {
  if (!aspect) return readAspectWeights(storage);
  const w = readAspectWeights(storage);
  w[aspect] = Math.max(-2, Math.min(5, (w[aspect] || 0) + delta));
  try { storage?.setItem(WEIGHTS_KEY, JSON.stringify(w)); } catch { /* storage full or blocked */ }
  return w;
}

/** Top aspects you care about, e.g. ['crowds','price'] */
export const caredAspects = (weights = readAspectWeights(), min = 1) =>
  Object.entries(weights).filter(([, v]) => v >= min).sort((a, b) => b[1] - a[1]).map(([k]) => k);
