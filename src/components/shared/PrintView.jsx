import { getCityColor } from '../../utils.jsx';
import { Utensils, Coffee, Landmark, TreePine, ShoppingBag, Camera, MountainSnow, Castle, Bed, Activity, Bus, MapPin, BookOpen, Building, Palette, Wine, Calendar as CalendarIcon, FileText } from 'lucide-react';

const TYPE_GLYPH = {
  restaurant: <Utensils size={16} style={{verticalAlign:'middle'}}/>,
  cafe: <Coffee size={16} style={{verticalAlign:'middle'}}/>,
  bar: <Wine size={16} style={{verticalAlign:'middle'}}/>,
  pub: <Wine size={16} style={{verticalAlign:'middle'}}/>,
  museum: <BookOpen size={16} style={{verticalAlign:'middle'}}/>,
  gallery: <Palette size={16} style={{verticalAlign:'middle'}}/>,
  attraction: <Landmark size={16} style={{verticalAlign:'middle'}}/>,
  entertainment: <Activity size={16} style={{verticalAlign:'middle'}}/>,
  park: <TreePine size={16} style={{verticalAlign:'middle'}}/>,
  nature: <TreePine size={16} style={{verticalAlign:'middle'}}/>,
  beach: <Camera size={16} style={{verticalAlign:'middle'}}/>,
  mountain: <MountainSnow size={16} style={{verticalAlign:'middle'}}/>,
  hiking: <Activity size={16} style={{verticalAlign:'middle'}}/>,
  hotel: <Bed size={16} style={{verticalAlign:'middle'}}/>,
  hostel: <Bed size={16} style={{verticalAlign:'middle'}}/>,
  shopping: <ShoppingBag size={16} style={{verticalAlign:'middle'}}/>,
  market: <ShoppingBag size={16} style={{verticalAlign:'middle'}}/>,
  landmark: <Landmark size={16} style={{verticalAlign:'middle'}}/>,
  monument: <Landmark size={16} style={{verticalAlign:'middle'}}/>,
  church: <Landmark size={16} style={{verticalAlign:'middle'}}/>,
  castle: <Castle size={16} style={{verticalAlign:'middle'}}/>,
  hospital: <Building size={16} style={{verticalAlign:'middle'}}/>,
  transport: <Bus size={16} style={{verticalAlign:'middle'}}/>,
  custom: <MapPin size={16} style={{verticalAlign:'middle'}}/>,
};
const placeGlyph = type => TYPE_GLYPH[type?.toLowerCase()] || <MapPin size={16} style={{verticalAlign:'middle'}}/>;

export const PrintView = ({ tripData }) => {
  const { locations = [], itinerary = [], budget } = tripData;
  const totalPlaces = locations.reduce((n, l) => n + (l.places?.length || 0), 0);
  const notesCount = locations.reduce((n, l) => n + l.places.filter(p => p.notes).length, 0);

  const h2 = { fontFamily:"'Outfit',Georgia,serif", fontSize:'1.3rem', fontWeight:'800', color:'#1e293b', borderBottom:'2px solid #e2e8f0', paddingBottom:'0.5rem', marginBottom:'1.25rem', marginTop:'2.5rem', letterSpacing:'-0.01em' };

  return (
    <div className="print-view" style={{ fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif", color:'#0f172a', maxWidth:'920px', margin:'0 auto', padding:'3rem 2.5rem', background:'#fff', lineHeight:1.5 }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ textAlign:'center', marginBottom:'2.5rem', paddingBottom:'2rem', borderBottom:'3px solid #e2e8f0' }}>
        <div style={{ fontSize:'0.75rem', letterSpacing:'0.3em', textTransform:'uppercase', color:'#94a3b8', marginBottom:'0.75rem', fontWeight:'700' }}>TRAVEL ITINERARY</div>
        <h1 style={{ fontFamily:"'Outfit',Georgia,serif", fontSize:'3rem', fontWeight:'800', color:'#0f172a', margin:'0 0 1rem', letterSpacing:'-0.04em' }}>{tripData.title}</h1>
        <div style={{ display:'flex', justifyContent:'center', flexWrap:'wrap', gap:'1.25rem', color:'#64748b', fontSize:'0.9rem', fontWeight:'500' }}>
          {locations.length > 0 && <span style={{display:'flex', alignItems:'center', gap:'4px'}}><MapPin size={14} color="#ef4444"/> {locations.length} Destination{locations.length !== 1 ? 's' : ''}</span>}
          {totalPlaces > 0 && <span style={{display:'flex', alignItems:'center', gap:'4px'}}><Building size={14} color="#10b981"/> {totalPlaces} Saved Place{totalPlaces !== 1 ? 's' : ''}</span>}
          {itinerary.length > 0 && <span style={{display:'flex', alignItems:'center', gap:'4px'}}><CalendarIcon size={14} color="#f59e0b"/> {itinerary.length} Day{itinerary.length !== 1 ? 's' : ''}</span>}
          {notesCount > 0 && <span style={{display:'flex', alignItems:'center', gap:'4px'}}><FileText size={14} color="#8b5cf6"/> {notesCount} Note{notesCount !== 1 ? 's' : ''}</span>}
        </div>
      </div>

      {/* ── Saved Places by Destination ────────────────────────── */}
      {locations.length > 0 && (
        <div>
          <h2 style={h2}>Saved Places</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))', gap:'2rem' }}>
            {locations.map(loc => {
              const cityColor = getCityColor(loc.id, locations);
              return (
                <div key={loc.id} style={{ pageBreakInside:'avoid', breakInside:'avoid' }}>
                  <div style={{ marginBottom:'0.85rem' }}>
                    <div style={{ fontFamily:"'Outfit',Georgia,serif", fontSize:'1.05rem', fontWeight:'800', color:cityColor }}>{loc.name.split(',')[0]}</div>
                    <div style={{ fontSize:'0.75rem', color:'#94a3b8', marginTop:'1px' }}>{loc.name}</div>
                  </div>
                  {loc.places && loc.places.length > 0 ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
                      {loc.places.map(p => (
                        <div key={p.id} style={{ padding:'8px 10px', border:'1px solid #e2e8f0', borderRadius:'8px', background:'#fafafa' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
                            <div style={{ fontWeight:'600', fontSize:'0.9rem', color:'#1e293b', display:'flex', alignItems:'center', gap:'6px' }}>{placeGlyph(p.type)} {p.name}</div>
                            <span style={{ fontSize:'0.75rem', color:'#94a3b8', flexShrink:0, textTransform:'capitalize', marginTop:'2px' }}>{p.type || ''}</span>
                          </div>
                          {p.address && <div style={{ fontSize:'0.8rem', color:'#64748b', marginTop:'2px' }}>{p.address}</div>}
                          {p.notes && (
                            <div style={{ marginTop:'6px', padding:'5px 8px', background:'#f1f5f9', borderRadius:'5px', fontSize:'0.85rem', color:'#334155' }}>
                              {p.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color:'#aaa', fontStyle:'italic', margin:0, fontSize:'0.9rem' }}>No places saved.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Daily Itinerary ──────────────────────────────────────── */}
      {itinerary.length > 0 && (
        <div style={{ pageBreakBefore:'always' }}>
          <h2 style={h2}>Daily Itinerary</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
            {itinerary.map((day, di) => (
              <div key={day.id} style={{ pageBreakInside:'avoid', breakInside:'avoid', border:'1px solid #e2e8f0', borderRadius:'10px', overflow:'hidden' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'10px 14px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  <div style={{ background:'#3b82f6', color:'white', borderRadius:'7px', padding:'3px 10px', fontSize:'0.8rem', fontWeight:'700', whiteSpace:'nowrap' }}>
                    {day.date || `Day ${di + 1}`}
                  </div>
                  {day.location && <div style={{ color:'#64748b', fontSize:'0.9rem', fontWeight:'500' }}>{day.location}</div>}
                </div>
                <div style={{ padding:'10px 14px' }}>
                  {day.events && day.events.length > 0 ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                      {day.events.map(ev => (
                        <div key={ev.id} style={{ display:'flex', gap:'1rem', alignItems:'flex-start', padding:'4px 0', borderBottom:'1px solid #f1f5f9' }}>
                          <span style={{ minWidth:'55px', fontSize:'0.8rem', color:'#64748b', fontWeight:'600', paddingTop:'1px' }}>{ev.time}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:'600', fontSize:'0.9rem', color:'#1e293b' }}>{ev.title}</div>
                            {ev.notes && <div style={{ fontSize:'0.8rem', color:'#64748b', marginTop:'2px' }}>{ev.notes}</div>}
                          </div>
                          <span style={{ fontSize:'0.75rem', color:'#94a3b8', textTransform:'capitalize', flexShrink:0, paddingTop:'1px' }}>{ev.type}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color:'#aaa', fontStyle:'italic', fontSize:'0.85rem' }}>No events scheduled</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Budget ──────────────────────────────────────────────── */}
      {budget?.total > 0 && (
        <div style={{ pageBreakInside:'avoid', marginTop:'2rem' }}>
          <h2 style={h2}>Budget</h2>
          <div style={{ display:'flex', gap:'2.5rem', fontSize:'0.9rem', color:'#334155' }}>
            <div><strong>Total:</strong> {budget.currency} {budget.total.toLocaleString()}</div>
            {budget.expenses?.length > 0 && (
              <div><strong>Spent:</strong> {budget.currency} {budget.expenses.reduce((s,e)=>s+(e.amount||0),0).toLocaleString()}</div>
            )}
          </div>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div style={{ marginTop:'3rem', paddingTop:'1rem', borderTop:'1px solid #e2e8f0', textAlign:'center', fontSize:'0.75rem', color:'#cbd5e1', letterSpacing:'0.05em' }}>
        CREATED WITH ALPACAMAP
      </div>
    </div>
  );
};
