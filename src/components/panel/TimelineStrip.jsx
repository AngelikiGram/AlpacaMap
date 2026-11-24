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

















































export const TimelineStrip=({tripData,setActiveCity,setActiveTab,setCalendarExpandedDay,panelOpen})=>{
  const sorted=[...tripData.itinerary].sort((a,b)=>a.date.localeCompare(b.date));
  if(sorted.length===0)return null;
  const fmtDate=(d)=>{ const pt=new Date(d+'T12:00:00'); return isNaN(pt)?d:pt.toLocaleDateString('en-US',{month:'short',day:'numeric'}); };
  const fmtDay=(d)=>{ const pt=new Date(d+'T12:00:00'); return isNaN(pt)?'---':pt.toLocaleDateString('en-US',{weekday:'short'}); };

  return(
    <div className="timeline-strip" style={{
      left: panelOpen ? 'calc(clamp(380px, 40%, 650px) + 28px)' : '80px',
      right: '24px',
      transition: 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <div className="timeline-label">TRIP TIMELINE</div>
      <div className="timeline-scroll">
        {sorted.map(day=>{
          const city=tripData.locations.find(l=>l.name.toLowerCase().startsWith(day.location.toLowerCase().split(',')[0].toLowerCase()));
          const color=city?getCityColor(city.id,tripData.locations):'#64748b';
          return(
            <div key={day.id} className="timeline-day" role="button" tabIndex={0} style={{'--city-color':color}}
              onClick={()=>{
                setCalendarExpandedDay(day.id);
                setActiveTab('calendar');
              }}
            >
              <div className="tl-date-row">
                <div className="tl-color-dot" style={{background:color,boxShadow:`0 0 6px ${color}80`}}/>
                <div>
                  <div className="tl-weekday">{fmtDay(day.date)}</div>
                  <div className="tl-date">{fmtDate(day.date)}</div>
                </div>
              </div>
              <div className="tl-location">{day.location.split(',')[0].slice(0,11)}</div>
              <div className="tl-events-row">
                {day.events.length===0
                  ?<span className="tl-free">free</span>
                  :day.events.map(evt=><span key={evt.id} className="tl-evt-dot" title={`${evt.time} ${evt.title}`}>{EVT_EMOJI[evt.type]||'•'}</span>)
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
