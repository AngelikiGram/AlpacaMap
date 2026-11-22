import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';

import { MapContainer, TileLayer, Marker, Popup, Tooltip, ZoomControl, Polyline, Circle, Polygon, ScaleControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { Navigation, MapPin, Calendar as CalendarIcon, Search, Compass, ChevronRight, FileText, Plus, ArrowLeft, Trash2, Loader2, SlidersHorizontal, X, Info, Upload, BookOpen, ExternalLink, ChevronDown, ChevronUp, DollarSign, Package, Check, Pencil, Layers, FolderOpen, Save, Clock, Phone, Globe, Accessibility, Utensils, Coffee, Landmark, TreePine, ShoppingBag, Camera, MountainSnow, Tent, Castle, Plane, Train, Bed, Activity, Bus, Ship, CreditCard, Droplets, Car, Moon, Satellite, Eye, Sparkles, GripVertical } from 'lucide-react';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';

import { CITY_PALETTE, getCityColor, MAP_LAYERS, SENTINEL_NONE, getTypeDetails, createDayStopIcon, createGlyphIcon, createCityIcon, classifyWeather, detectOSMCategory, processOverpassResults, scorePlaceQuality, nameSim, semanticDedup, getZoomParams, filterMarkersAdaptive, loadTrips, loadPrefs, saveTrips, savePrefs, detectLocationType, createSearchResultIcon, getAllMapPoints, buildArc, getDistanceKm, INITIAL_TRIP, TRIPS_KEY, PREFS_KEY, TABS, wmoIcon, formatDur, searchOverpass } from "../../utils.jsx";
import { searchNominatim, fetchPlaceImage } from "../../api.js";
import EvidenceBadge from "../shared/EvidenceBadge";
import { buildPlaceEvidence, findEvidence } from "../../knowledge/evidence";
import { OVERPASS_URL, OVERPASS_TAGS, TOURIST_LANDMARK_TAGS, CATEGORY_ZOOM_PRIORITY, SEARCH_KEYWORDS, INTEREST_CATEGORIES, LOCATION_TYPE_PRESETS, EVENT_TYPES, TRANSPORT_ICON, EVT_EMOJI, DOC_SECTIONS, BUDGET_CATEGORIES, PACKING_TEMPLATES, ENTITY_PROFILES } from "../../config.jsx";

import { LiveImage } from "../shared/LiveImage.jsx";
import { PortalDropdown } from "../shared/PortalDropdown.jsx";
import { WeatherWidget } from "../shared/WeatherWidget.jsx";
import { DonutChart } from "../shared/DonutChart.jsx";
import { InfoWindow } from "../shared/InfoWindow.jsx";
import { PrintView } from "../shared/PrintView.jsx";

















































export const CalendarPanel=({tripData,setTripData,expandedDays=[],setExpandedDays})=>{
  const[newEvent,setNewEvent]=useState({time:'09:00',title:'',type:'activity'});
  const[editingEvt,setEditingEvt]=useState(null); // {dayId, evtId}
  const[editEvtDraft,setEditEvtDraft]=useState(null);
  const[newDayDate,setNewDayDate]=useState('');
  const[newDayEndDate,setNewDayEndDate]=useState('');
  const[newDayLoc,setNewDayLoc]=useState('');
  
  const[editingDayId,setEditingDayId]=useState(null);
  const[editDayDate,setEditDayDate]=useState('');
  const[editDayLoc,setEditDayLoc]=useState('');

  const[dragOverDayId, setDragOverDayId]=useState(null);

  const sorted=[...tripData.itinerary].sort((a,b)=>a.date.localeCompare(b.date));
  // Do the sources agree about each stop? (warnings on itinerary stops)
  const evidenceMap=useMemo(()=>buildPlaceEvidence(tripData.knowledgeGraph?.nodes||[],tripData.knowledgeGraph?.verified),[tripData.knowledgeGraph]);
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

  const saveEditDay=()=>{
    if(!editDayDate)return;
    setTripData(prev=>({...prev,itinerary:prev.itinerary.map(d=>d.id!==editingDayId?d:{...d,date:editDayDate,location:editDayLoc||'Unknown'})}));
    setEditingDayId(null);
  };

  const handleDragOver = (e, dayId) => {
    e.preventDefault();
    if (dragOverDayId !== dayId) {
      setDragOverDayId(dayId);
    }
  };

  const handleDrop = (e, targetDayId) => {
    e.preventDefault();
    setDragOverDayId(null);

    const dayIdData = e.dataTransfer.getData("text/dayId");
    const evtDataJson = e.dataTransfer.getData("text/evtData");

    if (dayIdData) {
      const sourceDayId = parseInt(dayIdData, 10);
      if (sourceDayId === targetDayId) return;

      setTripData(prev => {
        const sourceDay = prev.itinerary.find(d => d.id === sourceDayId);
        const targetDay = prev.itinerary.find(d => d.id === targetDayId);
        if (!sourceDay || !targetDay) return prev;

        const sourceDate = sourceDay.date;
        const targetDate = targetDay.date;

        return {
          ...prev,
          itinerary: prev.itinerary.map(d => {
            if (d.id === sourceDayId) return { ...d, date: targetDate };
            if (d.id === targetDayId) return { ...d, date: sourceDate };
            return d;
          })
        };
      });
    } else if (evtDataJson) {
      const { sourceDayId, evtId } = JSON.parse(evtDataJson);
      if (sourceDayId === targetDayId) return;

      setTripData(prev => {
        const sourceDay = prev.itinerary.find(d => d.id === sourceDayId);
        const targetDay = prev.itinerary.find(d => d.id === targetDayId);
        if (!sourceDay || !targetDay) return prev;

        const eventToMove = sourceDay.events.find(e => e.id === evtId);
        if (!eventToMove) return prev;

        const updatedSourceEvents = sourceDay.events.filter(e => e.id !== evtId);
        const updatedTargetEvents = [...targetDay.events, eventToMove].sort((a, b) => a.time.localeCompare(b.time));

        return {
          ...prev,
          itinerary: prev.itinerary.map(d => {
            if (d.id === sourceDayId) return { ...d, events: updatedSourceEvents };
            if (d.id === targetDayId) return { ...d, events: updatedTargetEvents };
            return d;
          })
        };
      });
    }
  };

  const toggleDay = (dayId) => {
    const isNowOpen = !expandedDays.includes(dayId);
    setExpandedDays(prev => 
      prev.includes(dayId) ? prev.filter(id => id !== dayId) : [...prev, dayId]
    );
    if (isNowOpen) {
      setTimeout(() => {
        document.getElementById('cal-day-' + dayId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  };

  const generateDefaultItinerary = () => {
    if (!tripData.locations || tripData.locations.length === 0) return;

    // Sort locations based on routes or nearest neighbor
    const sortedLocations = (() => {
      const locs = [...tripData.locations];
      if (locs.length <= 1) return locs;

      const nextLocMap = new Map();
      const hasIncoming = new Set();
      const routes = tripData.routes || [];
      
      routes.forEach(r => {
        nextLocMap.set(r.from, r.to);
        hasIncoming.add(r.to);
      });

      let startId = null;
      for (const loc of locs) {
        if (nextLocMap.has(loc.id) && !hasIncoming.has(loc.id)) {
          startId = loc.id;
          break;
        }
      }

      if (startId === null && locs.length > 0) {
        startId = locs[0].id;
      }

      const ordered = [];
      const visited = new Set();
      let currentId = startId;

      while (currentId !== null && currentId !== undefined && !visited.has(currentId)) {
        const loc = locs.find(l => l.id === currentId);
        if (loc) {
          ordered.push(loc);
          visited.add(currentId);
        }
        currentId = nextLocMap.get(currentId);
      }

      const remaining = locs.filter(l => !visited.has(l.id));
      if (remaining.length > 0) {
        let current = ordered[ordered.length - 1] || remaining[0];
        if (ordered.length === 0) {
          ordered.push(current);
          visited.add(current.id);
          const idx = remaining.findIndex(l => l.id === current.id);
          if (idx > -1) remaining.splice(idx, 1);
        }

        const unvisited = [...remaining];
        while (unvisited.length > 0) {
          let nearestIdx = 0;
          let minDist = Infinity;
          for (let i = 0; i < unvisited.length; i++) {
            const dist = getDistanceKm(current.coords[0], current.coords[1], unvisited[i].coords[0], unvisited[i].coords[1]);
            if (dist < minDist) {
              minDist = dist;
              nearestIdx = i;
            }
          }
          current = unvisited.splice(nearestIdx, 1)[0];
          ordered.push(current);
        }
      }
      return ordered;
    })();

    let start = new Date('2026-09-10');

    const newDays = sortedLocations.map((loc, index) => {
      const dateStr = start.toISOString().split('T')[0];
      const events = [];

      // Add transit events if a route connects the previous location to this one
      if (index > 0) {
        const prevLoc = sortedLocations[index - 1];
        const route = (tripData.routes || []).find(r => r.from === prevLoc.id && r.to === loc.id);
        if (route) {
          const type = (route.mode === 'flight' || route.mode === 'train') ? route.mode : 'activity';
          const modeLabel = route.mode === 'flight' ? 'Flight' : route.mode === 'train' ? 'Train' : 'Transit';
          events.push({
            id: Date.now() + index * 1000 + 99,
            time: '08:00',
            title: `${modeLabel} to ${loc.name.split(',')[0]}`,
            type: type
          });
        } else {
          const dist = getDistanceKm(prevLoc.coords[0], prevLoc.coords[1], loc.coords[0], loc.coords[1]);
          const mode = dist > 400 ? 'flight' : 'train';
          const modeLabel = mode === 'flight' ? 'Flight' : 'Train';
          events.push({
            id: Date.now() + index * 1000 + 99,
            time: '08:00',
            title: `${modeLabel} to ${loc.name.split(',')[0]}`,
            type: mode
          });
        }
      }

      if (loc.places && loc.places.length > 0) {
        loc.places.forEach((p, pIdx) => {
          const hour = 10 + pIdx * 2;
          events.push({
            id: Date.now() + index * 1000 + pIdx,
            time: `${hour.toString().padStart(2, '0')}:00`,
            title: `Visit ${p.name}`,
            type: 'activity'
          });
        });
      } else {
        events.push({
          id: Date.now() + index * 1000,
          time: '12:00',
          title: `Explore ${loc.name}`,
          type: 'activity'
        });
      }
      start.setDate(start.getDate() + 1);
      return {
        id: Date.now() + index,
        date: dateStr,
        location: loc.name,
        events: events.sort((a,b) => a.time.localeCompare(b.time))
      };
    });

    setTripData(prev => ({
      ...prev,
      itinerary: newDays.sort((a, b) => a.date.localeCompare(b.date))
    }));
  };

  return(
    <div>
      {sorted.length===0&&<p className="panel-hint">No days yet. Add a day below to start building your schedule.</p>}
      {sorted.map(day=>{
        const city=tripData.locations.find(l=>l.name.toLowerCase().startsWith(day.location.toLowerCase().split(',')[0].toLowerCase()));
        const color=city?getCityColor(city.id,tripData.locations):'#64748b';
        const isOpen=expandedDays.includes(day.id);
        const isEditingDay=editingDayId===day.id;
        const isDragOver = dragOverDayId === day.id;

        return(
          <div 
            id={"cal-day-"+day.id} 
            key={day.id} 
            className="cal-day" 
            style={{
              '--day-color':color,
              border: isDragOver ? '2px dashed var(--primary)' : '1px solid rgba(255,255,255,0.07)',
              boxShadow: isDragOver ? '0 0 16px rgba(59, 130, 246, 0.45)' : '',
              transform: isDragOver ? 'scale(1.015)' : 'scale(1)',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onDragOver={e => handleDragOver(e, day.id)}
            onDragLeave={() => setDragOverDayId(null)}
            onDrop={e => handleDrop(e, day.id)}
          >
            <div 
              className="cal-day-header" 
              onClick={()=>{ if(!isEditingDay) toggleDay(day.id); }}
              draggable={!isEditingDay}
              onDragStart={e => {
                e.dataTransfer.setData("text/dayId", day.id.toString());
                e.dataTransfer.effectAllowed = "move";
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: isEditingDay ? 'default' : 'grab' }}
            >
              <div className="cal-day-bar" style={{background:color}}/>
              {!isEditingDay && (
                <GripVertical size={13} style={{ color: 'rgba(255,255,255,0.22)', marginRight: '2px', flexShrink: 0 }} />
              )}
              {isEditingDay ? (
                <div style={{flex:1, display:'flex', gap:'0.4rem', flexDirection:'column', padding:'0.2rem 0'}} onClick={e=>e.stopPropagation()}>
                  <div style={{display:'flex', gap:'0.4rem'}}>
                    <input type="date" value={editDayDate} onChange={e=>setEditDayDate(e.target.value)} style={{fontSize:'0.8rem', padding:'0.2rem 0.4rem', flex: 1}}/>
                    <button className="btn-primary" style={{padding:'0.2rem 0.6rem', fontSize:'0.75rem', background:color}} onClick={saveEditDay}><Check size={11}/></button>
                    <button className="btn-icon" style={{padding:'0.2rem 0.4rem'}} onClick={()=>setEditingDayId(null)}><X size={11}/></button>
                  </div>
                  <input type="text" value={editDayLoc} onChange={e=>setEditDayLoc(e.target.value)} style={{fontSize:'0.8rem', padding:'0.2rem 0.4rem'}} placeholder="Location..." list="saved-locations"/>
                </div>
              ) : (
                <>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:'600',fontSize:'0.875rem'}}>{fmtDate(day.date)}</div>
                    <div style={{fontSize:'0.7rem',color:'var(--text-secondary)'}}>{day.location} · {day.events.length} event{day.events.length!==1?'s':''}</div>
                  </div>
                  <div style={{display:'flex',gap:'0.35rem',alignItems:'center'}} onClick={e=>e.stopPropagation()}>
                    <button className="btn-icon" style={{padding:'0.2rem'}} title="Edit day" onClick={e=>{e.stopPropagation();setEditingDayId(day.id);setEditDayDate(day.date);setEditDayLoc(day.location);}}>
                      <Pencil size={11} color="var(--text-secondary)"/>
                    </button>
                    <button className="btn-icon" style={{padding:'0.2rem'}} title="Delete day" onClick={e=>{e.stopPropagation();setTripData(prev=>({...prev,itinerary:prev.itinerary.filter(d=>d.id!==day.id)}));}}>
                      <Trash2 size={11} color="var(--danger)"/>
                    </button>
                    {isOpen?<ChevronUp size={13} color="var(--text-secondary)" onClick={() => toggleDay(day.id)}/>:<ChevronDown size={13} color="var(--text-secondary)" onClick={() => toggleDay(day.id)}/>}
                  </div>
                </>
              )}
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
                    <div 
                      key={evt.id} 
                      className="time-block" 
                      style={{
                        cursor:'pointer',
                        padding: '0.45rem 0.6rem',
                        background: 'rgba(255,255,255,0.015)',
                        border: '1px solid rgba(255,255,255,0.03)',
                        borderRadius: '8px',
                        marginBottom: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.15s ease'
                      }} 
                      onClick={()=>{setEditingEvt({dayId:day.id,evtId:evt.id});setEditEvtDraft({time:evt.time,title:evt.title,type:evt.type});}}
                      draggable={true}
                      onDragStart={e => {
                        e.stopPropagation();
                        e.dataTransfer.setData("text/evtData", JSON.stringify({ sourceDayId: day.id, evtId: evt.id }));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      <GripVertical size={11} style={{ cursor: 'grab', color: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
                      <div className="time-col" style={{display:'flex',alignItems:'center',gap:'4px'}}>{EVT_EMOJI[evt.type]||'•'} {evt.time}</div>
                      <div className="activity-col" style={{fontSize:'0.83rem'}}>{evt.title}</div>
                      <EvidenceBadge evidence={findEvidence(evt.title,evidenceMap)}/>
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
      <div className="section-divider" style={{ margin: '1.25rem 0' }}/>
      <div className="section-label" style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem', fontWeight: '600' }}>Add Day</div>
      <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap', background: 'rgba(255,255,255,0.015)', padding: '0.65rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)'}}>
        <div style={{display:'flex', gap:'0.4rem', flex:'1 1 100%'}}>
          <div style={{flex: 1}}>
            <div style={{fontSize:'0.65rem', color:'var(--text-secondary)', marginBottom:'2px'}}>Start Date</div>
            <input type="date" value={newDayDate} onChange={e=>setNewDayDate(e.target.value)} style={{width: '100%', fontSize:'0.8rem',padding:'0.45rem', borderRadius: '6px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff'}}/>
          </div>
          <div style={{flex: 1}}>
            <div style={{fontSize:'0.65rem', color:'var(--text-secondary)', marginBottom:'2px'}}>End Date (Optional)</div>
            <input type="date" value={newDayEndDate} onChange={e=>setNewDayEndDate(e.target.value)} style={{width: '100%', fontSize:'0.8rem',padding:'0.45rem', borderRadius: '6px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff'}}/>
          </div>
        </div>
        <input type="text" placeholder="Location…" value={newDayLoc} onChange={e=>setNewDayLoc(e.target.value)} style={{flex:1,fontSize:'0.8rem',padding:'0.45rem', borderRadius: '6px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff'}} list="saved-locations"/>
        <button className="btn-primary" style={{padding:'0.45rem 0.85rem',fontSize:'0.8rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '3px', alignSelf: 'flex-end'}} onClick={()=>{
          if(!newDayDate)return;
          const start = new Date(newDayDate + 'T00:00:00');
          const end = newDayEndDate ? new Date(newDayEndDate + 'T00:00:00') : start;
          
          const newDays = [];
          const current = new Date(start);
          while (current <= end) {
            const dateStr = current.toISOString().split('T')[0];
            newDays.push({
              id: Date.now() + newDays.length,
              date: dateStr,
              location: newDayLoc || 'Unknown',
              events: []
            });
            current.setDate(current.getDate() + 1);
          }

          setTripData(prev=>({
            ...prev,
            itinerary: [...prev.itinerary, ...newDays].sort((a,b)=>a.date.localeCompare(b.date))
          }));
          setNewDayDate('');
          setNewDayEndDate('');
          setNewDayLoc('');
        }}><Plus size={12}/> Add</button>
      </div>
      {tripData.locations && tripData.locations.length > 0 && (
        <div style={{marginTop:'1rem'}}>
          <button className="btn-primary" style={{width:'100%', padding:'0.5rem', fontSize:'0.8rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem', background:'linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)'}} onClick={generateDefaultItinerary}>
            <Sparkles size={13}/> Generate Default Itinerary
          </button>
        </div>
      )}
      <datalist id="saved-locations">
        {tripData.locations.map(loc => (
          <option key={loc.id} value={loc.name} />
        ))}
      </datalist>
    </div>
  );
};
