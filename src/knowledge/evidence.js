// Evidence summary per place, used to warn on itinerary stops and map pins.
import { summarizeVerified } from './contradictions.js';

export const normalizeName = (s) => (s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/^(the|le|la|les|il|lo|el)\s+/, '')
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export const LEVELS = {
  disputed:    { label: 'Sources disagree',          color: '#f87171', rank: 4 },
  conditional: { label: 'Depends on conditions',     color: '#fbbf24', rank: 3 },
  mixed:       { label: 'Mixed opinions',            color: '#fbbf24', rank: 2 },
  thin:        { label: 'Little evidence',           color: '#94a3b8', rank: 1 },
  solid:       { label: 'Sources agree',             color: '#34d399', rank: 0 },
};

/** Map(normalized place name → evidence) for named places (topic labels "City · X" are skipped). */
export function buildPlaceEvidence(nodes = [], verified = null) {
  const map = new Map();
  for (const n of nodes) {
    if (!n?.place || n.place.includes(' · ')) continue;
    const key = normalizeName(n.place);
    if (key.length < 3) continue;
    let e = map.get(key);
    if (!e) { e = { place: n.place, key, statements: 0, pos: 0, neg: 0, neu: 0, sources: new Set(), contradictions: [], depends: [] }; map.set(key, e); }
    e.statements++;
    const s = n.evaluation?.sentiment;
    if (s === 'positive') e.pos++; else if (s === 'negative') e.neg++; else e.neu++;
    if (n.source?.sourceType) e.sources.add(n.source.sourceType);
  }
  if (verified?.pairs) {
    const byId = new Map(nodes.map((x) => [x.id, x]));
    for (const pl of summarizeVerified(verified.pairs).places) {
      const e = map.get(normalizeName(pl.place));
      if (!e) continue;
      e.contradictions = pl.contradictions; e.depends = pl.depends;
      const p = pl.contradictions[0] || pl.depends[0];
      const a = byId.get(p?.aId), b = byId.get(p?.bId);
      if (a && b) e.example = { a: a.claim, aSource: a.source?.sourceType, b: b.claim, bSource: b.source?.sourceType, condition: p.condition?.text || null };
    }
  }
  for (const e of map.values()) {
    e.sources = [...e.sources];
    const opinionated = e.pos + e.neg;
    e.agreement = opinionated ? Math.max(e.pos, e.neg) / opinionated : 1;
    e.level = e.contradictions.length ? 'disputed'
      : e.depends.length ? 'conditional'
      : (e.sources.length < 2 || e.statements < 3) ? 'thin'
      : (opinionated >= 3 && e.agreement < 0.65) ? 'mixed'
      : 'solid';
  }
  return map;
}

/** Finds evidence for a stop or pin name ("Visit the Louvre Museum" → "Louvre Museum"). */
export function findEvidence(name, evidenceMap) {
  if (!evidenceMap?.size || !name) return null;
  const key = normalizeName(name);
  if (evidenceMap.has(key)) return evidenceMap.get(key);
  let best = null;
  for (const e of evidenceMap.values()) {
    if (e.key.length < 5) continue;
    if (key.includes(e.key) || (key.length >= 5 && e.key.includes(key))) {
      if (!best || e.key.length > best.key.length) best = e;
    }
  }
  return best;
}
