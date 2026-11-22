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

















































export const MyTripsPanel = ({ savedTrips, currentTripId, onLoad, onNew, onDelete, onClose, onExport, onImport, onLoadDemo }) => {
  const fmt = (iso) => new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  return (
    <div className="trips-overlay">
      <div className="trips-overlay-header">
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <FolderOpen size={16} color="var(--accent-primary)"/>
          <span style={{ fontWeight:'700', fontSize:'1rem', fontFamily:'Outfit,sans-serif' }}>My Trips</span>
        </div>
        <button className="info-window-close" onClick={onClose}><X size={14}/></button>
      </div>
      <div className="trips-overlay-body">
        <div style={{display:'flex',gap:'0.4rem',marginBottom:'0.5rem'}}>
          <button className="new-trip-btn" style={{flex:1,margin:0}} onClick={onNew}>
            <Plus size={14}/> New
          </button>
          <button className="new-trip-btn" style={{flex:1,margin:0,background:'rgba(16,185,129,0.12)',borderColor:'rgba(16,185,129,0.3)',color:'#10b981'}} onClick={onImport}>
            <Upload size={14}/> Import
          </button>
          <button className="new-trip-btn" style={{flex:1,margin:0,background:'rgba(59,130,246,0.12)',borderColor:'rgba(59,130,246,0.3)',color:'var(--accent-primary)'}} onClick={onExport}>
            <Save size={14}/> Export
          </button>
        </div>
        {onLoadDemo && (
          <button className="new-trip-btn" style={{width:'100%',margin:'0 0 0.5rem',background:'rgba(250,204,21,0.08)',borderColor:'rgba(250,204,21,0.3)',color:'#facc15'}} onClick={onLoadDemo}>
            🦙 Open the London demo trip
          </button>
        )}
        {savedTrips.length === 0 && (
          <p style={{ fontSize:'0.82rem', color:'var(--text-secondary)', margin:'1rem 0', lineHeight:1.5 }}>
            No saved trips yet. Start planning — your trips auto-save every few seconds.
          </p>
        )}
        {savedTrips.map(trip => (
          <div key={trip.id} className={`trip-card ${trip.id === currentTripId ? 'active' : ''}`} onClick={() => onLoad(trip)}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:'600', fontSize:'0.9rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trip.title}</div>
              <div style={{ fontSize:'0.71rem', color:'var(--text-secondary)', marginTop:'2px' }}>
                {trip.data.locations?.length ?? 0} stops · saved {fmt(trip.lastModified)}
              </div>
              <div style={{ display:'flex', gap:'4px', marginTop:'5px', flexWrap:'wrap' }}>
                {(trip.data.locations ?? []).slice(0,4).map(l => (
                  <span key={l.id} style={{ fontSize:'0.62rem', padding:'1px 7px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px' }}>
                    {l.name.split(',')[0]}
                  </span>
                ))}
                {(trip.data.locations?.length ?? 0) > 4 && <span style={{ fontSize:'0.62rem', color:'var(--text-secondary)' }}>+{trip.data.locations.length - 4}</span>}
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', alignItems:'center', flexShrink:0 }}>
              {trip.id === currentTripId && <span className="current-badge">CURRENT</span>}
              <button className="btn-icon" style={{ padding:'0.25rem' }} onClick={e => { e.stopPropagation(); onDelete(trip.id); }}>
                <Trash2 size={12} color="var(--danger)"/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
