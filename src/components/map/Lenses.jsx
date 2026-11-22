// Map lenses:
//  • Truth lens — colours the map by how much travel sources argue about each place
//    (soft overlapping circles read like a heat map: green = sources agree, red = they disagree).
//  • Time lens — what is open, closed or packed at a chosen hour, plus golden hour for viewpoints.
import React from 'react';
import { Circle, CircleMarker, Tooltip } from 'react-leaflet';
import { Scale, Clock, X, Sunrise, Sunset } from 'lucide-react';
import { fmtMin } from '../../planner/openingHours';

export function TruthLensLayer({ items, onPick }) {
  return items.map((p) => (
    <React.Fragment key={`tl-${p.name}`}>
      {/* wide soft halo → heat-map look where several argued places are close together */}
      <Circle center={p.coords} radius={140 + p.score * 320} interactive={false}
        pathOptions={{ stroke: false, fillColor: p.color, fillOpacity: 0.12 + p.score * 0.22 }} />
      <CircleMarker center={p.coords} radius={p.saved ? 8 : 6}
        pathOptions={{ color: '#0b1020', weight: 1.5, fillColor: p.color, fillOpacity: 0.95 }}
        eventHandlers={{ click: () => onPick?.(p) }}>
        <Tooltip direction="top" offset={[0, -6]}>
          <b>{p.name}</b><br />
          <span style={{ color: p.color, fontWeight: 700 }}>{p.headline}</span>
          {' · '}{p.evidence.statements} statements, {p.evidence.sources.length} sources
        </Tooltip>
      </CircleMarker>
    </React.Fragment>
  ));
}

export function TruthLensLegend({ items, cityName, topicDisputes = 0, checked, onClose, onOpenDebates }) {
  const hot = [...items].sort((a, b) => b.score - a.score).filter((p) => p.score >= 0.35).slice(0, 4);
  return (
    <div className="lens-legend" role="region" aria-label="Truth lens legend">
      <div className="lens-legend-head">
        <Scale size={14} /> <b>Truth lens</b>{cityName ? <span className="lens-sub"> · {cityName}</span> : null}
        <button className="lens-close" onClick={onClose} aria-label="Close truth lens"><X size={13} /></button>
      </div>
      <div className="lens-ramp"><span>Sources agree</span><i /><span>Sources disagree</span></div>
      {items.length === 0 ? (
        <p className="lens-note">🦙 No place here has enough statements yet. Load knowledge for this city (Knowledge tab) or zoom to a city in your trip.</p>
      ) : (
        <>
          <p className="lens-note">{items.length} places with evidence{hot.length ? ' · most argued:' : ' · sources mostly agree here'}</p>
          {hot.map((p) => (
            <div key={p.name} className="lens-hot"><span className="lens-dot" style={{ background: p.color }} />{p.name}<em>{p.headline}</em></div>
          ))}
        </>
      )}
      {topicDisputes > 0 && (
        <button className="lens-cta" onClick={onOpenDebates}>⚖️ {topicDisputes} possible disagreements to judge → Debates</button>
      )}
      {!checked && <p className="lens-note dim">Amber/red without a check mark = tone differs. Run Knowledge → Conflicts to verify real contradictions.</p>}
    </div>
  );
}

// ── Time lens ─────────────────────────────────────────────────────────────────
const TIME_STYLE = {
  open: { color: '#34d399', fill: 0.85, r: 5 },
  closed: { color: '#64748b', fill: 0.35, r: 4 },
  busy: { color: '#fb923c', fill: 0.9, r: 7 },
  golden: { color: '#facc15', fill: 0.95, r: 9 },
};

export function TimeLensLayer({ items, onPick }) {
  return items.map((p) => {
    const s = TIME_STYLE[p.status];
    return (
      <CircleMarker key={`tm-${p.name}`} center={p.coords} radius={s.r}
        pathOptions={{ color: p.status === 'golden' ? '#fde68a' : '#0b1020', weight: p.status === 'golden' ? 3 : 1, fillColor: s.color, fillOpacity: s.fill, dashArray: p.status === 'closed' ? '2,2' : null }}
        eventHandlers={{ click: () => onPick?.(p) }}>
        <Tooltip direction="top" offset={[0, -6]}>
          <b>{p.name}</b><br />{{ open: 'Open', closed: 'Closed', busy: 'Busy', golden: 'Golden hour' }[p.status]}{p.note ? ` — ${p.note}` : ''}
        </Tooltip>
      </CircleMarker>
    );
  });
}

export function TimeLensControl({ date, setDate, minutes, setMinutes, dates, lens, onClose }) {
  const { sun, golden, dark, counts } = lens;
  return (
    <div className="lens-legend time" role="region" aria-label="Time lens">
      <div className="lens-legend-head">
        <Clock size={14} /> <b>Time lens</b>
        <span className="lens-time">{fmtMin(minutes)}</span>
        <button className="lens-close" onClick={onClose} aria-label="Close time lens"><X size={13} /></button>
      </div>
      <input type="range" min={6 * 60} max={23 * 60 + 30} step={30} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}
        aria-label="Time of day" className={`lens-slider ${golden ? 'golden' : dark ? 'dark' : ''}`} />
      <div className="lens-row">
        <select value={date} onChange={(e) => setDate(e.target.value)} aria-label="Day">
          {dates.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        {sun && <span className="lens-sun"><Sunrise size={12} /> {fmtMin(sun.sunrise)} <Sunset size={12} /> {fmtMin(sun.sunset)}</span>}
      </div>
      <div className="lens-counts">
        <span><i style={{ background: TIME_STYLE.open.color }} />{counts.open || 0} open</span>
        <span><i style={{ background: TIME_STYLE.closed.color }} />{counts.closed || 0} closed</span>
        <span><i style={{ background: TIME_STYLE.busy.color }} />{counts.busy || 0} busy</span>
        {golden && <span><i style={{ background: TIME_STYLE.golden.color }} />golden hour ✨</span>}
      </div>
      {!lens.items.length && <p className="lens-note">🦙 No opening hours known for places here yet — open Explore to load the city's places.</p>}
    </div>
  );
}
