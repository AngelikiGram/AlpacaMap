import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';

import { MapContainer, TileLayer, Marker, Popup, Tooltip, ZoomControl, Polyline, Circle, Polygon, ScaleControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { Navigation, MapPin, Calendar as CalendarIcon, Search, Compass, Route, ChevronRight, FileText, Plus, ArrowLeft, Trash2, Loader2, SlidersHorizontal, X, Info, Upload, BookOpen, ExternalLink, ChevronDown, ChevronUp, DollarSign, Package, Check, Pencil, Layers, FolderOpen, Save, Clock, Phone, Globe, Accessibility, Utensils, Coffee, Landmark, TreePine, ShoppingBag, Camera, MountainSnow, Tent, Castle, Plane, Train, Bed, Activity, Bus, Ship, CreditCard, Droplets, Car, Moon, Satellite, Eye, Sparkles, Star, Brain } from 'lucide-react';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';

import { CITY_PALETTE, getCityColor, MAP_LAYERS, SENTINEL_NONE, getTypeDetails, createDayStopIcon, createGlyphIcon, createCityIcon, classifyWeather, detectOSMCategory, processOverpassResults, scorePlaceQuality, nameSim, semanticDedup, getZoomParams, filterMarkersAdaptive, loadTrips, loadPrefs, saveTrips, savePrefs, detectLocationType, createSearchResultIcon, getAllMapPoints, buildArc, getDistanceKm, INITIAL_TRIP, TRIPS_KEY, PREFS_KEY, TABS, wmoIcon, formatDur, searchOverpass } from "../../utils.jsx";
import { searchNominatim, fetchPlaceImage } from "../../api.js";
import { OVERPASS_URL, OVERPASS_TAGS, TOURIST_LANDMARK_TAGS, CATEGORY_ZOOM_PRIORITY, SEARCH_KEYWORDS, INTEREST_CATEGORIES, LOCATION_TYPE_PRESETS, EVENT_TYPES, TRANSPORT_ICON, EVT_EMOJI, DOC_SECTIONS, BUDGET_CATEGORIES, PACKING_TEMPLATES, ENTITY_PROFILES } from "../../config.jsx";

import { LiveImage } from "./LiveImage.jsx";
import { PortalDropdown } from "./PortalDropdown.jsx";
import { WeatherWidget } from "./WeatherWidget.jsx";
import { DonutChart } from "./DonutChart.jsx";
import { PrintView } from "./PrintView.jsx";

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

export const InfoWindow = ({ place, isLoading, onClose, onAdd, canAdd, onAddToActiveRoute, knowledgeGraphNodes = [], allCityNames = [] }) => {
  const cityNamesSet = useMemo(() => {
    return new Set(allCityNames.map(name => name.toLowerCase().trim()));
  }, [allCityNames]);

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

            {place.extract&&<p style={{color:'var(--text-secondary)',fontSize:'0.8rem',lineHeight:'1.7',marginBottom:'1.1rem',borderLeft:'3px solid var(--accent-secondary)',paddingLeft:'0.75rem'}}>{place.extract}</p>}

            {/* Knowledge claims extracted from travel sources */}
            {kgInsights.length > 0 && (
              <div className="knowledge-insights-section" style={{
                marginBottom: '1.2rem',
                background: 'rgba(139,92,246,0.05)',
                border: '1px solid rgba(139,92,246,0.22)',
                borderRadius: '12px',
                padding: '12px',
                boxShadow: '0 4px 16px rgba(139,92,246,0.04)',
                borderLeft: '4px solid #8b5cf6'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Brain size={14} color="#8b5cf6" style={{ filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.5))' }}/>
                  <h4 style={{ fontSize: '0.82rem', margin: 0, color: 'var(--text-primary)', fontWeight: '700', fontFamily: 'Outfit, sans-serif' }}>
                    What travellers say
                    <span style={{ fontSize: '0.65rem', fontWeight: '400', color: '#a78bfa', marginLeft: '6px' }}>{kgInsights.length} claim{kgInsights.length !== 1 ? 's' : ''} from knowledge graph</span>
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
                          <div style={{ margin: '6px 0 0 0', color: '#c084fc', fontSize: '0.7rem', display: 'flex', alignItems: 'flex-start', gap: '4px', background: 'rgba(192,132,252,0.07)', padding: '4px 8px', borderRadius: '4px', borderLeft: '2.5px solid #c084fc' }}>
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
