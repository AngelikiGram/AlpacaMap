// One-box planner on the home screen: "3 days in Paris, hate queues, love food, €800".
// Understands the request without AI, builds a plan from OpenStreetMap data and the knowledge
// graph, flags stops that travel sources warn about, and can optionally ask the AI for day stories.
import { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, Loader2, AlertTriangle, MapPin, Wand2, X } from 'lucide-react';
import { parsePrompt, buildQuickPlan, poiFromOsm, describeParsed, KNOWN_CITIES, isoDate } from '../../planner/quickPlan';
import { osmSlugFor, loadBundledOsm, bundledKeyFor, loadBundledKnowledge } from '../../knowledge/bundled';
import { buildPlaceEvidence } from '../../knowledge/evidence';
import { searchNominatim } from '../../api';
import { searchOverpass } from '../../utils';
import { aiStatus, aiComplete } from '../../ai/aiClient';

const EXAMPLES = [
  '3 days in Paris, hate queues, love food, €800',
  'Relaxed weekend in London with my partner, hidden gems and views',
  '4 days in Rome, history and coffee, avoid crowds',
  'Long weekend in Zurich, nature and lakes, £600',
  '2 days in Edinburgh with kids, castles and parks',
];
const CATS = ['Restaurants', 'Coffee', 'Museums', 'Art', 'Parks', 'Attractions', 'Viewpoints', 'Historic', 'Shopping'];

function defaultStart(p) {
  const d = new Date();
  if (p.days && p.days <= 3) { d.setDate(d.getDate() + (((5 - d.getDay() + 7) % 7) || 7)); } // next Friday
  else d.setDate(d.getDate() + 14);
  return isoDate(d);
}

export function QuickPlanBox({ onApply, hasTrip }) {
  const [text, setText] = useState('');
  const [exampleIdx, setExampleIdx] = useState(0);
  const [busy, setBusy] = useState(null);          // status text while working
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);      // { parsed, city, plan }
  const [aiBusy, setAiBusy] = useState(null);
  const status = aiStatus(); // cheap; re-read each render so it notices a model that finished loading

  useEffect(() => { const t = setInterval(() => setExampleIdx((i) => (i + 1) % EXAMPLES.length), 4000); return () => clearInterval(t); }, []);

  const run = async (prompt = text) => {
    const q = prompt.trim();
    if (!q) return;
    setErr(''); setResult(null);
    const parsed = parsePrompt(q);
    try {
      // 1 · Where?
      setBusy('Finding the city…');
      let city = parsed.cityKey ? KNOWN_CITIES[parsed.cityKey] : null;
      if (!city && parsed.cityQuery) {
        const r = await searchNominatim(parsed.cityQuery, { limit: 1 });
        if (r?.[0]) city = { name: r[0].display_name.split(',').slice(0, 2).join(',').trim(), coords: [parseFloat(r[0].lat), parseFloat(r[0].lon)] };
      }
      if (!city) { setErr('🦙 Which city? Try something like “3 days in Lisbon, love food”.'); return; }
      // 2 · Places (bundled offline data first, then the live OpenStreetMap API)
      setBusy(`Reading places in ${city.name.split(',')[0]}…`);
      let elements = await loadBundledOsm(osmSlugFor(city.name));
      if (elements.length < 50) {
        try { elements = (await searchOverpass(city.coords, 3, CATS))?.elements || []; }
        catch { /* offline or Overpass busy */ }
      }
      const pois = elements.map(poiFromOsm).filter(Boolean);
      if (!pois.length) { setErr(`🦙 I couldn't load places for ${city.name.split(',')[0]} right now (OpenStreetMap busy?). Try again in a minute.`); return; }
      // 3 · What travellers say (bundled knowledge)
      let evidenceIndex = null;
      const key = bundledKeyFor(city.name);
      if (key) {
        setBusy('Checking what travellers say…');
        try { evidenceIndex = buildPlaceEvidence(await loadBundledKnowledge(key), null, { cityNames: [city.name] }); } catch { /* no knowledge */ }
      }
      setBusy('Building your days…');
      await new Promise((r) => setTimeout(r, 0));
      const startDate = parsed.startDate || defaultStart(parsed);
      const plan = buildQuickPlan(parsed, { pois, center: city.coords, evidenceIndex, startDate, radiusKm: parsed.avoid.includes('walking') ? 3 : 5 });
      if (!plan.days.length) { setErr('🦙 Not enough places found to build a day. Try a bigger city or fewer constraints.'); return; }
      setResult({ parsed: { ...parsed, startDate }, city, plan });
    } catch (e) {
      setErr(`Something went wrong: ${e.message}`);
    } finally { setBusy(null); }
  };

  const addStories = async () => {
    if (!result) return;
    setAiBusy('Asking the AI…');
    try {
      const outline = result.plan.days.map((d, i) => `Day ${i + 1}: ${d.stops.map((s) => s.name).join(', ')}`).join('\n');
      const reply = await aiComplete([
        { role: 'system', content: 'You write short, vivid travel copy. Return ONLY JSON: {"days":[{"title":"max 5 words","story":"one sentence, max 25 words"}]}' },
        { role: 'user', content: `Trip: ${result.parsed.raw}\nCity: ${result.city.name}\n${outline}` },
      ], { json: true, maxTokens: 500, onProgress: (p) => setAiBusy(p.progress < 1 ? `Downloading AI model… ${Math.round((p.progress || 0) * 100)}%` : 'Writing…') });
      const m = reply.match(/\{[\s\S]*\}/);
      const days = m ? JSON.parse(m[0]).days || [] : [];
      setResult((r) => ({ ...r, plan: { ...r.plan, days: r.plan.days.map((d, i) => (days[i] ? { ...d, title: days[i].title || d.title, story: days[i].story } : d)) } }));
    } catch (e) { setErr(`AI not available: ${e.message}`); }
    setAiBusy(null);
  };

  const flagged = result ? result.plan.days.flatMap((d) => d.stops).filter((s) => s.flags.length).length : 0;

  return (
    <section className="quickplan" aria-label="Plan a trip in one sentence">
      <form className="quickplan-form" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <span className="quickplan-alpaca" aria-hidden>🦙</span>
        <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Describe your trip"
          placeholder={`Where to? e.g. “${EXAMPLES[exampleIdx]}”`} disabled={!!busy} />
        <button type="submit" className="quickplan-go" disabled={!!busy || !text.trim()} aria-label="Plan it">
          {busy ? <Loader2 size={15} className="spin" /> : <ArrowRight size={15} />}
        </button>
      </form>
      {!result && !busy && !err && (
        <div className="quickplan-examples">
          {EXAMPLES.slice(0, 3).map((ex) => <button key={ex} type="button" onClick={() => { setText(ex); run(ex); }}>{ex}</button>)}
        </div>
      )}
      {busy && <div className="quickplan-status"><Loader2 size={12} className="spin" /> {busy}</div>}
      {err && <div className="quickplan-err">{err}</div>}

      {result && (
        <div className="quickplan-result">
          <div className="quickplan-understood">
            <Sparkles size={12} /> <span>{describeParsed(result.parsed, result.city.name.split(',')[0])}</span>
            <button className="btn-icon" onClick={() => setResult(null)} aria-label="Discard plan"><X size={12} /></button>
          </div>
          {result.plan.days.map((d, i) => (
            <div key={i} className="qp-day">
              <div className="qp-day-head"><b>Day {i + 1}</b> <span>{d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''}</span> <em>{d.title}</em></div>
              {d.story && <p className="qp-story">{d.story}</p>}
              {d.stops.map((s, j) => (
                <div key={j} className={`qp-stop ${s.flags.length ? 'flagged' : ''}`} title={s.flags.map((f) => `${f.text}${f.detail ? `\n${f.detail}` : ''}`).join('\n\n') || s.why.join(', ')}>
                  <span className="qp-time">{s.time}</span>
                  <span className="qp-name">{s.name}</span>
                  {s.flags.length > 0 ? <span className="qp-flag"><AlertTriangle size={11} /> {s.flags[0].text}</span> : <span className="qp-why">{s.why[0] || ''}</span>}
                </div>
              ))}
            </div>
          ))}
          {result.plan.notes.map((n, i) => <p key={i} className="qp-note">{n}</p>)}
          <div className="qp-actions">
            <button className="btn-primary" onClick={() => onApply(result, 'new')}><MapPin size={13} /> Make this my trip</button>
            {hasTrip && <button className="btn-secondary" onClick={() => onApply(result, 'add')}>Add to current trip</button>}
            {status.usable && (
              <button className="btn-secondary" onClick={addStories} disabled={!!aiBusy}
                title={status.needsDownload ? 'Downloads the in-browser AI model once (≈1 GB)' : status.reason || 'Write a short story for each day'}>
                {aiBusy ? <><Loader2 size={12} className="spin" /> {aiBusy}</> : <><Wand2 size={12} /> Day stories with AI{status.needsDownload ? ' (≈1 GB once)' : ''}</>}
              </button>
            )}
          </div>
          {flagged > 0 && <p className="qp-note warn">⚠ {flagged} stop{flagged > 1 ? 's' : ''} flagged by travel sources — hover for details. You can swap them later in the Itinerary.</p>}
        </div>
      )}
    </section>
  );
}
