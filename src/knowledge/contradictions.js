// Statement-level contradiction detection.
//
// The old rule ("a place has both a positive and a negative statement") is not a contradiction:
// "The Louvre is amazing" and "the Louvre queue is awful" are both true. Here we
//   1. pick candidate pairs: same place/topic, different sources, talking about the same ASPECT,
//   2. let an NLI model decide contradiction / entailment / neutral for each pair (nli.js),
//   3. explain contradictions that only differ in their CONDITIONS (season, time, who travels …).
// Everything in this file is pure and unit-tested (tests/contradictions.test.mjs).

// What a statement is about. Two statements can only contradict if they share an aspect.
export const ASPECTS = {
  crowds:      /\b(crowd(s|ed)?|busy|packed|quiet|empty|tourists?|touristy|queues?|lines?|wait(ing)?)\b/i,
  price:       /\b(price[sd]?|expensive|cheap|cost(s|ly)?|overpriced|afford\w*|value|budget|free|euros?|€|\$)\b/i,
  safety:      /\b(safe(ty)?|unsafe|dangerous|pickpocket\w*|scams?|crime|theft|thie(f|ves)|sketchy)\b/i,
  quality:     /\b(amazing|great|best|worst|terrible|awful|overrated|underrated|worth(while)?|disappoint\w*|beautiful|ugly|stunning|boring)\b/i,
  food:        /\b(food|meals?|restaurants?|cuisine|dish(es)?|taste|delicious|bland)\b/i,
  cleanliness: /\b(clean|dirty|filthy|smell(y|s)?|litter|trash)\b/i,
  opening:     /\b(open(s|ing)?|closed?|hours?|opening times?|reservations?|book(ing)? (ahead|in advance)|tickets?)\b/i,
  transport:   /\b(metro|subway|bus(es)?|trains?|tram|taxi|walk(able|ing)?|traffic|parking|transport)\b/i,
  weather:     /\b(weather|rain(y)?|hot|cold|warm|sunny|snow|humid|heat)\b/i,
  noise:       /\b(noisy|loud|quiet|peaceful|calm)\b/i,
};

export function aspectsOf(text) {
  const t = text || '';
  return Object.keys(ASPECTS).filter((k) => ASPECTS[k].test(t));
}

// Conditions under which a statement holds. Different values in the same dimension explain a
// disagreement ("crowded in summer" vs "quiet in winter").
const CONDITION_RULES = {
  season: [
    ['summer', /\b(summer|july|august|june|high season|peak season)\b/i],
    ['winter', /\b(winter|december|january|february|christmas|low season|off[- ]season)\b/i],
    ['spring', /\b(spring|march|april|may)\b/i],
    ['autumn', /\b(autumn|fall|september|october|november)\b/i],
  ],
  timeOfDay: [
    ['early morning', /\b(early (in the )?morning|at opening|first thing|before \d{1,2}\s?(am|a\.m\.))\b/i],
    ['morning', /\b(morning)\b/i],
    ['afternoon', /\b(afternoon|midday|noon)\b/i],
    ['evening', /\b(evening|sunset|dusk)\b/i],
    ['night', /\b(night|late|after dark|midnight)\b/i],
  ],
  week: [
    ['weekend', /\b(weekends?|saturdays?|sundays?)\b/i],
    ['weekday', /\b(weekdays?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?)\b/i],
  ],
  traveller: [
    ['families', /\b(famil(y|ies)|kids|children|toddlers?)\b/i],
    ['solo', /\b(solo|alone|by yourself|on your own)\b/i],
    ['women', /\b(women|female)\b/i],
    ['couples', /\b(couples?|romantic|honeymoon)\b/i],
    ['budget travellers', /\b(budget|backpack\w*|cheap)\b/i],
  ],
  area: [
    ['centre', /\b(cent(er|re)|downtown|old town|historic (center|centre))\b/i],
    ['outskirts', /\b(outskirts|suburbs?|outside the (city|center|centre)|periphery)\b/i],
  ],
};
export const CONDITION_DIMENSIONS = Object.keys(CONDITION_RULES);

/** { season?: 'summer', timeOfDay?: 'morning', ... } — first matching value per dimension. */
export function extractConditions(text, given = {}) {
  const out = {};
  for (const [dim, rules] of Object.entries(CONDITION_RULES)) {
    const g = given?.[dim];
    if (typeof g === 'string' && g) { out[dim] = g.toLowerCase(); continue; }
    for (const [value, re] of rules) if (re.test(text || '')) { out[dim] = value; break; }
  }
  return out;
}

const DIM_LABEL = { season: 'season', timeOfDay: 'time of day', week: 'day of the week', traveller: 'who is travelling', area: 'part of the city' };

/** Explains why two statements may both be true, or returns null. */
export function explainByConditions(a, b) {
  const ca = extractConditions(a.claim, a.conditions);
  const cb = extractConditions(b.claim, b.conditions);
  for (const dim of CONDITION_DIMENSIONS) {
    if (ca[dim] && cb[dim] && ca[dim] !== cb[dim]) {
      return { dimension: dim, label: DIM_LABEL[dim], a: ca[dim], b: cb[dim], text: `Depends on ${DIM_LABEL[dim]}: ${ca[dim]} vs ${cb[dim]}` };
    }
  }
  return null;
}

const STOP = new Set('the a an and or but of to in on at for with from by is are was were be been it its this that these those you your we our they their there here not no do does did can will would should could have has had as if so than then just very also more most only about into out up over after before when where which who what how all any some get got one really'.split(' '));
const contentWords = (t) => new Set(((t || '').toLowerCase().match(/[a-zà-ÿ]{3,}/g) || []).filter((w) => !STOP.has(w)));

/**
 * Candidate pairs for NLI: same place/topic, different sources, at least one shared aspect.
 * Pairs with opposite sentiment and more word overlap are ranked first; capped per place and in total.
 */
export function candidatePairs(nodes, { maxPerPlace = 12, maxTotal = 300, maxPerNode = 3, maxLength = 300, minSharedWords = 2 } = {}) {
  const byPlace = new Map();
  for (const n of nodes) {
    if (!n?.place || !n.claim) continue;
    const k = n.place.toLowerCase();
    if (!byPlace.has(k)) byPlace.set(k, []);
    byPlace.get(k).push(n);
  }
  const all = [];
  for (const [placeKey, list] of byPlace) {
    if (list.length < 2) continue;
    // Words of the place name ("eiffel", "tower") do not show that two statements talk about the same thing
    const placeWords = contentWords(list[0].place.replace(/·/g, ' '));
    const prepared = list
      .filter((n) => n.claim.length <= maxLength)   // long texts (itineraries, lists) cover many things at once
      .slice(0, 200)
      .map((n) => ({ n, asp: new Set(aspectsOf(n.claim)), words: new Set([...contentWords(n.claim)].filter((w) => !placeWords.has(w))), s: n.evaluation?.sentiment }));
    const pairs = [];
    for (let i = 0; i < prepared.length; i++) {
      for (let j = i + 1; j < prepared.length; j++) {
        const A = prepared[i], B = prepared[j];
        if (A.n.source?.sourceType === B.n.source?.sourceType) continue;
        const sharedAspects = [...A.asp].filter((x) => B.asp.has(x));
        if (!sharedAspects.length) continue;
        let shared = 0; for (const w of A.words) if (B.words.has(w)) shared++;
        if (shared < minSharedWords) continue;   // must talk about the same thing, not just the same aspect
        // Near-identical text in two sources (Wikitravel shares much text with Wikivoyage) is a copy,
        // not independent evidence and never a contradiction — skip it.
        const jaccard = shared / (A.words.size + B.words.size - shared || 1);
        if (jaccard > 0.6) continue;
        const opposite = (A.s === 'positive' && B.s === 'negative') || (A.s === 'negative' && B.s === 'positive');
        const score = sharedAspects.length * 2 + Math.min(shared, 4) + (opposite ? 6 : 0);
        pairs.push({ placeKey, place: A.n.place, a: A.n, b: B.n, aspects: sharedAspects, score });
      }
    }
    pairs.sort((x, y) => y.score - x.score);
    all.push(...pairs.slice(0, maxPerPlace));
  }
  all.sort((x, y) => y.score - x.score);
  // A long statement touches many aspects; don't let one statement dominate the budget
  const uses = new Map(); const out = [];
  for (const p of all) {
    const ua = uses.get(p.a.id) || 0, ub = uses.get(p.b.id) || 0;
    if (ua >= maxPerNode || ub >= maxPerNode) continue;
    uses.set(p.a.id, ua + 1); uses.set(p.b.id, ub + 1);
    out.push(p);
    if (out.length >= maxTotal) break;
  }
  return out;
}

/** Plain text for the model: no markdown/wiki markup, collapsed whitespace, length-limited. */
export const plainText = (t, max = 400) => (t || '')
  .replace(/'''|''|\*\*|__|~~|`/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/^[#=*\->\s]+/gm, '')
  .replace(/\s+/g, ' ').trim().slice(0, max);

/** Turns NLI scores into a verdict for one pair. */
export function classifyPair(scores, a, b, { threshold = 0.8 } = {}) {
  const c = scores.contradiction ?? 0, e = scores.entailment ?? 0;
  if (c >= threshold && c > e) {
    const cond = explainByConditions(a, b);
    return cond ? { label: 'depends', condition: cond } : { label: 'contradiction' };
  }
  if (e >= threshold && e > c) return { label: 'agree' };
  return { label: 'unrelated' };
}

/** Groups verified pairs by place for display and counting. */
export function summarizeVerified(pairs) {
  const byPlace = new Map();
  for (const p of pairs) {
    if (p.label !== 'contradiction' && p.label !== 'depends') continue;
    if (!byPlace.has(p.placeKey)) byPlace.set(p.placeKey, { place: p.place, contradictions: [], depends: [] });
    byPlace.get(p.placeKey)[p.label === 'contradiction' ? 'contradictions' : 'depends'].push(p);
  }
  const places = [...byPlace.values()];
  for (const pl of places) for (const k of ['contradictions', 'depends']) pl[k].sort((x, y) => (y.scores?.contradiction || 0) - (x.scores?.contradiction || 0));
  places.sort((x, y) => y.contradictions.length - x.contradictions.length || y.depends.length - x.depends.length);
  return {
    places,
    contradictionPlaces: places.filter((p) => p.contradictions.length).length,
    dependsPlaces: places.filter((p) => !p.contradictions.length && p.depends.length).length,
  };
}

// Two known examples the model must get right before its results are trusted.
export const CALIBRATION = [
  { a: 'The museum is open on Mondays.', b: 'The museum is closed on Mondays.', expect: 'contradiction' },
  { a: 'The metro is the fastest way to get around the city.', b: 'Taking the metro is a quick way to travel around the city.', expect: 'entailment' },
];
