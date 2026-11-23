// Debate cards: swipe through statements where travel sources may disagree.
// Each answer is stored with the trip (knowledgeGraph.verified.pairs, by: 'you'), so pins,
// the Truth lens and itinerary badges react immediately, and it teaches the app which
// aspects (crowds, price, safety …) matter to you.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Scale, Undo2, ThumbsUp, Sparkles, MapPin, Globe } from 'lucide-react';
import { buildDebates, applyAnswer, answeredKeys } from '../../knowledge/debates';
import { bumpAspectWeight, readAspectWeights, caredAspects } from '../../knowledge/travellerReports';
import { sourceLabel } from '../../knowledge/controversy';

const ASPECT_EMOJI = { crowds: '🧍', price: '💶', safety: '🛡️', quality: '⭐', food: '🍽️', cleanliness: '🧼', opening: '🕐', transport: '🚇', weather: '🌦️', noise: '🔊' };

export function DebatesPanel({ tripData, setTripData, onOpenTab }) {
  const kg = tripData.knowledgeGraph || {};
  const [history, setHistory] = useState([]);              // for undo
  const [weights, setWeights] = useState(() => readAspectWeights());
  const [drag, setDrag] = useState(0);
  const [skipped, setSkipped] = useState(() => new Set());
  const start = useRef(null);

  const answered = useMemo(() => answeredKeys(kg.verified), [kg.verified]);
  const fullDeck = useMemo(() => buildDebates(kg.nodes || [], kg.verified, { answered, limit: 40 }), [kg.nodes, kg.verified, answered]);
  const deck = useMemo(() => {
    const rest = fullDeck.filter((c) => !skipped.has(c.key));
    return rest.length ? rest : fullDeck;            // when everything was skipped, start over
  }, [fullDeck, skipped]);
  const card = deck[0];
  const total = fullDeck.length + answered.size;

  // Tell the map which place or city-wide topic the current card is about (MapView listens):
  // a place is flown to and ringed; a topic is highlighted in the Truth lens panel.
  const focusMap = (c) => window.dispatchEvent(new CustomEvent('alpacamap-debate-focus', {
    detail: c ? { place: c.place, onMap: c.onMap, topic: c.topic } : null,
  }));
  useEffect(() => { focusMap(card); }, [card?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => focusMap(null), []);

  const answer = (choice) => {
    if (!card) return;
    setDrag(0);
    if (choice === 'skip') { setSkipped((s) => new Set([...s, card.key])); return; }
    const res = applyAnswer(card, choice, kg.verified);
    if (res.aspect && res.aspectDelta) setWeights(bumpAspectWeight(res.aspect, res.aspectDelta));
    setHistory((h) => [...h, { prev: kg.verified, aspect: res.aspect, delta: res.aspectDelta }]);
    setTripData((prev) => ({ ...prev, knowledgeGraph: { ...prev.knowledgeGraph, verified: res.verified } }));
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    if (last.aspect && last.delta) setWeights(bumpAspectWeight(last.aspect, -last.delta));
    setTripData((prev) => ({ ...prev, knowledgeGraph: { ...prev.knowledgeGraph, verified: last.prev } }));
  };

  const checked = card?.kind === 'checked';
  const left = checked ? { id: 'a', label: 'Trust the top one' } : { id: 'unrelated', label: 'Not the same thing' };
  const right = checked ? { id: 'b', label: 'Trust the bottom one' } : { id: 'disagree', label: 'They disagree' };

  const onDown = (e) => { start.current = e.clientX; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { if (start.current != null) setDrag(e.clientX - start.current); };
  const onUp = () => {
    if (start.current == null) return;
    start.current = null;
    if (drag > 90) answer(right.id); else if (drag < -90) answer(left.id); else setDrag(0);
  };

  const cared = caredAspects(weights);

  if (!kg.nodes?.length) {
    return (
      <div className="empty-state">
        <Scale size={30} />
        <h4>Nothing to debate yet</h4>
        <p>🦙 Debates appear once the app has read what guides and travellers say about your cities. Cities with ready-made knowledge (London, Paris, Rome, Edinburgh, Zurich) load automatically.</p>
        <button className="btn-primary" onClick={() => onOpenTab?.('knowledge')}>Load knowledge</button>
      </div>
    );
  }

  return (
    <div className="debates">
      <div className="debates-head">
        <div>
          <div className="debates-title"><Scale size={15} /> Debates</div>
          <div className="debates-sub">Sources disagree? You decide. {total ? `${answered.size} of ${total} judged` : ''}</div>
        </div>
        <button className="btn-icon" onClick={undo} disabled={!history.length} title="Undo last answer" aria-label="Undo last answer"><Undo2 size={14} /></button>
      </div>
      {total > 0 && <div className="debates-progress"><i style={{ width: `${(answered.size / total) * 100}%` }} /></div>}

      {!card ? (
        <div className="empty-state">
          <ThumbsUp size={28} />
          <h4>All debates judged 🎉</h4>
          <p>Your answers now mark disputed places on the map and in your itinerary. Run <b>Knowledge → Conflicts</b> to let the in-browser model find more.</p>
          <button className="btn-secondary" onClick={() => onOpenTab?.('knowledge')}>Open Knowledge</button>
        </div>
      ) : (
        <>
          <div className={`debate-card ${drag > 40 ? 'lean-right' : drag < -40 ? 'lean-left' : ''}`}
            style={{ transform: `translateX(${drag}px) rotate(${drag / 25}deg)` }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            role="group" aria-label={`Debate about ${card.topic}`}>
            <div className="debate-meta">
              <span className="debate-topic">{card.aspect ? ASPECT_EMOJI[card.aspect] || '⚖️' : '⚖️'} {card.topic}{card.city ? ` · ${card.city}` : ''}</span>
              <span className={`debate-kind ${checked ? 'checked' : ''}`}>{checked ? (card.label === 'depends' ? 'Model: depends' : 'Model: contradiction') : 'Unchecked'}</span>
            </div>
            <div className="debate-where">
              {card.onMap
                ? <button className="debate-where-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => focusMap(card)}><MapPin size={11} /> Shown on the map</button>
                : <span className="debate-where-topic"><Globe size={11} /> City-wide topic · not one place on the map</span>}
            </div>
            <blockquote className="debate-side pos">
              <p>“{card.a.text}”</p>
              <cite>— {sourceLabel(card.a.source)}</cite>
            </blockquote>
            <div className="debate-vs">vs</div>
            <blockquote className="debate-side neg">
              <p>“{card.b.text}”</p>
              <cite>— {sourceLabel(card.b.source)}</cite>
            </blockquote>
            {card.condition && <div className="debate-cond"><Sparkles size={11} /> {card.condition}</div>}
            <div className="debate-q">{checked ? 'Which matches what you know?' : 'Do these two really disagree?'}</div>
          </div>
          <div className="debate-actions">
            <button className="debate-btn" onClick={() => answer(left.id)}>← {left.label}</button>
            <button className="debate-btn mid" onClick={() => answer('both')}>Both true (depends)</button>
            <button className="debate-btn" onClick={() => answer(right.id)}>{right.label} →</button>
          </div>
          <button className="debate-skip" onClick={() => answer('skip')}>Skip</button>
          <p className="debate-hint">Swipe the card left or right, or use the buttons.</p>
        </>
      )}

      {cared.length > 0 && (
        <div className="debates-learned">
          <b>🦙 I've learned you care about:</b> {cared.map((a) => `${ASPECT_EMOJI[a] || ''} ${a}`).join(' · ')}
          <div className="dim">Disagreements about these are ranked first in Knowledge → Conflicts.</div>
        </div>
      )}
    </div>
  );
}
