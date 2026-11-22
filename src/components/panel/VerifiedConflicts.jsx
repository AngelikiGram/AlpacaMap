import React, { useMemo, useState } from 'react';
import { ShieldCheck, Loader2, AlertTriangle, Clock } from 'lucide-react';
import { candidatePairs, classifyPair, plainText, summarizeVerified, CALIBRATION } from '../../knowledge/contradictions';
import { NLI_MODEL, loadNli, scoreSymmetric, calibrate } from '../../knowledge/nli';
import { readTravellerProfile, pairRelevance } from '../../knowledge/relevance';

const SRC = { wikivoyage: 'Wikivoyage', wikitravel: 'Wikitravel', wikipedia: 'Wikipedia', reddit: 'Reddit', stackexchange: 'StackExchange' };

function Statement({ node, tag }) {
  if (!node) return <div style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>(statement removed)</div>;
  return (
    <div style={{ fontSize: '0.68rem', lineHeight: 1.45 }}>
      <span style={{ fontWeight: 700, color: 'var(--text-secondary)', marginRight: 4 }}>{tag}</span>
      {node.claim}
      <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', marginTop: 2 }}>
        {node.source?.url ? <a href={node.source.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{SRC[node.source?.sourceType] || node.source?.sourceType}</a> : (SRC[node.source?.sourceType] || node.source?.sourceType)}
        {node.source?.publishedAt ? ` · ${node.source.publishedAt}` : ''}
      </div>
    </div>
  );
}

function PairCard({ pair, byId }) {
  return (
    <div style={{ display: 'grid', gap: 6, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <Statement node={byId.get(pair.aId)} tag="A" />
      <Statement node={byId.get(pair.bId)} tag="B" />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: '0.58rem', color: 'var(--text-secondary)' }}>
        {pair.condition && <span style={{ color: '#fbbf24', fontWeight: 600 }}><Clock size={9} style={{ verticalAlign: '-1px' }} /> {pair.condition.text}</span>}
        <span title="Probability the model assigns to 'these two statements contradict each other'">model: {Math.round((pair.scores?.contradiction || 0) * 100)}% contradiction</span>
        {pair.aspects?.length > 0 && <span>about: {pair.aspects.join(', ')}</span>}
      </div>
    </div>
  );
}

function PlaceGroup({ title, color, places, kind, byId, profile }) {
  const [open, setOpen] = useState(null);
  // Personal relevance: disagreements that matter for this traveller come first
  const ranked = useMemo(() => places.map((pl) => {
    let best = { score: 0, reasons: [] };
    for (const p of pl[kind]) {
      const r = pairRelevance(p, byId.get(p.aId), byId.get(p.bId), profile);
      if (r.score > best.score) best = r;
    }
    return { ...pl, relevance: best };
  }).sort((x, y) => y.relevance.score - x.relevance.score), [places, kind, byId, profile]);
  if (!places.length) return null;
  return (
    <div>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color, margin: '4px 0 6px' }}>{title} ({places.length})</div>
      {ranked.map((pl) => {
        const list = pl[kind];
        const expanded = open === pl.place;
        return (
          <div key={pl.place} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 10px', marginBottom: 6, background: 'rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                {pl.place}
                {pl.relevance.score >= 0.4 && (
                  <span title="Based on your traveller profile in the Planner" style={{ marginLeft: 6, fontSize: '0.58rem', fontWeight: 700, color: '#60a5fa', border: '1px solid #60a5fa55', borderRadius: 8, padding: '0 5px' }}>
                    Matters for you: {pl.relevance.reasons.join(', ')}
                  </span>
                )}
              </span>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{list.length} pair{list.length > 1 ? 's' : ''}</span>
            </div>
            {(expanded ? list : list.slice(0, 1)).map((p) => <PairCard key={p.aId + p.bId} pair={p} byId={byId} />)}
            {list.length > 1 && (
              <button type="button" onClick={() => setOpen(expanded ? null : pl.place)}
                style={{ marginTop: 4, fontSize: '0.6rem', background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0 }}>
                {expanded ? 'Show less' : `Show all ${list.length}`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Statement-level conflict check with an NLI model running in the browser.
 * Results are stored in knowledgeGraph.verified via onSave.
 */
export default function VerifiedConflicts({ nodes, verified, onSave }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const running = !!status;
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const summary = useMemo(() => summarizeVerified(verified?.pairs || []), [verified]);
  const stale = verified && verified.nodeCount !== nodes.length;
  const profile = useMemo(() => readTravellerProfile(), []);

  const run = async () => {
    setError(null);
    try {
      const pairs = candidatePairs(nodes);
      if (!pairs.length) { onSave({ model: NLI_MODEL, checkedAt: new Date().toISOString(), nodeCount: nodes.length, pairsChecked: 0, pairs: [] }); return; }
      setStatus('Loading the AI model (about 45 MB, only the first time)…');
      await loadNli(({ progress }) => setStatus(`Downloading the AI model… ${Math.round(progress)}%`));
      setStatus('Testing the model on known examples…');
      const calibration = await calibrate(CALIBRATION);
      setStatus(`Comparing statements… 0/${pairs.length}`);
      const scores = await scoreSymmetric(
        pairs.map((p) => ({ a: plainText(p.a.claim), b: plainText(p.b.claim) })),
        { onProgress: (d, t) => setStatus(`Comparing statements… ${d}/${t}`) },
      );
      const results = pairs.map((p, i) => ({
        placeKey: p.placeKey, place: p.place, aId: p.a.id, bId: p.b.id, aspects: p.aspects,
        scores: Object.fromEntries(Object.entries(scores[i]).map(([k, v]) => [k, +v.toFixed(3)])),
        ...classifyPair(scores[i], p.a, p.b),
      }));
      const counts = results.reduce((acc, r) => ({ ...acc, [r.label]: (acc[r.label] || 0) + 1 }), {});
      onSave({ model: NLI_MODEL, method: 'symmetric-min, threshold 0.8', checkedAt: new Date().toISOString(), nodeCount: nodes.length, pairsChecked: pairs.length, counts, calibration: calibration.map((c) => ({ expect: c.expect, got: c.got })), pairs: results.filter((r) => r.label !== 'unrelated') });
    } catch (e) {
      console.error('[NLI]', e);
      const msg = String(e?.message || e);
      setError(msg.includes('self-test')
        ? `The check was stopped because the model failed its self-test (${msg.replace(/^.*?\(/, '').replace(/\)$/, '')}). No results were changed.`
        : `Could not run the AI model: ${msg}. Your browser may block WebAssembly or the model download.`);
    } finally {
      setStatus(null);
    }
  };

  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ShieldCheck size={15} style={{ color: '#10b981' }} />
        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Do the sources really disagree?</span>
      </div>
      <div style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        A positive and a negative statement about the same place are not necessarily a contradiction
        ("amazing museum" vs "awful queue"). This check compares statements from different sources pair by pair
        with a language model that runs in your browser, and explains disagreements that only depend on
        conditions such as season, time of day or who is travelling.
      </div>

      {verified && !running && (
        <div style={{ fontSize: '0.64rem', color: 'var(--text-secondary)' }}>
          Checked {verified.pairsChecked} pairs on {new Date(verified.checkedAt).toLocaleDateString()}:{' '}
          <b style={{ color: '#f87171' }}>{summary.contradictionPlaces}</b> place{summary.contradictionPlaces === 1 ? '' : 's'} with real contradictions,{' '}
          <b style={{ color: '#fbbf24' }}>{summary.dependsPlaces}</b> that depend on conditions
          {verified.counts?.agree ? <>, {verified.counts.agree} pairs agree</> : null}.
          {stale && <span style={{ color: '#fbbf24' }}> The statements changed since — run the check again.</span>}
          {!verified.method && <span style={{ color: '#fbbf24' }}> These results come from an earlier, less strict version of the check — run it again.</span>}
        </div>
      )}

      {running ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.7rem' }} role="status">
          <Loader2 size={13} style={{ animation: 'spinAnim 1s linear infinite' }} /> {status}
        </div>
      ) : (
        <button type="button" onClick={run} disabled={!nodes.length}
          style={{ padding: '7px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.12)', color: '#34d399', fontWeight: 700, fontSize: '0.72rem', cursor: nodes.length ? 'pointer' : 'not-allowed' }}>
          {verified ? 'Run the check again' : 'Check for real contradictions'}
        </button>
      )}
      {error && <div style={{ fontSize: '0.64rem', color: '#f87171' }}><AlertTriangle size={11} style={{ verticalAlign: '-2px' }} /> {error}</div>}

      {verified && !running && (
        <>
          <PlaceGroup title="Real contradictions" color="#f87171" places={summary.places.filter((p) => p.contradictions.length)} kind="contradictions" byId={byId} profile={profile} />
          <PlaceGroup title="Both can be true — depends on conditions" color="#fbbf24" places={summary.places.filter((p) => p.depends.length)} kind="depends" byId={byId} profile={profile} />
          {summary.places.length === 0 && <div style={{ fontSize: '0.68rem', color: '#34d399' }}>No real contradictions found between the sources.</div>}
        </>
      )}
    </div>
  );
}
