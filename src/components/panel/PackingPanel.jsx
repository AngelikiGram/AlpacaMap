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

















































export const PackingPanel=({tripData,setTripData})=>{
  const[activeList,setActiveList]=useState(0);
  const[newItem,setNewItem]=useState('');
  const[newListName,setNewListName]=useState('');
  const[addingList,setAddingList]=useState(false);
  const lists=tripData.packing;
  const currentList=lists[activeList]||lists[0];
  const totalItems=lists.reduce((s,l)=>s+l.items.length,0);
  const checkedItems=lists.reduce((s,l)=>s+l.items.filter(i=>i.checked).length,0);
  const overallPct=totalItems>0?Math.round((checkedItems/totalItems)*100):0;
  const toggle=(listId,itemId)=>{setTripData(prev=>({...prev,packing:prev.packing.map(l=>l.id!==listId?l:{...l,items:l.items.map(i=>i.id!==itemId?i:{...i,checked:!i.checked})})}));};
  const addItem=()=>{if(!newItem.trim()||!currentList)return;setTripData(prev=>({...prev,packing:prev.packing.map(l=>l.id!==currentList.id?l:{...l,items:[...l.items,{id:Date.now(),text:newItem.trim(),checked:false}]})}));setNewItem('');};
  const removeItem=(listId,itemId)=>{setTripData(prev=>({...prev,packing:prev.packing.map(l=>l.id!==listId?l:{...l,items:l.items.filter(i=>i.id!==itemId)})}));};
  const addList=()=>{if(!newListName.trim())return;setTripData(prev=>({...prev,packing:[...prev.packing,{id:Date.now(),name:newListName.trim(),items:[]}]}));setActiveList(lists.length);setNewListName('');setAddingList(false);};
  const addTemplate=(key)=>{if(!currentList)return;const items=(PACKING_TEMPLATES[key]||[]).filter(text=>!currentList.items.some(i=>i.text===text)).map(text=>({id:Date.now()+Math.random(),text,checked:false}));if(!items.length)return;setTripData(prev=>({...prev,packing:prev.packing.map(l=>l.id!==currentList.id?l:{...l,items:[...l.items,...items]})}));};
  const listPct=currentList&&currentList.items.length>0?Math.round((currentList.items.filter(i=>i.checked).length/currentList.items.length)*100):0;
  const addQuickItem=(text)=>{if(!currentList)return;if(currentList.items.some(i=>i.text.toLowerCase()===text.toLowerCase()))return;setTripData(prev=>({...prev,packing:prev.packing.map(l=>l.id!==currentList.id?l:{...l,items:[...l.items,{id:Date.now()+Math.random(),text,checked:false}]})}));};
  const QUICK_ITEMS=['Passport','ID card','Visa docs','Phone charger','Power bank','Sunscreen','Travel insurance','Adapter','Medication','Camera','Cash/cards'];

  const smartSuggestions = useMemo(() => {
    const suggestions = [];
    if (!currentList) return suggestions;
    const existingItems = new Set(
      (currentList.items || []).map(i => i.text.toLowerCase())
    );

    // 1. From AI Plan if available
    if (tripData.aiPlan?.packing) {
      tripData.aiPlan.packing.forEach(p => {
        const name = typeof p === 'string' ? p : (p.item || p.name || '');
        const reason = typeof p === 'string' ? 'Suggested for this itinerary' : (p.reason || 'AI recommendation');
        if (name && !existingItems.has(name.toLowerCase())) {
          suggestions.push({
            text: name,
            source: 'AI Plan',
            reason: reason
          });
        }
      });
    }

    // 2. From Saved Places categories
    const savedCategories = new Set();
    (tripData.locations || []).forEach(loc => {
      (loc.places || []).forEach(p => {
        if (p.type) savedCategories.add(p.type);
      });
    });

    savedCategories.forEach(cat => {
      const profileKey = Object.keys(ENTITY_PROFILES).find(k => k.toLowerCase() === cat.toLowerCase());
      if (profileKey && ENTITY_PROFILES[profileKey]?.packing) {
        ENTITY_PROFILES[profileKey].packing.forEach(item => {
          if (!existingItems.has(item.toLowerCase()) && !suggestions.some(s => s.text.toLowerCase() === item.toLowerCase())) {
            suggestions.push({
              text: item,
              source: profileKey,
              reason: `Recommended for ${profileKey.toLowerCase()} visits on your trip`
            });
          }
        });
      }
    });

    // 3. Fallback recommendations if suggestions is empty and list is empty
    if (suggestions.length === 0 && currentList.items.length === 0) {
      const defaultCats = ['documents', 'clothes', 'electronics', 'toiletries'];
      defaultCats.forEach(cat => {
        const items = PACKING_TEMPLATES[cat] || [];
        items.slice(0, 2).forEach(item => {
          if (!existingItems.has(item.toLowerCase())) {
            suggestions.push({
              text: item,
              source: cat.charAt(0).toUpperCase() + cat.slice(1),
              reason: `Essential ${cat}`
            });
          }
        });
      });
    }

    return suggestions.slice(0, 10); // Limit to top 10 relevant recommendations
  }, [tripData, currentList]);

  return (
    <div>
      <div className="budget-overview" style={{marginBottom:'1rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
          <span style={{fontWeight:'600',fontSize:'0.9rem'}}>Packing Progress</span>
          <span style={{fontSize:'0.82rem',color:overallPct===100?'var(--success)':'var(--text-secondary)'}}>{checkedItems}/{totalItems} items{overallPct===100?', done!':''}</span>
        </div>
        <div className="budget-bar-track">
          <div className="budget-bar-fill" style={{width:`${overallPct}%`,background:overallPct===100?'var(--success)':'var(--grad-primary)'}}/>
        </div>
      </div>
      <div style={{display:'flex',gap:'0.3rem',flexWrap:'wrap',marginBottom:'0.75rem',alignItems:'center'}}>
        {lists.map((list,idx)=>{
          const p=list.items.length>0?Math.round((list.items.filter(i=>i.checked).length/list.items.length)*100):0;
          return<button key={list.id} className={`chip ${activeList===idx?'active':''}`} onClick={()=>setActiveList(idx)}>{list.name}<span style={{fontSize:'0.6rem',opacity:0.75,marginLeft:'0.25rem'}}>{p}%</span></button>;
        })}
        <button className="chip" onClick={()=>setAddingList(true)} title="New list"><Plus size={11}/></button>
      </div>
      {addingList&&(
        <div className="add-form" style={{marginBottom:'0.75rem'}}>
          <input type="text" placeholder="List name…" value={newListName} onChange={e=>setNewListName(e.target.value)} autoFocus style={{fontSize:'0.85rem',padding:'0.4rem 0.65rem'}} onKeyDown={e=>{if(e.key==='Enter')addList();if(e.key==='Escape')setAddingList(false);}}/>
          <button className="btn-primary btn-sq" onClick={addList} aria-label="Create list" title="Create list"><Check size={14}/></button>
          <button className="btn-icon btn-sq" onClick={()=>setAddingList(false)}><X size={14}/></button>
        </div>
      )}
      {currentList&&(
        <>
          <div className="section-label" style={{marginBottom:'0.35rem'}}>Quick Templates</div>
          <div className="chip-group" style={{marginBottom:'1rem'}}>
            {Object.keys(PACKING_TEMPLATES).map(key=><button key={key} className="chip" style={{fontSize:'0.7rem'}} onClick={()=>addTemplate(key)}>+ {key}</button>)}
          </div>

          {smartSuggestions.length > 0 && (
            <div style={{ marginBottom: '1rem', padding: '12px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '12px' }}>
              <div className="section-label" style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem' }}>
                <Sparkles size={12} style={{ color: '#fbbf24' }} /> Smart Suggestions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {smartSuggestions.map((sug, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0, marginRight: '8px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: '500', color: 'var(--text-primary)' }}>{sug.text}</span>
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sug.reason}>
                        <span style={{ color: '#60a5fa', fontWeight: '600', marginRight: '4px' }}>{sug.source}</span> · {sug.reason}
                      </span>
                    </div>
                    <button className="btn-primary" style={{ padding: '0.22rem 0.5rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}
                      onClick={() => {
                        setTripData(prev => ({
                          ...prev,
                          packing: prev.packing.map(l => l.id !== currentList.id ? l : { ...l, items: [...l.items, { id: Date.now() + idx, text: sug.text, checked: false }] })
                        }));
                      }}
                    >
                      <Plus size={11} /> Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="section-label" style={{marginBottom:'0.5rem'}}>
            {currentList.name}<span style={{marginLeft:'0.5rem',color:'var(--accent-primary)',fontSize:'0.7rem'}}>{currentList.items.filter(i=>i.checked).length}/{currentList.items.length}</span>
            {listPct===100&&currentList.items.length>0&&<span style={{marginLeft:'0.4rem',fontSize:'0.7rem',color:'var(--success)',fontWeight:'600'}}>done</span>}
          </div>
          {currentList.items.length===0&&<p style={{fontSize:'0.8rem',color:'var(--text-secondary)',marginBottom:'0.75rem'}}>Empty. Add items or pick a template above.</p>}
          {currentList.items.map(item=>(
            <div key={item.id} className="packing-item" onClick={()=>toggle(currentList.id,item.id)}>
              <div className={`packing-checkbox ${item.checked?'checked':''}`}>{item.checked&&<Check size={10} color="white"/>}</div>
              <span style={{flex:1,fontSize:'0.875rem',textDecoration:item.checked?'line-through':'none',color:item.checked?'var(--text-secondary)':'var(--text-primary)',transition:'all 0.18s'}}>{item.text}</span>
              <button className="btn-icon" style={{padding:'0.15rem',opacity:0.4}} onClick={e=>{e.stopPropagation();removeItem(currentList.id,item.id);}}><X size={11}/></button>
            </div>
          ))}
          <div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginTop:'0.75rem',marginBottom:'4px'}}>
            {QUICK_ITEMS.map(item=>(
              <button key={item} type="button" onClick={()=>addQuickItem(item)}
                style={{fontSize:'0.62rem',padding:'2px 7px',borderRadius:'10px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',cursor:'pointer',color:'var(--text-secondary)'}}>
                + {item}
              </button>
            ))}
          </div>
          <form className="add-form" style={{marginTop:'0rem'}} onSubmit={e=>{e.preventDefault();addItem();}}>
            <input type="text" placeholder="Add item (e.g. passport, ID card)…" value={newItem} onChange={e=>setNewItem(e.target.value)} style={{fontSize:'0.85rem',padding:'0.5rem 0.65rem'}}/>
            <button type="submit" className="btn-primary btn-sq" aria-label="Add item" title="Add item"><Plus size={16}/></button>
          </form>
        </>
      )}
    </div>
  );
};
