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

















































export const DocumentsPanel=({tripData,setTripData})=>{
  const fileRefs=useRef({});
  return(
    <div>
      <p className="panel-hint">Upload tickets, reservations, and confirmations by category.</p>
      {DOC_SECTIONS.map(sec=>(
        <div key={sec.key} className="doc-section">
          <div className="doc-section-header"><span>{sec.icon} {sec.label}</span><span className="tag" style={{fontSize:'0.65rem'}}>{tripData.documents[sec.key].length} file{tripData.documents[sec.key].length!==1?'s':''}</span></div>
          {tripData.documents[sec.key].map(f=>(
            <div key={f.id} className="file-card">
              <FileText size={15} color="var(--accent-secondary)"/>
              <div style={{flex:1}}><div style={{fontSize:'0.8rem',fontWeight:'500'}}>{f.name}</div><div style={{fontSize:'0.7rem',color:'var(--text-secondary)'}}>{f.size}</div></div>
              <button className="btn-icon" onClick={()=>setTripData(prev=>({...prev,documents:{...prev.documents,[sec.key]:prev.documents[sec.key].filter(fi=>fi.id!==f.id)}}))}><Trash2 size={12} color="var(--danger)"/></button>
            </div>
          ))}
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" ref={el=>fileRefs.current[sec.key]=el} style={{display:'none'}} onChange={e=>{const items=Array.from(e.target.files).map(f=>({id:Date.now()+Math.random(),name:f.name,size:`${(f.size/1024).toFixed(1)} KB`}));setTripData(prev=>({...prev,documents:{...prev.documents,[sec.key]:[...prev.documents[sec.key],...items]}}));e.target.value='';}}/>
          <button className="upload-btn" onClick={()=>fileRefs.current[sec.key]?.click()}><Upload size={12}/> Upload {sec.label}</button>
        </div>
      ))}
    </div>
  );
};
