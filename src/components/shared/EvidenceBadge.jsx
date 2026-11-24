import { useState } from 'react';
import { LEVELS } from '../../knowledge/evidence';

const SRC = { wikivoyage: 'Wikivoyage', wikitravel: 'Wikitravel', wikipedia: 'Wikipedia', reddit: 'Reddit', stackexchange: 'StackExchange' };

/**
 * Small status chip for an itinerary stop or place: shows whether sources agree about it.
 * Click opens a short explanation with the two disagreeing statements.
 */
export default function EvidenceBadge({ evidence, hideSolid = true }) {
  const [open, setOpen] = useState(false);
  if (!evidence || (hideSolid && evidence.level === 'solid')) return null;
  const lv = LEVELS[evidence.level];
  const ex = evidence.example;
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        title={`${lv.label}, ${evidence.statements} statements from ${evidence.sources.length} source${evidence.sources.length === 1 ? '' : 's'}`}
        aria-expanded={open}
        style={{ fontSize: '0.6rem', fontWeight: 700, color: lv.color, border: `1px solid ${lv.color}55`, background: `${lv.color}14`, borderRadius: 8, padding: '1px 6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {lv.label}
      </button>
      {open && (
        <span role="dialog" onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', zIndex: 50, top: '120%', right: 0, width: 260, maxWidth: '80vw', background: 'rgba(8,12,26,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 10px', fontSize: '0.66rem', lineHeight: 1.45, color: 'var(--text-primary)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', textAlign: 'left' }}>
          <b>{evidence.place}</b>
          <span style={{ display: 'block', color: 'var(--text-secondary)', margin: '2px 0 6px' }}>
            {evidence.statements} statements · {evidence.sources.map((s) => SRC[s] || s).join(', ')}
          </span>
          {ex ? (
            <>
              {ex.condition && <span style={{ display: 'block', color: '#fbbf24', marginBottom: 4 }}>{ex.condition}</span>}
              <span style={{ display: 'block', marginBottom: 4 }}>“{ex.a}” <i style={{ color: 'var(--text-secondary)' }}>{SRC[ex.aSource] || ex.aSource}</i></span>
              <span style={{ display: 'block' }}>“{ex.b}” <i style={{ color: 'var(--text-secondary)' }}>{SRC[ex.bSource] || ex.bSource}</i></span>
            </>
          ) : evidence.level === 'thin' ? (
            <span>Only a few statements or a single source mention this place, treat the information with care.</span>
          ) : (
            <span>Sources have mixed opinions ({evidence.pos} positive, {evidence.neg} negative). Run Knowledge → Conflicts to check whether they really contradict.</span>
          )}
        </span>
      )}
    </span>
  );
}
