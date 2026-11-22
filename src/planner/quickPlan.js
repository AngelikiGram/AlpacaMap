// One-box planner: "3 days in Paris, hate queues, love food, €800" → a day-by-day plan.
// Works fully offline from bundled OpenStreetMap data + the knowledge graph; an AI model,
// when available, only polishes the wording afterwards (see QuickPlanBox.jsx).
import { isOpenAt, closedWeekdays } from './openingHours.js';
import { distKm, nearestNeighbourOrder } from './geo.js';
import { controversyScore, pickDisputePair, sourceLabel, strictEvidence } from '../knowledge/controversy.js';
import { ASPECTS } from '../knowledge/contradictions.js';

export const KNOWN_CITIES = {
  london: { name: 'London, United Kingdom', coords: [51.5074, -0.1278] },
  paris: { name: 'Paris, France', coords: [48.8566, 2.3522] },
  rome: { name: 'Rome, Italy', coords: [41.8986, 12.4769] },
  edinburgh: { name: 'Edinburgh, United Kingdom', coords: [55.9533, -3.1883] },
  zurich: { name: 'Zurich, Switzerland', coords: [47.3769, 8.5417] },
  prague: { name: 'Prague, Czechia', coords: [50.0875, 14.4213] },
  kyoto: { name: 'Kyoto, Japan', coords: [35.0116, 135.7681] },
  tokyo: { name: 'Tokyo, Japan', coords: [35.6812, 139.7671] },
  'new york': { name: 'New York, United States', coords: [40.758, -73.9855] },
  sydney: { name: 'Sydney, Australia', coords: [-33.8688, 151.2093] },
  amsterdam: { name: 'Amsterdam, Netherlands', coords: [52.3676, 4.9041] },
  barcelona: { name: 'Barcelona, Spain', coords: [41.3874, 2.1686] },
  vienna: { name: 'Vienna, Austria', coords: [48.2082, 16.3738] },
  berlin: { name: 'Berlin, Germany', coords: [52.52, 13.405] },
  lisbon: { name: 'Lisbon, Portugal', coords: [38.7223, -9.1393] },
  madrid: { name: 'Madrid, Spain', coords: [40.4168, -3.7038] },
  munich: { name: 'Munich, Germany', coords: [48.1374, 11.5755] },
  venice: { name: 'Venice, Italy', coords: [45.4408, 12.3155] },
  florence: { name: 'Florence, Italy', coords: [43.7696, 11.2558] },
  budapest: { name: 'Budapest, Hungary', coords: [47.4979, 19.0402] },
  copenhagen: { name: 'Copenhagen, Denmark', coords: [55.6761, 12.5683] },
  dublin: { name: 'Dublin, Ireland', coords: [53.3498, -6.2603] },
  istanbul: { name: 'Istanbul, Türkiye', coords: [41.0082, 28.9784] },
  athens: { name: 'Athens, Greece', coords: [37.9838, 23.7275] },
};
const CITY_ALIASES = { nyc: 'new york', 'new york city': 'new york', 'zürich': 'zurich', roma: 'rome', wien: 'vienna', praha: 'prague', lisboa: 'lisbon', münchen: 'munich', venezia: 'venice', firenze: 'florence' };

const NUM = { one: 1, a: 1, an: 1, two: 2, couple: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export const INTERESTS = {
  food:      { label: 'Food',        re: /\b(food(ie)?|eat(ing)?|restaurants?|cuisine|street food|dining|brunch|lunch spots)\b/i },
  coffee:    { label: 'Coffee',      re: /\b(coffee|caf[eé]s?|espresso)\b/i },
  culture:   { label: 'Culture',     re: /\b(museums?|art|galler(y|ies)|history|historic(al)?|culture|cultural|architecture|castles?|churches?|cathedrals?)\b/i },
  nature:    { label: 'Nature',      re: /\b(parks?|nature|green|gardens?|hik(e|ing)|outdoors?|walks?|trees)\b/i },
  views:     { label: 'Views',       re: /\b(views?|viewpoints?|panoram\w*|photo(graphy|s)?|sunsets?|rooftops?)\b/i },
  nightlife: { label: 'Nightlife',   re: /\b(nightlife|bars?|pubs?|beer|cocktails?|clubs?|party|drinks?)\b/i },
  shopping:  { label: 'Shopping',    re: /\b(shop(ping)?|markets?|boutiques?|vintage|flea)\b/i },
};

const DISLIKE_LEAD = /\b(hate|hates|avoid|no|not into|don'?t like|dislike|skip|without|less|fewer|never)\b/i;
const AVOID = {
  crowds:  /\b(queues?|crowds?|crowded|lines?|tourist traps?|touristy|busy|waiting)\b/i,
  walking: /\b(walking|long walks|stairs|hills?)\b/i,
  price:   /\b(expensive|pricey|overpriced)\b/i,
};

/** Parses a free-text trip request. Everything it can't find is null / empty. */
export function parsePrompt(text, { today = new Date() } = {}) {
  const t = ` ${String(text || '').replace(/\s+/g, ' ').trim()} `;
  const low = t.toLowerCase();
  const out = { raw: String(text || '').trim(), cityKey: null, cityQuery: null, days: null, budget: null, currency: null, likes: [], avoid: [], group: null, pace: 'normal', hidden: false, startDate: null };

  // City: a known city anywhere, else "in/to/visit <Capitalised Words>"
  const names = [...Object.keys(KNOWN_CITIES), ...Object.keys(CITY_ALIASES)].sort((a, b) => b.length - a.length);
  for (const n of names) if (new RegExp(`\\b${n}\\b`, 'i').test(low)) { out.cityKey = CITY_ALIASES[n] || n; break; }
  if (!out.cityKey) {
    const m = t.match(/\b(?:in|to|visit(?:ing)?|around|explore)\s+([A-ZÀ-Ý][\p{L}'-]+(?:\s+[A-ZÀ-Ý][\p{L}'-]+){0,2})/u);
    if (m) out.cityQuery = m[1];
  }

  // Days
  if (/\b(long weekend)\b/.test(low)) out.days = 3;
  else if (/\bweekend\b/.test(low)) out.days = 2;
  else if (/\b(a|one) week\b/.test(low)) out.days = 7;
  const dm = low.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|a couple of|a)\s*-?\s*(days?|nights?)\b/);
  if (dm) { const k = dm[1].replace('a couple of', 'couple'); const v = NUM[k] ?? Number(k); if (v) out.days = dm[2].startsWith('night') ? v + 1 : v; }
  if (out.days) out.days = Math.max(1, Math.min(10, out.days));

  // Budget
  const bm = t.match(/([€$£])\s?(\d[\d.,]*)\s*(k)?\b|\b(\d[\d.,]*)\s*(k)?\s*(€|eur(?:os?)?|usd|dollars?|\$|gbp|pounds?|£|chf|francs?)\b/i);
  if (bm) {
    const num = parseFloat((bm[2] || bm[4]).replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')) * ((bm[3] || bm[5]) ? 1000 : 1);
    const sym = (bm[1] || bm[6] || '').toLowerCase();
    out.budget = Math.round(num);
    out.currency = /€|eur/.test(sym) ? 'EUR' : /\$|usd|dollar/.test(sym) ? 'USD' : /£|gbp|pound/.test(sym) ? 'GBP' : /chf|franc/.test(sym) ? 'CHF' : 'EUR';
  }

  // Likes / dislikes: split into clauses so "hate museums" doesn't count as liking museums
  for (const clause of low.split(/[,.;!]|\bbut\b|\band\b/)) {
    const negative = DISLIKE_LEAD.test(clause);
    for (const [k, def] of Object.entries(INTERESTS)) if (def.re.test(clause)) (negative ? out.avoid : out.likes).push(k);
    if (negative) {
      for (const [k, re] of Object.entries(AVOID)) if (re.test(clause)) out.avoid.push(k);
    }
  }
  if (/\b(quiet|calm|peaceful|off the beaten|hidden gems?|local(s| spots)?|non-touristy|secret)\b/.test(low)) { out.hidden = true; if (!out.avoid.includes('crowds')) out.avoid.push('crowds'); }
  out.likes = [...new Set(out.likes)].filter((k) => !out.avoid.includes(k));
  out.avoid = [...new Set(out.avoid)];

  // Who & pace
  if (/\b(kids?|children|family|toddlers?)\b/.test(low)) out.group = 'family';
  else if (/\b(girlfriend|boyfriend|partner|wife|husband|couple|romantic|honeymoon)\b/.test(low)) out.group = 'couple';
  else if (/\b(friends|mates|group)\b/.test(low)) out.group = 'friends';
  else if (/\b(solo|alone|by myself|on my own)\b/.test(low)) out.group = 'solo';
  if (/\b(relax(ed|ing)?|slow|chill|easy|lazy|no rush)\b/.test(low)) out.pace = 'relaxed';
  else if (/\b(packed|see everything|busy schedule|intense|max(imum)?|as much as)\b/.test(low)) out.pace = 'packed';

  // Dates: ISO date, "in March", "next weekend", "tomorrow"
  const iso = low.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const mon = low.match(new RegExp(`\\b(?:in|during|this|next)?\\s*(${MONTHS.join('|')})\\b`));
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (iso) out.startDate = `${iso[1]}-${iso[2]}-${iso[3]}`;
  else if (/\btomorrow\b/.test(low)) out.startDate = isoDate(addDays(base, 1));
  else if (/\bnext week(end)?\b/.test(low) || /\bthis weekend\b/.test(low)) {
    const d = addDays(base, ((6 - base.getDay() + 7) % 7) || 7); // next Saturday
    out.startDate = isoDate(/\bnext week\b(?!end)/.test(low) ? addDays(d, 2) : (/long weekend/.test(low) ? addDays(d, -1) : d));
  } else if (mon) {
    const m = MONTHS.indexOf(mon[1]);
    const y = m < today.getMonth() || (m === today.getMonth() && today.getDate() > 20) ? today.getFullYear() + 1 : today.getFullYear();
    out.startDate = isoDate(new Date(y, m, m === today.getMonth() ? today.getDate() + 7 : 10));
  }
  return out;
}

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Human summary of what was understood, e.g. "3 days · Paris · food · avoid crowds · €800". */
export function describeParsed(p, cityLabel) {
  const bits = [];
  if (p.days) bits.push(`${p.days} day${p.days > 1 ? 's' : ''}`);
  if (cityLabel) bits.push(cityLabel);
  if (p.likes.length) bits.push(`loves ${p.likes.map((k) => INTERESTS[k].label.toLowerCase()).join(', ')}`);
  if (p.avoid.length) bits.push(`avoids ${p.avoid.map((k) => (INTERESTS[k]?.label || k).toLowerCase()).join(', ')}`);
  if (p.hidden) bits.push('hidden gems');
  if (p.group) bits.push(p.group);
  if (p.pace !== 'normal') bits.push(`${p.pace} pace`);
  if (p.budget) bits.push(`${p.currency === 'USD' ? '$' : p.currency === 'GBP' ? '£' : p.currency === 'CHF' ? 'CHF ' : '€'}${p.budget}`);
  if (p.startDate) bits.push(`from ${p.startDate}`);
  return bits.join(' · ');
}

// ── POIs from OpenStreetMap elements ─────────────────────────────────────────
/** OSM element → { name, coords, cat, type, hours, fame } or null. */
export function poiFromOsm(el) {
  const tg = el?.tags || {};
  const name = tg['name:en'] || tg.name;
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  if (!name || lat == null || lon == null) return null;
  let cat = null, type = null;
  if (tg.tourism === 'museum' || tg.tourism === 'gallery' || tg.amenity === 'arts_centre') { cat = 'culture'; type = tg.tourism === 'gallery' ? 'gallery' : 'museum'; }
  else if (tg.amenity === 'theatre') { cat = 'culture'; type = 'theatre'; }
  else if (tg.historic && !['memorial', 'boundary_stone', 'milestone', 'wayside_cross', 'wayside_shrine', 'plaque', 'building'].includes(tg.historic)) { cat = 'culture'; type = 'historic'; }
  else if (tg.amenity === 'place_of_worship' && (tg.wikidata || tg.wikipedia)) { cat = 'culture'; type = 'church'; }
  else if (tg.tourism === 'viewpoint') { cat = 'views'; type = 'viewpoint'; }
  else if (tg.leisure === 'park' || tg.leisure === 'garden' || tg.leisure === 'nature_reserve') { cat = 'nature'; type = 'park'; }
  else if (tg.tourism === 'attraction' || tg.tourism === 'zoo' || tg.tourism === 'aquarium') { cat = 'sights'; type = 'attraction'; }
  else if (tg.amenity === 'restaurant' || tg.amenity === 'food_court') { cat = 'food'; type = 'restaurant'; }
  else if (tg.amenity === 'cafe') { cat = 'coffee'; type = 'cafe'; }
  else if (tg.amenity === 'pub' || tg.amenity === 'bar' || tg.amenity === 'biergarten') { cat = 'nightlife'; type = tg.amenity === 'pub' ? 'pub' : 'bar'; }
  else if (tg.amenity === 'marketplace' || tg.shop === 'mall' || tg.shop === 'department_store') { cat = 'shopping'; type = tg.amenity === 'marketplace' ? 'market' : 'shopping'; }
  if (!cat) return null;
  const fame = (tg.wikidata ? 1.5 : 0) + (tg.wikipedia ? 1 : 0) + (tg.tourism === 'attraction' ? 0.5 : 0) + (tg.website ? 0.3 : 0) + (tg.opening_hours ? 0.2 : 0);
  return { id: el.id, name, coords: [lat, lon], cat, type, hours: tg.opening_hours || null, fame,
    osmTags: { hours: tg.opening_hours || null, wikidata: tg.wikidata || null, wikipedia: tg.wikipedia || null, website: tg.website || null, cuisine: tg.cuisine || null } };
}

const PACE_STOPS = { relaxed: 3, normal: 4, packed: 6 };
const crowdWarnings = (e) => (e?.statementsList || []).filter((n) => ASPECTS.crowds.test(n.claim || '') && /\b(crowd(s|ed)?|busy|packed|queues?|long lines?|wait)\b/i.test(n.claim || '') && n.evaluation?.sentiment !== 'positive');

/**
 * Builds the plan. pois: output of poiFromOsm (any order). evidenceIndex: buildPlaceEvidence(...) or null.
 * Returns { days:[{ date, title, stops:[{ time, name, type, coords, hours, why[], flags[] }] }], notes[] }
 */
export function buildQuickPlan(parsed, { pois = [], center, evidenceIndex = null, startDate, radiusKm = 5 } = {}) {
  const days = parsed.days || 3;
  const perDay = PACE_STOPS[parsed.pace] || 4;
  const likes = new Set(parsed.likes), avoid = new Set(parsed.avoid);
  const notes = [];

  // Score every POI once (cheap part), then look up evidence for the best ~800 only
  const seen = new Set();
  const base = [];
  for (const p of pois) {
    if (!p || (center && distKm(center, p.coords) > radiusKm)) continue;
    const k = p.name.toLowerCase(); if (seen.has(k)) continue; seen.add(k);
    const why = [];
    let s = parsed.hidden ? Math.min(p.fame, 1) * 0.6 + (p.fame > 0 && p.fame < 1.6 ? 1 : 0) : p.fame;
    if (p.fame >= 1.5 && !parsed.hidden) why.push('well known');
    if (parsed.hidden && p.fame > 0 && p.fame < 1.6) why.push('hidden gem');
    if (likes.has(p.cat)) { s += 3; why.push(`you like ${INTERESTS[p.cat]?.label.toLowerCase() || p.cat}`); }
    if (avoid.has(p.cat)) s -= 6;
    if (p.cat === 'sights' || p.cat === 'culture' || p.cat === 'views') s += 0.5;      // backbone of a city day
    base.push({ p, s, why });
  }
  base.sort((a, b) => b.s - a.s);
  const scored = [];
  for (const [i, { p, why }] of base.entries()) {
    let { s } = base[i];
    const flags = [];
    const e = i < 800 && evidenceIndex?.size ? strictEvidence(p.name, evidenceIndex) : null;
    if (e) {
      s += Math.min(1, e.statements / 10);                                         // travellers talk about it
      if (e.pos > e.neg * 2 && e.pos >= 2) { s += 0.6; why.push(`${e.pos} positive tips`); }
      const crowd = crowdWarnings(e);
      if (crowd.length && avoid.has('crowds')) { s -= 2.5; flags.push({ kind: 'crowds', text: `Sources mention queues/crowds (${sourceLabel(crowd[0].source?.sourceType)})`, detail: crowd[0].claim }); }
      const c = controversyScore(e);
      if (c >= 0.45) { const pair = pickDisputePair(e); flags.push({ kind: 'dispute', text: pair?.condition || 'Sources disagree about this place', detail: pair ? `“${pair.a}” vs “${pair.b}”` : '' }); }
    }
    if (avoid.has('price') && /\b(michelin|fine dining)\b/i.test(p.osmTags?.cuisine || '')) s -= 2;
    scored.push({ ...p, s, why, flags });
  }
  const isMeal = (p) => p.cat === 'food' || p.cat === 'coffee';
  const isEvening = (p) => p.cat === 'nightlife';
  const main = scored.filter((p) => !isMeal(p) && !isEvening(p)).sort((a, b) => b.s - a.s);
  const meals = scored.filter((p) => p.cat === 'food' || (p.cat === 'coffee' && likes.has('coffee'))).sort((a, b) => b.s - a.s);
  const evening = scored.filter((p) => isEvening(p) || (p.cat === 'food' && likes.has('food'))).sort((a, b) => b.s - a.s);
  if (main.length < perDay) notes.push('Not many places found for this city — add more from the Explore tab.');

  const used = new Set();
  const start = startDate || parsed.startDate;
  const out = [];
  for (let d = 0; d < days; d++) {
    const date = start ? isoDate(addDays(new Date(`${start}T00:00:00`), d)) : null;
    const when = (hhmm) => (date ? new Date(`${date}T${hhmm}:00`) : null);
    const openAt = (p, hhmm) => !date || !p.hours || isOpenAt(p.hours, when(hhmm)) !== false;
    const weekday = date ? new Date(`${date}T12:00:00`).getDay() : null;
    const closedToday = (p) => weekday != null && !!p.hours && (closedWeekdays(p.hours) || []).includes(weekday);
    // Anchor: best unused place that is open around late morning, far enough from previous anchors
    const anchor = main.find((p) => !used.has(p.name) && openAt(p, '11:00') && out.every((day) => !day._anchor || distKm(day._anchor.coords, p.coords) > 1.2))
      || main.find((p) => !used.has(p.name) && openAt(p, '11:00'));
    if (!anchor) break;
    used.add(anchor.name);
    const picks = [anchor];
    const near = main.filter((p) => !used.has(p.name) && !closedToday(p) && distKm(anchor.coords, p.coords) <= (avoid.has('walking') ? 1.2 : 2.2))
      .map((p) => ({ p, v: p.s - 1.1 * distKm(anchor.coords, p.coords) }))
      .sort((a, b) => b.v - a.v);
    // Variety: at most two of the same category per day
    const catCount = { [anchor.cat]: 1 };
    for (const { p } of near) {
      if (picks.length >= perDay) break;
      if ((catCount[p.cat] || 0) >= 2) continue;
      picks.push(p); used.add(p.name); catCount[p.cat] = (catCount[p.cat] || 0) + 1;
    }
    const ordered = nearestNeighbourOrder(picks);
    // Times
    let t = parsed.pace === 'relaxed' ? 10 * 60 : 9 * 60 + 30;
    const stops = [];
    const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const visit = parsed.pace === 'packed' ? 75 : parsed.pace === 'relaxed' ? 120 : 95;
    let lunchDone = false;
    for (let i = 0; i < ordered.length; i++) {
      const p = ordered[i];
      if (!lunchDone && t >= 12 * 60 + 15) {
        const lunch = meals.find((m) => !used.has(m.name) && !closedToday(m) && distKm(m.coords, p.coords) <= 0.9 && openAt(m, '13:00'));
        if (lunch) { used.add(lunch.name); stops.push(stopOf(lunch, fmt(t), ['lunch nearby', ...lunch.why])); t += 60 + 15; }
        lunchDone = true;
      }
      // Not open yet? Wait up to an hour (e.g. a palace opening at 10:00) before warning
      for (let wait = 0; wait < 60 && !openAt(p, fmt(t)) && openAt(p, fmt(t + 60)); wait += 15) t += 15;
      if (!openAt(p, fmt(t))) p.flags = [...p.flags, { kind: 'hours', text: `Check opening hours: ${p.hours}` }];
      stops.push(stopOf(p, fmt(t), p.why));
      t += visit + 20;
    }
    if (!lunchDone && ordered.length) {
      const last = ordered[ordered.length - 1];
      const lunch = meals.find((m) => !used.has(m.name) && distKm(m.coords, last.coords) <= 1);
      if (lunch) { used.add(lunch.name); stops.splice(Math.min(2, stops.length), 0, stopOf(lunch, '12:45', ['lunch nearby', ...lunch.why])); }
    }
    if ((likes.has('nightlife') || likes.has('food')) && ordered.length) {
      const last = ordered[ordered.length - 1];
      const eve = evening.find((m) => !used.has(m.name) && !closedToday(m) && openAt(m, '19:30') && distKm(m.coords, last.coords) <= 1.5);
      if (eve) { used.add(eve.name); stops.push(stopOf(eve, '19:30', [likes.has('nightlife') ? 'evening drinks' : 'dinner', ...eve.why])); }
    }
    stops.sort((a, b) => a.time.localeCompare(b.time));
    out.push({ date, title: dayTitle(ordered), stops, _anchor: anchor });
  }
  out.forEach((d) => delete d._anchor);

  if (parsed.budget && days) {
    const perDayBudget = parsed.budget / days;
    notes.push(perDayBudget < 90 ? `≈${Math.round(perDayBudget)} per day is tight — plan picnics and free museums.` : `≈${Math.round(perDayBudget)} per day for food, tickets and transport.`);
  }
  const flagged = out.flatMap((d) => d.stops).filter((s) => s.flags.length).length;
  if (flagged) notes.push(`${flagged} stop${flagged > 1 ? 's have' : ' has'} a warning from travel sources — check the ⚠ marks.`);
  return { days: out, notes };
}

const stopOf = (p, time, why) => ({ time, name: p.name, type: p.type, cat: p.cat, coords: p.coords, hours: p.hours, osmTags: p.osmTags, why: [...new Set(why)].slice(0, 3), flags: p.flags || [] });

function dayTitle(stops) {
  const cats = stops.map((s) => s.cat);
  const top = ['culture', 'nature', 'views', 'shopping', 'sights'].find((c) => cats.filter((x) => x === c).length >= 2);
  const lead = stops[0]?.name || '';
  return top ? `${{ culture: 'Culture', nature: 'Green', views: 'Views', shopping: 'Markets', sights: 'Sights' }[top]} day around ${lead}` : `Around ${lead}`;
}
