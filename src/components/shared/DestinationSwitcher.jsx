import { useEffect, useRef, useState } from 'react';
import { MapPin, ChevronDown, Check, Search, Lock, Plus } from 'lucide-react';
import { bundledKeyFor, READY_CITIES } from '../../knowledge/bundled';
import { searchNominatim } from '../../api.js';


const short = (name) => String(name || '').split(',')[0];

/**
 * Shows the destination being explored and lets the traveller switch to another one.
 * onSelect(city): city already in the trip; onAdd({ name, coords }): add a city to the trip and open it.
 */
export function DestinationSwitcher({ locations = [], activeCity, onSelect, onAdd, locked = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const root = useRef(null);
  const current = activeCity || locations[0] || null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); root.current?.querySelector('.dest-trigger')?.focus(); } };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    root.current?.querySelector('.dest-menu button')?.focus();
    return () => { document.removeEventListener('pointerdown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (locked) {
    return (
      <div className="dest-locked" title="The destination is set by the study task">
        <MapPin size={14} aria-hidden="true" /> <span>{current ? short(current.name) : 'No destination'}</span> <Lock size={12} aria-label="fixed for this task" />
      </div>
    );
  }

  const inTrip = new Set(locations.map((l) => bundledKeyFor(l.name) || short(l.name).toLowerCase()));
  const ready = READY_CITIES.filter((c) => !inTrip.has(c.key));
  const choose = (fn) => { fn(); setOpen(false); setQuery(''); setResults(null); };
  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    try {
      const r = await searchNominatim(query.trim(), { limit: 5 });
      setResults((r || []).filter((x) => /city|town|village|administrative/.test(`${x.type} ${x.addresstype}`)).slice(0, 5));
    } catch { setResults([]); }
    setBusy(false);
  };

  return (
    <div className="dest" ref={root}>
      <button type="button" className="dest-trigger" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MapPin size={14} aria-hidden="true" />
        <span className="dest-label">Destination</span>
        <b>{current ? short(current.name) : 'Choose a city'}</b>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="dest-menu" role="dialog" aria-label="Change destination">
          {locations.length > 0 && (
            <div className="dest-group">
              <div className="dest-group-title">In this trip</div>
              {locations.map((l) => {
                const isCurrent = current?.id === l.id;
                return (
                  <button key={l.id} type="button" className={`dest-item ${isCurrent ? 'current' : ''}`} aria-current={isCurrent || undefined}
                    onClick={() => choose(() => onSelect(l))}>
                    <span>{short(l.name)}</span>
                    {isCurrent ? <span className="dest-tag"><Check size={13} aria-hidden="true" /> Exploring now</span> : <span className="dest-tag">Open</span>}
                  </button>
                );
              })}
            </div>
          )}
          {ready.length > 0 && (
            <div className="dest-group">
              <div className="dest-group-title">Explore another city (sources ready)</div>
              {ready.map((c) => (
                <button key={c.key} type="button" className="dest-item" onClick={() => choose(() => onAdd({ name: c.name, coords: c.coords }))}>
                  <span>{short(c.name)}</span><span className="dest-tag"><Plus size={13} aria-hidden="true" /> Add</span>
                </button>
              ))}
            </div>
          )}
          <form className="dest-search" onSubmit={search}>
            <label htmlFor="dest-q" className="dest-group-title">Any other city</label>
            <div className="dest-search-row">
              <input id="dest-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Lisbon" autoComplete="off" />
              <button type="submit" className="btn-icon" aria-label="Search city" disabled={busy}><Search size={15} /></button>
            </div>
          </form>
          {results && (results.length ? results.map((r) => (
            <button key={r.place_id} type="button" className="dest-item"
              onClick={() => choose(() => onAdd({ name: r.display_name.split(',').slice(0, 2).join(','), coords: [parseFloat(r.lat), parseFloat(r.lon)] }))}>
              <span>{r.display_name.split(',').slice(0, 3).join(',')}</span><span className="dest-tag"><Plus size={13} aria-hidden="true" /> Add</span>
            </button>
          )) : <p className="dest-note">No city found. Try another spelling.</p>)}
          <p className="dest-note">Adding a city keeps everything you saved for the others. Switch back here at any time.</p>
        </div>
      )}
    </div>
  );
}
