import { useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Activity, MapPin, Bookmark, CalendarDays, Route, TrendingUp, Brain, ShieldAlert, Sparkles, Navigation, X, Maximize2, ChevronDown, ChevronUp, Download, Upload } from 'lucide-react';
import { getCityColor, getDistanceKm, getTypeDetails } from '../../utils';

// ── data helpers ───────────────────────────────────────────────────────────

function buildStats(tripData) {
  const locations  = tripData.locations || [];
  const itinerary  = tripData.itinerary || [];
  const budget     = tripData.budget || {};
  const packing    = tripData.packing || [];
  const totalPlaces = locations.reduce((n, c) => n + (c.places?.length || 0), 0);
  const totalDays  = itinerary.length;
  const activeDays = itinerary.filter(d => d.events?.length > 0).length;
  const catCounts  = {};
  for (const loc of locations)
    for (const p of (loc.places || []))
      catCounts[p.type] = (catCounts[p.type] || 0) + 1;
  const topCats    = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxCat     = topCats[0]?.[1] || 1;
  let totalKm = 0;
  for (let i = 1; i < locations.length; i++) {
    const a = locations[i-1], b = locations[i];
    if (a.coords && b.coords) totalKm += getDistanceKm(a.coords[0], a.coords[1], b.coords[0], b.coords[1]);
  }
  const spent       = (budget.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const budgetTotal = budget.total || 0;
  const budgetPct   = budgetTotal > 0 ? Math.min(100, Math.round((spent / budgetTotal) * 100)) : null;
  const packingDone = packing.filter(p => p.packed).length;
  return { locations, totalPlaces, totalDays, activeDays, topCats, maxCat, totalKm, spent, budgetTotal, budgetPct, packingDone, packingTotal: packing.length, budget };
}

function buildInsights(savedPlaces) {
  if (!savedPlaces.length) return { radarData: [], scatterData: [], persona: 'The Novice', avgAuthority: 0 };
  const cc = { Culture: 0, Nature: 0, Food: 0, Social: 0 };
  savedPlaces.forEach(p => {
    const t = (p.type || '').toLowerCase();
    if (t.includes('museum') || t.includes('art') || t.includes('gallery') || t.includes('historic') || t.includes('castle') || t.includes('church') || t.includes('cathedral') || t.includes('abbey') || t.includes('monument') || t.includes('memorial') || t.includes('ruins'))
      cc.Culture++;
    else if (t.includes('park') || t.includes('hiking') || t.includes('beach') || t.includes('view') || t.includes('camping') || t.includes('nature') || t.includes('mountain') || t.includes('peak') || t.includes('trail'))
      cc.Nature++;
    else if (t.includes('food') || t.includes('restaurant') || t.includes('cafe') || t.includes('coffee'))
      cc.Food++;
    else
      cc.Social++;
  });
  const maxC = Math.max(1, ...Object.values(cc));
  const radarData = Object.entries(cc).map(([subject, count]) => ({ subject, value: count / maxC }));
  let persona = 'The Generalist';
  if (cc.Culture > cc.Nature && cc.Culture > cc.Food && cc.Culture > cc.Social)    persona = 'The Culture Vulture';
  else if (cc.Nature > cc.Culture && cc.Nature > cc.Food && cc.Nature > cc.Social) persona = 'The Nature Explorer';
  else if (cc.Food > cc.Culture && cc.Food > cc.Nature && cc.Food > cc.Social)     persona = 'The Gastronome';
  else if (cc.Social > cc.Culture && cc.Social > cc.Nature)                        persona = 'The Social Explorer';
  const scatterData = savedPlaces.map(p => {
    const q       = p._qualityScore || 5;
    const hasWiki = p.osmTags?.wikipedia || p.osmTags?.wikidata;
    const hasSite = !!(p.osmTags?.website || p.osmTags?.['contact:website']);
    const nameLen = p.name?.length || 8;
    const idHash  = String(p.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    // authority: quality score + wiki + website + name familiarity (longer = more famous)
    const authority = Math.min(98, Math.max(5,
      q * 7 + (hasWiki ? 28 : 0) + (hasSite ? 12 : 0) + (nameLen > 20 ? 8 : nameLen > 12 ? 4 : 0) + (idHash % 18)
    ));
    // controversy: low-wiki places are more debated; type matters (local vs landmark)
    const t = (p.type || '').toLowerCase();
    const isEstablished = t.includes('museum') || t.includes('historic') || t.includes('monument');
    const controversy = Math.min(95, Math.max(5,
      (hasWiki ? 8 : 48) + (isEstablished ? -10 : 15) + (idHash % 30) + (q < 5 ? 12 : 0)
    ));
    return { name: p.name, authority, controversy };
  });
  const avgAuthority = Math.round(scatterData.reduce((a, v) => a + v.authority, 0) / scatterData.length);
  return { radarData, scatterData, persona, avgAuthority };
}

// ── axis colours for radar ─────────────────────────────────────────────────
const AXIS_COLORS = { Culture:'#6366f1', Nature:'#10b981', Food:'#f59e0b', Social:'#ec4899' };

// ── SVG Radar Chart ────────────────────────────────────────────────────────

function RadarChart({ data, accent, dark }) {
  if (!data.length) return null;
  const W = 320, H = 240, cx = 160, cy = 115, R = 88;
  const n = data.length;
  const angle   = i => (i / n) * 2 * Math.PI - Math.PI / 2;
  const axisEnd = i => ({ x: cx + R * Math.cos(angle(i)), y: cy + R * Math.sin(angle(i)) });
  const dataPt  = (i, v) => ({ x: cx + R * v * Math.cos(angle(i)), y: cy + R * v * Math.sin(angle(i)) });
  const rings   = [0.25, 0.5, 0.75, 1];
  const gridC   = dark ? 'rgba(255,255,255,0.08)' : '#e8edf5';
  const polyPts = data.map((d, i) => { const p = dataPt(i, d.value); return `${p.x},${p.y}`; }).join(' ');
  const gradId  = `rg${dark?'d':'l'}`;

  return (
    <svg width={W} height={H} style={{ display:'block', margin:'0 auto' }}>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={accent} stopOpacity="0.55"/>
          <stop offset="100%" stopColor={accent} stopOpacity="0.08"/>
        </radialGradient>
      </defs>

      {/* rings */}
      {rings.map(r => (
        <polygon key={r}
          points={data.map((_, i) => { const e = axisEnd(i); return `${cx+(e.x-cx)*r},${cy+(e.y-cy)*r}`; }).join(' ')}
          fill={r === 1 ? (dark?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.015)') : 'none'}
          stroke={gridC} strokeWidth={r===1?1.5:1}
        />
      ))}

      {/* spokes */}
      {data.map((d, i) => {
        const e = axisEnd(i);
        const col = AXIS_COLORS[d.subject] || accent;
        return <line key={i} x1={cx} y1={cy} x2={e.x} y2={e.y} stroke={col} strokeWidth="1.5" strokeOpacity="0.3"/>;
      })}

      {/* data fill */}
      <polygon points={polyPts} fill={`url(#${gradId})`} stroke="none"/>
      <polygon points={polyPts} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" strokeOpacity="0.9"/>

      {/* value dots + glow */}
      {data.map((d, i) => {
        const p   = dataPt(i, d.value);
        const col = AXIS_COLORS[d.subject] || accent;
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="7" fill={col} opacity="0.18"/>
            <circle cx={p.x} cy={p.y} r="4.5" fill={col} stroke={dark?'#1e293b':'#fff'} strokeWidth="2"/>
          </g>
        );
      })}

      {/* axis labels with pct */}
      {data.map((d, i) => {
        const e   = axisEnd(i);
        const off = 22;
        const lx  = cx + (e.x - cx) * (1 + off/R);
        const ly  = cy + (e.y - cy) * (1 + off/R);
        const anchor = e.x > cx + 5 ? 'start' : e.x < cx - 5 ? 'end' : 'middle';
        const col = AXIS_COLORS[d.subject] || (dark?'rgba(255,255,255,0.7)':'#475569');
        const pct = Math.round(d.value * 100);
        return (
          <g key={i}>
            <text x={lx} y={ly-7} textAnchor={anchor} fontSize="11" fontWeight="700" fill={col}>{d.subject}</text>
            <text x={lx} y={ly+6} textAnchor={anchor} fontSize="10" fontWeight="500" fill={col} opacity="0.65">{pct}%</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── SVG Scatter Chart ──────────────────────────────────────────────────────

const QUADRANTS = [
  { label:'Iconic Classics',      x2:.5, y2:.5, x1:0, y1:0, fill:'#10b98108' },
  { label:'Debated Icons',        x2:1,  y2:.5, x1:.5, y1:0, fill:'#f59e0b08' },
  { label:'Hidden Gems',          x2:.5, y2:1,  x1:0, y1:.5, fill:'#6366f108' },
  { label:'Local Controversies',  x2:1,  y2:1,  x1:.5, y1:.5, fill:'#ec489908' },
];

function ScatterPlot({ data, accent, dark }) {
  const [hover, setHover] = useState(null);
  const W=320, H=240, PL=38, PR=14, PT=14, PB=32;
  const iW = W-PL-PR, iH = H-PT-PB;
  const gridC  = dark ? 'rgba(255,255,255,0.05)' : '#f0f4f8';
  const axisC  = dark ? 'rgba(255,255,255,0.12)' : '#dde3ec';
  const labelC = dark ? 'rgba(255,255,255,0.38)' : '#94a3b8';
  const px = v => PL + (v/100)*iW;
  const py = v => PT + (1-v/100)*iH;

  const dotColor = d => {
    if (d.authority > 50 && d.controversy < 50)  return '#10b981'; // Iconic Classics
    if (d.authority > 50 && d.controversy >= 50) return '#f59e0b'; // Debated Icons
    if (d.authority <= 50 && d.controversy < 50) return '#6366f1'; // Hidden Gems
    return '#ec4899';                                               // Local Controversies
  };

  return (
    <svg width={W} height={H} style={{ display:'block', margin:'0 auto', overflow:'visible' }}>
      {/* quadrant backgrounds */}
      {QUADRANTS.map((q, qi) => (
        <rect key={qi}
          x={PL + q.x1*iW} y={PT + (1-q.y2)*iH}
          width={(q.x2-q.x1)*iW} height={(q.y2-q.y1)*iH}
          fill={q.fill} rx="0"
        />
      ))}

      {/* grid lines */}
      {[0,25,50,75,100].map(v => (
        <g key={v}>
          <line x1={PL} y1={py(v)} x2={W-PR} y2={py(v)} stroke={gridC} strokeWidth="1"/>
          <line x1={px(v)} y1={PT} x2={px(v)} y2={H-PB} stroke={gridC} strokeWidth="1"/>
          <text x={PL-4} y={py(v)} textAnchor="end" dominantBaseline="middle" fontSize="9" fill={labelC}>{v}</text>
          <text x={px(v)} y={H-PB+11} textAnchor="middle" fontSize="9" fill={labelC}>{v}</text>
        </g>
      ))}

      {/* dividers */}
      <line x1={px(50)} y1={PT} x2={px(50)} y2={H-PB} stroke={axisC} strokeWidth="1.5" strokeDasharray="5,3"/>
      <line x1={PL} y1={py(50)} x2={W-PR} y2={py(50)} stroke={axisC} strokeWidth="1.5" strokeDasharray="5,3"/>

      {/* axes */}
      <line x1={PL} y1={H-PB} x2={W-PR} y2={H-PB} stroke={axisC} strokeWidth="1.5"/>
      <line x1={PL} y1={PT}   x2={PL}   y2={H-PB} stroke={axisC} strokeWidth="1.5"/>

      {/* quadrant micro-labels */}
      {[
        { label:'Iconic', cx: PL+iW*0.75, cy: PT+iH*0.82, col:'#10b981' },
        { label:'Debated', cx: PL+iW*0.75, cy: PT+iH*0.18, col:'#f59e0b' },
        { label:'Hidden', cx: PL+iW*0.25, cy: PT+iH*0.82, col:'#6366f1' },
        { label:'Local', cx: PL+iW*0.25, cy: PT+iH*0.18, col:'#ec4899' },
      ].map((q, qi) => (
        <text key={qi} x={q.cx} y={q.cy} textAnchor="middle" fontSize="9" fontWeight="700" fill={q.col} opacity="0.55">{q.label}</text>
      ))}

      {/* dots */}
      {data.map((d, i) => {
        const col = dotColor(d);
        const r   = hover === i ? 8 : 6;
        return (
          <g key={i} style={{ cursor:'pointer' }} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}>
            <circle cx={px(d.authority)} cy={py(d.controversy)} r={r+3} fill={col} opacity="0.15"/>
            <circle cx={px(d.authority)} cy={py(d.controversy)} r={r} fill={col} stroke={dark?'#1e293b':'#fff'} strokeWidth="1.5" opacity="0.9"/>
          </g>
        );
      })}

      {/* tooltip */}
      {hover !== null && (() => {
        const d  = data[hover];
        const tx = Math.min(px(d.authority)+10, W-130);
        const ty = Math.max(py(d.controversy)-46, PT);
        return (
          <foreignObject x={tx} y={ty} width="130" height="52">
            <div style={{ background: dark?'rgba(15,23,42,0.96)':'rgba(15,23,42,0.92)', color:'#f8fafc', fontSize:'10px', padding:'6px 8px', borderRadius:'8px', boxShadow:'0 4px 16px rgba(0,0,0,0.4)', lineHeight:1.5, fontFamily:'system-ui' }}>
              <div style={{ fontWeight:700, marginBottom:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.name}</div>
              <div style={{ color:'rgba(255,255,255,0.6)', fontSize:'9.5px' }}>Authority {d.authority} · Controversy {d.controversy}</div>
            </div>
          </foreignObject>
        );
      })()}

      <text x={PL+iW/2} y={H-2} textAnchor="middle" fontSize="10" fontWeight="600" fill={labelC}>Authority →</text>
      <text x={10} y={PT+iH/2} textAnchor="middle" fontSize="10" fontWeight="600" fill={labelC} transform={`rotate(-90,10,${PT+iH/2})`}>↑ Controversy</text>
    </svg>
  );
}

// ── reusable panel blocks ──────────────────────────────────────────────────

const card = (dark) => ({
  background: dark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
  border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
  borderRadius: '12px', padding: '14px', marginBottom: '14px',
});

function StatCards({ stats, dark }) {
  const items = [
    { icon: <MapPin size={13}/>,       label:'Destinations', value: stats.locations.length,                                                    color:'#3b82f6' },
    { icon: <Bookmark size={13}/>,     label:'Saved places', value: stats.totalPlaces,                                                         color:'#8b5cf6' },
    { icon: <CalendarDays size={13}/>, label:'Days planned', value: stats.totalDays > 0 ? `${stats.activeDays}/${stats.totalDays}` : '-',      color:'#10b981' },
    { icon: <Route size={13}/>,        label:'Distance',     value: stats.totalKm > 0 ? `${Math.round(stats.totalKm).toLocaleString()} km` : '-', color:'#f59e0b' },
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'18px' }}>
      {items.map(c => (
        <div key={c.label} style={{ background: dark?'rgba(255,255,255,0.04)':'#f8fafc', border: dark?'1px solid rgba(255,255,255,0.07)':'1px solid #e2e8f0', borderRadius:'10px', padding:'10px 12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'5px', color:c.color, marginBottom:'4px', fontSize:'0.67rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em' }}>{c.icon}{c.label}</div>
          <div style={{ fontSize:'1.1rem', fontWeight:'800', color: dark?'#f8fafc':'#0f172a' }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function CategoryBars({ topCats, maxCat, dark }) {
  if (!topCats.length) return null;
  return (
    <div style={{ marginBottom:'18px' }}>
      <div style={{ fontSize:'0.68rem', fontWeight:'700', color: dark?'rgba(255,255,255,0.4)':'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}>Saved by type</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
        {topCats.map(([type, count]) => {
          const { icon, color } = getTypeDetails(type);
          const pct = Math.round((count / maxCat) * 100);
          return (
            <div key={type} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ width:'82px', display:'flex', alignItems:'center', gap:'4px', color: dark?'rgba(255,255,255,0.6)':'#475569', fontSize:'0.7rem', flexShrink:0 }}>
                <span style={{ color }}>{icon}</span>{type}
              </div>
              <div style={{ flex:1, background: dark?'rgba(255,255,255,0.08)':'#e2e8f0', borderRadius:'4px', height:'7px', overflow:'hidden' }}>
                <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:'4px', transition:'width 0.4s' }}/>
              </div>
              <div style={{ width:'20px', textAlign:'right', fontSize:'0.7rem', fontWeight:'700', color: dark?'rgba(255,255,255,0.5)':'#64748b', flexShrink:0 }}>{count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BudgetBar({ stats, dark }) {
  if (!stats.budgetTotal) return null;
  const pct = stats.budgetPct;
  const barColor = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#10b981';
  return (
    <div style={{ marginBottom:'18px' }}>
      <div style={{ fontSize:'0.68rem', fontWeight:'700', color: dark?'rgba(255,255,255,0.4)':'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px' }}>Budget</div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.7rem', color: dark?'rgba(255,255,255,0.5)':'#64748b', marginBottom:'5px' }}>
        <span>Spent <strong style={{ color: dark?'#f8fafc':'#0f172a' }}>{stats.budget.currency||'EUR'} {stats.spent.toLocaleString()}</strong></span>
        <span>Total <strong style={{ color: dark?'#f8fafc':'#0f172a' }}>{stats.budget.currency||'EUR'} {stats.budgetTotal.toLocaleString()}</strong></span>
      </div>
      <div style={{ background: dark?'rgba(255,255,255,0.08)':'#e2e8f0', borderRadius:'4px', height:'7px', overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:barColor, borderRadius:'4px', transition:'width 0.4s' }}/>
      </div>
      <div style={{ fontSize:'0.67rem', color: dark?'rgba(255,255,255,0.4)':'#94a3b8', marginTop:'3px', textAlign:'right' }}>{pct}% used</div>
    </div>
  );
}

function PackingBar({ stats, dark }) {
  if (!stats.packingTotal) return null;
  const pct = Math.round((stats.packingDone / stats.packingTotal) * 100);
  return (
    <div style={{ marginBottom:'18px' }}>
      <div style={{ fontSize:'0.68rem', fontWeight:'700', color: dark?'rgba(255,255,255,0.4)':'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px' }}>Packing</div>
      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
        <div style={{ flex:1, background: dark?'rgba(255,255,255,0.08)':'#e2e8f0', borderRadius:'4px', height:'7px', overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%', background:'#10b981', borderRadius:'4px', transition:'width 0.4s' }}/>
        </div>
        <span style={{ fontSize:'0.7rem', color: dark?'rgba(255,255,255,0.5)':'#64748b', flexShrink:0 }}>{stats.packingDone}/{stats.packingTotal}</span>
      </div>
    </div>
  );
}

function PerCity({ locations, dark }) {
  const [openId, setOpenId] = useState(null);
  if (!locations.length) return null;
  return (
    <div style={{ marginBottom:'4px' }}>
      <div style={{ fontSize:'0.68rem', fontWeight:'700', color: dark?'rgba(255,255,255,0.4)':'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}>Per destination</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
        {locations.map((loc) => {
          const isOpen = openId === loc.id;
          const cc = {};
          (loc.places||[]).forEach(p => { cc[p.type] = (cc[p.type]||0)+1; });
          const topLC = Object.entries(cc).sort((a,b)=>b[1]-a[1]).slice(0,5);
          return (
            <div key={loc.id} style={{ background: dark?'rgba(255,255,255,0.03)':'#f8fafc', border: dark?`1px solid ${isOpen?'rgba(99,102,241,0.35)':'rgba(255,255,255,0.07)'}`:`1px solid ${isOpen?'#a5b4fc':'#e2e8f0'}`, borderRadius:'8px', overflow:'hidden' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', cursor:'pointer' }} onClick={()=>setOpenId(isOpen?null:loc.id)}>
                <span style={{ fontSize:'0.78rem', fontWeight:'600', color: dark?'#f8fafc':'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, minWidth:0 }}>{loc.name.split(',')[0]}</span>
                <div style={{ display:'flex', gap:'8px', flexShrink:0, marginLeft:'8px', alignItems:'center' }}>
                  <span style={{ fontSize:'0.67rem', color: dark?'rgba(255,255,255,0.45)':'#64748b' }}><strong style={{ color: dark?'#f8fafc':'#0f172a' }}>{(loc.places||[]).length}</strong> saved</span>
                  {isOpen ? <ChevronUp size={12} color={dark?'rgba(255,255,255,0.4)':'#94a3b8'}/> : <ChevronDown size={12} color={dark?'rgba(255,255,255,0.4)':'#94a3b8'}/>}
                </div>
              </div>
              {isOpen && topLC.length > 0 && (
                <div style={{ padding:'6px 10px 10px', borderTop: dark?'1px solid rgba(255,255,255,0.05)':'1px solid #e2e8f0', background: dark?'rgba(0,0,0,0.15)':'#fff' }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                    {topLC.map(([type, count]) => { const {icon,color} = getTypeDetails(type); return (
                      <div key={type} style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'0.65rem', background: dark?'rgba(255,255,255,0.06)':'#f1f5f9', borderRadius:'5px', padding:'2px 6px' }}>
                        <span style={{color}}>{icon}</span>
                        <span style={{color: dark?'rgba(255,255,255,0.6)':'#475569'}}>{type}</span>
                        <span style={{fontWeight:'700', color: dark?'#f8fafc':'#0f172a'}}>{count}</span>
                      </div>
                    ); })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── export / import helpers ────────────────────────────────────────────────

function exportTrip(tripData, tripId) {
  // Bundle tripData + any extra localStorage keys for this trip
  const extras = {};
  try {
    const intelKey = `gc_intel_v1_${tripId}`;
    const raw = localStorage.getItem(intelKey);
    if (raw) extras[intelKey] = JSON.parse(raw);
  } catch {}
  const payload = { version: 2, tripData, extras };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${(tripData.name || tripData.title || 'trip').replace(/\s+/g,'-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── expanded modal ─────────────────────────────────────────────────────────

function ExpandedModal({ onClose, tripData, setTripData, tripId, activeCity, savedPlaces, stats, insights, accent }) {
  const importRef = useRef(null);

  const handleImport = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        // Support both v2 bundle format and legacy plain tripData
        const td = parsed.version === 2 ? parsed.tripData : parsed;
        if (!td?.locations) { alert('Invalid trip file, no locations found.'); return; }
        if (setTripData) setTripData(td);
        // Restore extra localStorage keys if present
        if (parsed.extras) {
          for (const [k, v] of Object.entries(parsed.extras)) {
            try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
          }
        }
        onClose();
      } catch { alert('Could not parse file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const SectionHead = ({ icon, children }) => (
    <div style={{ display:'flex', alignItems:'center', gap:'7px', fontSize:'0.68rem', fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'16px' }}>
      {icon}{children}
    </div>
  );

  return createPortal(
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(6px)' }} onClick={onClose}/>
      <div style={{ position:'relative', background:'#fff', borderRadius:'20px', width:'min(900px,96vw)', maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 40px 100px rgba(0,0,0,0.4)', overflow:'hidden' }}>

        {/* ── header (white) ── */}
        <div style={{ padding:'20px 28px 16px', background:'#fff', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ background:`${accent}18`, borderRadius:'10px', width:'38px', height:'38px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Activity size={18} color={accent}/>
            </div>
            <div>
              <div style={{ fontSize:'1.05rem', fontWeight:800, color:'#0f172a', letterSpacing:'-0.01em' }}>Traveler Insights</div>
              <div style={{ fontSize:'0.7rem', color:'#94a3b8', marginTop:'1px' }}>{tripData.name || tripData.title || 'Trip'} · {stats.locations.length} destination{stats.locations.length!==1?'s':''}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <input ref={importRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleImport}/>
            <button onClick={() => importRef.current?.click()} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 12px', borderRadius:'8px', border:'1px solid #e2e8f0', background:'#f8fafc', cursor:'pointer', fontSize:'0.72rem', fontWeight:600, color:'#475569' }}>
              <Upload size={13}/> Import
            </button>
            <button onClick={() => exportTrip(tripData, tripId)} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 12px', borderRadius:'8px', border:`1px solid ${accent}40`, background:`${accent}10`, cursor:'pointer', fontSize:'0.72rem', fontWeight:600, color:accent }}>
              <Download size={13}/> Export
            </button>
            <button onClick={onClose} style={{ background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:'50%', width:'32px', height:'32px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', marginLeft:'4px' }}
              onMouseEnter={e=>e.currentTarget.style.background='#e2e8f0'}
              onMouseLeave={e=>e.currentTarget.style.background='#f1f5f9'}>
              <X size={15} color="#475569"/>
            </button>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'28px', scrollbarWidth:'thin', scrollbarColor:'#cbd5e1 transparent' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'32px' }}>

            {/* ── LEFT: Trip Overview ── */}
            <div>
              <SectionHead icon={<TrendingUp size={12}/>}>Trip Overview</SectionHead>
              <StatCards stats={stats} dark={false}/>
              <CategoryBars topCats={stats.topCats} maxCat={stats.maxCat} dark={false}/>
              <BudgetBar stats={stats} dark={false}/>
              <PackingBar stats={stats} dark={false}/>
              <PerCity locations={stats.locations} dark={false}/>
            </div>

            {/* ── RIGHT: Behavioral Analytics ── */}
            <div>
              <SectionHead icon={<Brain size={12}/>}>Behavioral Analytics</SectionHead>

              {savedPlaces.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px 24px', color:'#94a3b8', background:'#f8fafc', borderRadius:'16px', border:'1px dashed #e2e8f0' }}>
                  <Activity size={32} style={{ opacity:0.25, display:'block', margin:'0 auto 12px' }}/>
                  <div style={{ fontSize:'0.85rem', fontWeight:700, color:'#475569', marginBottom:'6px' }}>No saved places yet</div>
                  <div style={{ fontSize:'0.7rem', lineHeight:1.6 }}>Save places across your destinations to unlock your traveler persona and preference charts.</div>
                </div>
              ) : (<>

                {/* Persona */}
                <div style={card(false)}>
                  <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                    <div style={{ background:`${accent}18`, borderRadius:'50%', width:'44px', height:'44px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Sparkles size={20} color={accent}/>
                    </div>
                    <div>
                      <div style={{ fontSize:'0.63rem', textTransform:'uppercase', letterSpacing:'0.06em', color:'#94a3b8', fontWeight:700, marginBottom:'3px' }}>Traveler Persona</div>
                      <div style={{ fontSize:'1.1rem', fontWeight:800, color:'#0f172a' }}>{insights.persona}</div>
                      <div style={{ fontSize:'0.68rem', color:'#64748b', marginTop:'2px' }}>Based on {savedPlaces.length} saved place{savedPlaces.length!==1?'s':''} across all cities</div>
                    </div>
                  </div>
                </div>

                {/* Radar */}
                <div style={card(false)}>
                  <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#0f172a', marginBottom:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                    <Navigation size={13} color="#94a3b8"/> Activity Preference
                  </div>
                  <RadarChart data={insights.radarData} accent={accent} dark={false}/>
                </div>

                {/* Scatter */}
                <div style={card(false)}>
                  <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#0f172a', marginBottom:'3px', display:'flex', alignItems:'center', gap:'6px' }}>
                    <ShieldAlert size={13} color="#94a3b8"/> Source Conflict vs Authority
                  </div>
                  <div style={{ fontSize:'0.63rem', color:'#94a3b8', marginBottom:'12px', lineHeight:1.4 }}>
                    {insights.avgAuthority > 50 ? 'You prefer well-established landmarks.' : 'You prefer highly-debated hidden gems.'}
                  </div>
                  <ScatterPlot data={insights.scatterData} accent={accent} dark={false}/>
                </div>

                {/* Footprint */}
                <div style={card(false)}>
                  <div style={{ fontSize:'0.63rem', textTransform:'uppercase', letterSpacing:'0.06em', color:'#94a3b8', fontWeight:700, marginBottom:'8px' }}>Geographic Footprint</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:'6px' }}>
                    <span style={{ fontSize:'1.6rem', fontWeight:800, color:accent }}>{(savedPlaces.length * 1.4).toFixed(1)}</span>
                    <span style={{ fontSize:'0.8rem', color:'#64748b' }}>km²</span>
                  </div>
                  <div style={{ fontSize:'0.65rem', color:'#94a3b8', marginTop:'3px' }}>Estimated area, <strong style={{color:'#475569'}}>City-Sprawling</strong> style</div>
                </div>

              </>)}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── main panel (dark sidebar) ──────────────────────────────────────────────

export default function AnalyticsPanel({ tripData, setTripData, tripId, activeCity: propActiveCity }) {
  const [expanded, setExpanded] = useState(false);
  const activeCity  = propActiveCity || tripData?.locations?.find(c => c.id === tripData.activeLocationId) || tripData?.locations?.[0];
  const accent      = activeCity ? getCityColor(activeCity.id, tripData.locations) : '#3b82f6';
  const savedPlaces = useMemo(() => (tripData.locations || []).flatMap(loc => loc.places || []), [tripData.locations]);
  const stats       = useMemo(() => buildStats(tripData), [tripData]);
  const insights    = useMemo(() => buildInsights(savedPlaces), [savedPlaces]);
  const T = { bg:'#0f172a', border:'rgba(255,255,255,0.08)', text:'#f8fafc', muted:'rgba(255,255,255,0.45)' };

  if (!activeCity) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:T.muted, fontSize:'0.8rem' }}>No active city selected.</div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:T.bg, color:T.text, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ padding:'14px 16px', background:'rgba(30,41,59,0.7)', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', backdropFilter:'blur(12px)', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:'0.85rem', fontWeight:800, color:T.text, display:'flex', alignItems:'center', gap:'6px' }}>
            <Activity size={15} color={accent}/> Insights
          </div>
          <div style={{ fontSize:'0.62rem', color:T.muted, marginTop:'1px' }}>{activeCity.name.split(',')[0]}</div>
        </div>
        <button onClick={() => setExpanded(true)} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'5px 9px', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', color:T.muted, fontSize:'0.68rem', fontWeight:600 }}>
          <Maximize2 size={12}/> Expand
        </button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px', scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,0.08) transparent' }}>
        <div style={{ fontSize:'0.68rem', fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px', display:'flex', alignItems:'center', gap:'5px' }}>
          <TrendingUp size={11}/> Overview
        </div>
        <StatCards stats={stats} dark={true}/>

        <div style={{ height:'1px', background:'rgba(255,255,255,0.06)', margin:'14px 0' }}/>

        <div style={{ fontSize:'0.68rem', fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px', display:'flex', alignItems:'center', gap:'5px' }}>
          <Brain size={11}/> Analytics
        </div>

        {savedPlaces.length === 0 ? (
          <div style={{ textAlign:'center', padding:'28px 16px', color:T.muted }}>
            <Activity size={26} style={{ opacity:0.2, display:'block', margin:'0 auto 10px' }}/>
            <div style={{ fontSize:'0.8rem', fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:'6px' }}>No saved places yet</div>
            <div style={{ fontSize:'0.68rem', lineHeight:1.6 }}>Save places to unlock your traveler persona.</div>
          </div>
        ) : (<>
          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'12px 14px', marginBottom:'12px', display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ background:`${accent}20`, borderRadius:'50%', width:'36px', height:'36px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Sparkles size={16} color={accent}/>
            </div>
            <div>
              <div style={{ fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.06em', color:T.muted, fontWeight:700 }}>Persona</div>
              <div style={{ fontSize:'0.9rem', fontWeight:800, color:T.text }}>{insights.persona}</div>
            </div>
          </div>
          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'12px 14px' }}>
            <div style={{ fontSize:'0.68rem', fontWeight:700, color:T.muted, marginBottom:'8px' }}>Activity Preference</div>
            <RadarChart data={insights.radarData} accent={accent} dark={true}/>
          </div>
        </>)}
      </div>

      {expanded && (
        <ExpandedModal
          onClose={() => setExpanded(false)}
          tripData={tripData}
          setTripData={setTripData}
          tripId={tripId}
          activeCity={activeCity}
          savedPlaces={savedPlaces}
          stats={stats}
          insights={insights}
          accent={accent}
        />
      )}
    </div>
  );
}
