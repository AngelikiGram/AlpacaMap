// How much a disagreement matters for *this* traveller.
// Uses the Planner's traveller profile (who is going, style, budget) stored in localStorage.
import { aspectsOf, extractConditions } from './contradictions.js';

export function readTravellerProfile(storage = globalThis.localStorage) {
  try {
    const styles = JSON.parse(storage?.getItem('tripmind_tripstyle_arr') || '[]');
    return {
      group: storage?.getItem('tripmind_grouptype') || null,     // solo, couple, family, friends, seniors, business, honeymoon
      styles: Array.isArray(styles) ? styles : [],              // cultural, foodie, nightlife, ...
      pace: storage?.getItem('tripmind_trippace') || null,
      budget: storage?.getItem('tripmind_budgetinput') || null,
      aspectWeights: JSON.parse(storage?.getItem('alpacamap_aspect_weights') || '{}') || {}, // learned from Debate cards
    };
  } catch { return { group: null, styles: [], pace: null, budget: null, aspectWeights: {} }; }
}

const GROUP_TO_TRAVELLER = { family: 'families', solo: 'solo', couple: 'couples', honeymoon: 'couples' };
const STYLE_TO_ASPECTS = {
  foodie: ['food', 'price'], nightlife: ['noise', 'safety'], cultural: ['crowds', 'opening', 'quality'],
  historian: ['crowds', 'opening'], relaxation: ['crowds', 'noise'], luxury: ['quality'], adventure: ['safety', 'transport'],
  photography: ['crowds', 'weather'], explorer: ['transport', 'safety'], wellness: ['noise', 'cleanliness'],
};

/** 0–1 relevance of a verified pair; reasons explain why it matters. */
export function pairRelevance(pair, a, b, profile) {
  if (!profile) return { score: 0, reasons: [] };
  const reasons = [];
  let score = 0;
  const aspects = new Set(pair.aspects || [...aspectsOf(a?.claim), ...aspectsOf(b?.claim)]);
  if (aspects.has('safety')) { score += 0.4; reasons.push('safety'); }
  const wantedTraveller = GROUP_TO_TRAVELLER[profile.group];
  if (wantedTraveller) {
    const ta = extractConditions(a?.claim).traveller, tb = extractConditions(b?.claim).traveller;
    if (ta === wantedTraveller || tb === wantedTraveller) { score += 0.4; reasons.push(`about ${wantedTraveller}`); }
  }
  for (const st of profile.styles || []) {
    const wanted = STYLE_TO_ASPECTS[String(st).toLowerCase()] || [];
    const hit = wanted.find((x) => aspects.has(x));
    if (hit) { score += 0.25; reasons.push(`${hit} matters for ${String(st).toLowerCase()} trips`); break; }
  }
  if (profile.budget && aspects.has('price')) { score += 0.2; reasons.push('price, you set a budget'); }
  // Aspects you sided with in the Debate cards
  const learned = Object.entries(profile.aspectWeights || {}).filter(([k, v]) => v >= 1 && aspects.has(k)).sort((x, y) => y[1] - x[1])[0];
  if (learned) { score += Math.min(0.3, 0.1 * learned[1]); reasons.push(`${learned[0]} matters to you (your debate answers)`); }
  return { score: Math.min(1, score), reasons };
}
