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

















































export const BudgetPanel=({tripData,setTripData})=>{
  const{budget}=tripData;
  const[newExp,setNewExp]=useState({name:'',amount:'',category:'food',city:''});
  const[editingExpId,setEditingExpId]=useState(null);
  const[editExpDraft,setEditExpDraft]=useState(null);
  const[editTotal,setEditTotal]=useState(false);
  const[tempTotal,setTempTotal]=useState('');
  const[editCur,setEditCur]=useState(false);
  const[tempCur,setTempCur]=useState('');
  const totalSpent=budget.expenses.reduce((s,e)=>s+Number(e.amount),0);
  const remaining=budget.total-totalSpent;
  const pct=budget.total>0?Math.min(100,Math.round((totalSpent/budget.total)*100)):0;
  const barColor=pct>90?'var(--danger)':pct>70?'var(--warning)':'var(--grad-primary)';
  const saveTotal=()=>{setTripData(prev=>({...prev,budget:{...prev.budget,total:Number(tempTotal)||prev.budget.total}}));setEditTotal(false);};
  const saveCur=()=>{setTripData(prev=>({...prev,budget:{...prev.budget,currency:tempCur.trim()||prev.budget.currency}}));setEditCur(false);};
  const saveExpense=()=>{
    if(!editExpDraft?.name?.trim()||!editExpDraft?.amount)return;
    setTripData(prev=>({...prev,budget:{...prev.budget,expenses:prev.budget.expenses.map(e=>e.id!==editingExpId?e:{...e,...editExpDraft,amount:Number(editExpDraft.amount)})}}));
    setEditingExpId(null); setEditExpDraft(null);
  };
  const addExpense=()=>{
    if(!newExp.name.trim()||!newExp.amount)return;
    setTripData(prev=>({...prev,budget:{...prev.budget,expenses:[...prev.budget.expenses,{id:Date.now(),...newExp,amount:Number(newExp.amount)}]}}));
    setNewExp({name:'',amount:'',category:'food',city:''});
  };
  const byCategory=BUDGET_CATEGORIES.map(cat=>({...cat,total:budget.expenses.filter(e=>e.category===cat.value).reduce((s,e)=>s+Number(e.amount),0)}));
  const spent_segs=byCategory.filter(c=>c.total>0);

  return(
    <div>
      {/* Overview card */}
      <div className="budget-overview">
        <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
          <DonutChart segments={byCategory} currency={budget.currency} totalSpent={totalSpent}/>
          <div style={{flex:1}}>
            <div style={{marginBottom:'0.75rem'}}>
              <div className="section-label" style={{marginBottom:'0.15rem'}}>Total Budget</div>
              {editTotal?(
                <div style={{display:'flex',gap:'0.4rem',alignItems:'center'}}>
                  <input type="number" value={tempTotal} onChange={e=>setTempTotal(e.target.value)} autoFocus
                    style={{width:'90px',padding:'0.25rem 0.4rem',fontSize:'1rem',fontWeight:'700'}}
                    onKeyDown={e=>{if(e.key==='Enter')saveTotal();if(e.key==='Escape')setEditTotal(false);}}
                  />
                  <button className="btn-primary" style={{padding:'0.25rem 0.5rem',fontSize:'0.72rem'}} onClick={saveTotal}>✓</button>
                </div>
              ):(
                <div style={{display:'flex',alignItems:'center',gap:'0.4rem',cursor:'pointer'}} onClick={()=>{setTempTotal(budget.total);setEditTotal(true);}}>
                  {editCur?(
                    <input type="text" value={tempCur} onChange={e=>setTempCur(e.target.value)} autoFocus
                      style={{width:'45px',padding:'0.1rem 0.25rem',fontSize:'0.8rem'}}
                      onKeyDown={e=>{if(e.key==='Enter')saveCur();if(e.key==='Escape')setEditCur(false);}}
                      onClick={e=>e.stopPropagation()}
                    />
                  ):(
                    <span style={{fontSize:'0.8rem',color:'var(--text-secondary)',cursor:'pointer'}} onClick={e=>{e.stopPropagation();setTempCur(budget.currency);setEditCur(true);}}>{budget.currency}</span>
                  )}
                  <span style={{fontSize:'1.3rem',fontWeight:'700',fontFamily:'Outfit,sans-serif'}}>{budget.total.toLocaleString()}</span>
                  <Pencil size={11} color="var(--text-secondary)"/>
                </div>
              )}
            </div>
            <div>
              <div className="section-label" style={{marginBottom:'0.15rem'}}>Remaining</div>
              <div style={{fontSize:'1.1rem',fontWeight:'700',color:remaining>=0?'var(--success)':'var(--danger)'}}>
                {budget.currency} {Math.abs(remaining).toLocaleString()}
                {remaining<0&&<span style={{fontSize:'0.62rem',fontWeight:'400',marginLeft:'0.3rem'}}>over</span>}
              </div>
            </div>
            <div style={{marginTop:'0.65rem'}}>
              <div className="budget-bar-track">
                <div className="budget-bar-fill" style={{width:`${pct}%`,background:barColor}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.65rem',color:'var(--text-secondary)',marginTop:'0.25rem'}}>
                <span>{budget.currency} {totalSpent.toLocaleString()} spent</span><span>{pct}%</span>
              </div>
            </div>
          </div>
        </div>

        {spent_segs.length>0&&(
          <div style={{display:'flex',flexWrap:'wrap',gap:'0.35rem',marginTop:'0.75rem',paddingTop:'0.75rem',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
            {spent_segs.map(cat=>(
              <div key={cat.value} style={{background:`${cat.color}15`,border:`1px solid ${cat.color}30`,borderRadius:'6px',padding:'0.25rem 0.55rem',fontSize:'0.73rem'}}>
                {cat.label} <strong style={{color:cat.color}}>{budget.currency} {cat.total.toLocaleString()}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-label" style={{marginTop:'1rem'}}>Expenses ({budget.expenses.length})</div>
      {budget.expenses.length===0&&<p style={{fontSize:'0.8rem',color:'var(--text-secondary)',marginBottom:'1rem'}}>No expenses yet.</p>}
      {budget.expenses.map(exp=>{
        if (editingExpId === exp.id) {
          return (
            <div key={exp.id} className="expense-card" style={{ flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 85px', gap: '0.4rem' }}>
                <input autoFocus type="text" value={editExpDraft.name} onChange={e=>setEditExpDraft(p=>({...p,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&saveExpense()} style={{fontSize:'0.85rem',padding:'0.3rem'}}/>
                <input type="number" value={editExpDraft.amount} onChange={e=>setEditExpDraft(p=>({...p,amount:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&saveExpense()} style={{fontSize:'0.85rem',padding:'0.3rem'}}/>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                <button className="btn-icon" style={{fontSize:'0.75rem', padding:'0.2rem 0.5rem'}} onClick={()=>{setEditingExpId(null); setEditExpDraft(null);}}>Cancel</button>
                <button className="btn-primary" style={{fontSize:'0.75rem', padding:'0.2rem 0.5rem', display:'flex', alignItems:'center', gap:'3px'}} onClick={saveExpense}><Check size={11}/> Save</button>
              </div>
            </div>
          );
        }
        const cat=BUDGET_CATEGORIES.find(c=>c.value===exp.category);
        return(
          <div key={exp.id} className="expense-card" onClick={()=>{setEditingExpId(exp.id); setEditExpDraft({...exp});}} style={{cursor:'pointer'}} title="Edit expense">
            <div style={{width:'9px',height:'9px',borderRadius:'50%',background:cat?.color||'#6b7280',flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:'500',fontSize:'0.83rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{exp.name}</div>
              {exp.city&&<div style={{fontSize:'0.68rem',color:'var(--text-secondary)',display:'flex',alignItems:'center',gap:'3px'}}><MapPin size={10}/> {exp.city.split(',')[0]}</div>}
            </div>
            <div style={{fontWeight:'700',fontSize:'0.88rem',flexShrink:0}}>{budget.currency} {Number(exp.amount).toLocaleString()}</div>
            <button className="btn-icon" style={{padding:'0.2rem'}} onClick={(e)=>{e.stopPropagation();setTripData(prev=>({...prev,budget:{...prev.budget,expenses:prev.budget.expenses.filter(e=>e.id!==exp.id)}}))}}><Trash2 size={12} color="var(--danger)"/></button>
          </div>
        );
      })}

      <div className="section-divider"/>
      <div className="section-label">Add Expense</div>
      <div className="chip-group" style={{marginBottom:'0.8rem'}}>
        {[{n:'Flights',c:'transport'},{n:'Hotel',c:'accommodation'},{n:'Food/Dinner',c:'food'},{n:'Tickets',c:'activities'},{n:'Transit',c:'transport'}].map(q=>(
          <button key={q.n} className="chip" style={{fontSize:'0.65rem'}} onClick={()=>setNewExp(p=>({...p,name:q.n,category:q.c}))}>+ {q.n}</button>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 85px',gap:'0.4rem',marginBottom:'0.4rem'}}>
        <input type="text" placeholder="Expense name…" value={newExp.name} onChange={e=>setNewExp(p=>({...p,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addExpense()} style={{fontSize:'0.85rem',padding:'0.45rem 0.65rem'}}/>
        <input type="number" placeholder="Amount" value={newExp.amount} onChange={e=>setNewExp(p=>({...p,amount:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addExpense()} style={{fontSize:'0.85rem',padding:'0.45rem 0.65rem'}}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.4rem',marginBottom:'0.5rem'}}>
        <select value={newExp.category} onChange={e=>setNewExp(p=>({...p,category:e.target.value}))} style={{fontSize:'0.8rem',padding:'0.4rem'}}>
          {BUDGET_CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={newExp.city} onChange={e=>setNewExp(p=>({...p,city:e.target.value}))} style={{fontSize:'0.8rem',padding:'0.4rem'}}>
          <option value="">No city</option>
          {tripData.locations.map(l=><option key={l.id} value={l.name}>{l.name.split(',')[0]}</option>)}
        </select>
      </div>
      <button className="btn-primary" style={{width:'100%',padding:'0.55rem',display:'flex',justifyContent:'center',gap:'0.5rem',fontSize:'0.85rem'}} onClick={addExpense}>
        <Plus size={14}/> Add Expense
      </button>
    </div>
  );
};
