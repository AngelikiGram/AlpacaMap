// Credibility of a single statement: source reliability × freshness + independent corroboration.
//
// Fixes over the earlier version:
//  - age was computed from the date the statement was *collected*, so every bundled statement
//    looked brand-new; now only a real publication date counts, unknown age is a fixed penalty;
//  - corroboration counted copies from the same source; now only *other* sources count.

export const SOURCE_RELIABILITY = {
  manual: 1.0, wikivoyage: 0.85, wikipedia: 0.82, stackexchange: 0.78, wikitravel: 0.65, reddit: 0.6, blog: 0.7, review: 0.7, other: 0.6,
};

const YEAR = 365.25 * 24 * 3600 * 1000;
export const UNKNOWN_AGE_FACTOR = 0.85;

/** 1 = brand new, decays with age; volatile facts (prices, opening hours) age faster. */
export function freshness(node, now = Date.now()) {
  const published = node?.source?.publishedAt;
  if (!published) return UNKNOWN_AGE_FACTOR;
  const age = Math.max(0, (now - new Date(published).getTime()) / YEAR);
  if (!Number.isFinite(age)) return UNKNOWN_AGE_FACTOR;
  const halfLife = node.knowledge_type === 'volatile' ? 1.5 : 6; // years
  return Math.pow(0.5, age / halfLife);
}

/** { score, low, high } — the interval narrows with more independent evidence. */
export function credibility(node, samePlaceNodes = [], now = Date.now()) {
  const src = node?.source?.sourceType || 'other';
  const reliability = SOURCE_RELIABILITY[src] ?? SOURCE_RELIABILITY.other;
  const sentiment = node?.evaluation?.sentiment;
  const otherSources = new Set(samePlaceNodes
    .filter((n) => n !== node && n.source?.sourceType && n.source.sourceType !== src && n.evaluation?.sentiment === sentiment)
    .map((n) => n.source.sourceType));
  const corroboration = Math.min(0.2, otherSources.size * 0.07);
  const score = Math.min(1, reliability * freshness(node, now) + corroboration);
  const independent = new Set(samePlaceNodes.map((n) => n.source?.sourceType).filter(Boolean)).size;
  const unc = Math.min(0.3, 0.3 / Math.sqrt(Math.max(1, independent)));
  return { score, low: Math.max(0, score - unc), high: Math.min(1, score + unc) };
}
