import { useState, useEffect, useMemo } from 'react';
import EvidenceBadge from './EvidenceBadge';
import { buildPlaceEvidence, findEvidence } from '../../knowledge/evidence';
import { pickDisputePair, disputeHeadline, sourceLabel } from '../../knowledge/controversy';
import { QUICK_REPORTS, quickReport, reportsFor } from '../../knowledge/travellerReports';


import { MapPin, Route, Plus, Loader2, X, ExternalLink, Clock, Phone, Globe, Accessibility, Star, Brain } from 'lucide-react';


import { getTypeDetails } from "../../utils.jsx";
import { PhotoCredit } from "./PhotoCredit.jsx";

import { WeatherWidget } from "./WeatherWidget.jsx";

const GENERIC_WORDS = new Set([
  'solo', 'travel', 'traveller', 'travellers', 'trip', 'trips', 'cafe', 'cafes', 'coffee', 'restaurant', 'restaurants', 
  'bar', 'bars', 'pub', 'pubs', 'hotel', 'hotels', 'hostel', 'hostels', 'transport', 'bus', 'buses', 'train', 'trains', 
  'metro', 'tube', 'station', 'stations', 'airport', 'airports', 'shop', 'shops', 'market', 'markets', 'park', 'parks', 
  'street', 'road', 'food', 'drink', 'drinks', 'eating', 'dining', 'lunch', 'dinner', 'breakfast', 'museum', 'museums', 
  'gallery', 'galleries', 'sight', 'sights', 'view', 'views', 'viewpoint', 'viewpoints', 'city', 'town', 'village', 
  'place', 'places', 'location', 'locations', 'area', 'areas', 'district', 'districts', 'neighborhood', 'neighborhoods', 
  'neighbourhood', 'neighbourhoods'
]);

const isGenericWord = (name) => {
  return GENERIC_WORDS.has(name.toLowerCase().trim());
};

const isWordMatch = (name1, name2) => {
  if (name1 === name2) return true;
  const w1 = name1.split(/\s+/);
  const w2 = name2.split(/\s+/);
  if (w1.length === 1) return w2.includes(w1[0]);
  if (w2.length === 1) return w1.includes(w2[0]);
  return name1.includes(name2) || name2.includes(name1);
};

export const cleanNameForMatching = (name) => {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/^(the|a|an)\s+/g, '')
    .replace(/\s+(station|tube station|underground station|museum|gallery|park)$/g, '')
    .trim();
};

export const InfoWindow = ({ place, isLoading, onClose, onAdd, canAdd, onAddToActiveRoute, knowledgeGraphNodes = [], knowledgeGraphVerified = null, allCityNames = [], onAddStatement, tripDates = [] }) => {
  const [justReported, setJustReported] = useState(null);
  useEffect(() => { setJustReported(null); }, [place?.name]);
  const cityNamesSet = useMemo(() => {
    return new Set(allCityNames.map(name => name.toLowerCase().trim()));
  }, [allCityNames]);

  const placeEvidence = useMemo(() => {
    if (!knowledgeGraphNodes?.length || !place?.name || place.isCity) return null;
    return findEvidence(place.name, buildPlaceEvidence(knowledgeGraphNodes, knowledgeGraphVerified, { cityNames: allCityNames }));
  }, [knowledgeGraphNodes, knowledgeGraphVerified, place?.name, place?.isCity, allCityNames]);

  // The most telling disagreement about this place, shown up front
  const dispute = useMemo(() => {
    if (!placeEvidence) return null;
    const pair = pickDisputePair(placeEvidence);
    return pair ? { ...pair, headline: disputeHeadline(placeEvidence, pair) } : null;
  }, [placeEvidence]);
  const myReports = useMemo(() => reportsFor(knowledgeGraphNodes, place?.name), [knowledgeGraphNodes, place?.name]);
  const report = (id) => {
    // A report made during the trip uses today's date (season/weekday conditions); before the trip, the trip's first day
    const today = new Date().toISOString().slice(0, 10);
    const when = tripDates.length && tripDates.every((d) => d > today) ? new Date(`${[...tripDates].sort()[0]}T12:00:00`) : new Date();
    const node = quickReport(id, place.name, allCityNames[0] || null, when);
    if (node) { onAddStatement?.(node); setJustReported(id); }
  };

  const kgInsights = useMemo(() => {
    if (!knowledgeGraphNodes || !place?.name) return [];
    const pName = place.name.toLowerCase().trim();
    const filtered = knowledgeGraphNodes.filter(n => {
      if (!n.place) return false;
      const nPlace = n.place.toLowerCase().trim();
      
      // If the claim's place is a general city name, only show it if the current place is a city
      if (cityNamesSet.has(nPlace)) {
        return place.isCity && (nPlace === pName || pName.includes(nPlace) || nPlace.includes(pName));
      }
      
      // Otherwise, do name matching
      const cleanN = cleanNameForMatching(nPlace);
      const cleanP = cleanNameForMatching(pName);
      if (cleanN.length > 2) {
        if (cleanN === cleanP) return true;
        if (!isGenericWord(cleanN) && !isGenericWord(cleanP)) {
          if (isWordMatch(cleanN, cleanP)) return true;
        }
      }
      return false;
    });

    // Deduplicate identical claims
    const seen = new Set();
    return filtered.filter(n => {
      if (!n.claim) return false;
      const key = n.claim.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [knowledgeGraphNodes, place?.name, cityNamesSet]);

  return (
    <div className="info-window">
      <div className="info-window-header">
        <div style={{flex:1,minWidth:0}}>
          <h3 style={{fontSize:'1.05rem',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{place.name}</h3>
          {!isLoading&&place.rating&&(
            <div style={{display:'flex',gap:'0.5rem',fontSize:'0.78rem',color:'var(--text-secondary)',marginTop:'0.2rem',flexWrap:'wrap'}}>
              <span style={{display:'flex', alignItems:'center', gap:'3px'}}>{place.rating} <Star size={11} color="#facc15" fill="#facc15"/> ({Number(place.reviewsCount||0).toLocaleString()} reviews)</span>
              {place.priceRange&&<><span>·</span><span style={{color:'var(--success)'}}>{place.priceRange}</span></>}
              <span>· <span style={{textTransform:'capitalize'}}>{place.type}</span></span>
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:'0.4rem',alignItems:'center',flexShrink:0}}>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`} target="_blank" rel="noreferrer" className="btn-icon"><ExternalLink size={14}/></a>
          <button className="info-window-close" onClick={onClose}><X size={14}/></button>
        </div>
      </div>
      <div className="info-window-body">
        {isLoading?(
          <div style={{display:'flex',flexDirection:'column',gap:'1rem',alignItems:'center',justifyContent:'center',height:'180px',color:'var(--text-secondary)'}}>
            <Loader2 size={28} className="spin"/>
            <p style={{fontSize:'0.85rem'}}>Fetching place info…</p>
          </div>
        ):(
          <>
            <div style={{marginBottom:'1rem',height:'180px',overflow:'hidden',borderRadius:'var(--radius-md)'}}>
              {place.heroImage ? (
                <img src={place.heroImage} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} alt={place.name}
                  onError={e=>{
                    e.target.style.display='none';
                    const pColor = getTypeDetails(place.type).color;
                    e.target.parentNode.style.background=`linear-gradient(135deg,${pColor}30,${pColor}10)`;
                  }}/>
              ) : (() => {
                const { icon: pIcon, color: pColor } = getTypeDetails(place.type);
                return (
                  <div style={{width:'100%',height:'100%',background:`linear-gradient(135deg,${pColor}30,${pColor}10)`,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'8px'}}>
                    <div style={{color:pColor,opacity:0.6,transform:'scale(2.5)'}}>{pIcon}</div>
                    <span style={{color:'var(--text-secondary)',fontSize:'0.7rem',textTransform:'capitalize'}}>{place.type}</span>
                  </div>
                );
              })()}
            </div>
            {place.heroImage && <div style={{marginTop:'-0.75rem',marginBottom:'1rem'}}><PhotoCredit url={place.heroImage}/></div>}
            {place.isCity && <WeatherWidget coords={place.coords}/>}
            {place.highlights?.length>0&&(
              <div className="highlights-box">
                <h4 style={{fontSize:'0.85rem',marginBottom:'0.6rem'}}>Highlights</h4>
                <ul style={{margin:0,paddingLeft:'1.1rem',color:'var(--text-secondary)',fontSize:'0.8rem',lineHeight:'1.6'}}>
                  {place.highlights.map((h,i)=><li key={i}>{h}</li>)}
                </ul>
              </div>
            )}
            {/* Rich OSM data */}
            {place.osmTags&&(place.osmTags.address||place.osmTags.hours||place.osmTags.phone||place.osmTags.website||place.osmTags.cuisine)&&(
              <div className="osm-details">
                {place.osmTags.address&&(
                  <div className="osm-row"><MapPin size={12} color="var(--accent-primary)"/><span>{place.osmTags.address}</span></div>
                )}
                {place.osmTags.cuisine&&(
                  <div className="osm-row"><span style={{fontSize:'0.8rem',fontWeight:'500',color:'var(--text-secondary)'}}>Cuisine</span><span>{place.osmTags.cuisine}</span></div>
                )}
                {place.osmTags.hours&&(
                  <div className="osm-row"><Clock size={12} color="var(--accent-primary)"/><span style={{fontFamily:'monospace',fontSize:'0.75rem'}}>{place.osmTags.hours}</span></div>
                )}
                {place.osmTags.phone&&(
                  <div className="osm-row"><Phone size={12} color="var(--accent-primary)"/><a href={`tel:${place.osmTags.phone}`} style={{color:'var(--accent-primary)',textDecoration:'none'}}>{place.osmTags.phone}</a></div>
                )}
                {place.osmTags.website&&(
                  <div className="osm-row"><Globe size={12} color="var(--accent-primary)"/>
                    <a href={place.osmTags.website.startsWith('http')?place.osmTags.website:`https://${place.osmTags.website}`} target="_blank" rel="noreferrer" style={{color:'var(--accent-primary)',textDecoration:'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {place.osmTags.website.replace(/^https?:\/\//,'').split('/')[0]}
                    </a>
                  </div>
                )}
                {place.osmTags.wheelchair&&place.osmTags.wheelchair!=='no'&&(
                  <div className="osm-row"><Accessibility size={12} color="var(--success)"/><span style={{color:'var(--success)',fontSize:'0.78rem'}}>Wheelchair accessible</span></div>
                )}
                {place.osmTags.fee&&(
                  <div className="osm-row"><span style={{fontSize:'0.75rem',color:'var(--text-secondary)'}}>Fee</span><span style={{fontSize:'0.78rem'}}>{place.osmTags.fee}</span></div>
                )}
              </div>
            )}

            {place.extract&&<p style={{color:'var(--text-secondary)',fontSize:'0.8rem',lineHeight:'1.7',marginBottom:'1.1rem'}}>{place.extract}</p>}

            {placeEvidence && placeEvidence.level !== 'solid' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.8rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <EvidenceBadge evidence={placeEvidence} /> <span>{placeEvidence.statements} statements from {placeEvidence.sources.length} source{placeEvidence.sources.length === 1 ? '' : 's'}</span>
              </div>
            )}

            {dispute && (
              <div className={`iw-dispute ${dispute.verified ? 'verified' : ''}`}>
                <div className="iw-dispute-head">⚖️ <b>{dispute.headline}</b><span>{dispute.verified ? 'checked by the in-browser model' : 'tone differs, not yet checked'}</span></div>
                <div className="iw-side pos">“{dispute.a}” <cite>{sourceLabel(dispute.aSource)}</cite></div>
                <div className="iw-side neg">“{dispute.b}” <cite>{sourceLabel(dispute.bSource)}</cite></div>
                {dispute.condition && <div className="iw-cond">→ {dispute.condition}</div>}
              </div>
            )}

            {onAddStatement && !place.isCity && (
              <div className="iw-report">
                <div className="iw-report-q">Been here? Tell the alpaca 🦙 <span>your answer becomes a source (reliability 1.0)</span></div>
                <div className="iw-report-btns">
                  {QUICK_REPORTS.map((r) => (
                    <button key={r.id} type="button" className={justReported === r.id ? 'on' : ''} onClick={() => report(r.id)}>{r.emoji} {r.label}</button>
                  ))}
                </div>
                {(justReported || myReports.length > 0) && (
                  <div className="iw-report-done">✓ {myReports.length || 1} report{(myReports.length || 1) > 1 ? 's' : ''} from you, counted in the Truth lens and evidence badges.</div>
                )}
              </div>
            )}

            {/* Knowledge claims extracted from travel sources */}
            {kgInsights.length > 0 && (
              <div className="knowledge-insights-section" style={{
                marginBottom: '1.2rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Brain size={14} color="var(--text-secondary)"/>
                  <h4 style={{ fontSize: '0.82rem', margin: 0, color: 'var(--text-primary)', fontWeight: '700', fontFamily: 'Outfit, sans-serif' }}>
                    What travellers say
                    <span style={{ fontSize: '0.65rem', fontWeight: '400', color: 'var(--text-secondary)', marginLeft: '6px' }}>{kgInsights.length} claim{kgInsights.length !== 1 ? 's' : ''} from knowledge graph</span>
                  </h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {kgInsights.map((insight, idx) => {
                    const sentiment = insight.evaluation?.sentiment || 'neutral';
                    const sentColor = sentiment === 'positive' ? '#10b981' : sentiment === 'negative' ? '#ef4444' : '#94a3b8';
                    const bgSentColor = sentiment === 'positive' ? 'rgba(16,185,129,0.12)' : sentiment === 'negative' ? 'rgba(239,68,68,0.12)' : 'rgba(148,163,184,0.12)';
                    const isWarning = sentiment === 'negative' || (insight.claim || '').toLowerCase().includes('scam') || (insight.claim || '').toLowerCase().includes('beware');
                    
                    return (
                      <div key={insight.id || idx}
                        onClick={() => insight.source?.url && window.open(insight.source.url, '_blank')}
                        style={{
                          background: 'rgba(8,12,26,0.25)',
                          border: '1px solid rgba(255,255,255,0.04)',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          fontSize: '0.74rem',
                          cursor: insight.source?.url ? 'pointer' : 'default',
                          transition: 'background-color 0.15s, border-color 0.15s',
                        }}
                        onMouseEnter={e => insight.source?.url && (e.currentTarget.style.background = 'rgba(8,12,26,0.4)', e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                        onMouseLeave={e => insight.source?.url && (e.currentTarget.style.background = 'rgba(8,12,26,0.25)', e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)')}
                        title={insight.source?.url ? "Click to view original source post" : ""}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                          <span style={{
                            fontSize: '0.57rem',
                            padding: '2px 6px',
                            borderRadius: '6px',
                            background: bgSentColor,
                            color: sentColor,
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            {isWarning ? '⚠️ warning' : sentiment}
                          </span>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Credibility: <strong style={{ color: sentColor }}>{Math.round((insight.credibility || 0.75) * 100)}%</strong>
                          </span>
                        </div>
                        <p style={{ margin: 0, color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.45 }}>
                          "{insight.claim}"
                        </p>
                        {insight.advice && (
                          <div style={{ margin: '6px 0 0 0', color: '#c084fc', fontSize: '0.7rem', display: 'flex', alignItems: 'flex-start', gap: '4px', background: 'rgba(192,132,252,0.07)', padding: '4px 8px', borderRadius: '4px' }}>
                            <span style={{ flexShrink: 0 }}>💡</span> <span>{insight.advice}</span>
                          </div>
                        )}
                        {insight.source && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '7px', fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                            <span>via {insight.source.sourceType || 'source'}</span>
                            {insight.source.url && (
                              <span style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 'bold' }}>
                                🔗 View original post <ExternalLink size={8}/>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {place.reviews?.length>0&&place.reviews.map((r,i)=>(
              <div key={i} className="review-block">
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.2rem'}}>
                  <span style={{fontWeight:'600',fontSize:'0.8rem'}}>{r.name}</span>
                  <span style={{fontSize:'0.75rem', display:'flex', gap:'2px'}}>
                    {Array.from({ length: Math.round(r.rating) }).map((_, i) => <Star key={i} size={10} color="#facc15" fill="#facc15"/>)}
                  </span>
                </div>
                <p style={{fontSize:'0.75rem',color:'var(--text-secondary)',margin:0}}>"{r.text}"</p>
              </div>
            ))}
            {canAdd&&!place.isCity&&(
              <button className="btn-primary" style={{width:'100%',marginTop:'1.1rem',display:'flex',justifyContent:'center',gap:'0.5rem',padding:'0.75rem'}} onClick={onAdd}>
                <Plus size={16}/> Add to {canAdd}
              </button>
            )}
            {onAddToActiveRoute&&!place.isCity&&(
              <button className="btn-primary"
                style={{width:'100%',marginTop:'0.5rem',display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',padding:'0.65rem',background:'var(--accent-secondary)'}}
                onClick={() => onAddToActiveRoute(place)}>
                <span style={{display:'flex',alignItems:'center',gap:'6px',fontWeight:'700'}}>
                  <Route size={15}/> Add to Active Route ◈
                </span>
                {window._activeRouteName && (
                  <span style={{fontSize:'0.68em',opacity:0.65,fontWeight:'400',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'240px'}}>
                    {window._activeRouteName}
                  </span>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
