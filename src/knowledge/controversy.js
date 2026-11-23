// How much sources argue about a place — drives the Truth lens on the map,
// the dispute block in place popups and the Debate cards.
//
// Two kinds of disagreement:
//  • verified  – the in-browser NLI check (Knowledge → Conflicts) found a real contradiction
//                or a condition-dependent pair (evidence.level 'disputed' / 'conditional');
//  • unchecked – statements from different sources about the same aspect sound opposite
//                (one positive, one negative). Shown as "Sources sound different" until checked.
import { findEvidence, normalizeName, LEVELS } from './evidence.js';
import { summarizeVerified } from './contradictions.js';
import { aspectsOf, explainByConditions } from './contradictions.js';

export const SOURCE_LABEL = {
  wikivoyage: 'Wikivoyage', wikitravel: 'Wikitravel', wikipedia: 'Wikipedia', reddit: 'Reddit',
  stackexchange: 'StackExchange', manual: 'You', traveller: 'You',
};
export const sourceLabel = (s) => SOURCE_LABEL[s] || (s ? s[0].toUpperCase() + s.slice(1) : 'Unknown');

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * Like findEvidence, but only keeps statements that name the place in full ("British Museum",
 * not every sentence containing "museum") or are filed under it. Map POIs have many short,
 * generic names ("The Castle", "Circus"), so the loose word match is too noisy for them.
 */
export function strictEvidence(name, index) {
  const e = findEvidence(name, index);
  if (!e) return null;
  const full = normalizeName(name).replace(/^the /, '');
  if (full.length < 5) return null;
  const re = new RegExp(`(^| )${full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`);
  const keep = (e.statementsList || []).filter((n) => normalizeName(n.place) === normalizeName(name) || re.test(normalizeName(n.claim)));
  if (!keep.length) return null;
  if (keep.length === e.statementsList.length) return e;
  const ids = new Set(keep.map((n) => n.id));
  const out = { ...e, statements: keep.length, pos: 0, neg: 0, neu: 0, statementsList: keep, contradictions: [], depends: [], example: null };
  const src = new Set();
  for (const n of keep) {
    const s = n.evaluation?.sentiment;
    if (s === 'positive') out.pos++; else if (s === 'negative') out.neg++; else out.neu++;
    if (n.source?.sourceType) src.add(n.source.sourceType);
  }
  out.sources = [...src];
  const pairs = (index.verified?.pairs || []).filter((p) => ids.has(p.aId) && ids.has(p.bId));
  for (const pl of summarizeVerified(pairs).places) { out.contradictions.push(...pl.contradictions); out.depends.push(...pl.depends); }
  const ex = out.contradictions[0] || out.depends[0];
  if (ex) {
    const a = keep.find((n) => n.id === ex.aId), b = keep.find((n) => n.id === ex.bId);
    out.example = { a: a.claim, aSource: a.source?.sourceType, b: b.claim, bSource: b.source?.sourceType, condition: ex.condition?.text || null };
  }
  const opinionated = out.pos + out.neg;
  out.agreement = opinionated ? Math.max(out.pos, out.neg) / opinionated : 1;
  out.level = out.contradictions.length ? 'disputed' : out.depends.length ? 'conditional'
    : (out.sources.length < 2 || out.statements < 3) ? 'thin' : (opinionated >= 3 && out.agreement < 0.65) ? 'mixed' : 'solid';
  if (!LEVELS[out.level]) out.level = 'thin';
  return out;
}

/**
 * 0–1 "how much do sources argue" for one evidence object (from findEvidence), or null.
 * Verified contradictions dominate; otherwise the size of the opinion minority, damped
 * when there are only a few opinionated statements.
 */
export function controversyScore(e) {
  if (!e) return null;
  if (e.level === 'disputed') return clamp01(0.85 + 0.05 * (e.contradictions.length - 1));
  if (e.level === 'conditional') return 0.65;
  const opinionated = e.pos + e.neg;
  if (!opinionated) return 0.05;
  const minority = Math.min(e.pos, e.neg) / opinionated;          // 0 … 0.5
  const confidence = Math.min(1, opinionated / 6);                  // few statements → weak signal
  const crossSource = (e.sources?.length || 0) >= 2 ? 1 : 0.5;
  return clamp01(0.08 + minority * 1.3 * confidence * crossSource); // max ≈ 0.73
}

/** Colour ramp for the lens: green (agree) → amber → red (argue). */
export function controversyColor(score) {
  if (score == null) return '#64748b';
  if (score < 0.2) return '#34d399';
  if (score < 0.4) return '#a3e635';
  if (score < 0.55) return '#fbbf24';
  if (score < 0.75) return '#fb923c';
  return '#f87171';
}

const OPPOSITE = (a, b) => (a === 'positive' && b === 'negative') || (a === 'negative' && b === 'positive');
const words = (t) => new Set(((t || '').toLowerCase().match(/[a-z]{4,}/g) || []));

/**
 * The most telling pair of statements about a place.
 * Uses the verified example when there is one; otherwise picks an opposite-sentiment pair
 * from two different sources that talk about the same aspect.
 * Returns { a, b, aSource, bSource, aspect, condition, verified } or null.
 */
export function pickDisputePair(e) {
  if (!e) return null;
  if (e.example) {
    return { a: e.example.a, b: e.example.b, aSource: e.example.aSource, bSource: e.example.bSource,
      condition: e.example.condition, verified: true, aspect: aspectsOf(e.example.a).find((x) => aspectsOf(e.example.b).includes(x)) || null };
  }
  const JUNK = /\*\*|\]\(|——|\[\s|^\W/;
  const list = (e.statementsList || []).filter((n) => n.claim && n.claim.length <= 260 && !JUNK.test(n.claim));
  const nameWords = new Set(normalizeName(e.place).split(' '));
  let best = null;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j];
      if (!OPPOSITE(A.evaluation?.sentiment, B.evaluation?.sentiment)) continue;
      if (A.source?.sourceType && A.source?.sourceType === B.source?.sourceType) continue;
      const shared = aspectsOf(A.claim).filter((x) => aspectsOf(B.claim).includes(x));
      if (!shared.length) continue;
      const wa = words(A.claim); let overlap = 0; for (const w of words(B.claim)) if (wa.has(w) && !nameWords.has(w)) overlap++;
      if (overlap < 1) continue;                       // must talk about the same thing
      const score = shared.length * 3 + Math.min(overlap, 4) - Math.abs(A.claim.length - B.claim.length) / 200;
      if (!best || score > best.score) best = { A, B, shared, score };
    }
  }
  if (!best) return null;
  const pos = best.A.evaluation?.sentiment === 'positive' ? best.A : best.B;
  const neg = pos === best.A ? best.B : best.A;
  const cond = explainByConditions(pos, neg);
  return { a: pos.claim, b: neg.claim, aSource: pos.source?.sourceType, bSource: neg.source?.sourceType,
    aId: pos.id, bId: neg.id, aspect: best.shared[0] || null, condition: cond?.text || null, verified: false };
}

/** Short human headline for a dispute. */
export function disputeHeadline(e, pair = pickDisputePair(e)) {
  if (!e) return null;
  if (e.level === 'disputed') return 'Sources disagree';
  if (e.level === 'conditional') return pair?.condition || 'Depends on conditions';
  if (pair?.condition) return `Maybe: ${pair.condition.toLowerCase()}`;
  if (pair) return 'Sources sound different';
  if (e.level === 'thin') return 'Little evidence';
  const opinionated = e.pos + e.neg;
  if (opinionated >= 3 && Math.min(e.pos, e.neg) / opinionated >= 0.2) return `Mixed: ${e.pos} 👍 / ${e.neg} 👎`;
  return 'Sources agree';
}

/**
 * Truth-lens points: every named place with coordinates that has evidence.
 * points: [{ name, coords:[lat,lon], kind? }] → [{ …point, score, color, evidence, headline }]
 */
export function buildTruthLens(points, index, { minStatements = 2 } = {}) {
  if (!index?.size) return [];
  const seen = new Set(); const out = [];
  for (const p of points || []) {
    if (!p?.name || !Array.isArray(p.coords) || p.coords.length < 2) continue;
    const key = p.name.toLowerCase();
    if (seen.has(key)) continue; seen.add(key);
    // One generic word ("Circus", "The Castle", "Coffee") is not a place we can talk about,
    // unless it is a saved place or a well-known one (has a Wikidata entry)
    const nameWords = normalizeName(p.name).replace(/^the /, '').split(' ').filter(Boolean);
    if (nameWords.length < 2 && !p.saved) {
      const filed = (index.items || []).some((it) => it.place === normalizeName(p.name));
      if (!filed) continue;
    }
    const e = strictEvidence(p.name, index);
    if (!e || e.statements < minStatements) continue;
    const score = controversyScore(e);
    out.push({ ...p, score, color: controversyColor(score), evidence: e, headline: disputeHeadline(e) });
  }
  return out.sort((a, b) => a.score - b.score); // hottest drawn last (on top)
}

/** True for city-wide topics such as "London · Climate" (statements not tied to one place). */
export const isTopicPlace = (place) => String(place || '').includes(' · ');

/**
 * Evidence for one city-wide topic ("London · Climate"): only the statements filed under it.
 * Same shape as findEvidence(), so controversyScore() and disputeHeadline() apply.
 */
export function topicEvidence(topic, index) {
  if (!index?.size || !topic) return null;
  const key = normalizeName(topic);
  const keep = (index.items || []).filter((it) => it.place === key).map((it) => it.n);
  if (!keep.length) return null;
  const e = { place: topic, key, statements: keep.length, pos: 0, neg: 0, neu: 0, sources: [], statementsList: keep, contradictions: [], depends: [], example: null };
  const src = new Set();
  for (const n of keep) {
    const s = n.evaluation?.sentiment;
    if (s === 'positive') e.pos++; else if (s === 'negative') e.neg++; else e.neu++;
    if (n.source?.sourceType) src.add(n.source.sourceType);
  }
  e.sources = [...src];
  const ids = new Set(keep.map((n) => n.id));
  const pairs = (index.verified?.pairs || []).filter((p) => ids.has(p.aId) && ids.has(p.bId));
  for (const pl of summarizeVerified(pairs).places) { e.contradictions.push(...pl.contradictions); e.depends.push(...pl.depends); }
  const opinionated = e.pos + e.neg;
  e.agreement = opinionated ? Math.max(e.pos, e.neg) / opinionated : 1;
  e.level = e.contradictions.length ? 'disputed' : e.depends.length ? 'conditional'
    : (e.sources.length < 2 || e.statements < 3) ? 'thin' : (opinionated >= 3 && e.agreement < 0.65) ? 'mixed' : 'solid';
  return e;
}

/**
 * City-wide topics of one city for the Truth lens panel (they have no position on the map).
 * → [{ topic, place, score, color, headline, evidence }], most argued first.
 */
export function buildTopicLens(index, cityName) {
  if (!index?.size || !cityName) return [];
  const city = normalizeName(String(cityName).split(',')[0]);
  const topics = new Set();
  for (const it of index.items || []) {
    const raw = it.n?.place || '';
    if (isTopicPlace(raw) && normalizeName(raw.split(' · ')[0]) === city) topics.add(raw);
  }
  const out = [];
  for (const place of topics) {
    const e = topicEvidence(place, index);
    if (!e || e.statements < 3) continue;
    const score = controversyScore(e);
    // Label follows the colour band, so a green dot never reads "Mixed"
    const counts = `${e.pos} 👍 / ${e.neg} 👎`;
    const headline = e.level === 'disputed' ? 'Sources disagree' : e.level === 'conditional' ? 'Depends on conditions'
      : score >= 0.4 ? `Split: ${counts}` : `Mostly agree: ${counts}`;
    out.push({ place, topic: place.split(' · ').slice(1).join(' · '), score, color: controversyColor(score), headline, evidence: e });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Places worth a Debate card, most argued first. */
export function debateCandidates(points, index, { limit = 30 } = {}) {
  return buildTruthLens(points, index)
    .map((p) => ({ ...p, pair: pickDisputePair(p.evidence) }))
    .filter((p) => p.pair && (p.pair.verified || p.pair.aspect) && (p.score >= 0.2 || p.evidence.level === 'disputed' || p.evidence.level === 'conditional'))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
