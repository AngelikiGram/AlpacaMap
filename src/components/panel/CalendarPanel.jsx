import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';

import { MapContainer, TileLayer, Marker, Popup, Tooltip, ZoomControl, Polyline, Circle, Polygon, ScaleControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { Navigation, MapPin, Calendar as CalendarIcon, Search, Compass, ChevronRight, FileText, Plus, ArrowLeft, Trash2, Loader2, SlidersHorizontal, X, Info, Upload, BookOpen, ExternalLink, ChevronDown, ChevronUp, DollarSign, Package, Check, Pencil, Layers, FolderOpen, Save, Clock, Phone, Globe, Accessibility, Utensils, Coffee, Landmark, TreePine, ShoppingBag, Camera, MountainSnow, Tent, Castle, Plane, Train, Bed, Activity, Bus, Ship, CreditCard, Droplets, Car, Moon, Satellite, Eye, Sparkles } from 'lucide-react';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';

import { CITY_PALETTE, getCityColor, MAP_LAYERS, SENTINEL_NONE, getTypeDetails, createDayStopIcon, createGlyphIcon, createCityIcon, classifyWeather, detectOSMCategory, processOverpassResults, scorePlaceQuality, nameSim, semanticDedup, getZoomParams, filterMarkersAdaptive, loadTrips, loadPrefs, saveTrips, savePrefs, detectLocationType, createSearchResultIcon, getAllMapPoints, buildArc, getDistanceKm, INITIAL_TRIP, TRIPS_KEY, PREFS_KEY, TABS, wmoIcon, formatDur, searchOverpass } from "../../utils.jsx";
import { searchNominatim, fetchPlaceImage } from "../../api.js";
import { OVERPASS_URL, OVERPASS_TAGS, TOURIST_LANDMARK_TAGS, CATEGORY_ZOOM_PRIORITY, SEARCH_KEYWORDS, INTEREST_CATEGORIES, LOCATION_TYPE_PRESETS, EVENT_TYPES, TRANSPORT_ICON, EVT_EMOJI, DOC_SECTIONS, BUDGET_CATEGORIES, PACKING_TEMPLATES, ENTITY_PROFILES } from "../../config.jsx";

import { LiveImage } from "../shared/LiveImage.jsx";
import { PortalDropdown } from "../shared/PortalDropdown.jsx";
import { WeatherWidget } from "../shared/WeatherWidget.jsx";
import { DonutChart } from "../shared/DonutChart.jsx";
import { InfoWindow } from "../shared/InfoWindow.jsx";
import { PrintView } from "../shared/PrintView.jsx";

















































export const CalendarPanel=({tripData,setTripData,expandedDay,setExpandedDay})=>{
  const[newEvent,setNewEvent]=useState({time:'09:00',title:'',type:'activity'});
  const[editingEvt,setEditingEvt]=useState(null); // {dayId, evtId}
  const[editEvtDraft,setEditEvtDraft]=useState(null);
  const[newDayDate,setNewDayDate]=useState('');
  const[newDayLoc,setNewDayLoc]=useState('');
  const sorted=[...tripData.itinerary].sort((a,b)=>a.date.localeCompare(b.date));
  const fmtDate=d=>new Date(d+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});

  const saveEvent=(dayId)=>{
    if(!newEvent.title.trim())return;
    setTripData(prev=>({...prev,itinerary:prev.itinerary.map(d=>d.id!==dayId?d:{...d,events:[...d.events,{id:Date.now(),...newEvent}].sort((a,b)=>a.time.localeCompare(b.time))})}));
    setNewEvent({time:'09:00',title:'',type:'activity'});
  };
  const saveEditEvt=()=>{
    if(!editEvtDraft?.title?.trim())return;
    setTripData(prev=>({...prev,itinerary:prev.itinerary.map(d=>d.id!==editingEvt.dayId?d:{...d,events:d.events.map(e=>e.id!==editingEvt.evtId?e:{...e,...editEvtDraft}).sort((a,b)=>a.time.localeCompare(b.time))})}));
    setEditingEvt(null);setEditEvtDraft(null);
  };
  const deleteEvt=(dayId,evtId)=>setTripData(prev=>({...prev,itinerary:prev.itinerary.map(d=>d.id!==dayId?d:{...d,events:d.events.filter(e=>e.id!==evtId)})}));

  useEffect(() => {
    if (expandedDay) {
      document.getElementById('cal-day-' + expandedDay)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [expandedDay]);

  return(
    <div>
      {sorted.length===0&&<p className="panel-hint">No days yet. Add a day below to start building your schedule.</p>}
      {sorted.map(day=>{
        const city=tripData.locations.find(l=>l.name.toLowerCase().startsWith(day.location.toLowerCase().split(',')[0].toLowerCase()));
        const color=city?getCityColor(city.id,tripData.locations):'#64748b';
        const isOpen=expandedDay===day.id;
        return(
          <div id={"cal-day-"+day.id} key={day.id} className="cal-day" style={{'--day-color':color}}>
            <div className="cal-day-header" onClick={()=>setExpandedDay(isOpen?null:day.id)}>
              <div className="cal-day-bar" style={{background:color}}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:'600',fontSize:'0.875rem'}}>{fmtDate(day.date)}</div>
                <div style={{fontSize:'0.7rem',color:'var(--text-secondary)'}}>{day.location} · {day.events.length} event{day.events.length!==1?'s':''}</div>
              </div>
              <div style={{display:'flex',gap:'0.35rem',alignItems:'center'}}>
                <button className="btn-icon" style={{padding:'0.2rem'}} title="Delete day" onClick={e=>{e.stopPropagation();setTripData(prev=>({...prev,itinerary:prev.itinerary.filter(d=>d.id!==day.id)}));}}>
                  <Trash2 size={11} color="var(--danger)"/>
                </button>
                {isOpen?<ChevronUp size={13} color="var(--text-secondary)"/>:<ChevronDown size={13} color="var(--text-secondary)"/>}
              </div>
            </div>
            {isOpen&&(
              <div className="cal-day-body">
                {day.events.length===0&&<div style={{fontSize:'0.78rem',color:'var(--text-secondary)',padding:'0.3rem 0 0.5rem'}}>No events yet — add one below.</div>}
                {day.events.map(evt=>{
                  const isEditingThis=editingEvt?.dayId===day.id&&editingEvt?.evtId===evt.id;
                  if(isEditingThis) return(
                    <div key={evt.id} style={{padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                      <div style={{display:'grid',gridTemplateColumns:'80px 1fr',gap:'5px',marginBottom:'4px'}}>
                        <input type="time" value={editEvtDraft.time||''} onChange={e=>setEditEvtDraft(p=>({...p,time:e.target.value}))} style={{fontSize:'0.78rem',padding:'3px 5px'}}/>
                        <input type="text" value={editEvtDraft.title||''} onChange={e=>setEditEvtDraft(p=>({...p,title:e.target.value}))} style={{fontSize:'0.78rem',padding:'3px 5px'}} onKeyDown={e=>e.key==='Enter'&&saveEditEvt()} autoFocus/>
                      </div>
                      <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'5px'}}>
                        {EVENT_TYPES.map(t=>(
                          <button key={t.value} type="button" className={`chip ${editEvtDraft.type===t.value?'active':''}`} style={{fontSize:'0.62rem',padding:'1px 7px',...(editEvtDraft.type===t.value?{background:color,borderColor:'transparent'}:{})}} onClick={()=>setEditEvtDraft(p=>({...p,type:t.value}))}>{t.label}</button>
                        ))}
                      </div>
                      <div style={{display:'flex',gap:'5px'}}>
                        <button className="btn-primary" style={{padding:'2px 10px',fontSize:'0.76rem',background:color}} onClick={saveEditEvt}><Check size={11}/> Save</button>
                        <button className="btn-icon" style={{padding:'2px 8px',fontSize:'0.76rem'}} onClick={()=>{setEditingEvt(null);setEditEvtDraft(null);}}>Cancel</button>
                        <button className="btn-icon" style={{padding:'2px',marginLeft:'auto'}} onClick={()=>{deleteEvt(day.id,evt.id);setEditingEvt(null);}}><Trash2 size={11} color="var(--danger)"/></button>
                      </div>
                    </div>
                  );
                  return(
                    <div key={evt.id} className="time-block" style={{cursor:'pointer'}} onClick={()=>{setEditingEvt({dayId:day.id,evtId:evt.id});setEditEvtDraft({time:evt.time,title:evt.title,type:evt.type});}}>
                      <div className="time-col" style={{display:'flex',alignItems:'center',gap:'4px'}}>{EVT_EMOJI[evt.type]||'•'} {evt.time}</div>
                      <div className="activity-col" style={{fontSize:'0.83rem'}}>{evt.title}</div>
                      <button className="btn-icon" style={{padding:'0.2rem'}} onClick={e=>{e.stopPropagation();deleteEvt(day.id,evt.id);}}>
                        <Trash2 size={11} color="var(--danger)"/>
                      </button>
                    </div>
                  );
                })}
                {/* Always-visible add event form */}
                <div style={{marginTop:'6px',paddingTop:'6px',borderTop:'1px dashed rgba(255,255,255,0.1)'}}>
                  <div style={{display:'grid',gridTemplateColumns:'80px 1fr',gap:'5px',marginBottom:'4px'}}>
                    <input type="time" value={newEvent.time} onChange={e=>setNewEvent(p=>({...p,time:e.target.value}))} style={{fontSize:'0.78rem',padding:'3px 5px'}}/>
                    <input type="text" placeholder="Add event…" value={newEvent.title} onChange={e=>setNewEvent(p=>({...p,title:e.target.value}))} style={{fontSize:'0.78rem',padding:'3px 5px'}} onKeyDown={e=>e.key==='Enter'&&saveEvent(day.id)}/>
                  </div>
                  <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'5px'}}>
                    {EVENT_TYPES.map(t=>(
                      <button key={t.value} type="button" className={`chip ${newEvent.type===t.value?'active':''}`} style={{fontSize:'0.62rem',padding:'1px 7px',...(newEvent.type===t.value?{background:color,borderColor:'transparent'}:{})}} onClick={()=>setNewEvent(p=>({...p,type:t.value}))}>{t.label}</button>
                    ))}
                  </div>
                  <button className="btn-primary" style={{padding:'3px 12px',fontSize:'0.78rem',background:color,display:'flex',alignItems:'center',gap:'4px'}} onClick={()=>saveEvent(day.id)}>
                    <Plus size={11}/> Add event
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div className="section-divider"/>
      <div className="section-label">Add Day</div>
      <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
        <input type="date" value={newDayDate} onChange={e=>setNewDayDate(e.target.value)} style={{flex:'0 0 auto',fontSize:'0.8rem',padding:'0.4rem'}}/>
        <input type="text" placeholder="Location…" value={newDayLoc} onChange={e=>setNewDayLoc(e.target.value)} style={{flex:1,fontSize:'0.8rem',padding:'0.4rem'}}/>
        <button className="btn-primary" style={{padding:'0.4rem 0.75rem',fontSize:'0.8rem'}} onClick={()=>{
          if(!newDayDate)return;
          setTripData(prev=>({...prev,itinerary:[...prev.itinerary,{id:Date.now(),date:newDayDate,location:newDayLoc||'Unknown',events:[]}]}));
          setNewDayDate('');setNewDayLoc('');
        }}><Plus size={12}/> Add</button>
      </div>
    </div>
  );
};
