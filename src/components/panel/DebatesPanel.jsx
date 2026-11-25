// Debates: one pair of statements at a time, framed as the question both answer.
// Each answer is stored with the trip (knowledgeGraph.verified.pairs, by: 'you'), so pins, the Truth lens and
// itinerary badges react immediately, and it tells the app which aspects (crowds, price, safety …) matter to you.
import { useEffect, useMemo, useState } from 'react';
import { Scale, Undo2, ThumbsUp, ThumbsDown, MapPin, Globe, SkipForward, Info } from 'lucide-react';
import { buildDebates, applyAnswer, answeredKeys } from '../../knowledge/debates';
import { centralQuestion, relationOf, forYou, aspectName, markAspect, sharedWords } from '../../knowledge/debateText';
import { bumpAspectWeight, readAspectWeights, caredAspects } from '../../knowledge/travellerReports';
import { sourceLabel } from '../../knowledge/controversy';

function Claim({ side, aspect, condition }) {
  const positive = side.sentiment === 'positive';
  const Icon = positive ? ThumbsUp : ThumbsDown;
  return (
    <article className="claim">
      <header className="claim-head">
        <span className="claim-source">{sourceLabel(side.source)}</span>
        <span className={`claim-stance ${positive ? 'pos' : 'neg'}`}><Icon size={13} aria-hidden="true" /> {positive ? 'Positive' : 'Critical'}</span>
      </header>
      {condition && <div className="claim-condition">About {condition}</div>}
      <p className="claim-text">
        {markAspect(side.text, aspect).map((part, i) => (part.mark ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}
      </p>
    </article>
  );
}

export function DebatesPanel({ tripData, setTripData, onOpenTab, activeCity = null }) {
  const kg = tripData.knowledgeGraph || {};
  // Only the destination being explored (statements are filed by city, city-wide topics as "London · Transport")
  const cityKey = String(activeCity?.name || '').split(',')[0].trim().toLowerCase();
  const cityNodes = useMemo(() => {
    const all = kg.nodes || [];
    if (!cityKey) return all;
    const mine = all.filter((n) => String(n.city || '').split(',')[0].trim().toLowerCase() === cityKey || String(n.place || '').toLowerCase().startsWith(`${cityKey} ·`));
    return mine.length ? mine : all;
  }, [kg.nodes, cityKey]);
  const [history, setHistory] = useState([]);              // for undo
  const [weights, setWeights] = useState(() => readAspectWeights());
  const [skipped, setSkipped] = useState(() => new Set());

  const answered = useMemo(() => answeredKeys(kg.verified), [kg.verified]);
  const fullDeck = useMemo(() => buildDebates(cityNodes, kg.verified, { answered, limit: 40 }), [cityNodes, kg.verified, answered]);
  const deck = useMemo(() => {
    const rest = fullDeck.filter((c) => !skipped.has(c.key));
    return rest.length ? rest : fullDeck;            // when everything was skipped, start over
  }, [fullDeck, skipped]);
  const card = deck[0];
  // Answers for this destination only
  const answeredHere = useMemo(() => { const ids = new Set(cityNodes.map((n) => n.id)); return [...answered].filter((k) => k.split('|').every((id) => ids.has(id))).length; }, [answered, cityNodes]);
  const total = fullDeck.length + answeredHere;

  // Tell the map which place or city-wide topic the current card is about (MapView listens):
  // a place is flown to and ringed; a topic is highlighted in the Truth lens panel.
  const focusMap = (c) => window.dispatchEvent(new CustomEvent('alpacamap-debate-focus', {
    detail: c ? { place: c.place, onMap: c.onMap, topic: c.topic } : null,
  }));
  useEffect(() => { focusMap(card); }, [card?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => focusMap(null), []);

  const answer = (choice) => {
    if (!card) return;
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

  const cared = caredAspects(weights);

  if (!kg.nodes?.length) {
    return (
      <div className="empty-state">
        <Scale size={30} aria-hidden="true" />
        <h4>Nothing to compare yet</h4>
        <p>Debates appear once the app has read what guides and travellers say about your cities. London, Paris, Rome, Edinburgh and Zurich load automatically.</p>
        <button className="btn-primary" onClick={() => onOpenTab?.('knowledge')}>Load what sources say</button>
      </div>
    );
  }

  const checked = card?.kind === 'checked';
  const relation = card ? relationOf(card) : null;
  // Same answer ids as before (stored labels and study analysis rely on them)
  const options = checked
    ? [
      { id: 'a', label: `I trust ${sourceLabel(card.a.source)}`, hint: 'The first statement is right' },
      { id: 'both', label: 'Both can be true', hint: 'It depends on the situation' },
      { id: 'b', label: `I trust ${sourceLabel(card.b.source)}`, hint: 'The second statement is right' },
    ]
    : [
      { id: 'disagree', label: 'They really disagree', hint: 'Both cannot be right' },
      { id: 'both', label: 'Both can be true', hint: 'It depends on the situation' },
      { id: 'unrelated', label: 'Different things', hint: 'They talk about different aspects' },
    ];

  return (
    <div className="debates">
      <div className="debates-head">
        <div>
          <h3 className="debates-title">Where sources disagree</h3>
          <p className="debates-sub">Compare two statements and say what you think.</p>
        </div>
        <button className="btn-icon" onClick={undo} disabled={!history.length} title="Undo last answer" aria-label="Undo last answer"><Undo2 size={15} /></button>
      </div>
      {total > 0 && (
        <div className="debates-progress-row">
          <div className="debates-progress" aria-hidden="true"><i style={{ width: `${(answeredHere / total) * 100}%` }} /></div>
          <span>{answeredHere} of {total} answered</span>
        </div>
      )}

      {!card ? (
        <div className="empty-state">
          <ThumbsUp size={28} aria-hidden="true" />
          <h4>All pairs answered</h4>
          <p>Your answers now mark disputed places on the map and in your itinerary.</p>
          <button className="btn-secondary" onClick={() => onOpenTab?.('knowledge')}>See all statements</button>
        </div>
      ) : (
        <section className="debate" aria-labelledby="debate-question">
          <div className="debate-context">
            {card.onMap
              ? <button type="button" className="debate-where" onClick={() => focusMap(card)}><MapPin size={13} aria-hidden="true" /> {card.place} · show on map</button>
              : <span className="debate-where static"><Globe size={13} aria-hidden="true" /> {card.topic} · whole city</span>}
          </div>
          <h4 id="debate-question" className="debate-question">{centralQuestion(card)}</h4>

          <div className={`debate-relation ${relation.kind}`}>
            <b>{relation.title}</b>
            <span>{relation.text}</span>
          </div>

          <div className="debate-claims">
            <Claim side={card.a} aspect={card.aspect} condition={card.conditionSides?.a} />
            <Claim side={card.b} aspect={card.aspect} condition={card.conditionSides?.b} />
          </div>

          <p className="debate-foryou"><b>What this means for you:</b> {forYou(card)}</p>

          <fieldset className="debate-answer">
            <legend>What do you think?</legend>
            <div className="debate-options">
              {options.map((o) => (
                <button key={o.id} type="button" className="debate-option" onClick={() => answer(o.id)}>
                  <b>{o.label}</b><span>{o.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="debate-footer">
            <button type="button" className="debate-skip" onClick={() => answer('skip')}><SkipForward size={13} aria-hidden="true" /> Skip this pair</button>
            <details className="debate-why">
              <summary><Info size={13} aria-hidden="true" /> How was this pair found?</summary>
              <ul>
                <li>Both statements are about {card.onMap ? card.place : `${card.topic.toLowerCase()} in this city`}{sharedWords(card).length ? <> and share words such as {sharedWords(card).map((w) => `“${w}”`).join(', ')}</> : null}.</li>
                <li>They come from two different sources: {sourceLabel(card.a.source)} and {sourceLabel(card.b.source)}.</li>
                <li>{checked ? 'An automatic language check compared them' : 'Their tone is opposite; they were not checked automatically'}{card.conditionSides ? `, and they refer to different ${card.conditionSides.label}` : ''}.</li>
                <li>Neither source is ranked above the other here.</li>
              </ul>
            </details>
          </div>
        </section>
      )}

      {cared.length > 0 && (
        <p className="debates-learned">From your answers, you seem to care about {cared.map(aspectName).join(', ')}. Disagreements about these are shown first.</p>
      )}
    </div>
  );
}
