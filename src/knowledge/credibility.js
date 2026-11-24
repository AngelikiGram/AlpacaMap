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

const STOP = new Set('the a an and or but of to in on at for with from by is are was were be been it its this that these those you your we our they their there here not no do does did can will would should could have has had as if so than then just very also more most only about into out up over after before when where which who what how all any some get got one really'.split(' '));
const words = (t) => new Set(((t || '').toLowerCase().match(/[a-zà-ÿ]{3,}/g) || []).filter((w) => !STOP.has(w)));

/** True when two statements share more than 60 % of their content words. */
export function isNearCopy(a, b, threshold = 0.6) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return false;
  let shared = 0; for (const w of A) if (B.has(w)) shared++;
  return shared / (A.size + B.size - shared) > threshold;
}

/** { score, low, high }, the interval narrows with more independent evidence. */
export function credibility(node, samePlaceNodes = [], now = Date.now()) {
  const src = node?.source?.sourceType || 'other';
  const reliability = SOURCE_RELIABILITY[src] ?? SOURCE_RELIABILITY.other;
  const sentiment = node?.evaluation?.sentiment;
  // A near-copy of this statement in another source (e.g. Wikitravel repeating Wikivoyage) is the
  // same evidence twice, not independent corroboration, same test as the pairing step (Jaccard > 0.6).
  const otherSources = new Set(samePlaceNodes
    .filter((n) => n !== node && n.source?.sourceType && n.source.sourceType !== src && n.evaluation?.sentiment === sentiment)
    .filter((n) => !isNearCopy(node.claim, n.claim))
    .map((n) => n.source.sourceType));
  const corroboration = Math.min(0.2, otherSources.size * 0.07);
  const score = Math.min(1, reliability * freshness(node, now) + corroboration);
  const independent = new Set(samePlaceNodes.map((n) => n.source?.sourceType).filter(Boolean)).size;
  const unc = Math.min(0.3, 0.3 / Math.sqrt(Math.max(1, independent)));
  return { score, low: Math.max(0, score - unc), high: Math.min(1, score + unc) };
}
