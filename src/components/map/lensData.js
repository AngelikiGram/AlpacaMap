// Data side of the map lenses (hooks and helpers); the drawing is in Lenses.jsx.
import { useMemo } from 'react';
import { buildTruthLens, strictEvidence } from '../../knowledge/controversy';
import { checkStop } from '../../planner/tripChecks';
import { isOpenAt, sunTimes } from '../../planner/openingHours';

/**
 * Places of the city in focus (saved first), with coordinates. visible: the places currently pinned on the
 * map (MapView's visibleRecs); without it, all loaded places of the city.
 */
export function lensPoints(locations, activeCity, visible = null) {
  const cities = activeCity ? (locations || []).filter((l) => l.id === activeCity.id) : (locations || []);
  const out = [];
  for (const c of cities) {
    for (const p of c.places || []) if (Array.isArray(p.coords)) out.push({ ...p, saved: true, hours: p.osmTags?.hours || p.hours || null });
    for (const p of (visible && c.id === activeCity?.id ? visible : c.recommendations) || []) if (Array.isArray(p.coords)) out.push({ ...p, hours: p.osmTags?.hours || null });
  }
  return out;
}

// ── Truth lens ────────────────────────────────────────────────────────────────
export function useTruthLens(points, evidenceIndex, enabled) {
  return useMemo(() => (enabled ? buildTruthLens(points, evidenceIndex) : []), [enabled, points, evidenceIndex]);
}


// ── Time lens ─────────────────────────────────────────────────────────────────
const isViewpoint = (p) => /viewpoint|views?/i.test(p.type || '') || /\b(viewpoint|lookout|belv[eé]d[eè]re|hill)\b/i.test(p.name || '');

export function useTimeLens(points, evidenceIndex, { date, minutes, center, utcOffsetMin, enabled }) {
  return useMemo(() => {
    if (!enabled) return { items: [], sun: null, golden: false, counts: {} };
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0'), mm = String(minutes % 60).padStart(2, '0');
    const when = new Date(`${date}T${hh}:${mm}:00`);
    const sun = center ? sunTimes(center[0], center[1], when, utcOffsetMin) : null;
    const golden = !!sun && ((minutes >= sun.sunrise && minutes <= sun.sunrise + 60) || (minutes >= sun.sunset - 60 && minutes <= sun.sunset));
    const dark = !!sun && (minutes < sun.sunrise - 20 || minutes > sun.sunset + 30);
    const items = []; const counts = { open: 0, closed: 0, busy: 0, golden: 0, unknown: 0 };
    let lookups = 0;
    for (const p of points) {
      let status = null, note = null;
      if (p.hours) { const o = isOpenAt(p.hours, when); if (o === true) status = 'open'; else if (o === false) { status = 'closed'; note = p.hours; } }
      // Crowd hints from sources (only for well-known or saved places: keeps it fast)
      if (status !== 'closed' && evidenceIndex?.size && lookups < 300 && (p.saved || p.osmTags?.wikidata)) {
        lookups++;
        const ev = strictEvidence(p.name, evidenceIndex);
        const w = ev ? checkStop({ title: p.name, date, time: `${hh}:${mm}`, place: null, evidence: ev }).find((x) => x.kind === 'crowds' || x.kind === 'closed-day') : null;
        if (w?.kind === 'crowds') { status = 'busy'; note = w.text; }
        if (w?.kind === 'closed-day') { status = 'closed'; note = w.text; }
      }
      if (isViewpoint(p) && !status) status = dark ? 'closed' : 'open';
      if (golden && isViewpoint(p) && status !== 'closed') { status = 'golden'; note = 'Golden hour light'; }
      // Every pinned place gets a dot; without opening hours it is marked as unknown
      if (!status) status = 'unknown';
      counts[status === 'golden' ? 'golden' : status]++;
      items.push({ ...p, status, note });
    }
    return { items, sun, golden, dark, counts };
  }, [enabled, points, evidenceIndex, date, minutes, center, utcOffsetMin]);
}

