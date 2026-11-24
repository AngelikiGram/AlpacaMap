// Map lenses:
//  • Truth lens, colours the map by how much travel sources argue about each place
//    (soft overlapping circles read like a heat map: green = sources agree, red = they disagree).
//  • Time lens, what is open, closed or packed at a chosen hour, plus golden hour for viewpoints.
import React from 'react';
import { Circle, CircleMarker, Tooltip } from 'react-leaflet';
import { Scale, Clock, X, Sunrise, Sunset } from 'lucide-react';
import { fmtMin } from '../../planner/openingHours';
import { TOPIC_KEYWORDS } from '../../knowledge/topics';

// Bands of the controversy score (same thresholds as controversyColor)
const band = (s) => (s >= 0.75 ? 'disagree' : s >= 0.4 ? 'mixed' : 'agree');
const BAND_COLOR = { agree: '#34d399', mixed: '#fbbf24', disagree: '#f87171' };

export function TruthLensLayer({ items, onPick, focus = null }) {
  return [...items.map((p) => (
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
  )),
  // Place of the Debates card currently open: ringed and labelled
  focus && (
    <CircleMarker key={`tl-focus-${focus.name}`} center={focus.coords} radius={17} interactive={false}
      pathOptions={{ color: '#facc15', weight: 3, dashArray: '5,4', fillOpacity: 0 }}>
      <Tooltip permanent direction="right" offset={[16, 0]} className="lens-focus-tip">⚖️ Debating: <b>{focus.name}</b></Tooltip>
    </CircleMarker>
  )];
}

const BAND_WORD = { agree: 'agree', mixed: 'opinions split', disagree: 'disagree' };
const SOURCE_NAME = { wikivoyage: 'Wikivoyage', wikitravel: 'Wikitravel', wikipedia: 'Wikipedia', reddit: 'Reddit', stackexchange: 'StackExchange', manual: 'You' };
const JUNK = /\*\*|\]\(|==|\[\s|^\W|\?\s*$/;

/** Up to `n` short statements with the given sentiment, from as many different sources as possible. */
function pickStatements(list, sentiment, n = 2, topic = '') {
  const words = TOPIC_KEYWORDS[topic] || [];
  const hits = (t) => { const l = t.toLowerCase(); return words.reduce((k, w) => k + (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(l) ? 1 : 0), 0); };
  const cand = (list || [])
    .filter((s) => s.evaluation?.sentiment === sentiment && s.claim && s.claim.length >= 40 && s.claim.length <= 200 && !JUNK.test(s.claim))
    .map((s) => ({ s, k: hits(s.claim) }))
    .sort((a, b) => b.k - a.k || (b.s.evaluation?.intensity || 0) - (a.s.evaluation?.intensity || 0))
    .map((x) => x.s);
  const out = []; const used = new Set();
  for (const s of cand) { if (!used.has(s.source?.sourceType)) { out.push(s); used.add(s.source?.sourceType); } if (out.length >= n) return out; }
  for (const s of cand) { if (!out.includes(s)) out.push(s); if (out.length >= n) break; }
  return out;
}

/** What the sources say about one city-wide topic: a few positive and a few negative statements. */
function TopicDetail({ topic, onOpenKnowledge }) {
  const e = topic.evidence;
  const pos = pickStatements(e.statementsList, 'positive', 2, topic.topic);
  const neg = pickStatements(e.statementsList, 'negative', 2, topic.topic);
  const Item = ({ s, tone }) => (
    <li className={`lens-say ${tone}`}>
      <span>{s.claim}</span>
      <cite>{SOURCE_NAME[s.source?.sourceType] || s.source?.sourceType || 'Source'}</cite>
    </li>
  );
  return (
    <div className="lens-topic-detail">
      <p className="lens-note">{e.statements} statements from {e.sources.length} source{e.sources.length === 1 ? '' : 's'}: {e.pos} positive, {e.neg} negative.</p>
      {pos.length > 0 && <><div className="lens-say-head">On the positive side</div><ul>{pos.map((s) => <Item key={s.id} s={s} tone="pos" />)}</ul></>}
      {neg.length > 0 && <><div className="lens-say-head">On the negative side</div><ul>{neg.map((s) => <Item key={s.id} s={s} tone="neg" />)}</ul></>}
      {onOpenKnowledge && <button className="lens-link" onClick={onOpenKnowledge}>Read all {e.statements} statements →</button>}
      {/safety|health/i.test(topic.topic || topic.place || '') && (
        <p className="lens-note lens-disclaimer">Collected from guides and forums, not official advice. Check your government's travel advice and local emergency information.</p>
      )}
    </div>
  );
}

export function TruthLensLegend({ items, topics = [], focusTopic = null, openTopic = null, setOpenTopic, onOpenKnowledge, cityName, topicDisputes = 0, checked, onClose, onOpenDebates }) {
  const [showAll, setShowAll] = React.useState(false);
  const hot = [...items].sort((a, b) => b.score - a.score).filter((p) => p.score >= 0.4).slice(0, 3);
  const counts = items.reduce((m, p) => ((m[band(p.score)] += 1), m), { agree: 0, mixed: 0, disagree: 0 });
  const important = topics.filter((t) => t.score >= 0.4 || t.place === focusTopic || t.place === openTopic);
  const shownTopics = showAll ? topics : (important.length ? important : topics).slice(0, 4);
  const hiddenCount = topics.length - shownTopics.length;
  const topicWord = (t) => (t.evidence?.level === 'disputed' ? 'disagree' : t.evidence?.level === 'conditional' ? 'depends on conditions' : BAND_WORD[band(t.score)]);
  return (
    <div className="lens-legend" role="region" aria-label="Truth lens legend">
      <div className="lens-legend-head">
        <Scale size={14} /> <b>Do sources agree?</b>{cityName ? <span className="lens-sub"> · {cityName}</span> : null}
        <button className="lens-close" onClick={onClose} aria-label="Close truth lens"><X size={13} /></button>
      </div>
      {items.length === 0 ? (
        <p className="lens-note">🦙 No place here has enough statements yet. Load knowledge for this city (Knowledge tab) or zoom to a city in your trip.</p>
      ) : (
        <>
          <p className="lens-note">Each dot is a place that several guides or travellers write about. Its colour shows whether they agree.</p>
          <div className="lens-key">
            {['agree', 'mixed', 'disagree'].map((b) => (
              <span key={b}><span className="lens-dot" style={{ background: BAND_COLOR[b] }} />{counts[b]} {b === 'mixed' ? 'mixed' : b}</span>
            ))}
          </div>
          {hot.length > 0 && (
            <>
              <div className="lens-topics-head">Places where opinions split</div>
              {hot.map((p) => (
                <div key={p.name} className="lens-hot"><span className="lens-dot" style={{ background: p.color }} />{p.name}
                  <em>{p.evidence.pos + p.evidence.neg} opinions</em></div>
              ))}
            </>
          )}
        </>
      )}
      {shownTopics.length > 0 && (
        <div className="lens-topics">
          <div className="lens-topics-head">What sources say about the whole city (click a topic)</div>
          {shownTopics.map((t) => {
            const open = openTopic === t.place;
            return (
              <React.Fragment key={t.place}>
                <button type="button" className={`lens-hot lens-topic-btn ${focusTopic === t.place || open ? 'focus' : ''}`}
                  aria-expanded={open} onClick={() => setOpenTopic?.(open ? null : t.place)}>
                  <span className="lens-dot" style={{ background: t.color }} />{t.topic}
                  <em>{focusTopic === t.place ? 'open in Debates' : topicWord(t)} {open ? '▴' : '▾'}</em>
                </button>
                {open && <TopicDetail topic={t} onOpenKnowledge={onOpenKnowledge} />}
              </React.Fragment>
            );
          })}
          {hiddenCount > 0 && <button type="button" className="lens-link" onClick={() => setShowAll(true)}>Show {hiddenCount} more topics</button>}
        </div>
      )}
      {topicDisputes > 0 && (
        <button className="lens-cta" onClick={onOpenDebates}>⚖️ Judge {topicDisputes} possible disagreements →</button>
      )}
      {!checked && <p className="lens-note dim">Colours come from the tone of the statements. Knowledge → Conflicts checks which ones may really contradict each other.</p>}
      <p className="lens-note dim">Topics, colours and tone are assigned automatically and can be wrong.</p>
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
          <b>{p.name}</b><br />{{ open: 'Open', closed: 'Closed', busy: 'Busy', golden: 'Golden hour' }[p.status]}{p.note ? `, ${p.note}` : ''}
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
      {!lens.items.length && <p className="lens-note">🦙 No opening hours known for places here yet, open Explore to load the city's places.</p>}
    </div>
  );
}
