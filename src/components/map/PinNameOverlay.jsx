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

















































export function PinNameOverlay({pendingPin,onConfirm,onCancel}){
  const map=useMap();
  const [name,setName]=useState('');
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const inputRef=useRef();

  const updatePosition = useCallback(() => {
    if (!pendingPin) return;
    try {
      const point = map.latLngToContainerPoint(L.latLng(pendingPin.latlng[0], pendingPin.latlng[1]));
      const rect = map.getContainer().getBoundingClientRect();
      setPos({ left: rect.left + point.x, top: rect.top + point.y });
    } catch (err) {
      console.error("Error updating pin overlay position:", err);
    }
  }, [map, pendingPin]);

  useMapEvents({
    zoom: updatePosition,
    move: updatePosition,
    zoomend: updatePosition,
    moveend: updatePosition,
    resize: updatePosition,
  });

  useEffect(() => {
    if (pendingPin) {
      setName(pendingPin.suggestedName || '');
      setTimeout(() => inputRef.current?.focus(), 80);
      updatePosition();
    }
  }, [pendingPin?.latlng, pendingPin?.suggestedName, updatePosition]);

  if(!pendingPin)return null;

  return createPortal(
    <div className="pin-name-overlay" style={{left:pos.left,top:pos.top}} onClick={e=>e.stopPropagation()}>
      <div className="pin-name-caret"/>
      <div className="pin-name-label">{pendingPin.mode==='city'?'Add destination':'Name this place'}</div>
      {pendingPin.address && (
        <div style={{fontSize:'0.68rem',color:'var(--text-secondary)',marginBottom:'0.45rem',maxWidth:'240px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:'3px'}} title={pendingPin.address}>
          <MapPin size={11}/> {pendingPin.address}
        </div>
      )}
      <div style={{display:'flex',gap:'0.35rem'}}>
        <input ref={inputRef} type="text" value={name} onChange={e=>setName(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();onConfirm(name);}if(e.key==='Escape'){e.preventDefault();onCancel();}}}
          placeholder={pendingPin.mode==='city'?'City or place name…':'Place name…'}
          className="pin-name-input"
        />
        <button className="btn-primary" style={{padding:'0.35rem 0.6rem',fontSize:'0.8rem'}} onClick={()=>onConfirm(name)}>Save</button>
        <button className="btn-icon" style={{padding:'0.35rem'}} onClick={onCancel}><X size={13}/></button>
      </div>
    </div>,
    document.body
  );
}
