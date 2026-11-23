import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Utensils, Train, ShieldCheck, Landmark, ShoppingBag, MapPin, CloudRain, Lightbulb, Building2, ExternalLink, AlertTriangle, Maximize2, X } from 'lucide-react';

export const RADAR_CATEGORIES = [
  { key: 'Food & Drink',  abbr: 'F&D',  Icon: Utensils,    color: '#f97316', rx: /\b(food|eat|eating|drink|restaurant|cafe|coffee|beer|wine|cuisine|lunch|dinner|breakfast|bakery|pastry|meal|dining|cuisine|pub|bar)\b/i },
  { key: 'Transport',     abbr: 'TRN',  Icon: Train,       color: '#0ea5e9', rx: /\b(transport|metro|bus|train|taxi|cab|airport|flight|station|tram|transfer|subway|transit|ferry|cycle|bike|walk|tube|travel|passenger|passengers|commute|commuter|commuters|fare|fares|oyster|travelcard|capping|cap|caps|peak|off-peak|journey|journeys|line|lines|rail|railway|railways)\b/i },
  { key: 'Safety',        abbr: 'SAF',  Icon: ShieldCheck, color: '#ef4444', rx: /\b(safe|safety|danger|scam|pickpocket|hospital|health|police|emergency|avoid|crime|theft|thief|caution|risk|unsafe|beware)\b/i },
  { key: 'Culture',       abbr: 'CUL',  Icon: Landmark,    color: '#8b5cf6', rx: /\b(museum|church|temple|history|historical|art|gallery|festival|landmark|palace|architecture|monument|medieval|heritage|century|founded|roman|empire|dynasty|ancient|ruins|cathedral|castle|cultural)\b/i },
  { key: 'Shopping',      abbr: 'SHP',  Icon: ShoppingBag, color: '#ec4899', rx: /\b(shop|shopping|buy|souvenir|store|mall|boutique|price|cheap|expensive|bargain|retail|market)\b/i },
  { key: 'Districts',     abbr: 'DST',  Icon: MapPin,      color: '#10b981', rx: /\b(neighbourhood|district|area|quarter|zone|suburb|downtown|old town|borough|neighbourhood|block|street|village)\b/i },
  { key: 'Climate',       abbr: 'WTH',  Icon: CloudRain,   color: '#84cc16', rx: /\b(weather|rain|rainfall|hot|cold|summer|winter|sunny|temperature|humid|dry|climate|forecast|snow|wind|storm|freezing|scorching|degrees?|celsius|fahrenheit)\b/i },
  { key: 'Tips',          abbr: 'TIP',  Icon: Lightbulb,   color: '#f59e0b', rx: /\b(tip|advice|recommend|book|ticket|opening hours?|closing|queue|crowd|timing|best time|entry|free|pass|card|tourist)\b/i },
  { key: 'Accommodation', abbr: 'ACC',  Icon: Building2,   color: '#06b6d4', rx: /\b(hotel|hostel|stay|accommodation|airbnb|room|check.?in|apartment|sleep|lodge|rental|motel|resort|booking)\b/i },
];

const CAT_ALIAS = {
  'Food & Drink': 'Food & Drink', 'Safety & Health': 'Safety', 'Transport': 'Transport',
  'Culture': 'Culture', 'Shopping': 'Shopping', 'Districts': 'Districts',
  'Climate': 'Climate', 'Travel Tips': 'Tips', 'Accommodation': 'Accommodation',
};

// Content-first: claim text takes priority over extracted category labels
export function classifyNodeForRadar(node) {
  const claimText = (node.claim || '');
  // Primary: classify based on claim content alone
  for (const { key, rx } of RADAR_CATEGORIES) {
    if (rx.test(claimText)) return key;
  }
  // Fallback: check place · Category suffix only when claim text gives no match
  if (node.place?.includes(' · ')) {
    const suffix = node.place.split(' · ')[1];
    const alias = CAT_ALIAS[suffix];
    if (alias) return alias;
    const found = RADAR_CATEGORIES.find(c => suffix.startsWith(c.key.split(' ')[0]));
    if (found) return found.key;
  }
  // Last resort: check full text including place name
  const fullText = claimText + ' ' + (node.place || '');
  for (const { key, rx } of RADAR_CATEGORIES) {
    if (rx.test(fullText)) return key;
  }
  return 'Culture'; // default for general city/historical info
}

function RadarSVG({ data, hovKey, onHover, onClick, size = 260, dark = true }) {
  const N = data.length;
  const cx = size / 2, cy = size / 2;
  const R = size * 0.36;
  const abbrR = size * 0.46;

  const th = {
    ring:   dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.10)',
    spoke:  dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)',
    label:  dark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.30)',
    glyphBg: dark ? 'rgba(8,12,28,0.85)'    : 'rgba(245,245,250,0.95)',
    glyphTxt: dark ? '#fff' : '#fff',
    dot:    dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)',
  };

  const spoke = (i, r) => {
    const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), angle };
  };

  const rings = [0.25, 0.5, 0.75, 1].map(pct => ({
    pct, points: Array.from({ length: N }, (_, i) => spoke(i, R * pct)),
  }));

  const coveragePts = data.map((d, i) => spoke(i, R * Math.max(0.04, d.coverage / 100)));
  const sentPts     = data.map((d, i) => spoke(i, R * Math.max(0.04, d.sentPct / 100)));

  const poly = pts => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <svg width={size} height={size} style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <radialGradient id={`rdr-bg-${dark?'d':'l'}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={dark ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.05)'}/>
          <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={R} fill={`url(#rdr-bg-${dark?'d':'l'})`}/>

      {/* Grid rings */}
      {rings.map(({ points }, ri) => (
        <polygon key={ri} points={poly(points)} fill="none" stroke={th.ring} strokeWidth="0.8"/>
      ))}
      {/* Ring value labels */}
      {[25, 50, 75, 100].map((v, ri) => (
        <text key={ri} x={cx + 3} y={cy - R * v / 100 + 3}
          fontSize={size > 300 ? 8 : 6} fill={th.label} fontFamily="Inter,sans-serif">
          {v}%
        </text>
      ))}

      {/* Spokes */}
      {data.map((_, i) => {
        const tip = spoke(i, R);
        return <line key={i} x1={cx} y1={cy} x2={tip.x.toFixed(1)} y2={tip.y.toFixed(1)}
          stroke={th.spoke} strokeWidth="0.8"/>;
      })}

      {/* Coverage area */}
      <polygon points={poly(coveragePts)}
        fill="#8b5cf6" fillOpacity={dark ? 0.15 : 0.12} stroke="#8b5cf6" strokeWidth="1.8"
        style={{ transition: 'all 0.35s' }}/>

      {/* Sentiment area */}
      <polygon points={poly(sentPts)}
        fill="#10b981" fillOpacity={dark ? 0.10 : 0.08} stroke="#10b981" strokeWidth="1.3"
        strokeDasharray="4 3" style={{ transition: 'all 0.35s' }}/>

      {/* Coverage dots */}
      {coveragePts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.2}
          fill={hovKey === data[i].key ? data[i].color : '#8b5cf6'}
          stroke={th.dot} strokeWidth="0.8"
          opacity={hovKey && hovKey !== data[i].key ? 0.35 : 1}
          style={{ transition: 'opacity 0.15s, fill 0.15s', cursor: 'pointer' }}
          onMouseEnter={() => onHover(data[i].key)}
          onClick={() => onClick && onClick(data[i].key)}/>
      ))}

      {/* Spoke-end category glyphs — fixed size to avoid layout shift */}
      {data.map((d, i) => {
        const lp = spoke(i, abbrR);
        const isHov = hovKey === d.key;
        const circR = size > 300 ? 14 : 9.5;
        const fs = size > 300 ? 8 : 5.8;
        return (
          <g key={i} style={{ cursor: 'pointer' }} onMouseEnter={() => onHover(d.key)} onClick={() => onClick && onClick(d.key)}>
            <circle cx={lp.x} cy={lp.y} r={circR}
              fill={isHov ? d.color : th.glyphBg}
              stroke={isHov ? d.color : `${d.color}80`}
              strokeWidth={isHov ? 2 : 1}
              opacity={hovKey && !isHov ? 0.45 : 1}
              style={{ transition: 'fill 0.15s, opacity 0.15s, stroke 0.15s' }}/>
            <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central"
              fontSize={fs} fontWeight="800" fontFamily="Inter,sans-serif"
              fill={isHov ? '#fff' : d.color}
              style={{ userSelect: 'none' }}>
              {d.abbr}
            </text>
          </g>
        );
      })}

      {/* Center */}
      <circle cx={cx} cy={cy} r="3" fill="rgba(139,92,246,0.4)" stroke="#8b5cf6" strokeWidth="0.8"/>
    </svg>
  );
}

function RadarModal({ radarData, stats, maxCount, nodes, onClose }) {
  const [hovKey, setHovKey] = useState(null);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(null);

  const hov = hovKey ? RADAR_CATEGORIES.find(c => c.key === hovKey) : null;
  const hovStats = hovKey ? stats[hovKey] : null;
  const covered = radarData.filter(d => d.count > 0);
  const top = covered.reduce((a, b) => a.count > b.count ? a : b, covered[0]);

  const modalFilteredClaims = useMemo(() => {
    if (!selectedCategoryKey) return [];
    return nodes
      .filter(n => classifyNodeForRadar(n) === selectedCategoryKey)
      .sort((a, b) => (b.credibility || 0) - (a.credibility || 0));
  }, [selectedCategoryKey, nodes]);

  const selectedCat = selectedCategoryKey ? RADAR_CATEGORIES.find(c => c.key === selectedCategoryKey) : null;
  const selectedStats = selectedCategoryKey ? stats[selectedCategoryKey] : null;

  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '20px', padding: '20px', boxSizing: 'border-box'
    }}>
      {/* Container wrapper to hold both windows side-by-side if screen size permits */}
      <div style={{ display: 'flex', gap: '20px', maxWidth: '1240px', width: '100%', justifyContent: 'center', height: '90vh' }}>
        
        {/* Main Radar Modal */}
        <div onClick={e => e.stopPropagation()} style={{
          background: '#fff', borderRadius: '18px', padding: '32px 36px', width: '780px',
          maxHeight: '100%', overflowY: 'auto', fontFamily: 'Inter,sans-serif',
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
          position: 'relative', display: 'flex', flexDirection: 'column'
        }}>
          {/* Close */}
          <button onClick={onClose} style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%',
            width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={16} color="#444"/></button>

          {/* Title */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#1a1a2e', marginBottom: '4px' }}>
              Knowledge Radar
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>
              Topic coverage across {nodes.length} claims
              {top && <> · Most documented: <strong style={{ color: top.color }}>{top.key} ({top.count})</strong></>}
            </div>
          </div>

          {/* Main layout */}
          <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', flex: 1 }}
            onMouseLeave={() => setHovKey(null)}>
            <RadarSVG data={radarData} hovKey={hovKey} onHover={setHovKey} onClick={setSelectedCategoryKey} size={380} dark={false}/>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Legend */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                {[['#8b5cf6', 'Coverage'], ['#10b981', 'Positive %']].map(([col, lbl]) => (
                  <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="20" height="6">
                      <line x1="0" y1="3" x2="20" y2="3" stroke={col} strokeWidth={lbl==='Coverage'?'2':'1.5'} strokeDasharray={lbl==='Positive %'?'4 2':'none'}/>
                    </svg>
                    <span style={{ fontSize: '0.75rem', color: '#555' }}>{lbl}</span>
                  </div>
                ))}
              </div>

              {/* Category list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {radarData.sort((a,b) => b.count - a.count).map(d => {
                  const isHov = hovKey === d.key;
                  const isSelected = selectedCategoryKey === d.key;
                  const bar = d.coverage;
                  return (
                    <div key={d.key}
                      onMouseEnter={() => setHovKey(d.key)}
                      onClick={() => setSelectedCategoryKey(isSelected ? null : d.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                        background: isSelected ? `${d.color}1a` : (isHov ? `${d.color}0d` : 'rgba(0,0,0,0.02)'),
                        border: `1px solid ${isSelected ? d.color : (isHov ? d.color+'40' : 'rgba(0,0,0,0.06)')}`,
                        transition: 'all 0.15s',
                      }}>
                      <d.Icon size={13} color={d.color} style={{ flexShrink: 0 }}/>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#222', width: '90px', flexShrink: 0 }}>{d.key}</span>
                      <div style={{ flex: 1, height: '5px', background: 'rgba(0,0,0,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${bar}%`, height: '100%', background: d.color, borderRadius: '3px', transition: 'width 0.3s' }}/>
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: d.color, minWidth: '28px', textAlign: 'right' }}>{d.count}</span>
                    </div>
                  );
                })}
              </div>

              {/* Hover tooltip */}
              {hov && hovStats && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: `${hov.color}0d`, border: `1px solid ${hov.color}30`, borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '700', color: hov.color, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <hov.Icon size={13}/> {hov.key}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                    {[
                      ['Claims', hovStats.count, '#7c3aed'],
                      ['Positive', `${hovStats.count ? Math.round(hovStats.pos/hovStats.count*100) : 0}%`, '#059669'],
                      ['Negative', hovStats.neg, '#dc2626'],
                      ['Coverage', `${Math.round((hovStats.count/maxCount)*100)}%`, '#d97706'],
                    ].map(([label, val, col]) => (
                      <div key={label} style={{ background: 'rgba(0,0,0,0.03)', borderRadius: '6px', padding: '4px 8px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: col }}>{val}</div>
                        <div style={{ fontSize: '0.6rem', color: '#999' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {hovStats.sample && (
                    <div style={{ marginTop: '8px', fontSize: '0.68rem', color: '#666', fontStyle: 'italic', lineHeight: 1.5 }}>
                      "{hovStats.sample.slice(0,140)}{hovStats.sample.length>140?'…':''}"
                    </div>
                  )}
                  <div style={{ marginTop: '8px', fontSize: '0.62rem', color: hov.color, fontWeight: '600', textAlign: 'center' }}>
                    Click to view all {hovStats.count} claims
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Second White Popup Window on the Right (Claims detail) */}
        {selectedCategoryKey && selectedCat && (
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '18px', padding: '32px 30px', width: '420px',
            height: '100%', overflowY: 'auto', fontFamily: 'Inter,sans-serif',
            boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            position: 'relative', display: 'flex', flexDirection: 'column', boxSizing: 'border-box'
          }}>
            {/* Close */}
            <button onClick={() => setSelectedCategoryKey(null)} style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%',
              width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><X size={16} color="#444"/></button>

            {/* Header */}
            <div style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', fontWeight: '800', color: '#1a1a2e', marginBottom: '4px' }}>
                <selectedCat.Icon size={20} color={selectedCat.color}/>
                {selectedCategoryKey}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#888' }}>
                {modalFilteredClaims.length} verified traveller claims
              </div>
            </div>

            {/* Sentiment breakdown */}
            {selectedStats && (
              <div style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '10px', padding: '10px 12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', gap: '1px', marginBottom: '8px' }}>
                  {selectedStats.pos > 0 && <div style={{ flex: selectedStats.pos, background: '#10b981' }}/>}
                  {selectedStats.neg > 0 && <div style={{ flex: selectedStats.neg, background: '#ef4444' }}/>}
                  {selectedStats.count - selectedStats.pos - selectedStats.neg > 0 && <div style={{ flex: selectedStats.count - selectedStats.pos - selectedStats.neg, background: '#94a3b8' }}/>}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {[['#10b981', 'Positive', selectedStats.pos], ['#ef4444', 'Negative', selectedStats.neg], ['#94a3b8', 'Neutral', selectedStats.count - selectedStats.pos - selectedStats.neg]].map(([col, lbl, cnt]) => cnt > 0 && (
                    <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.62rem', color: '#555' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, display: 'inline-block' }}/>
                      <strong>{cnt}</strong> {lbl}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Claims list */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '2px' }}>
              {modalFilteredClaims.map((n, i) => {
                const sc = n.evaluation?.sentiment || 'neutral';
                const col = sc === 'positive' ? '#10b981' : sc === 'negative' ? '#ef4444' : '#94a3b8';
                return (
                  <div key={i} style={{
                    padding: '12px 14px', borderRadius: '10px', background: '#fff',
                    border: `1px solid ${col}35`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    position: 'relative'
                  }}>
                    <div style={{ fontSize: '0.78rem', color: '#222', lineHeight: 1.45, marginBottom: '6px' }}>{n.claim}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      {n.place && (
                        <span style={{ fontSize: '0.65rem', color: '#666', fontWeight: '600' }}>
                          📍 {n.place.split(' · ')[0]}
                        </span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: '700', color: col, textTransform: 'capitalize' }}>
                          {sc}
                        </span>
                        {n.source?.url && (
                          <a href={n.source.url} target="_blank" rel="noreferrer" style={{ color: '#aaa', display: 'flex', alignItems: 'center' }}>
                            <ExternalLink size={11}/>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}

export default function KnowledgeRadarView({ nodes }) {
  const [hovKey, setHovKey] = useState(null);
  const [activeKey, setActiveKey] = useState(null);
  const [sinceYear, setSinceYear] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // Temporal filter — shows knowledge as it existed from a given year onward
  const temporalNodes = useMemo(() => {
    if (!sinceYear) return nodes;
    return nodes.filter(n => {
      const d = n.date || n.source?.date || n.extractedAt;
      if (!d) return true;
      return new Date(d).getFullYear() >= sinceYear;
    });
  }, [nodes, sinceYear]);

  const { stats, maxCount } = useMemo(() => {
    const m = {};
    RADAR_CATEGORIES.forEach(c => { m[c.key] = { count: 0, pos: 0, neg: 0, sample: null }; });
    temporalNodes.forEach(n => {
      const cat = classifyNodeForRadar(n);
      if (!m[cat]) return;
      m[cat].count++;
      if (n.evaluation?.sentiment === 'positive') m[cat].pos++;
      if (n.evaluation?.sentiment === 'negative') m[cat].neg++;
      if (!m[cat].sample && n.claim) m[cat].sample = n.claim;
    });
    return { stats: m, maxCount: Math.max(...Object.values(m).map(s => s.count), 1) };
  }, [temporalNodes]);

  const radarData = RADAR_CATEGORIES.map(c => {
    const s = stats[c.key];
    const sentPct = s.count ? Math.round((s.pos / s.count) * 100) : 0;
    return { ...c, count: s.count, coverage: Math.round((s.count / maxCount) * 100), sentPct };
  });

  const covered  = radarData.filter(d => d.count > 0);
  const top      = covered.reduce((a, b) => a.count > b.count ? a : b, covered[0]);
  const gaps     = RADAR_CATEGORIES.filter(c => !stats[c.key]?.count);

  const filteredClaims = useMemo(() => {
    if (!activeKey) return [];
    return temporalNodes
      .filter(n => classifyNodeForRadar(n) === activeKey)
      .sort((a, b) => (b.credibility || 0) - (a.credibility || 0));
  }, [activeKey, temporalNodes]);

  const hov      = hovKey ? RADAR_CATEGORIES.find(c => c.key === hovKey) : null;
  const hovStats = hovKey ? stats[hovKey] : null;

  // Count how many nodes fall in each exact year (for button labels)
  const yearCounts = useMemo(() => {
    const m = {};
    nodes.forEach(n => {
      const d = n.date || n.source?.date || n.extractedAt;
      if (!d) return;
      const y = new Date(d).getFullYear();
      m[y] = (m[y] || 0) + 1;
    });
    return m;
  }, [nodes]);

  const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'Inter,sans-serif' }}>

      {/* Temporal year filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.28)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '2px' }}>Since</span>
        {[null, ...YEARS].map(y => {
          // cumulative count for "since Y": nodes with date >= y
          const cumCount = y == null ? nodes.length
            : nodes.filter(n => {
                const d = n.date || n.source?.date || n.extractedAt;
                if (!d) return false;
                return new Date(d).getFullYear() >= y;
              }).length;
          const isActive = sinceYear === y;
          return (
            <button key={y ?? 'all'}
              onClick={() => { setSinceYear(y); setActiveKey(null); }}
              title={y ? `${cumCount} claims with source date ≥ ${y}` : `All ${nodes.length} claims`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                fontSize: '0.54rem', padding: '2px 6px 3px', borderRadius: '8px', cursor: 'pointer',
                background: isActive ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`,
                color: isActive ? '#c084fc' : 'rgba(255,255,255,0.35)',
                fontFamily: 'Inter,sans-serif', lineHeight: 1.2,
              }}>
              <span style={{ fontWeight: isActive ? '700' : '400' }}>{y ?? 'All'}</span>
              <span style={{ fontSize: '0.44rem', color: isActive ? 'rgba(192,132,252,0.7)' : 'rgba(255,255,255,0.2)', fontWeight: '500' }}>{cumCount}</span>
            </button>
          );
        })}
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: '5px' }}>
        <div style={{ flex: 1, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px', padding: '5px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#c084fc', lineHeight: 1 }}>
            {covered.length}<span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontWeight: '400' }}>/{RADAR_CATEGORIES.length}</span>
          </div>
          <div style={{ fontSize: '0.54rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>Topics</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '5px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#10b981', lineHeight: 1 }}>{temporalNodes.length}</div>
          <div style={{ fontSize: '0.54rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>Claims</div>
        </div>
        {top && (
          <div style={{ flex: 2, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '5px 9px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.54rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Most documented</div>
            <div style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <top.Icon size={10} color={top.color}/>
              <span>{top.key}</span>
              <span style={{ color: '#f59e0b', fontSize: '0.62rem' }}>({top.count})</span>
            </div>
          </div>
        )}
      </div>

      {/* Radar + side panel */}
      <div style={{
        background: 'rgba(6,8,20,0.7)', borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '10px', display: 'flex', gap: '8px', alignItems: 'flex-start',
        position: 'relative',
      }}>
        <button onClick={() => setExpanded(true)} title="Full screen" style={{
          position: 'absolute', top: '8px', right: '8px', zIndex: 2,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '6px', padding: '3px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center',
        }}><Maximize2 size={11} color="rgba(255,255,255,0.45)"/></button>
        <RadarSVG data={radarData} hovKey={hovKey} onHover={k => { setHovKey(k); }} size={258}/>

        {/* Right panel */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '7px' }}>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[['#8b5cf6', 'Coverage'], ['#10b981', 'Positive %']].map(([col, lbl]) => (
              <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg width="16" height="5">
                  <line x1="0" y1="2.5" x2="16" y2="2.5" stroke={col} strokeWidth={lbl==='Coverage'?'1.8':'1.4'} strokeDasharray={lbl==='Positive %'?'4 2':'none'}/>
                </svg>
                <span style={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.35)' }}>{lbl}</span>
              </div>
            ))}
          </div>

          {/* Hover stats */}
          {hov && hovStats ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: hov.color, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <hov.Icon size={12}/> {hov.key}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
                {[
                  ['Claims',    hovStats.count, '#c084fc'],
                  ['Positive',  `${hovStats.count ? Math.round(hovStats.pos/hovStats.count*100) : 0}%`, '#10b981'],
                  ['Negative',  hovStats.neg,   '#f87171'],
                  ['Coverage',  `${Math.round((hovStats.count/maxCount)*100)}%`, '#f59e0b'],
                ].map(([label, val, col]) => (
                  <div key={label} style={{ background:'rgba(0,0,0,0.25)', borderRadius:'5px', padding:'3px 6px' }}>
                    <div style={{ fontSize:'0.68rem', fontWeight:'700', color:col }}>{val}</div>
                    <div style={{ fontSize:'0.52rem', color:'rgba(255,255,255,0.28)' }}>{label}</div>
                  </div>
                ))}
              </div>
              {hovStats.sample && (
                <div style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.38)', lineHeight:1.4, fontStyle:'italic', borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'4px' }}>
                  "{hovStats.sample.slice(0,100)}{hovStats.sample.length>100?'…':''}"
                </div>
              )}
              <button onClick={() => setActiveKey(activeKey === hov.key ? null : hov.key)}
                style={{ background:`${hov.color}18`, border:`1px solid ${hov.color}40`, borderRadius:'6px', color:hov.color, padding:'3px 8px', fontSize:'0.6rem', fontWeight:'600', cursor:'pointer', fontFamily:'Inter,sans-serif', marginTop:'2px' }}>
                {activeKey === hov.key ? 'Hide claims' : 'View claims →'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>Hover a spoke to inspect</div>
              {/* Chip list — all covered categories */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                {radarData.filter(d => d.count > 0).sort((a, b) => b.count - a.count).map(d => (
                  <button key={d.key} onClick={() => setActiveKey(activeKey === d.key ? null : d.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '3px',
                      padding: '2px 6px', borderRadius: '10px', fontSize: '0.57rem', cursor: 'pointer',
                      background: activeKey === d.key ? `${d.color}22` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${activeKey === d.key ? d.color+'55' : 'rgba(255,255,255,0.08)'}`,
                      color: activeKey === d.key ? d.color : 'rgba(255,255,255,0.42)',
                      fontFamily: 'Inter,sans-serif', transition: 'all 0.15s',
                    }}>
                    <d.Icon size={8}/> <span style={{ fontWeight:'600' }}>{d.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Gaps */}
          {gaps.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '7px', padding: '5px 7px', marginTop: 'auto' }}>
              <AlertTriangle size={10} color="#fca5a5" style={{ flexShrink: 0, marginTop: '1px' }}/>
              <div>
                <div style={{ fontSize: '0.55rem', color: '#fca5a5', fontWeight: '600', marginBottom: '2px' }}>Knowledge gaps</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {gaps.slice(0, 4).map(c => (
                    <span key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)' }}>
                      <c.Icon size={7} color={c.color}/> {c.key}
                    </span>
                  ))}
                  {gaps.length > 4 && <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)' }}>+{gaps.length - 4}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expanded claims for active category */}
      {activeKey && filteredClaims.length > 0 && (() => {
        const cat      = RADAR_CATEGORIES.find(c => c.key === activeKey);
        const catStats = stats[activeKey] || { count: 0, pos: 0, neg: 0 };
        const total    = catStats.count;  // actual count from classifier — not sliced
        const neg      = catStats.neg;
        const pos      = catStats.pos;
        const neu      = total - pos - neg;
        const SHOW_MAX = 15;
        const visible  = filteredClaims.slice(0, SHOW_MAX);

        // Detect places that have BOTH positive and negative claims → conflict
        const placeMap = {};
        filteredClaims.forEach(n => {
          if (!n.place) return;
          const key = n.place.split(' · ')[0].toLowerCase().trim();
          if (!placeMap[key]) placeMap[key] = { pos: 0, neg: 0 };
          if (n.evaluation?.sentiment === 'positive') placeMap[key].pos++;
          if (n.evaluation?.sentiment === 'negative') placeMap[key].neg++;
        });
        const conflictPlaces = new Set(
          Object.entries(placeMap).filter(([, v]) => v.pos > 0 && v.neg > 0).map(([k]) => k)
        );

        const SENT_COL = { positive: '#34d399', negative: '#f87171', neutral: '#94a3b8' };

        return (
          <div style={{ background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', overflow:'hidden' }}>
            {/* Header */}
            <div style={{ padding:'6px 10px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                <span style={{ fontSize:'0.62rem', fontWeight:'700', color:cat?.color, display:'flex', alignItems:'center', gap:'4px' }}>
                  {cat && <cat.Icon size={10}/>} {activeKey}
                  <span style={{ color:'rgba(255,255,255,0.3)', fontWeight:'400', fontSize:'0.56rem' }}>
                    — {total} claim{total !== 1 ? 's' : ''}{total > SHOW_MAX ? ` · top ${SHOW_MAX} shown` : ''}
                  </span>
                </span>
                <button onClick={() => setActiveKey(null)} style={{ background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer', fontSize:'0.75rem' }}>✕</button>
              </div>

              {/* Sentiment distribution bar */}
              <div style={{ display:'flex', flexDirection:'column', gap:'3px', paddingBottom:'6px' }}>
                <div style={{ display:'flex', height:'6px', borderRadius:'3px', overflow:'hidden', gap:'1px' }}>
                  {pos > 0  && <div style={{ flex: pos,  background: '#34d399', transition:'flex 0.4s' }}/>}
                  {neg > 0  && <div style={{ flex: neg,  background: '#f87171', transition:'flex 0.4s' }}/>}
                  {neu > 0  && <div style={{ flex: neu,  background: 'rgba(148,163,184,0.35)', transition:'flex 0.4s' }}/>}
                </div>
                <div style={{ display:'flex', gap:'10px' }}>
                  {[['#34d399','Positive',pos],['#f87171','Negative',neg],['rgba(148,163,184,0.7)','Neutral',neu]].map(([col, lbl, cnt]) => cnt > 0 && (
                    <span key={lbl} style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'0.52rem', color:'rgba(255,255,255,0.4)' }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:col, display:'inline-block' }}/>
                      {cnt} {lbl}
                    </span>
                  ))}
                  {conflictPlaces.size > 0 && (
                    <span style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'0.52rem', color:'#fb923c', marginLeft:'auto' }}>
                      <AlertTriangle size={8} color="#fb923c"/> {conflictPlaces.size} contested place{conflictPlaces.size > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Claim rows */}
            <div style={{ maxHeight:'240px', overflowY:'auto' }}>
              {visible.map((n, i) => {
                const sc = n.evaluation?.sentiment;
                const col = SENT_COL[sc] || SENT_COL.neutral;
                const placeKey = n.place?.split(' · ')[0].toLowerCase().trim() || '';
                const isConflict = conflictPlaces.has(placeKey);
                return (
                  <div key={i} style={{
                    padding:'5px 10px 5px 0',
                    borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    display:'flex', gap:'0',
                    background: isConflict ? 'rgba(251,146,60,0.04)' : 'transparent',
                  }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'0.63rem', color:'var(--text-primary)', lineHeight:1.45 }}>{n.claim}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:'5px', marginTop:'2px', flexWrap:'wrap' }}>
                        {n.place && <span style={{ fontSize:'0.54rem', color:'rgba(255,255,255,0.26)' }}>{n.place.split(' · ')[0]}</span>}
                        <span style={{ fontSize:'0.52rem', fontWeight:'700', color:col, letterSpacing:'0.03em' }}>
                          {sc === 'positive' ? '↑ positive' : sc === 'negative' ? '↓ negative' : '· neutral'}
                        </span>
                        {isConflict && (
                          <span style={{ fontSize:'0.5rem', color:'#fb923c', display:'flex', alignItems:'center', gap:'2px', background:'rgba(251,146,60,0.12)', border:'1px solid rgba(251,146,60,0.25)', borderRadius:'4px', padding:'0 4px' }}>
                            <AlertTriangle size={7} color="#fb923c"/> contested
                          </span>
                        )}
                        {typeof n.credibility === 'number' && (
                          <span style={{ fontSize:'0.5rem', color:'rgba(255,255,255,0.2)', marginLeft:'auto', display:'flex', alignItems:'center', gap:'2px' }}>
                            {[1,2,3,4,5].map(s => (
                              <span key={s} style={{ width:3, height:3, borderRadius:'50%', background: s <= Math.round(n.credibility) ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)', display:'inline-block' }}/>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                    {n.source?.url && (
                      <a href={n.source.url} target="_blank" rel="noreferrer" style={{ color:'rgba(255,255,255,0.22)', flexShrink:0, alignSelf:'center', marginLeft:'6px' }}>
                        <ExternalLink size={10}/>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {expanded && (
        <RadarModal
          radarData={radarData}
          stats={stats}
          maxCount={maxCount}
          nodes={temporalNodes}
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  );
}
