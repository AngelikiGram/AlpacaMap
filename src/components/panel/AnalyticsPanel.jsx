import { useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Activity, MapPin, Bookmark, CalendarDays, Route, TrendingUp, X, Maximize2, ChevronDown, ChevronUp, Download, Upload } from 'lucide-react';
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
          <div style={{ display:'flex', alignItems:'center', gap:'5px', color:c.color, marginBottom:'4px', fontSize:'0.75rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em' }}>{c.icon}{c.label}</div>
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
      <div style={{ fontSize:'0.75rem', fontWeight:'700', color: dark?'rgba(255,255,255,0.4)':'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}>Saved by type</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
        {topCats.map(([type, count]) => {
          const { icon, color } = getTypeDetails(type);
          const pct = Math.round((count / maxCat) * 100);
          return (
            <div key={type} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ width:'82px', display:'flex', alignItems:'center', gap:'4px', color: dark?'rgba(255,255,255,0.6)':'#475569', fontSize:'0.8rem', flexShrink:0 }}>
                <span style={{ color }}>{icon}</span>{type}
              </div>
              <div style={{ flex:1, background: dark?'rgba(255,255,255,0.08)':'#e2e8f0', borderRadius:'4px', height:'7px', overflow:'hidden' }}>
                <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:'4px', transition:'width 0.4s' }}/>
              </div>
              <div style={{ width:'20px', textAlign:'right', fontSize:'0.8rem', fontWeight:'700', color: dark?'rgba(255,255,255,0.5)':'#64748b', flexShrink:0 }}>{count}</div>
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
      <div style={{ fontSize:'0.75rem', fontWeight:'700', color: dark?'rgba(255,255,255,0.4)':'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px' }}>Budget</div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color: dark?'rgba(255,255,255,0.5)':'#64748b', marginBottom:'5px' }}>
        <span>Spent <strong style={{ color: dark?'#f8fafc':'#0f172a' }}>{stats.budget.currency||'EUR'} {stats.spent.toLocaleString()}</strong></span>
        <span>Total <strong style={{ color: dark?'#f8fafc':'#0f172a' }}>{stats.budget.currency||'EUR'} {stats.budgetTotal.toLocaleString()}</strong></span>
      </div>
      <div style={{ background: dark?'rgba(255,255,255,0.08)':'#e2e8f0', borderRadius:'4px', height:'7px', overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:barColor, borderRadius:'4px', transition:'width 0.4s' }}/>
      </div>
      <div style={{ fontSize:'0.75rem', color: dark?'rgba(255,255,255,0.4)':'#94a3b8', marginTop:'3px', textAlign:'right' }}>{pct}% used</div>
    </div>
  );
}

function PackingBar({ stats, dark }) {
  if (!stats.packingTotal) return null;
  const pct = Math.round((stats.packingDone / stats.packingTotal) * 100);
  return (
    <div style={{ marginBottom:'18px' }}>
      <div style={{ fontSize:'0.75rem', fontWeight:'700', color: dark?'rgba(255,255,255,0.4)':'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px' }}>Packing</div>
      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
        <div style={{ flex:1, background: dark?'rgba(255,255,255,0.08)':'#e2e8f0', borderRadius:'4px', height:'7px', overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%', background:'#10b981', borderRadius:'4px', transition:'width 0.4s' }}/>
        </div>
        <span style={{ fontSize:'0.8rem', color: dark?'rgba(255,255,255,0.5)':'#64748b', flexShrink:0 }}>{stats.packingDone}/{stats.packingTotal}</span>
      </div>
    </div>
  );
}

function PerCity({ locations, dark }) {
  const [openId, setOpenId] = useState(null);
  if (!locations.length) return null;
  return (
    <div style={{ marginBottom:'4px' }}>
      <div style={{ fontSize:'0.75rem', fontWeight:'700', color: dark?'rgba(255,255,255,0.4)':'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}>Per destination</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
        {locations.map((loc) => {
          const isOpen = openId === loc.id;
          const cc = {};
          (loc.places||[]).forEach(p => { cc[p.type] = (cc[p.type]||0)+1; });
          const topLC = Object.entries(cc).sort((a,b)=>b[1]-a[1]).slice(0,5);
          return (
            <div key={loc.id} style={{ background: dark?'rgba(255,255,255,0.03)':'#f8fafc', border: dark?`1px solid ${isOpen?'rgba(99,102,241,0.35)':'rgba(255,255,255,0.07)'}`:`1px solid ${isOpen?'#a5b4fc':'#e2e8f0'}`, borderRadius:'8px', overflow:'hidden' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', cursor:'pointer' }} onClick={()=>setOpenId(isOpen?null:loc.id)}>
                <span style={{ fontSize:'0.85rem', fontWeight:'600', color: dark?'#f8fafc':'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, minWidth:0 }}>{loc.name.split(',')[0]}</span>
                <div style={{ display:'flex', gap:'8px', flexShrink:0, marginLeft:'8px', alignItems:'center' }}>
                  <span style={{ fontSize:'0.75rem', color: dark?'rgba(255,255,255,0.45)':'#64748b' }}><strong style={{ color: dark?'#f8fafc':'#0f172a' }}>{(loc.places||[]).length}</strong> saved</span>
                  {isOpen ? <ChevronUp size={12} color={dark?'rgba(255,255,255,0.4)':'#94a3b8'}/> : <ChevronDown size={12} color={dark?'rgba(255,255,255,0.4)':'#94a3b8'}/>}
                </div>
              </div>
              {isOpen && topLC.length > 0 && (
                <div style={{ padding:'6px 10px 10px', borderTop: dark?'1px solid rgba(255,255,255,0.05)':'1px solid #e2e8f0', background: dark?'rgba(0,0,0,0.15)':'#fff' }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                    {topLC.map(([type, count]) => { const {icon,color} = getTypeDetails(type); return (
                      <div key={type} style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'0.75rem', background: dark?'rgba(255,255,255,0.06)':'#f1f5f9', borderRadius:'5px', padding:'2px 6px' }}>
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

function ExpandedModal({ onClose, tripData, setTripData, tripId, stats, accent }) {
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
    <div style={{ display:'flex', alignItems:'center', gap:'7px', fontSize:'0.75rem', fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'16px' }}>
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
              <div style={{ fontSize:'0.8rem', color:'#94a3b8', marginTop:'1px' }}>{tripData.name || tripData.title || 'Trip'} · {stats.locations.length} destination{stats.locations.length!==1?'s':''}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <input ref={importRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleImport}/>
            <button onClick={() => importRef.current?.click()} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 12px', borderRadius:'8px', border:'1px solid #e2e8f0', background:'#f8fafc', cursor:'pointer', fontSize:'0.8rem', fontWeight:600, color:'#475569' }}>
              <Upload size={13}/> Import
            </button>
            <button onClick={() => exportTrip(tripData, tripId)} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 12px', borderRadius:'8px', border:`1px solid ${accent}40`, background:`${accent}10`, cursor:'pointer', fontSize:'0.8rem', fontWeight:600, color:accent }}>
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
          <div style={{ maxWidth:'560px' }}>

            {/* ── LEFT: Trip Overview ── */}
            <div>
              <SectionHead icon={<TrendingUp size={12}/>}>Trip Overview</SectionHead>
              <StatCards stats={stats} dark={false}/>
              <CategoryBars topCats={stats.topCats} maxCat={stats.maxCat} dark={false}/>
              <BudgetBar stats={stats} dark={false}/>
              <PackingBar stats={stats} dark={false}/>
              <PerCity locations={stats.locations} dark={false}/>
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
  const T = { bg:'#0f172a', border:'rgba(255,255,255,0.08)', text:'#f8fafc', muted:'rgba(255,255,255,0.45)' };

  if (!activeCity) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:T.muted, fontSize:'0.9rem' }}>No active city selected.</div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:T.bg, color:T.text, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ padding:'14px 16px', background:'rgba(30,41,59,0.7)', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', backdropFilter:'blur(12px)', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:'0.9rem', fontWeight:800, color:T.text, display:'flex', alignItems:'center', gap:'6px' }}>
            <Activity size={15} color={accent}/> Insights
          </div>
          <div style={{ fontSize:'0.75rem', color:T.muted, marginTop:'1px' }}>{activeCity.name.split(',')[0]}</div>
        </div>
        <button onClick={() => setExpanded(true)} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'5px 9px', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', color:T.muted, fontSize:'0.75rem', fontWeight:600 }}>
          <Maximize2 size={12}/> Expand
        </button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px', scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,0.08) transparent' }}>
        <div style={{ fontSize:'0.75rem', fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px', display:'flex', alignItems:'center', gap:'5px' }}>
          <TrendingUp size={11}/> Overview
        </div>
        <StatCards stats={stats} dark={true}/>
        <CategoryBars topCats={stats.topCats} maxCat={stats.maxCat} dark={true}/>

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
          accent={accent}
        />
      )}
    </div>
  );
}
