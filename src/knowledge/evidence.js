// Evidence about a place, used to warn on itinerary stops and map pins.
//
// A statement is attached to the *first* place it names, so a sentence like
// "Eiffel Tower, Louvre and Arc de Triomphe in one day" counts only for the Eiffel Tower.
// Evidence for a stop is therefore gathered from every statement that MENTIONS the stop
// (by its distinctive words) or is filed under it.
import { summarizeVerified } from './contradictions.js';

export const normalizeName = (s) => (s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Words that do not identify a specific place on their own
const GENERIC = new Set('the le la les il lo el de du des di del della of and museum musee museo church eglise chiesa cathedral basilica basilique park parc parco garden gardens jardin tower tour torre palace palais palazzo square place piazza station gare stazione bridge pont ponte street rue via avenue market marche mercato hotel restaurant cafe bar visit see go day trip tour check checkin checkout arrival arrive departure depart flight train bus taxi transfer lunch dinner breakfast brunch walk walking free time meeting meet pick pickup drop return back home rest morning afternoon evening night early late'.split(' '));

/** Distinctive words of a place name ("Louvre Museum" → ["louvre"]). */
export const distinctiveWords = (name) => {
  const words = normalizeName(name).split(' ').filter((w) => w.length >= 3 && !GENERIC.has(w));
  return words.some((w) => w.length >= 4) ? words : []; // need at least one real name word
};

export const LEVELS = {
  disputed:    { label: 'Sources disagree',      color: '#f87171', rank: 4 },
  conditional: { label: 'Depends on conditions', color: '#fbbf24', rank: 3 },
  mixed:       { label: 'Mixed opinions',        color: '#fbbf24', rank: 2 },
  thin:        { label: 'Little evidence',       color: '#94a3b8', rank: 1 },
  solid:       { label: 'Sources agree',         color: '#34d399', rank: 0 },
};

/** Index over all statements; pass it to findEvidence(). `size` is the number of statements. */
export function buildPlaceEvidence(nodes = [], verified = null, { cityNames = [] } = {}) {
  // City names identify the whole city, not a stop ("Train to Zurich")
  const ignore = new Set(cityNames.flatMap((c) => normalizeName(String(c).split(',')[0]).split(' ')));
  const items = nodes.filter((n) => n?.claim).map((n) => ({
    n,
    text: ` ${normalizeName(n.claim)} `,
    place: normalizeName(n.place),
  }));
  // Lookup tables so findEvidence touches only statements that share a word or place with the name
  // (a city has thousands of statements and the map asks for about a thousand places)
  const byWord = new Map();
  const byPlace = new Map();
  items.forEach((it, i) => {
    for (const w of new Set(it.text.split(' '))) if (w.length >= 3) { if (!byWord.has(w)) byWord.set(w, []); byWord.get(w).push(i); }
    if (!byPlace.has(it.place)) byPlace.set(it.place, []);
    byPlace.get(it.place).push(i);
  });
  return { items, verified, ignore, size: items.length, cache: new Map(), byWord, byPlace };
}

// Same rule as a full scan: filed under the place, under a place named inside it, or mentions all its distinctive words
function matchItems(index, key, words) {
  const hit = new Set();
  for (const [place, ids] of index.byPlace) {
    if (place === key || (place.length >= 5 && key.includes(place) && !place.includes(' · '))) ids.forEach((i) => hit.add(i));
  }
  const lists = words.map((w) => index.byWord.get(w) || []).sort((a, b) => a.length - b.length);
  if (lists.length && lists[0].length) {
    const rest = lists.slice(1).map((l) => new Set(l));
    for (const i of lists[0]) if (rest.every((s) => s.has(i))) hit.add(i);
  }
  return [...hit].sort((a, b) => a - b).map((i) => index.items[i]);
}

function levelOf(e) {
  const opinionated = e.pos + e.neg;
  e.agreement = opinionated ? Math.max(e.pos, e.neg) / opinionated : 1;
  return e.contradictions.length ? 'disputed'
    : e.depends.length ? 'conditional'
    : (e.sources.length < 2 || e.statements < 3) ? 'thin'
    : (opinionated >= 3 && e.agreement < 0.65) ? 'mixed'
    : 'solid';
}

/** Evidence for a stop or pin name, or null when no statement is about it. */
export function findEvidence(name, index) {
  if (!index?.size || !name) return null;
  const key = normalizeName(name);
  if (index.cache.has(key)) return index.cache.get(key);
  const words = distinctiveWords(name).filter((w) => !index.ignore?.has(w));
  let result = null;
  if (words.length) {
    const matched = matchItems(index, key, words);
    if (matched.length) {
      const e = { place: name, key, statements: matched.length, pos: 0, neg: 0, neu: 0, sources: new Set(), contradictions: [], depends: [] };
      const ids = new Set();
      for (const { n } of matched) {
        ids.add(n.id);
        const s = n.evaluation?.sentiment;
        if (s === 'positive') e.pos++; else if (s === 'negative') e.neg++; else e.neu++;
        if (n.source?.sourceType) e.sources.add(n.source.sourceType);
      }
      e.sources = [...e.sources];
      e.statementsList = matched.map(({ n }) => n); // used for dispute examples and trip checks
      // A verified disagreement counts for this stop only when BOTH statements are about it
      const pairs = (index.verified?.pairs || []).filter((p) => ids.has(p.aId) && ids.has(p.bId));
      for (const pl of summarizeVerified(pairs).places) { e.contradictions.push(...pl.contradictions); e.depends.push(...pl.depends); }
      const ex = e.contradictions[0] || e.depends[0];
      if (ex) {
        const byId = new Map(matched.map(({ n }) => [n.id, n]));
        const a = byId.get(ex.aId), b = byId.get(ex.bId);
        e.example = { a: a.claim, aSource: a.source?.sourceType, b: b.claim, bSource: b.source?.sourceType, condition: ex.condition?.text || null };
      }
      e.level = levelOf(e);
      result = e;
    }
  }
  index.cache.set(key, result);
  return result;
}
