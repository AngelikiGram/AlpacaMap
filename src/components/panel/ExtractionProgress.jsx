import React, { useState, useEffect, useRef } from 'react';
import { Globe, Hash, Sparkles, RefreshCw, Search, Map, Compass, BookOpen, MessageSquare, Tag, CheckCircle2, XCircle, Loader } from 'lucide-react';

const SRC_META = {
  wikivoyage:    { Icon: Map,          label: 'Wikivoyage',  color: '#0ea5e9' },
  wikitravel:    { Icon: Compass,      label: 'Wikitravel',  color: '#06b6d4' },
  wikipedia:     { Icon: BookOpen,     label: 'Wikipedia',   color: '#94a3b8' },
  reddit:        { Icon: MessageSquare,label: 'Reddit',      color: '#f97316' },
  stackexchange: { Icon: Tag,          label: 'StackExch',   color: '#f59e0b' },
};

const STAGES = [
  { id: 'fetch',  Icon: Globe,      label: 'Fetch'     },
  { id: 'nlp',    Icon: Hash,       label: 'NLP'       },
  { id: 'llm',    Icon: Sparkles,   label: 'AI Enrich' },
  { id: 'refine', Icon: RefreshCw,  label: 'Refine'    },
  { id: 'deep',   Icon: Search,     label: 'Deep'      },
];
const ORDER = STAGES.map(s => s.id);

function fmt(s) { return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`; }

export default function ExtractionProgress({ fetching, extracting, fetchStatus, nodeCount, fetchedPreviews }) {
  const [elapsed, setElapsed] = useState(0);
  const [displayCount, setDisplayCount] = useState(0);
  const startRef = useRef(null);

  // Elapsed timer
  useEffect(() => {
    const active = fetching || extracting;
    if (active) {
      if (!startRef.current) startRef.current = Date.now();
    } else {
      startRef.current = null;
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [fetching, extracting]);

  // Animated node counter
  useEffect(() => {
    if (nodeCount <= displayCount) { setDisplayCount(nodeCount); return; }
    const step = Math.max(1, Math.ceil((nodeCount - displayCount) / 10));
    const t = setTimeout(() => setDisplayCount(c => Math.min(nodeCount, c + step)), 48);
    return () => clearTimeout(t);
  }, [nodeCount, displayCount]);

  const st = fetchStatus || '';
  const stage = st.includes('Researching') || st.includes('Deep') ? 'deep'
    : st.includes('Classif') || st.includes('Refin') ? 'refine'
    : st.includes('LLM') || st.includes('enrichment') || st.includes('🤖') ? 'llm'
    : st.includes('NLP') || st.includes('🔢') ? 'nlp'
    : 'fetch';
  const si = ORDER.indexOf(stage);

  const dm = st.match(/\((\d+)\/(\d+)\)/);
  const deepN = dm ? +dm[1] : 0;
  const deepTotal = dm ? +dm[2] : 24;

  const pct = stage === 'deep' ? Math.min(97, 70 + (deepN / (deepTotal || 1)) * 27)
    : stage === 'refine' ? 68 : stage === 'llm' ? 48 : stage === 'nlp' ? 33
    : Math.min(28, elapsed * 1.8);

  const eta = stage === 'deep' && deepN > 1
    ? Math.max(0, Math.round((deepTotal - deepN) * (elapsed / deepN)))
    : stage === 'llm' ? Math.max(0, 55 - elapsed)
    : stage === 'refine' ? Math.max(0, 12 - elapsed)
    : stage === 'nlp' ? Math.max(0, 5 - elapsed)
    : Math.max(0, 15 - elapsed);

  const statusText = st.replace(/^[\u{1F300}-\u{1FFFF}\s]+/u, '').replace(/…$/, '').slice(0, 58);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '10px',
      padding: '13px 14px',
      background: 'linear-gradient(135deg, rgba(7,8,22,0.97), rgba(14,10,38,0.97))',
      border: '1px solid rgba(139,92,246,0.28)', borderRadius: '12px',
      fontFamily: 'Inter, sans-serif',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <style>{`
        @keyframes ep-pulse{0%,100%{opacity:1}50%{opacity:.45}}
        @keyframes ep-glow{0%,100%{box-shadow:0 0 10px rgba(139,92,246,.4)}50%{box-shadow:0 0 18px rgba(139,92,246,.75)}}
      `}</style>

      {/* Stage pipeline */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {STAGES.map((s, i) => {
          const done = i < si, active = i === si;
          return (
            <React.Fragment key={s.id}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flex: 1 }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px',
                  background: done ? 'rgba(16,185,129,0.14)' : active ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${done ? '#10b981' : active ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`,
                  transition: 'all 0.3s',
                  animation: active ? 'ep-glow 2s ease-in-out infinite' : 'none',
                }}>
                  {done ? <CheckCircle2 size={12} color="#10b981"/> : <s.Icon size={12}/>}
                </div>
                <span style={{
                  fontSize: '0.72rem', whiteSpace: 'nowrap', fontWeight: active ? '700' : '400',
                  color: done ? '#10b981' : active ? '#c084fc' : 'rgba(255,255,255,0.22)',
                  transition: 'color 0.3s',
                }}>
                  {s.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div style={{
                  height: '1.5px', flex: 0.22, marginBottom: '15px',
                  background: i < si ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.07)',
                  transition: 'background 0.4s',
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Progress bar + timer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.75rem', color: '#a78bfa', fontWeight: '600', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {statusText || (fetching ? 'Fetching sources…' : 'Processing…')}
          </span>
          <div style={{ display: 'flex', gap: '7px', flexShrink: 0 }}>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.38)', fontVariantNumeric: 'tabular-nums' }}>
              ⏱ {fmt(elapsed)}
            </span>
            {eta > 3 && (
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.22)' }}>
                ~{fmt(eta)} left
              </span>
            )}
          </div>
        </div>
        <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '2px',
            background: 'linear-gradient(90deg, #7c3aed, #0ea5e9)',
            width: `${pct}%`, transition: 'width 0.9s ease',
            boxShadow: '0 0 8px rgba(139,92,246,0.5)',
          }} />
        </div>
        {stage === 'deep' && deepTotal > 0 && (
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>
            {deepN}/{deepTotal} POIs researched
          </div>
        )}
      </div>

      {/* Source mini-cards */}
      {fetchedPreviews && fetchedPreviews.length > 0 && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {fetchedPreviews.map((src, i) => {
            const m = SRC_META[src.sourceType] || { Icon: Globe, label: src.label || src.sourceType, color: '#6b7280' };
            const SrcIcon = m.Icon;
            const done    = src.status === 'extracted';
            const isErr   = src.status === 'error' || src.status === 'extract_error';
            const loading = src.status === 'fetching' || src.status === 'extracting';
            const iconColor = done ? '#34d399' : isErr ? '#f87171' : loading ? m.color : 'rgba(255,255,255,0.3)';
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', borderRadius: '7px', fontSize: '0.75rem',
                background: done ? 'rgba(16,185,129,0.09)' : isErr ? 'rgba(239,68,68,0.09)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${done ? 'rgba(16,185,129,0.25)' : isErr ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 0.2s',
              }}>
                <SrcIcon size={9} color={iconColor}/>
                <span style={{ color: done ? '#34d399' : isErr ? '#f87171' : loading ? m.color : 'rgba(255,255,255,0.38)', fontWeight: '600' }}>
                  {m.label}
                </span>
                {done && src.nodeCount > 0 && (
                  <span style={{ color: '#34d399', background: 'rgba(16,185,129,0.15)', borderRadius: '6px', padding: '0 4px', fontWeight: '800' }}>
                    +{src.nodeCount}
                  </span>
                )}
                {loading && <Loader size={8} color={m.color} style={{ animation: 'ep-pulse 1s infinite' }}/>}
                {isErr && <XCircle size={8} color="#f87171"/>}
              </div>
            );
          })}
        </div>
      )}

      {/* Live node counter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
          <span style={{
            fontSize: '1.7rem', fontWeight: '800', color: '#c084fc',
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em',
            textShadow: '0 0 22px rgba(192,132,252,0.55)',
          }}>
            {displayCount.toLocaleString()}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>
            claims extracted
          </span>
        </div>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
      </div>
    </div>
  );
}
