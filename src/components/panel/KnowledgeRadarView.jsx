import React, { useMemo, useState } from 'react';
import { Utensils, Train, ShieldCheck, Landmark, ShoppingBag, MapPin, CloudRain, Lightbulb, Building2, ExternalLink, AlertTriangle } from 'lucide-react';

export const RADAR_CATEGORIES = [
  { key: 'Food & Drink',  abbr: 'F&D',  Icon: Utensils,    color: '#f97316', rx: /\b(food|eat|eating|drink|restaurant|cafe|coffee|beer|wine|cuisine|lunch|dinner|breakfast|bakery|pastry|meal|dining|cuisine|pub|bar)\b/i },
  { key: 'Transport',     abbr: 'TRN',  Icon: Train,       color: '#0ea5e9', rx: /\b(transport|metro|bus|train|taxi|cab|airport|flight|station|tram|transfer|subway|transit|ferry|cycle|bike|walk|tube)\b/i },
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

function RadarSVG({ data, hovKey, onHover, size = 260 }) {
  const N = data.length;
  const cx = size / 2, cy = size / 2;
  const R = size * 0.36;
  const labelR = size * 0.465;
  const abbrR = size * 0.46;

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
        <radialGradient id="rdr-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(139,92,246,0.06)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={R} fill="url(#rdr-bg)"/>

      {/* Grid rings */}
      {rings.map(({ pct, points }, ri) => (
        <polygon key={ri} points={poly(points)}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8"/>
      ))}
      {/* Ring value labels */}
      {[25, 50, 75, 100].map((v, ri) => (
        <text key={ri} x={cx + 3} y={cy - R * v / 100 + 3}
          fontSize="6" fill="rgba(255,255,255,0.2)" fontFamily="Inter,sans-serif">
          {v}%
        </text>
      ))}

      {/* Spokes */}
      {data.map((_, i) => {
        const tip = spoke(i, R);
        return <line key={i} x1={cx} y1={cy} x2={tip.x.toFixed(1)} y2={tip.y.toFixed(1)}
          stroke="rgba(255,255,255,0.08)" strokeWidth="0.8"/>;
      })}

      {/* Coverage area */}
      <polygon points={poly(coveragePts)}
        fill="#8b5cf6" fillOpacity="0.15" stroke="#8b5cf6" strokeWidth="1.8"
        style={{ transition: 'all 0.35s' }}/>

      {/* Sentiment area */}
      <polygon points={poly(sentPts)}
        fill="#10b981" fillOpacity="0.1" stroke="#10b981" strokeWidth="1.3"
        strokeDasharray="4 3" style={{ transition: 'all 0.35s' }}/>

      {/* Coverage dots */}
      {coveragePts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={hovKey === data[i].key ? 5 : 3.2}
          fill={hovKey === data[i].key ? data[i].color : '#8b5cf6'}
          stroke="rgba(255,255,255,0.25)" strokeWidth="0.8"
          style={{ transition: 'all 0.2s', cursor: 'pointer' }}
          onMouseEnter={() => onHover(data[i].key)}
          onMouseLeave={() => onHover(null)}/>
      ))}

      {/* Spoke-end category glyphs */}
      {data.map((d, i) => {
        const lp = spoke(i, abbrR);
        const isHov = hovKey === d.key;
        const circR = isHov ? 12 : 9.5;
        return (
          <g key={i} style={{ cursor: 'pointer' }}
            onMouseEnter={() => onHover(d.key)} onMouseLeave={() => onHover(null)}>
            <circle cx={lp.x} cy={lp.y} r={circR}
              fill={isHov ? d.color : 'rgba(8,12,28,0.85)'}
              stroke={isHov ? d.color : `${d.color}60`}
              strokeWidth={isHov ? 1.5 : 1}
              style={{ transition: 'all 0.2s' }}/>
            <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central"
              fontSize={isHov ? 6.5 : 5.8} fontWeight="800"
              fontFamily="Inter,sans-serif"
              fill={isHov ? '#fff' : d.color}
              style={{ transition: 'all 0.15s', userSelect: 'none' }}>
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

export default function KnowledgeRadarView({ nodes }) {
  const [hovKey, setHovKey] = useState(null);
  const [activeKey, setActiveKey] = useState(null);
  const [sinceYear, setSinceYear] = useState(null);

  // Temporal filter — shows knowledge as it existed from a given year onward
  const temporalNodes = useMemo(() => {
    if (!sinceYear) return nodes;
    return nodes.filter(n => {
      const d = n.source?.date || n.extractedAt;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'Inter,sans-serif' }}>

      {/* Temporal year filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.28)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '2px' }}>Since</span>
        {[null, 2020, 2021, 2022, 2023, 2024, 2025].map(y => (
          <button key={y ?? 'all'} onClick={() => { setSinceYear(y); setActiveKey(null); }}
            style={{
              fontSize: '0.54rem', padding: '2px 7px', borderRadius: '8px', cursor: 'pointer',
              background: sinceYear === y ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${sinceYear === y ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`,
              color: sinceYear === y ? '#c084fc' : 'rgba(255,255,255,0.35)',
              fontFamily: 'Inter,sans-serif', fontWeight: sinceYear === y ? '700' : '400',
            }}>{y ?? 'All'}</button>
        ))}
        {sinceYear && (
          <span style={{ fontSize: '0.52rem', color: '#f59e0b', marginLeft: '4px' }}>
            {temporalNodes.length} / {nodes.length} claims
          </span>
        )}
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
      }}>
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
                    {/* Left sentiment stripe */}
                    <div style={{ width:'3px', flexShrink:0, background: col, marginRight:'9px', borderRadius:'0 2px 2px 0', opacity: 0.7 }}/>
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
    </div>
  );
}
