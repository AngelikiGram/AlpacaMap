// Checks an itinerary against what is known about each stop:
//   • opening hours from OpenStreetMap ("closed on Mondays", "opens at 10:00"),
//   • what sources say about closures, seasons and crowds at certain times,
//   • the weather forecast (rain plan: swap outdoor stops for nearby indoor ones).
// Pure functions; the UI lives in CalendarPanel.
import { isOpenAt, closedWeekdays, WEEKDAY_NAMES } from './openingHours.js';
import { normalizeName } from '../knowledge/evidence.js';
import { ASPECTS, extractConditions } from '../knowledge/contradictions.js';
import { sourceLabel, strictEvidence } from '../knowledge/controversy.js';
import { getDistanceKm } from './geo.js';

const TRANSPORT = new Set(['flight', 'train', 'bus', 'car', 'ferry', 'hotel', 'transport', 'ship']);
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const SEASON_OF_MONTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
const DAY_WORDS = ['sundays?', 'mondays?', 'tuesdays?', 'wednesdays?', 'thursdays?', 'fridays?', 'saturdays?'];

export const timeBucket = (hhmm) => {
  const h = Number(String(hhmm || '12:00').split(':')[0]);
  return h < 9 ? 'early morning' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
};

const eventDate = (date, time) => new Date(`${date}T${/^\d{1,2}:\d{2}$/.test(time || '') ? time.padStart(5, '0') : '12:00'}:00`);
const CROWD_WORDS = /\b(crowd(s|ed)?|busy|packed|heaving|queues?|long lines?|wait(ing)?|tourists?)\b/i;

/** Warnings for one stop at one moment. place: { hours?, name } (resolved trip place), evidence from findEvidence. */
export function checkStop({ date, time, place, evidence }) {
  const when = eventDate(date, time);
  if (Number.isNaN(when.getTime())) return [];
  const wd = when.getDay();
  const out = [];

  // 1 · OpenStreetMap opening hours
  if (place?.hours) {
    const open = isOpenAt(place.hours, when);
    if (open === false) {
      const closedDays = closedWeekdays(place.hours) || [];
      out.push(closedDays.includes(wd)
        ? { kind: 'closed-day', severity: 'high', text: `Closed on ${WEEKDAY_NAMES[wd]}s`, detail: `Opening hours: ${place.hours}`, source: 'OpenStreetMap' }
        : { kind: 'closed-time', severity: 'high', text: `Not open at ${time}`, detail: `Opening hours: ${place.hours}`, source: 'OpenStreetMap' });
    }
  }

  // 2 · What sources say
  const month = when.getMonth(), season = SEASON_OF_MONTH[month], bucket = timeBucket(time);
  const weekend = wd === 0 || wd === 6;
  const seen = new Set(out.map((w) => w.kind));
  for (const n of evidence?.statementsList || []) {
    const t = n.claim || '';
    if (t.length > 400) continue;
    const src = sourceLabel(n.source?.sourceType);
    // "closed on Mondays" / "Mondays closed"
    if (!seen.has('closed-day')) {
      const dayRe = new RegExp(`\\bclosed\\s+(on\\s+)?(${DAY_WORDS[wd]})\\b|\\b(${DAY_WORDS[wd]})\\s*(:|-)?\\s*closed\\b`, 'i');
      if (dayRe.test(t)) { out.push({ kind: 'closed-day', severity: 'high', text: `${src} says it is closed on ${WEEKDAY_NAMES[wd]}s`, detail: t, source: src }); seen.add('closed-day'); continue; }
    }
    // "closed in winter" / "closed in January"
    if (!seen.has('closed-season') && /\bclosed\b/i.test(t)) {
      const m = t.toLowerCase().match(/\bclosed\s+(in|during|from|for|over)\s+(the\s+)?(winter|summer|spring|autumn|fall|january|february|march|april|may|june|july|august|september|october|november|december)\b/);
      if (m && (m[3] === season || (m[3] === 'fall' && season === 'autumn') || m[3] === MONTHS[month])) {
        out.push({ kind: 'closed-season', severity: 'high', text: `${src} says it is closed in ${m[3]}`, detail: t, source: src }); seen.add('closed-season'); continue;
      }
    }
    // Crowds at this time of day / on weekends
    if (!seen.has('crowds') && ASPECTS.crowds.test(t) && CROWD_WORDS.test(t) && n.evaluation?.sentiment !== 'positive') {
      const c = extractConditions(t, n.conditions);
      const timeHit = c.timeOfDay && (c.timeOfDay === bucket || (c.timeOfDay === 'morning' && bucket === 'early morning'));
      const weekHit = c.week === 'weekend' && weekend;
      const seasonHit = c.season && c.season === season;
      if (timeHit || weekHit || seasonHit) {
        const why = timeHit ? `in the ${c.timeOfDay}` : weekHit ? 'at weekends' : `in ${c.season}`;
        out.push({ kind: 'crowds', severity: 'medium', text: `${src}: very busy ${why}, and you're going ${weekHit ? `on ${WEEKDAY_NAMES[wd]}` : `at ${time}`}`, detail: t, source: src });
        seen.add('crowds');
      }
    }
  }
  return out;
}

/**
 * Warnings for a whole itinerary.
 * resolvePlace(title, dayLocation) → { name, hours, coords, type } | null
 * Returns Map key `${dayId}:${eventId}` → warnings[]
 */
export function checkItinerary(itinerary, { evidenceIndex, resolvePlace }) {
  const result = new Map();
  for (const day of itinerary || []) {
    for (const evt of day.events || []) {
      if (TRANSPORT.has(evt.type)) continue;
      const place = resolvePlace?.(evt.title, day.location) || null;
      const evidence = evidenceIndex?.size ? strictEvidence(evt.title, evidenceIndex) : null;
      const w = checkStop({ title: evt.title, date: day.date, time: evt.time, place, evidence });
      if (w.length) result.set(`${day.id}:${evt.id}`, w);
    }
  }
  return result;
}

/** Finds a trip place (saved or recommended) by stop title. */
export function makePlaceResolver(locations) {
  const all = [];
  for (const loc of locations || []) {
    for (const p of [...(loc.places || []), ...(loc.recommendations || [])]) {
      if (!p?.name) continue;
      all.push({ key: normalizeName(p.name), city: normalizeName(loc.name.split(',')[0]), name: p.name, coords: p.coords, type: p.type,
        hours: p.osmTags?.hours || p.hours || null, wikidata: p.osmTags?.wikidata || null });
    }
  }
  return (title, dayLocation) => {
    const k = normalizeName(title);
    if (!k) return null;
    const city = normalizeName(String(dayLocation || '').split(',')[0]);
    const pool = city ? all.filter((p) => p.city.startsWith(city) || city.startsWith(p.city)) : all;
    return pool.find((p) => p.key === k) || all.find((p) => p.key === k)
      || pool.find((p) => p.key.length >= 6 && (k.includes(p.key) || p.key.includes(k))) || null;
  };
}

// ── Weather ──────────────────────────────────────────────────────────────────
const WET_CODES = (c) => (c >= 51 && c <= 67) || (c >= 71 && c <= 86) || c >= 95;
export const isWetDay = (f) => !!f && ((f.precipProb ?? 0) >= 60 || WET_CODES(f.code ?? 0));

const forecastCache = new Map();
/** { 'YYYY-MM-DD': { code, precipProb, tmax } } for the next 16 days (Open-Meteo, no key). */
export function fetchDailyForecast(lat, lon) {
  const k = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (!forecastCache.has(k)) {
    forecastCache.set(k, fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,precipitation_probability_max,temperature_2m_max&forecast_days=16&timezone=auto`)
      .then((r) => r.json())
      .then((d) => {
        const out = {};
        (d.daily?.time || []).forEach((t, i) => { out[t] = { code: d.daily.weather_code?.[i], precipProb: d.daily.precipitation_probability_max?.[i], tmax: d.daily.temperature_2m_max?.[i] }; });
        out._utcOffsetMin = typeof d.utc_offset_seconds === 'number' ? d.utc_offset_seconds / 60 : null;
        return out;
      })
      .catch(() => { forecastCache.delete(k); return {}; }));
  }
  return forecastCache.get(k);
}

const OUTDOOR_TYPE = /^(park|parks|viewpoint|views|garden|beach|beaches|hiking|nature|camping|zoo|square|playground)$/i;
const OUTDOOR_NAME = /\b(park|gardens?|heath|common|beach|viewpoint|hill|walk|trail|zoo|cemetery|square|lido|pier|harbour|harbor|promenade|bridge)\b/i;
const INDOOR_TYPE = /^(museum|museums|gallery|art|art & galleries|church|cafe|cafes|restaurant|food|shopping|theatre|library|aquarium|cinema)$/i;
const INDOOR_NAME = /\b(museum|gallery|cathedral|church|abbey|library|theatre|theater|aquarium|hall|arcade|cinema|market hall|centre|center|chapel)\b/i;

export const isOutdoor = (p) => !!p && (OUTDOOR_TYPE.test(p.type || '') || (!INDOOR_NAME.test(p.name || '') && OUTDOOR_NAME.test(p.name || '')));
export const isIndoor = (p) => !!p && !isOutdoor(p) && (INDOOR_TYPE.test(p.type || '') || INDOOR_NAME.test(p.name || ''));

/**
 * For a wet day: swap each outdoor stop for the nearest good indoor place (≤ maxKm) not already planned.
 * events: [{ id, title, time }], resolve(title) → place, candidates: places with coords.
 */
export function suggestRainSwaps(events, resolve, candidates, { maxKm = 2.5, exclude = new Set() } = {}) {
  const used = new Set([...exclude].map(normalizeName));
  const swaps = [];
  for (const evt of events || []) {
    if (TRANSPORT.has(evt.type)) continue;
    const p = resolve(evt.title);
    if (!p?.coords || !isOutdoor({ ...p, name: p.name || evt.title })) continue;
    let best = null;
    for (const c of candidates || []) {
      if (!c?.coords || !c.name || used.has(normalizeName(c.name)) || !isIndoor(c)) continue;
      const d = getDistanceKm(p.coords[0], p.coords[1], c.coords[0], c.coords[1]);
      if (d > maxKm) continue;
      const fame = (c.osmTags?.wikidata || c.osmTags?.wikipedia || c.wikidata) ? 1.2 : 0;
      const score = fame - d;
      if (!best || score > best.score) best = { c, d, score };
    }
    if (best) {
      used.add(normalizeName(best.c.name));
      swaps.push({ eventId: evt.id, from: evt.title, time: evt.time, to: { name: best.c.name, coords: best.c.coords, type: best.c.type }, distKm: best.d });
    }
  }
  return swaps;
}
