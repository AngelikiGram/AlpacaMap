// Small reader for OpenStreetMap opening_hours strings, the common cases only:
//   "Mo-Fr 09:00-17:00; Sa 10:00-16:00; Su off", "24/7", "Mo,We 10:00-12:00,14:00-18:00",
//   "Tu-Su 10:00-18:00", "10:00-18:00" (every day), "PH off" (ignored), "Fr 18:00-02:00".
// Anything it does not understand returns null ("unknown") instead of guessing.

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_IDX = Object.fromEntries(DAYS.map((d, i) => [d, i]));
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };

function expandDays(spec) {
  const out = new Set();
  for (const part of spec.split(',')) {
    const p = part.trim();
    const range = p.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)-(Mo|Tu|We|Th|Fr|Sa|Su)$/);
    if (range) {
      let i = DAY_IDX[range[1]]; const end = DAY_IDX[range[2]];
      for (let k = 0; k < 7; k++) { out.add(i); if (i === end) break; i = (i + 1) % 7; }
    } else if (DAY_IDX[p] != null) out.add(DAY_IDX[p]);
    else return null;
  }
  return out;
}

/** Parses into { alwaysOpen } or { rules: [{days:Set, ranges:[[from,to]] | 'off'}] }, or null. */
export function parseOpeningHours(str) {
  const s = String(str || '').trim();
  if (!s) return null;
  if (s === '24/7') return { alwaysOpen: true };
  const rules = [];
  for (const raw of s.split(';')) {
    let r = raw.trim();
    if (!r || /^PH\b|^SH\b/.test(r)) continue;          // public/school holidays: ignore
    if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(r)) continue; // date exceptions ("Dec 24-26 off")
    r = r.replace(/,\s*PH\b/, '');
    const m = r.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)?\s*(.*)$/);
    if (!m) return null;
    const days = m[1] ? expandDays(m[1]) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!days) return null;
    const rest = m[2].trim();
    if (/^(off|closed)$/i.test(rest)) { rules.push({ days, ranges: 'off' }); continue; }
    const ranges = [];
    for (const t of rest.split(',')) {
      const tm = t.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\+?$/);
      if (!tm) return null;
      ranges.push([toMin(tm[1]), toMin(tm[2])]);
    }
    if (!ranges.length) return null;
    rules.push({ days, ranges });
  }
  return rules.length ? { rules } : null;
}

/**
 * Open at a moment? true / false / null (unknown).
 * `when` is a Date (local time of the city is assumed to equal the Date's local fields).
 */
export function isOpenAt(str, when) {
  const p = typeof str === 'string' ? parseOpeningHours(str) : str;
  if (!p) return null;
  if (p.alwaysOpen) return true;
  const day = when.getDay(), min = when.getHours() * 60 + when.getMinutes();
  const prev = (day + 6) % 7;
  // Later rules override earlier ones for the same day (OSM semantics)
  let today = null, yesterday = null;
  for (const r of p.rules) { if (r.days.has(day)) today = r; if (r.days.has(prev)) yesterday = r; }
  // Spill-over from the previous evening (Fr 18:00-02:00)
  if (yesterday && yesterday.ranges !== 'off' && yesterday.ranges.some(([a, b]) => b <= a && min < b)) return true;
  if (!today) return false;           // day not listed → closed
  if (today.ranges === 'off') return false;
  return today.ranges.some(([a, b]) => (b > a ? min >= a && min < b : min >= a));
}

/** Days of the week (0=Sun) on which the place is fully closed, or null when unknown. */
export function closedWeekdays(str) {
  const p = parseOpeningHours(str);
  if (!p) return null;
  if (p.alwaysOpen) return [];
  const out = [];
  for (let d = 0; d < 7; d++) {
    let rule = null; for (const r of p.rules) if (r.days.has(d)) rule = r;
    if (!rule || rule.ranges === 'off') out.push(d);
  }
  return out;
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Sun times (NOAA approximation, ±2 min), for golden hour on the map ──────────
/** { sunrise, sunset } as minutes after local midnight, using the timezone offset of `date`. */
export function sunTimes(lat, lon, date = new Date(), utcOffsetMin = null) {
  const rad = Math.PI / 180;
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / 86400000);
  const g = (2 * Math.PI / 365) * (dayOfYear - 1);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosH = (Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl))) - Math.tan(lat * rad) * Math.tan(decl);
  if (cosH > 1 || cosH < -1) return null; // polar day/night
  const ha = Math.acos(cosH) / rad;
  const offset = utcOffsetMin ?? guessUtcOffsetMin(lat, lon, date);
  const noon = 720 - 4 * lon - eqTime + offset;
  return { sunrise: Math.round(noon - ha * 4), sunset: Math.round(noon + ha * 4) };
}

/** Best guess of a city's UTC offset in minutes when the real one (e.g. from Open-Meteo) is unknown. */
export function guessUtcOffsetMin(lat, lon, date = new Date()) {
  let base = Math.round(lon / 15);
  if (lat > 35 && lat < 72 && lon > -11 && lon < 40) {          // Europe: political time zones
    base = (lon < -6 || (lon < 2 && lat > 49.5)) ? 0 : lon < 22.5 ? 1 : 2;
  }
  return (base + (isSummerTime(date, lat) ? 1 : 0)) * 60;
}

// Rough daylight-saving guess (Europe/N. America: last Sunday of March – last Sunday of October)
function isSummerTime(date, lat) {
  if (Math.abs(lat) < 23) return false;
  const m = date.getMonth();
  return lat > 0 ? m > 2 && m < 10 : m < 3 || m > 9;
}

export const fmtMin = (m) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`;
