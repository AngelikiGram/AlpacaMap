import { useMemo, useState } from 'react';
import { MapPin, Bookmark, CalendarDays, Route, TrendingUp, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { getTypeDetails, getDistanceKm } from '../../utils.jsx';

export const CoherencePanel = ({ tripData }) => {
  const [selectedCityId, setSelectedCityId] = useState(null);

  const stats = useMemo(() => {
    const locations = tripData.locations || [];
    const itinerary = tripData.itinerary || [];
    const budget = tripData.budget || {};
    const packing = tripData.packing || [];

    const totalPlaces = locations.reduce((n, c) => n + c.places.length, 0);
    const totalDays = itinerary.length;
    const activeDays = itinerary.filter(d => d.events?.length > 0).length;

    // Category breakdown of saved places
    const catCounts = {};
    for (const loc of locations) {
      if (selectedCityId && loc.id !== selectedCityId) continue;
      for (const p of loc.places) {
        catCounts[p.type] = (catCounts[p.type] || 0) + 1;
      }
    }
    const topCats = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const maxCat = topCats[0]?.[1] || 1;

    // Route distance
    let totalKm = 0;
    for (let i = 1; i < locations.length; i++) {
      const a = locations[i - 1], b = locations[i];
      if (a.coords && b.coords)
        totalKm += getDistanceKm(a.coords[0], a.coords[1], b.coords[0], b.coords[1]);
    }

    // Budget
    const spent = (budget.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
    const budgetTotal = budget.total || 0;
    const budgetPct = budgetTotal > 0 ? Math.min(100, Math.round((spent / budgetTotal) * 100)) : null;

    // Packing completion
    const packingDone = packing.filter(p => p.packed).length;
    const packingTotal = packing.length;

    return { locations, totalPlaces, totalDays, activeDays, topCats, maxCat, totalKm, spent, budgetTotal, budgetPct, packingDone, packingTotal, budget };
  }, [tripData, selectedCityId]);

  const { locations, totalPlaces, totalDays, activeDays, topCats, maxCat, totalKm, spent, budgetTotal, budgetPct, packingDone, packingTotal, budget } = stats;

  const cards = [
    { icon: <MapPin size={14}/>, label: 'Destinations', value: locations.length, color: '#3b82f6' },
    { icon: <Bookmark size={14}/>, label: 'Saved places', value: totalPlaces, color: '#8b5cf6' },
    { icon: <CalendarDays size={14}/>, label: 'Days planned', value: totalDays > 0 ? `${activeDays} / ${totalDays}` : '-', color: '#10b981' },
    { icon: <Route size={14}/>, label: 'Total distance', value: totalKm > 0 ? `${Math.round(totalKm).toLocaleString()} km` : '-', color: '#f59e0b' },
  ];

  return (
    <div style={{ fontSize:'0.82rem' }}>
      <div style={{ fontWeight:'700', fontSize:'0.88rem', marginBottom:'0.9rem', display:'flex', alignItems:'center', gap:'6px', color:'var(--text-primary)' }}>
        <TrendingUp size={15} style={{ color:'var(--accent-primary)' }}/> Trip Overview
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'1.1rem' }}>
        {cards.map(c => (
          <div key={c.label} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', padding:'10px 12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'5px', color:c.color, marginBottom:'4px', fontSize:'0.68rem', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.06em' }}>
              {c.icon}{c.label}
            </div>
            <div style={{ fontSize:'1.15rem', fontWeight:'700', color:'var(--text-primary)' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Saved places by category */}
      {topCats.length > 0 && (
        <div style={{ marginBottom:'1.1rem' }}>
          <div style={{ fontSize:'0.7rem', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.55rem' }}>Saved places by type</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {topCats.map(([type, count]) => {
              const { icon, color } = getTypeDetails(type);
              const pct = Math.round((count / maxCat) * 100);
              return (
                <div key={type} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ width:'90px', display:'flex', alignItems:'center', gap:'4px', color:'var(--text-secondary)', fontSize:'0.72rem', flexShrink:0 }}>
                    <span style={{ color }}>{icon}</span>{type}
                  </div>
                  <div style={{ flex:1, background:'rgba(255,255,255,0.06)', borderRadius:'4px', height:'6px', overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:'4px', transition:'width 0.4s ease' }}/>
                  </div>
                  <div style={{ width:'20px', textAlign:'right', fontSize:'0.7rem', color:'var(--text-secondary)', flexShrink:0 }}>{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Budget bar */}
      {budgetTotal > 0 && (
        <div style={{ marginBottom:'1.1rem' }}>
          <div style={{ fontSize:'0.7rem', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.55rem' }}>Budget</div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:'var(--text-secondary)', marginBottom:'5px' }}>
            <span>Spent: <strong style={{ color:'var(--text-primary)' }}>{budget.currency || 'USD'} {spent.toLocaleString()}</strong></span>
            <span>Total: <strong style={{ color:'var(--text-primary)' }}>{budget.currency || 'USD'} {budgetTotal.toLocaleString()}</strong></span>
          </div>
          <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:'4px', height:'7px', overflow:'hidden' }}>
            <div style={{ width:`${budgetPct}%`, height:'100%', background: budgetPct > 90 ? 'var(--danger)' : budgetPct > 70 ? 'var(--warning)' : 'var(--success)', borderRadius:'4px', transition:'width 0.4s ease' }}/>
          </div>
          <div style={{ fontSize:'0.68rem', color:'var(--text-secondary)', marginTop:'4px', textAlign:'right' }}>{budgetPct}% used</div>
        </div>
      )}

      {/* Packing */}
      {packingTotal > 0 && (
        <div style={{ marginBottom:'1.1rem' }}>
          <div style={{ fontSize:'0.7rem', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.55rem' }}>Packing</div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ flex:1, background:'rgba(255,255,255,0.06)', borderRadius:'4px', height:'7px', overflow:'hidden' }}>
              <div style={{ width:`${Math.round((packingDone/packingTotal)*100)}%`, height:'100%', background:'var(--success)', borderRadius:'4px', transition:'width 0.4s ease' }}/>
            </div>
            <span style={{ fontSize:'0.72rem', color:'var(--text-secondary)', flexShrink:0 }}>{packingDone}/{packingTotal} packed</span>
          </div>
        </div>
      )}

      {/* Per-city breakdown */}
      {locations.length > 0 && (
        <div>
          <div style={{ fontSize:'0.7rem', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.55rem' }}>Per destination</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {locations.map((loc, idx) => {
              const isExpanded = selectedCityId === loc.id;
              const notesCount = loc.places.filter(p => p.notes).length;
              const nextLoc = idx < locations.length - 1 ? locations[idx + 1] : null;
              const distToNext = nextLoc && loc.coords && nextLoc.coords
                ? Math.round(getDistanceKm(loc.coords[0], loc.coords[1], nextLoc.coords[0], nextLoc.coords[1]))
                : 0;
              const catCounts = {};
              loc.places.forEach(p => { catCounts[p.type] = (catCounts[p.type] || 0) + 1; });
              const topLocCats = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
              return (
                <div key={loc.id} style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${isExpanded ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)'}`, borderRadius:'8px', overflow:'hidden' }}>
                  <div
                    style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', cursor:'pointer' }}
                    onClick={() => setSelectedCityId(isExpanded ? null : loc.id)}
                  >
                    <span style={{ fontSize:'0.78rem', fontWeight:'600', color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, minWidth:0 }}>{loc.name.split(',')[0]}</span>
                    <div style={{ display:'flex', gap:'8px', flexShrink:0, marginLeft:'8px', alignItems:'center' }}>
                      <span style={{ fontSize:'0.68rem', color:'var(--text-secondary)' }}><strong style={{ color:'var(--text-primary)' }}>{loc.places.length}</strong> saved</span>
                      {notesCount > 0 && <span style={{ fontSize:'0.65rem', color:'var(--accent-primary)', display:'flex', alignItems:'center', gap:'2px' }}><FileText size={10}/>{notesCount}</span>}
                      {isExpanded ? <ChevronUp size={12} color="var(--text-secondary)"/> : <ChevronDown size={12} color="var(--text-secondary)"/>}
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ padding:'8px 10px 10px', borderTop:'1px solid rgba(255,255,255,0.05)', background:'rgba(0,0,0,0.15)' }}>
                      {topLocCats.length > 0 && (
                        <div style={{ marginBottom:'8px' }}>
                          <div style={{ fontSize:'0.63rem', color:'var(--text-secondary)', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'5px' }}>By type</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                            {topLocCats.map(([type, count]) => {
                              const { icon, color } = getTypeDetails(type);
                              return (
                                <div key={type} style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'0.65rem', background:'rgba(255,255,255,0.05)', borderRadius:'5px', padding:'2px 6px' }}>
                                  <span style={{ color }}>{icon}</span>
                                  <span style={{ color:'var(--text-secondary)' }}>{type}</span>
                                  <span style={{ color:'var(--text-primary)', fontWeight:'700' }}>{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div style={{ display:'flex', gap:'12px', fontSize:'0.68rem' }}>
                        {notesCount > 0 && (
                          <span style={{ color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:'3px' }}><FileText size={10}/> <strong style={{ color:'var(--text-primary)' }}>{notesCount}</strong> note{notesCount>1?'s':''}</span>
                        )}
                        {loc.recommendations?.length > 0 && (
                          <span style={{ color:'var(--text-secondary)' }}><strong style={{ color:'var(--accent-primary)' }}>{loc.recommendations.length}</strong> nearby suggestions</span>
                        )}
                        {distToNext > 0 && (
                          <span style={{ color:'var(--text-secondary)' }}>→ next: <strong style={{ color:'var(--text-primary)' }}>~{distToNext} km</strong></span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalPlaces === 0 && locations.length === 0 && (
        <div style={{ textAlign:'center', padding:'2rem 1rem', color:'var(--text-secondary)', fontSize:'0.78rem', lineHeight:1.7 }}>
          Add destinations and save places to see your trip summary here.
        </div>
      )}
    </div>
  );
};
