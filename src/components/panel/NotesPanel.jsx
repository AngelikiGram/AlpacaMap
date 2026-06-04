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

















































export const NotesPanel=({tripData,setTripData})=>{
  const[selected,setSelected]=useState('general');
  const updateNote=(key,value)=>setTripData(prev=>({...prev,notes:key==='general'?{...prev.notes,general:value}:{...prev.notes,cities:{...prev.notes.cities,[key]:value}}}));
  const currentNote=selected==='general'?tripData.notes.general:(tripData.notes.cities[selected]||'');
  const cityName=selected!=='general'?tripData.locations.find(c=>c.id===selected)?.name||'':'';
  return(
    <div>
      <div className="chip-group" style={{marginBottom:'1rem'}}>
        <button className={`chip ${selected==='general'?'active':''}`} onClick={()=>setSelected('general')}>General</button>
        {tripData.locations.map(city=><button key={city.id} className={`chip ${selected===city.id?'active':''}`} onClick={()=>setSelected(city.id)}>{city.name.split(',')[0]}</button>)}
      </div>
      <textarea rows={15} placeholder={selected==='general'?'General trip notes…':`Notes for ${cityName}…`}
        value={currentNote} onChange={e=>updateNote(selected,e.target.value)}
        style={{resize:'vertical',fontSize:'0.875rem',lineHeight:'1.6'}}
      />
      <div style={{fontSize:'0.7rem',color:'var(--text-secondary)',marginTop:'0.4rem',textAlign:'right'}}>{currentNote.length} chars · auto-saved</div>
    </div>
  );
};
