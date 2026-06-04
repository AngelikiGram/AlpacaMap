import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';

import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, Circle, Polygon, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { Navigation, MapPin, Calendar as CalendarIcon, Search, Compass, ChevronRight, FileText, Plus, ArrowLeft, Trash2, Loader2, SlidersHorizontal, X, Info, Upload, BookOpen, ExternalLink, ChevronDown, ChevronUp, DollarSign, Package, Check, Pencil, Layers, FolderOpen, Save, Clock, Phone, Globe, Accessibility, Utensils, Coffee, Landmark, TreePine, ShoppingBag, Camera, MountainSnow, Tent, Castle, Plane, Train, Bed, Activity, Bus, Ship, CreditCard, Droplets, Car, Moon, Satellite, Eye, Sparkles, Star, Brain } from 'lucide-react';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';

import { CITY_PALETTE, getCityColor, MAP_LAYERS, SENTINEL_NONE, getTypeDetails, createDayStopIcon, createGlyphIcon, createSavedGlyphIcon, createPreviewIcon, createCityIcon, classifyWeather, detectOSMCategory, processOverpassResults, scorePlaceQuality, nameSim, semanticDedup, getZoomParams, filterMarkersAdaptive, loadTrips, loadPrefs, saveTrips, savePrefs, detectLocationType, createSearchResultIcon, getAllMapPoints, buildArc, getDistanceKm, INITIAL_TRIP, TRIPS_KEY, PREFS_KEY, TABS, wmoIcon, formatDur, searchOverpass } from "../../utils.jsx";
import { searchNominatim, fetchPlaceImage } from "../../api.js";
import { OVERPASS_URL, OVERPASS_TAGS, TOURIST_LANDMARK_TAGS, CATEGORY_ZOOM_PRIORITY, SEARCH_KEYWORDS, INTEREST_CATEGORIES, LOCATION_TYPE_PRESETS, EVENT_TYPES, TRANSPORT_ICON, EVT_EMOJI, DOC_SECTIONS, BUDGET_CATEGORIES, PACKING_TEMPLATES, ENTITY_PROFILES } from "../../config.jsx";

import { LiveImage } from "../shared/LiveImage.jsx";
import { PortalDropdown } from "../shared/PortalDropdown.jsx";
import { WeatherWidget } from "../shared/WeatherWidget.jsx";
import { DonutChart } from "../shared/DonutChart.jsx";
import { InfoWindow } from "../shared/InfoWindow.jsx";
import { PrintView } from "../shared/PrintView.jsx";


import { MapBoundsTracker, MapZoomTracker, MapClickHandler, MapFlyController, SmartMapController } from "../map/MapControllers.jsx";

import { MapSearchBar } from "../map/MapSearchBar.jsx";

import { MapClickBar } from "../map/MapClickBar.jsx";

import { PinNameOverlay } from "../map/PinNameOverlay.jsx";

import { SearchResultMarker } from "../map/SearchResultMarker.jsx";

const cleanNameForMatching = (name) => {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/^(the|a|an)\s+/g, '')
    .replace(/\s+(station|tube station|underground station|museum|gallery|park)$/g, '')
    .trim();
};


























































function MapControls({ infoOpen, hasTimeline }) {
  const map = useMap();
  const [scaleInfo, setScaleInfo] = useState({ text: '', width: 80 });

  const updateScale = useCallback(() => {
    const container = map.getContainer();
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    if (!w || !h) return;
    const maxPx = 90;
    const cx = w / 2;
    const cy = h / 2;
    try {
      const p1 = map.containerPointToLatLng(L.point(cx - maxPx / 2, cy));
      const p2 = map.containerPointToLatLng(L.point(cx + maxPx / 2, cy));
      const rawKm = getDistanceKm(p1.lat, p1.lng, p2.lat, p2.lng);
      if (!rawKm || !isFinite(rawKm) || rawKm <= 0) return;
      const niceVals = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
      const nice = [...niceVals].reverse().find(v => v <= rawKm) || niceVals[0];
      const pixW = Math.round((nice / rawKm) * maxPx);
      const text = nice < 1 ? `${Math.round(nice * 1000)} m` : `${nice} km`;
      setScaleInfo({ text, width: Math.max(20, Math.min(pixW, maxPx)) });
    } catch {}
  }, [map]);

  useEffect(() => {
    updateScale();
    map.on('zoomend moveend resize', updateScale);
    return () => { map.off('zoomend moveend resize', updateScale); };
  }, [map, updateScale]);

  const bottom = hasTimeline ? 120 : 20;

  return createPortal(
    <div style={{ position:'absolute', bottom:bottom+'px', left:'auto', right:'40px', transform:'none', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'8px', zIndex:900, transition:'bottom 0.25s ease', pointerEvents:'auto' }}>
      <div style={{ background:'rgba(8,12,26,0.93)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', overflow:'hidden', display:'flex', flexDirection:'row', boxShadow:'0 4px 20px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.08)' }}>
        <button onClick={()=>map.zoomIn()} style={{ width:38, height:38, fontSize:'18px', fontWeight:'300', color:'rgba(241,245,249,0.8)', background:'transparent', border:'none', borderRight:'1px solid rgba(255,255,255,0.06)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,sans-serif' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(59,130,246,0.25)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>+</button>
        <button onClick={()=>map.zoomOut()} style={{ width:38, height:38, fontSize:'18px', fontWeight:'300', color:'rgba(241,245,249,0.8)', background:'transparent', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,sans-serif' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(59,130,246,0.25)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>−</button>
      </div>
      <div style={{ background:'rgba(8,12,26,0.82)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'8px', padding:'5px 10px', backdropFilter:'blur(10px)', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', minWidth:'80px' }}>
        <div style={{ position:'relative', width:scaleInfo.width+'px', height:'6px' }}>
          <div style={{ position:'absolute', top:'2px', left:0, right:0, height:'2px', background:'rgba(255,255,255,0.6)' }}/>
          <div style={{ position:'absolute', top:0, left:0, width:'2px', height:'6px', background:'rgba(255,255,255,0.6)' }}/>
          <div style={{ position:'absolute', top:0, right:0, width:'2px', height:'6px', background:'rgba(255,255,255,0.6)' }}/>
        </div>
        <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.6)', whiteSpace:'nowrap', fontFamily:'Inter,sans-serif' }}>{scaleInfo.text}</div>
      </div>
    </div>,
    map.getContainer()
  );
}

// ── Polygon Area Filter ───────────────────────────────────────────────────────
function PolygonDrawer({ isDrawing, setIsDrawing, polygon, setPolygon }) {
  const [draft, setDraft] = useState([]);

  useMapEvents({
    click(e) {
      if (!isDrawing) return;
      setDraft(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
    },
    dblclick(e) {
      if (!isDrawing || draft.length < 3) return;
      e.originalEvent.preventDefault();
      const completed = [...draft, draft[0]]; // close polygon
      setPolygon(draft);
      setDraft([]);
      setIsDrawing(false);
      window.dispatchEvent(new CustomEvent('routespace-polygon', { detail: draft }));
    },
  });

  return (
    <>
      {/* Draft polygon being drawn */}
      {draft.length > 1 && (
        <Polyline positions={draft}
          pathOptions={{ color: '#fbbf24', weight: 2, dashArray: '5,5', opacity: 0.9 }}/>
      )}
      {draft.map(([lat, lng], i) => (
        <Circle key={i} center={[lat, lng]} radius={18}
          pathOptions={{ color: '#fbbf24', fillColor: '#fbbf24', fillOpacity: 0.7, weight: 1 }}/>
      ))}
      {/* Completed polygon */}
      {polygon.length > 2 && (
        <Polygon positions={polygon}
          pathOptions={{ color: '#fbbf24', fillColor: '#fbbf24', fillOpacity: 0.08, weight: 2, dashArray: '6,4' }}/>
      )}
    </>
  );
}

function HighlightTracker({ highlightedPlace }) {
  const map = useMap();
  const prevKey = useRef(null);

  useEffect(() => {
    if (!highlightedPlace) return;
    if (!Array.isArray(highlightedPlace.coords) || highlightedPlace.coords.length !== 2) return;

    const key = `${highlightedPlace.id ?? highlightedPlace.name ?? 'place'}:${highlightedPlace.coords[0]},${highlightedPlace.coords[1]}`;
    if (prevKey.current === key) return;
    prevKey.current = key;

    map.flyTo([highlightedPlace.coords[0], highlightedPlace.coords[1]], Math.max(map.getZoom(), 14), {
      duration: 0.9,
    });
  }, [highlightedPlace, map]);

  return null;
}


const createRouteStopIcon = (num, slot) => {
  const fill = slot === 'A' ? '#2563eb' : '#059669';
  const stroke = slot === 'A' ? '#93c5fd' : '#6ee7b7';
  const label = `${slot}${num}`;
  const html = `<svg width="22" height="28" viewBox="0 0 22 28" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.5));overflow:visible">
    <path d="M11 1C6 1 2 5 2 10c0 6.8 9 17 9 17S20 16.8 20 10C20 5 16 1 11 1z"
          fill="${fill}" stroke="${stroke}" stroke-width="1.8"/>
    <circle cx="11" cy="10" r="5" fill="rgba(255,255,255,0.18)"/>
    <text x="11" y="13.5" text-anchor="middle" fill="#ffffff" font-size="${label.length > 2 ? '6' : '7'}" font-weight="900" font-family="Inter,-apple-system,sans-serif">${label}</text>
  </svg>`;
  return L.divIcon({ className: '', html, iconSize: [22, 28], iconAnchor: [11, 28], popupAnchor: [0, -30] });
};

const createStabilityIcon = (num, group) => {
  let strokeColor = '#fbbf24';
  let fillColor = '#b45309';
  let strokeDash = '';
  if (group === 'anchor') {
    strokeColor = '#fbbf24'; // solid gold
    fillColor = '#b45309'; // deep amber/gold fill
  } else if (group === 'alternative') {
    strokeColor = '#a78bfa'; // solid violet
    fillColor = '#6d28d9'; // deep purple/violet fill
  } else {
    strokeColor = '#22d3ee'; // bright cyan
    fillColor = '#0f766e'; // teal/cyan fill
    strokeDash = '2,2'; // dashed
  }

  const html = `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.45));overflow:visible">
    <path d="M14 1C7.4 1 2 6.4 2 13c0 8.8 12 21 12 21S26 21.8 26 13C26 6.4 20.6 1 14 1z" 
          fill="${fillColor}" 
          stroke="${strokeColor}" 
          stroke-width="2.5" 
          stroke-dasharray="${strokeDash}"/>
    <circle cx="14" cy="13" r="6" fill="rgba(255,255,255,0.22)"/>
    <text x="14" y="16.5" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="800" font-family="Inter,-apple-system,sans-serif">${num}</text>
  </svg>`;

  return L.divIcon({
    className: '',
    html,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
  });
};

const _iconHtmlCache = new Map();
const createComplexMarkerIcon = (place, isSaved = false, isCity = false, showKnowledgeOverlay = false, claimsCount = 0, sentimentInfo = null, isHighlighted = false) => {
  const details = getTypeDetails(isCity ? 'city' : place.type);
  const color = isCity ? (place.color || '#06b6d4') : details.color;
  const typeKey = isCity ? 'city' : (place.type || 'default');
  if (!_iconHtmlCache.has(typeKey)) _iconHtmlCache.set(typeKey, renderToString(details.icon).replace(/<svg[^>]*>|<\/svg>/gi, ''));
  const iconHtml = _iconHtmlCache.get(typeKey);
  
  // Base dimensions
  const sz = isCity ? 44 : (isSaved ? 38 : 32);
  const h = isCity ? 44 : Math.round(sz * 44 / 36);
  const tipY = isCity ? 22 : Math.round(h * 42 / 44);
  const midY = isCity ? 22 : Math.round(h * 17 / 44);
  
  let pulsingHalo = '';
  let badge = '';
  
  if (showKnowledgeOverlay && sentimentInfo && claimsCount > 0) {
    const isWarning = sentimentInfo.isWarning;
    // Wave color matches the pin color to be cohesive and avoid mismatches
    const waveColor = color;
    
    // Sleek flat perspective ground-level ripple wave centered at the anchor base of the pin
    pulsingHalo = `<div style="
      position: absolute;
      width: ${isCity ? 36 : 28}px;
      height: ${isCity ? 18 : 14}px;
      left: 50%;
      top: 100%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 1.5px solid ${waveColor};
      background: ${waveColor}20;
      animation: map-ground-ripple 2.0s infinite ease-out;
      pointer-events: none;
      z-index: 1;
    "></div>`;
    
    // Brain glyph path and Alert triangle glyph path
    const brainGlyphSvg = `<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /><path d="M12 5v14" />`;
    const alertGlyphSvg = `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`;

    const badgeBg = isWarning ? '#ef4444' : '#6366f1';
    const badgeBorder = isWarning ? '#fee2e2' : '#e0e7ff';
    const glyphSvg = isWarning ? alertGlyphSvg : brainGlyphSvg;
    const badgeLabel = isWarning ? sentimentInfo.neg : claimsCount;
    
    badge = `<div style="
      position: absolute;
      top: -6px;
      right: -10px;
      background: ${badgeBg};
      border: 1.2px solid ${badgeBorder};
      border-radius: 9999px;
      padding: 1px 4px;
      font-size: 8px;
      font-weight: 800;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.5px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.45);
      z-index: 10;
      white-space: nowrap;
      pointer-events: auto;
    ">
      <svg width="7.5" height="7.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
        ${glyphSvg}
      </svg>
      <span>${badgeLabel}</span>
    </div>`;
  }
  
  // Pin SVG
  let pinSvg = '';
  if (isCity) {
    pinSvg = `<div style="background:${color};border:2.5px solid rgba(255,255,255,0.92);border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px ${color}70,0 4px 14px rgba(0,0,0,0.45);">
      <svg width="20" height="20" viewBox="0 0 24 24" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">${iconHtml}</svg>
    </div>`;
  } else if (isSaved) {
    pinSvg = `<svg width="${sz}" height="${h}" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 0 5px rgba(255,255,255,0.9)) drop-shadow(0 0 10px rgba(255,255,255,0.45)) drop-shadow(0 3px 8px rgba(0,0,0,0.6));overflow:visible">
      <path d="M18 2C9.7 2 3 8.7 3 18c0 11.6 15 24 15 24S33 29.6 33 18C33 8.7 26.3 2 18 2z" fill="${color}"/>
      <path d="M18 2C9.7 2 3 8.7 3 18c0 11.6 15 24 15 24S33 29.6 33 18C33 8.7 26.3 2 18 2z" fill="none" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="18" cy="17" r="10.5" fill="rgba(255,255,255,0.22)"/>
      <g transform="translate(8,7) scale(0.833)" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">${iconHtml}</g>
    </svg>`;
  } else {
    pinSvg = `<svg width="${sz}" height="${h}" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));overflow:visible">
      <path d="M18 2C9.7 2 3 8.7 3 18c0 11.6 15 24 15 24S33 29.6 33 18C33 8.7 26.3 2 18 2z" fill="${color}"/>
      <circle cx="18" cy="17" r="11" fill="rgba(255,255,255,0.15)"/>
      <g transform="translate(8,7) scale(0.833)" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">${iconHtml}</g>
    </svg>`;
  }
  
  const highlightRing = isHighlighted ? `<div style="
    position:absolute; inset:-8px; border-radius:50%;
    border:2.5px solid #c084fc;
    box-shadow:0 0 12px rgba(192,132,252,0.7), inset 0 0 8px rgba(192,132,252,0.25);
    animation:map-highlight-pulse 1.2s ease-in-out infinite;
    pointer-events:none; z-index:6;
  "></div>` : '';

  const html = `<div style="position:relative; width:${sz}px; height:${isCity ? sz : h}px;">
    ${highlightRing}
    ${pulsingHalo}
    <div style="position:relative; z-index:5;">
      ${pinSvg}
      ${badge}
    </div>
  </div>`;
  
  return L.divIcon({
    className: '',
    html,
    iconSize: [sz, isCity ? sz : h],
    iconAnchor: [sz / 2, tipY],
    popupAnchor: [0, -tipY + midY]
  });
};

export const MapView=({locations,routes,activeCity,mapBounds,setMapBounds,triggerPlaceInfo,pendingPin,setPendingPin,mapCenter,setMapCenter,mapLayer,setMapLayer,onAddClickDestination,highlightedPlace,visibleCategories,setVisibleCategories,aiInterests,setAiInterests,aiPlan,aiActiveDay,aiDayDisplay,setAiDayDisplay,showNeighborhoods,setShowNeighborhoods,osmHardCap,setOsmHardCap,categoryDisplayLimit,setCategoryDisplayLimit,mapMarkerLimitFactor,setMapMarkerLimitFactor,searchRadius,setSearchRadius,recFilterText,infoOpen,previewPlaces,previewFlyTarget,routeSpaceRoute,stopStabilityMap,panelOpen,hasTimeline,knowledgeGraph})=>{
  const [fetchedPaths,    setFetchedPaths]    = useState({});
  const [showLayerMenu,   setShowLayerMenu]   = useState(false);
  const [showPoiMenu,     setShowPoiMenu]     = useState(false);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [mapPolygon,      setMapPolygon]      = useState([]);
  const [flyTarget,       setFlyTarget]       = useState(null);
  const [clickInfo,       setClickInfo]       = useState(null);
  const [mapZoom,         setMapZoom]         = useState(13);
  const [neighborhoods,   setNeighborhoods]   = useState([]);
  const [nbrLoading,      setNbrLoading]      = useState(false);
  const [nbrCity,         setNbrCity]         = useState('');
  const [showKnowledgeOverlay, setShowKnowledgeOverlay] = useState(false);

  useEffect(() => {
    const handleToggle = (e) => {
      setShowKnowledgeOverlay(e.detail);
    };
    window.addEventListener('toggle-knowledge-overlay', handleToggle);
    return () => window.removeEventListener('toggle-knowledge-overlay', handleToggle);
  }, []);

  const handleToggleKnowledgeOverlay = (val) => {
    setShowKnowledgeOverlay(val);
    window.dispatchEvent(new CustomEvent('toggle-knowledge-overlay-sync', { detail: val }));
  };

  const currentLayer=MAP_LAYERS.find(l=>l.id===mapLayer)||MAP_LAYERS[0];

  useEffect(() => {
    const styleId = 'map-knowledge-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes map-ground-ripple {
          0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0.85; }
          100% { transform: translate(-50%, -50%) scale(2.0); opacity: 0; }
        }
        @keyframes warning-blink {
          0% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.1); opacity: 1; filter: drop-shadow(0 0 5px #ef4444); }
          100% { transform: scale(1); opacity: 0.9; }
        }
        @keyframes map-highlight-pulse {
          0%,100% { transform: scale(1); opacity: 0.9; box-shadow: 0 0 12px rgba(192,132,252,0.7); }
          50% { transform: scale(1.18); opacity: 0.6; box-shadow: 0 0 22px rgba(192,132,252,0.4); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const resolvePlaceCoords = useCallback((name) => {
    if (!name) return null;
    const lowerName = name.toLowerCase().trim();
    if (activeCity?.places) {
      const found = activeCity.places.find(p => p.name.toLowerCase().trim() === lowerName || p.name.toLowerCase().trim().includes(lowerName) || lowerName.includes(p.name.toLowerCase().trim()));
      if (found && Array.isArray(found.coords) && found.coords.length === 2) return found.coords;
    }
    if (activeCity?.recommendations) {
      const found = activeCity.recommendations.find(r => r.name.toLowerCase().trim() === lowerName || r.name.toLowerCase().trim().includes(lowerName) || lowerName.includes(r.name.toLowerCase().trim()));
      if (found && Array.isArray(found.coords) && found.coords.length === 2) return found.coords;
    }
    if (previewPlaces) {
      const found = previewPlaces.find(p => p.name.toLowerCase().trim() === lowerName || p.name.toLowerCase().trim().includes(lowerName) || lowerName.includes(p.name.toLowerCase().trim()));
      if (found && Array.isArray(found.coords) && found.coords.length === 2) return found.coords;
    }
    return null;
  }, [activeCity, previewPlaces]);

  const allCityNames = useMemo(() => {
    return [
      ...(locations || []).map(l => l.name.split(',')[0]),
      activeCity?.name?.split(',')[0]
    ].filter(Boolean);
  }, [locations, activeCity]);

  const cityNamesSet = useMemo(() => {
    return new Set(allCityNames.map(name => name.toLowerCase().trim()));
  }, [allCityNames]);

  // Pre-compute per-place stats once when the graph changes — O(n) build, O(1) per-marker lookup
  const knowledgeStats = useMemo(() => {
    const placeMap = new Map(); // cleanName → nodes[]
    const cityMap  = new Map(); // cityNameLower → nodes[]
    (knowledgeGraph?.nodes || []).forEach(n => {
      if (!n.place || !n.claim) return;
      const nPlace = n.place.toLowerCase().trim();
      if (cityNamesSet.has(nPlace)) {
        if (!cityMap.has(nPlace)) cityMap.set(nPlace, []);
        cityMap.get(nPlace).push(n);
      } else {
        const ck = cleanNameForMatching(nPlace);
        if (ck.length <= 2) return;
        if (!placeMap.has(ck)) placeMap.set(ck, []);
        placeMap.get(ck).push(n);
      }
    });
    const toStats = (nodes) => {
      const seen = new Set();
      const u = nodes.filter(n => { const k = n.claim.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
      if (!u.length) return null;
      const pos = u.filter(n => n.evaluation?.sentiment === 'positive').length;
      const neg = u.filter(n => n.evaluation?.sentiment === 'negative').length;
      const isWarning = u.some(n => { const t = (n.claim || '').toLowerCase(); return n.evaluation?.sentiment === 'negative' || t.includes('scam') || t.includes('pickpocket') || t.includes('avoid') || t.includes('beware') || t.includes('thief'); });
      return { count: u.length, pos, neg, isWarning, ratio: pos / (pos + neg || 1) };
    };
    const placeStats = new Map([...placeMap].map(([k, v]) => [k, toStats(v)]).filter(([, v]) => v));
    const cityStats  = new Map([...cityMap ].map(([k, v]) => [k, toStats(v)]).filter(([, v]) => v));
    return { placeStats, cityStats };
  }, [knowledgeGraph?.nodes, cityNamesSet]);

  const getClaimsForPlace = useCallback((name, isCity = false) => {
    if (!name) return 0;
    const pName = name.toLowerCase().trim();
    const pc = knowledgeStats.placeStats.get(cleanNameForMatching(pName))?.count || 0;
    if (!isCity) return pc;
    return pc + (knowledgeStats.cityStats.get(pName)?.count || 0);
  }, [knowledgeStats]);

  const getPlaceSentimentInfo = useCallback((name, isCity = false) => {
    if (!name) return null;
    const pName = name.toLowerCase().trim();
    const ps = knowledgeStats.placeStats.get(cleanNameForMatching(pName));
    if (!isCity) return ps ? { total: ps.count, pos: ps.pos, neg: ps.neg, ratio: ps.ratio, isWarning: ps.isWarning } : null;
    const cs = knowledgeStats.cityStats.get(pName);
    if (!ps && !cs) return null;
    const count = (cs?.count || 0) + (ps?.count || 0);
    const pos   = (cs?.pos   || 0) + (ps?.pos   || 0);
    const neg   = (cs?.neg   || 0) + (ps?.neg   || 0);
    return { total: count, pos, neg, ratio: pos / (pos + neg || 1), isWarning: cs?.isWarning || ps?.isWarning || false };
  }, [knowledgeStats]);

  const sequencePaths = useMemo(() => {
    if (!showKnowledgeOverlay || !knowledgeGraph?.nodes) return [];
    const paths = [];
    knowledgeGraph.nodes.forEach(n => {
      if (n.claimType === 'sequence' && n.nextPlace && n.place) {
        const fromCoords = resolvePlaceCoords(n.place);
        const toCoords = resolvePlaceCoords(n.nextPlace);
        if (fromCoords && toCoords) {
          paths.push({
            id: n.id,
            from: n.place,
            to: n.nextPlace,
            positions: [fromCoords, toCoords],
            claim: n.claim,
          });
        }
      }
    });
    return paths;
  }, [showKnowledgeOverlay, knowledgeGraph?.nodes, resolvePlaceCoords]);

  // Pre-compute overlay panel stats — avoids 3 separate .filter() calls inside JSX on every render
  const overlaySummary = useMemo(() => {
    const nodes = knowledgeGraph?.nodes || [];
    if (!nodes.length) return null;
    const pos = nodes.filter(n => n.evaluation?.sentiment === 'positive').length;
    const neg = nodes.filter(n => n.evaluation?.sentiment === 'negative').length;
    const warnings = nodes.filter(n => { const t = (n.claim || '').toLowerCase(); return n.evaluation?.sentiment === 'negative' || t.includes('scam') || t.includes('pickpocket') || t.includes('avoid') || t.includes('beware'); }).length;
    const score = Math.round((pos / (pos + neg || 1)) * 100);
    return { total: nodes.length, pos, neg, warnings, score };
  }, [knowledgeGraph?.nodes]);

  const NBR_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#ef4444','#84cc16','#f97316','#a78bfa','#14b8a6','#f43f5e'];

  useEffect(()=>{
    if (!showNeighborhoods) return;
    const cityName = activeCity?.name || locations[0]?.name;
    if (!cityName || cityName === nbrCity) return;
    setNbrLoading(true);
    setNeighborhoods([]);
    const baseName = cityName.split(',')[0].trim();
    const query = `[out:json][timeout:30];area["name"="${baseName}"]["admin_level"~"^(4|6|8)$"]->.city;(relation(area.city)["boundary"="administrative"]["admin_level"~"^(8|9|10)$"]["name"];);out geom;`;
    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
      .then(r=>r.json())
      .then(data=>{
        const results = (data.elements||[]).map((rel,idx)=>{
          const outer = (rel.members||[]).filter(m=>m.type==='way'&&m.role==='outer'&&m.geometry);
          if (!outer.length) return null;
          const coords = outer.flatMap(w=>w.geometry.map(({lat,lon})=>[lat,lon]));
          return { name: rel.tags?.name||`District ${idx+1}`, coords, color: NBR_COLORS[idx%NBR_COLORS.length] };
        }).filter(Boolean);
        setNeighborhoods(results);
        setNbrCity(cityName);
      })
      .catch(()=>{})
      .finally(()=>setNbrLoading(false));
  },[showNeighborhoods, activeCity?.name, locations]);

  useEffect(()=>{
    routes.forEach(async route=>{
      if(fetchedPaths[route.id]||route.mode==='flight')return;
      const allPoints = getAllMapPoints(locations);
      const from=allPoints.find(l=>l.id===route.from),to=allPoints.find(l=>l.id===route.to);
      if(!from||!to)return;
      try{
        const data=await fetch(`https://router.project-osrm.org/route/v1/driving/${from.coords[1]},${from.coords[0]};${to.coords[1]},${to.coords[0]}?overview=full&geometries=geojson`,{signal:AbortSignal.timeout(10000)}).then(r=>r.json());
        if(data.code==='Ok'&&data.routes?.[0]){
          setFetchedPaths(prev=>({...prev,[route.id]:data.routes[0].geometry.coordinates.map(([lon,lat])=>[lat,lon])}));
        }
      }catch{}
    });
  },[routes,locations]);

  return(
    <div className={`map-wrapper${infoOpen?' info-open':''}`}>
      {/* Floating map search bar */}
      <MapSearchBar onFlyTo={(t) => { setFlyTarget(t); setClickInfo(null); }} panelOpen={panelOpen} />
      {/* Location info bar (overview mode click) */}
      <MapClickBar info={activeCity?null:clickInfo} onAddDestination={(info)=>{ onAddClickDestination(info); setClickInfo(null); }} onClose={()=>setClickInfo(null)}/>

      {/* Floating Knowledge Summary Panel on Map */}
      {showKnowledgeOverlay && knowledgeGraph?.nodes?.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '76px',
          right: '20px',
          zIndex: 1000,
          background: 'rgba(8,12,26,0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(236,72,153,0.3)',
          borderRadius: '14px',
          padding: '12px 14px',
          width: '200px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
          pointerEvents: 'auto',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Brain size={14} color="#ec4899" style={{ filter: 'drop-shadow(0 0 4px #ec4899)' }}/>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)' }}>City Knowledge Index</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Ingests:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{knowledgeGraph.nodes.length} claims</strong>
            </div>
            {overlaySummary && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sentiment Index:</span>
                  <strong style={{ color: overlaySummary.score > 60 ? '#6366f1' : overlaySummary.score > 40 ? '#f59e0b' : '#f97316' }}>{overlaySummary.score}% Pos</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Safety Alerts:</span>
                  <strong style={{ color: overlaySummary.warnings > 0 ? '#f97316' : 'var(--text-secondary)' }}>{overlaySummary.warnings} Warnings</strong>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px', display: 'flex' }}>
                  {overlaySummary.pos > 0 && <div style={{ flex: overlaySummary.pos, background: '#6366f1' }}/>}
                  {overlaySummary.total - overlaySummary.pos - overlaySummary.neg > 0 && <div style={{ flex: overlaySummary.total - overlaySummary.pos - overlaySummary.neg, background: '#6b7280' }}/>}
                  {overlaySummary.neg > 0 && <div style={{ flex: overlaySummary.neg, background: '#f97316' }}/>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating RouteSpace Map Legend */}
      {routeSpaceRoute && (
        <div style={{ position:'absolute', bottom:'20px', left:'50%', transform:'translateX(-50%)', zIndex:1000, background:'rgba(8,12,26,0.85)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'12px', padding:'8px 12px', display:'flex', alignItems:'center', gap:'12px', boxShadow:'0 4px 20px rgba(0,0,0,0.4)', pointerEvents:'none' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <div style={{ width:'12px', height:'3px', background:'#c084fc', borderRadius:'2px' }}/>
              <span style={{ fontSize:'0.7rem', color:'#c084fc', fontWeight:'600' }}>Active Route</span>
            </div>
          </div>
        </div>
      )}
      <MapContainer center={[46.8566,5.3522]} zoom={6} maxZoom={22} style={{height:'100%',width:'100%'}} zoomControl={false}>
        {/* Base layer */}
        <TileLayer key={mapLayer} url={currentLayer.url} attribution={currentLayer.attr} maxZoom={22} maxNativeZoom={currentLayer.maxNative} keepBuffer={4} subdomains={currentLayer.subdomains||'abc'}/>
        {/* Labels overlay (satellite, etc.) */}
        {currentLayer.labelsUrl && (
          <TileLayer key={`${mapLayer}-labels`} url={currentLayer.labelsUrl} attribution="" maxZoom={22} maxNativeZoom={19} subdomains="abcd" zIndex={500} opacity={0.9}/>
        )}
        {/* Fly-to controller + search result pin */}
        <MapFlyController target={flyTarget}/>
        <MapFlyController target={previewFlyTarget}/>
        <SearchResultMarker target={flyTarget}/>
        <MapControls infoOpen={infoOpen} hasTimeline={hasTimeline}/>
        <SmartMapController activeCity={activeCity} locations={locations}/>
        <HighlightTracker highlightedPlace={highlightedPlace}/>
        <MapBoundsTracker onCenterChange={setMapCenter} onBoundsChange={setMapBounds}/>
        <PolygonDrawer isDrawing={isDrawingPolygon} setIsDrawing={setIsDrawingPolygon} polygon={mapPolygon} setPolygon={setMapPolygon}/>
        <MapZoomTracker onZoomChange={setMapZoom}/>
        <MapClickHandler activeCity={activeCity} setPendingPin={setPendingPin} setClickInfo={setClickInfo} triggerPlaceInfo={triggerPlaceInfo}/>
        <PinNameOverlay pendingPin={pendingPin} onConfirm={name=>{pendingPin&&window._confirmPin?.(name);}} onCancel={()=>setPendingPin(null)}/>

        {activeCity?(
          <>
            {/* Dashed search radius circle */}
            {mapCenter && searchRadius && (
              <Circle
                center={[mapCenter.lat, mapCenter.lng]}
                radius={searchRadius * 1000}
                pathOptions={{ color: '#3b82f6', dashArray: '6 8', weight: 2, fillOpacity: 0.04 }}
              />
            )}
            
            {/* Active City Center Marker with general claims badge support */}
            {mapCenter && (() => {
              const isCity = true;
              const claimsCount = getClaimsForPlace(activeCity.name, isCity);
              const sentimentInfo = getPlaceSentimentInfo(activeCity.name, isCity);
              const isHL = highlightedPlace?.name?.toLowerCase() === activeCity.name?.toLowerCase();
              const complexIcon = createComplexMarkerIcon(activeCity, false, true, showKnowledgeOverlay, claimsCount, sentimentInfo, isHL);
              return (
                <Marker
                  key="active-city-center"
                  position={[mapCenter.lat, mapCenter.lng]} 
                  draggable 
                  icon={complexIcon}
                  zIndexOffset={100}
                  eventHandlers={{
                    dragend: (e) => {
                      const ll = e.target.getLatLng();
                      setMapCenter({ lat: ll.lat, lng: ll.lng });
                      setFlyTarget({ lat: ll.lat, lon: ll.lng, zoom: mapZoom, duration: 0.4 });
                    },
                    click: () => triggerPlaceInfo({ id: activeCity.id, name: activeCity.name, type: 'city', coords: [mapCenter.lat, mapCenter.lng], isCity: true })
                  }}
                >
                  <Tooltip direction="top" offset={[0, -20]} className="custom-tooltip">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{activeCity.name}</span>
                      {showKnowledgeOverlay && claimsCount > 0 && (
                        <span style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '6px', padding: '2px 6px', fontSize: '0.62rem', color: '#a5b4fc', marginLeft: '6px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
                            <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                            <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
                            <path d="M12 5v14" />
                          </svg>
                          <span>{claimsCount}</span>
                        </span>
                      )}
                    </div>
                  </Tooltip>
                </Marker>
              );
            })()}

            {activeCity.places.filter(p=>Array.isArray(p.coords)&&p.coords.length===2&&p.coords[0]!=null&&p.coords[1]!=null).map(p=>{
              const claimsCount = getClaimsForPlace(p.name);
              const sentimentInfo = getPlaceSentimentInfo(p.name);
              const isHL = highlightedPlace?.name?.toLowerCase() === p.name?.toLowerCase();
              const complexIcon = createComplexMarkerIcon(p, true, false, showKnowledgeOverlay, claimsCount, sentimentInfo, isHL);
              return (
                <Marker key={`p-group-${p.id}`} position={p.coords} icon={complexIcon} zIndexOffset={isHL ? 500 : 100} eventHandlers={{click:()=>triggerPlaceInfo(p)}}>
                  <Tooltip direction="top" offset={[0, -22]} className="custom-tooltip">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Star size={11} fill="#fbbf24" color="#fbbf24" style={{verticalAlign:'middle'}}/>
                      <span>{p.name}</span>
                      {showKnowledgeOverlay && claimsCount > 0 && (
                        <span style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '6px', padding: '2px 6px', fontSize: '0.62rem', color: '#a5b4fc', marginLeft: '6px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
                            <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                            <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
                            <path d="M12 5v14" />
                          </svg>
                          <span>{claimsCount}</span>
                        </span>
                      )}
                    </div>
                  </Tooltip>
                </Marker>
              );
            })}
            {/* AI-suggested preview markers (not yet saved) */}
            {(previewPlaces||[]).filter(p=>Array.isArray(p.coords)&&p.coords.length===2).map((p,i)=>(
              <Marker key={`prev-${i}`} position={p.coords} icon={createPreviewIcon(p.type)} opacity={0.85}>
                <Tooltip direction="top" offset={[0, -18]} className="custom-tooltip">✦ {p.name}</Tooltip>
              </Marker>
            ))}
            {/* Show exactly the same POIs on the map as in the left menu, per category, for the full search radius */}
            {(() => {
              const markers = [];
              const visibleCats = INTEREST_CATEGORIES.filter(cat => activeCity.recommendations.some(r => r.type === cat.value))
                .filter(cat => aiInterests.length === 0 || aiInterests.includes(cat.value));
              
              // Let's identify recommendations with claims to always include them on the map
              const recsWithClaims = activeCity.recommendations.filter(r => getClaimsForPlace(r.name) > 0);
              const recsToShow = new Map();

              visibleCats.forEach(cat => {
                let recsForCat = activeCity.recommendations.filter(r => r.type === cat.value && r.name.toLowerCase().includes(recFilterText.toLowerCase()));
                // Sort by quality score descending, then distance
                recsForCat = recsForCat.sort((a, b) => (b._qualityScore || 0) - (a._qualityScore || 0) || (a.distanceKm - b.distanceKm));
                // Use mapMarkerLimitFactor as a multiplier for the threshold
                const limit = Math.max(1, Math.round(categoryDisplayLimit * mapMarkerLimitFactor));
                recsForCat.slice(0, limit).forEach(r => recsToShow.set(r.id, r));
              });

              // Bypassing filter/density limits for any recommendation that has active claims
              recsWithClaims.forEach(r => {
                if (r.name.toLowerCase().includes(recFilterText.toLowerCase())) {
                  recsToShow.set(r.id, r);
                }
              });

              recsToShow.forEach(r => {
                const claimsCount = getClaimsForPlace(r.name);
                const sentimentInfo = getPlaceSentimentInfo(r.name);
                const isHL = highlightedPlace?.name?.toLowerCase() === r.name?.toLowerCase();
                const complexIcon = createComplexMarkerIcon(r, false, false, showKnowledgeOverlay, claimsCount, sentimentInfo, isHL);
                markers.push(
                  <Marker key={`r-group-${r.id}`} position={r.coords} icon={complexIcon} opacity={0.92} zIndexOffset={isHL ? 500 : 80} eventHandlers={{click:()=>triggerPlaceInfo(r)}}>
                    <Tooltip direction="top" offset={[0, -20]} className="custom-tooltip">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{r.name}</span>
                        {showKnowledgeOverlay && claimsCount > 0 && (
                          <span style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '6px', padding: '2px 6px', fontSize: '0.62rem', color: '#a5b4fc', marginLeft: '6px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
                              <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                              <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
                              <path d="M12 5v14" />
                            </svg>
                            <span>{claimsCount}</span>
                          </span>
                        )}
                      </div>
                    </Tooltip>
                  </Marker>
                );
              });
              return markers;
            })()}

            {/* ── Knowledge Graph Sequence Overlay ────────────────────────────── */}
            {showKnowledgeOverlay && sequencePaths.map(p => (
              <Polyline
                key={`kg-seq-${p.id}`}
                positions={p.positions}
                pathOptions={{ color: '#6366f1', weight: 3, dashArray: '5, 8', opacity: 0.85 }}
              >
                <Tooltip sticky>
                  <div style={{ fontSize: '0.72rem', padding: '2px', fontFamily: 'Inter, sans-serif' }}>
                    <div style={{ fontWeight: '700', color: '#818cf8' }}>Sequence Direction</div>
                    <strong>{p.from}</strong> → <strong>{p.to}</strong>
                    <div style={{ color: 'rgba(255,255,255,0.7)', marginTop: '4px', fontStyle: 'italic' }}>"{p.claim}"</div>
                  </div>
                </Tooltip>
              </Polyline>
            ))}
          </>
        ):(
          <>
            {locations.map(loc=>{
              const isCity = true;
              const claimsCount = getClaimsForPlace(loc.name, isCity);
              const sentimentInfo = getPlaceSentimentInfo(loc.name, isCity);
              const cityColor = getCityColor(loc.id, locations);
              const isHL = highlightedPlace?.name?.toLowerCase() === loc.name?.toLowerCase();
              const complexIcon = createComplexMarkerIcon({ ...loc, color: cityColor }, false, true, showKnowledgeOverlay, claimsCount, sentimentInfo, isHL);
              return (
                <Marker key={`city-group-${loc.id}`} position={loc.coords} icon={complexIcon} zIndexOffset={isHL ? 500 : 100}
                  eventHandlers={{click:()=>triggerPlaceInfo({id:loc.id,name:loc.name,type:'city',coords:loc.coords,isCity:true})}}
                >
                  <Tooltip direction="top" offset={[0, -20]} className="custom-tooltip">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{loc.name}</span>
                      {showKnowledgeOverlay && claimsCount > 0 && (
                        <span style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '6px', padding: '2px 6px', fontSize: '0.62rem', color: '#a5b4fc', marginLeft: '6px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
                            <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                            <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
                            <path d="M12 5v14" />
                          </svg>
                          <span>{claimsCount}</span>
                        </span>
                      )}
                    </div>
                  </Tooltip>
                </Marker>
              );
            })}
            {routes.map(route=>{
              const allPoints = getAllMapPoints(locations);
              const from=allPoints.find(l=>l.id===route.from),to=allPoints.find(l=>l.id===route.to);
              if(!from||!to)return null;
              const path=route.mode==='flight'?buildArc(from.coords,to.coords):(fetchedPaths[route.id]||route.path);
              const color=getCityColor(from.parentId,locations);
              return(
                <Polyline key={route.id} positions={path}
                  pathOptions={{color,weight:route.mode==='flight'?2:3,dashArray:route.mode==='flight'?'4,8':undefined,opacity:0.75}}
                />
              );
            })}
          </>
        )}
        {/* ── RouteSpace Active Route Overlay ────────────────────────────────── */}
        {routeSpaceRoute && (
          <React.Fragment key="routespace-overlay">
            {routeSpaceRoute && routeSpaceRoute.stops && routeSpaceRoute.stops.length >= 2 && (
              <Polyline 
                positions={routeSpaceRoute.stops.map(s => s.coords)} 
                pathOptions={{ color: '#c084fc', weight: 6, opacity: 0.95 }} 
              />
            )}

            {/* Active Route Large Stability Pins */}
            {routeSpaceRoute && routeSpaceRoute.stops && routeSpaceRoute.stops.map((stop, sIdx) => {
              const key = stop.name.toLowerCase();
              const stability = stopStabilityMap?.[key];
              const group = stability?.category || 'outlier';
              const freqPct = stability ? Math.round(stability.frequency * 100) : 0;
              const tooltipLabel = group === 'anchor' 
                ? `Stable Anchor (appears in ${freqPct}% of routes)` 
                : group === 'alternative' 
                ? `Flexible Alternative (appears in ${freqPct}% of routes)` 
                : `Outlier Sight (appears in ${freqPct}% of routes)`;

              return (
                <Marker 
                  key={`rs-marker-${sIdx}`} 
                  position={stop.coords} 
                  icon={createStabilityIcon(sIdx + 1, group)} 
                  zIndexOffset={400}
                  eventHandlers={{ click: () => triggerPlaceInfo(stop) }}
                >
                  <Tooltip direction="top" offset={[0, -16]} className="custom-tooltip" permanent={false}>
                    <div style={{ fontWeight: 'bold' }}>{stop.name}</div>
                    <div style={{ fontSize: '0.68rem', color: group === 'anchor' ? '#fbbf24' : group === 'alternative' ? '#a78bfa' : '#22d3ee', marginTop: '2px' }}>
                      {tooltipLabel}
                    </div>
                  </Tooltip>
                </Marker>
              );
            })}
          </React.Fragment>
        )}

        {/* ── Neighborhood overlays ───────────────────────────────────────────── */}
        {showNeighborhoods&&neighborhoods.map((nbr,ni)=>(
          <Polygon key={'nbr'+ni} positions={nbr.coords}
            pathOptions={{color:nbr.color,weight:2,opacity:0.7,fillOpacity:0.08,fillColor:nbr.color}}>
            <Tooltip sticky>{nbr.name}</Tooltip>
          </Polygon>
        ))}

        {/* ── AI Plan day routes & stop markers ──────────────────────────────── */}
        {aiPlan&&aiDayDisplay!=='none'&&(aiPlan.days||[]).map((day,di)=>{
          if (aiDayDisplay==='current'&&di!==aiActiveDay) return null;
          const stops=(day.stops||day.places||[]).filter(s=>Array.isArray(s.coords)&&s.coords.length===2);
          return(
            <React.Fragment key={'day'+di}>
              {stops.length>=2&&<Polyline positions={stops.map(s=>s.coords)} pathOptions={{color:day.color,weight:3,opacity:0.65,dashArray:'7,5'}}/>}
              {stops.map((stop,si)=>(
                <Marker key={'as'+di+'-'+si} position={stop.coords} icon={createDayStopIcon(si+1,day.color)} zIndexOffset={300}
                  eventHandlers={{ click: () => triggerPlaceInfo({ id:`ai-${di}-${si}`, name:stop.name, type:stop.type||'attraction', coords:stop.coords, extract:[`Day ${di+1} · Stop ${si+1}`,stop.time&&`Time: ${stop.time}`,stop.duration&&`Duration: ${stop.duration}`,stop.notes].filter(Boolean).join('\n'), osmTags:null }) }}>
                  <Tooltip direction="top" offset={[0,-16]} className="custom-tooltip" permanent={false}>{stop.time&&<span style={{fontWeight:600,marginRight:4}}>{stop.time}</span>}{stop.name}</Tooltip>
                </Marker>
              ))}
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* Map Controls */}
      <div className="map-layer-switcher">
        <div style={{position:'relative', display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
          <button className="layer-toggle-btn"
            onClick={() => {
              if (isDrawingPolygon) { setIsDrawingPolygon(false); return; }
              if (mapPolygon.length > 0) {
                setMapPolygon([]);
                window.dispatchEvent(new CustomEvent('routespace-polygon', { detail: [] }));
                return;
              }
              setIsDrawingPolygon(true);
            }}
            title={isDrawingPolygon ? 'Click map to add polygon vertices, double-click to finish' : mapPolygon.length > 0 ? 'Clear area filter' : 'Draw area filter'}
            style={{ background: isDrawingPolygon ? 'rgba(251,191,36,0.2)' : mapPolygon.length > 0 ? 'rgba(251,191,36,0.1)' : undefined, borderColor: (isDrawingPolygon || mapPolygon.length > 0) ? '#fbbf24' : undefined }}>
            {isDrawingPolygon ? <X size={15}/> : <Pencil size={15}/>}
            <span className="layer-toggle-label">{isDrawingPolygon ? 'Drawing… dbl-click to finish' : mapPolygon.length > 0 ? 'Clear area filter' : 'Draw area'}</span>
          </button>
          <button className="layer-toggle-btn" onClick={()=>{setShowLayerMenu(v=>!v); setShowPoiMenu(false);}} title="Switch map layer" style={{ marginTop:'14px' }}>
            <Layers size={15}/><span className="layer-toggle-label">{currentLayer.icon} {currentLayer.label}</span>
            <ChevronDown size={11} style={{opacity:0.6}}/>
          </button>
          {showLayerMenu&&(
            <div className="layer-menu" style={{position:'absolute', top:'calc(100% + 6px)', right:0}}>
              <div className="layer-menu-header">Map Style</div>
            {MAP_LAYERS.map(layer=>(
              <button key={layer.id} className={`layer-menu-item ${mapLayer===layer.id?'active':''}`}
                onClick={()=>{setMapLayer(layer.id);setShowLayerMenu(false);}}>
                <span className="layer-menu-icon">{layer.icon}</span>
                <div style={{flex:1,textAlign:'left'}}>
                  <div style={{fontWeight:'600',fontSize:'0.82rem',color: mapLayer===layer.id?'var(--accent-primary)':'var(--text-primary)'}}>{layer.label}</div>
                  <div style={{fontSize:'0.68rem',color:'var(--text-secondary)',marginTop:'1px'}}>{layer.desc}</div>
                </div>
                {mapLayer===layer.id&&<Check size={13} color="var(--accent-primary)" style={{flexShrink:0}}/>}
              </button>
            ))}
            {aiPlan&&aiPlan.days?.length>0&&(
              <>
                <div className="layer-menu-header" style={{marginTop:'6px'}}>AI Plan on Map</div>
                {[['current','Active day only'],['all','All days'],['none','Hidden']].map(([v,l])=>(
                  <button key={v} className={`layer-menu-item ${aiDayDisplay===v?'active':''}`} onClick={()=>setAiDayDisplay(v)}>
                    <Eye size={13} style={{flexShrink:0,opacity:0.7}}/>
                    <div style={{flex:1,textAlign:'left',fontSize:'0.8rem'}}>{l}</div>
                    {aiDayDisplay===v&&<Check size={13} color="var(--accent-primary)" style={{flexShrink:0}}/>}
                  </button>
                ))}
              </>
            )}
            <div className="layer-menu-header" style={{marginTop:'6px'}}>Overlays</div>
            <button className={`layer-menu-item ${showNeighborhoods?'active':''}`} onClick={()=>setShowNeighborhoods(v=>!v)}>
              <Layers size={13} style={{flexShrink:0,opacity:0.7}}/>
              <div style={{flex:1,textAlign:'left'}}>
                <div style={{fontWeight:'600',fontSize:'0.82rem',color:showNeighborhoods?'var(--accent-primary)':'var(--text-primary)'}}>Neighborhoods</div>
                <div style={{fontSize:'0.68rem',color:'var(--text-secondary)',marginTop:'1px'}}>{nbrLoading?'Loading…':neighborhoods.length>0?`${neighborhoods.length} districts loaded`:'Districts & neighborhoods'}</div>
              </div>
              {showNeighborhoods&&<Check size={13} color="var(--accent-primary)" style={{flexShrink:0}}/>}
            </button>
            <button className={`layer-menu-item ${showKnowledgeOverlay?'active':''}`} onClick={()=>handleToggleKnowledgeOverlay(!showKnowledgeOverlay)}>
              <Brain size={13} style={{flexShrink:0,opacity:0.7}}/>
              <div style={{flex:1,textAlign:'left'}}>
                <div style={{fontWeight:'600',fontSize:'0.82rem',color:showKnowledgeOverlay?'var(--accent-primary)':'var(--text-primary)'}}>Knowledge Overlay</div>
                <div style={{fontSize:'0.68rem',color:'var(--text-secondary)',marginTop:'1px'}}>
                  {knowledgeGraph?.nodes?.length ? `${knowledgeGraph.nodes.length} nodes loaded` : 'Show tips & sequence overlay'}
                </div>
              </div>
              {showKnowledgeOverlay&&<Check size={13} color="var(--accent-primary)" style={{flexShrink:0}}/>}
            </button>
          </div>
        )}
        </div>
        <div style={{position:'relative', display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
          <button className="layer-toggle-btn" onClick={()=>{setShowPoiMenu(v=>!v); setShowLayerMenu(false);}} title="Filter places on map">
            <SlidersHorizontal size={15}/><span className="layer-toggle-label">Filter</span>
            <ChevronDown size={11} style={{opacity:0.6}}/>
          </button>
          {showPoiMenu&&(
            <div className="layer-menu" style={{position:'absolute', top:'calc(100% + 6px)', right:0, padding:'12px', width:'268px', pointerEvents:'auto'}}>

              {/* What types to show on the map right now */}
              <div className="layer-menu-header">Show on map</div>
              <p style={{fontSize:'0.67rem',color:'var(--text-secondary)',margin:'2px 0 8px',lineHeight:1.4}}>Tap a type to hide or show those pins. All active = show everything.</p>
              <div className="chip-group" style={{flexWrap:'wrap', marginBottom:'14px'}}>
                {INTEREST_CATEGORIES.map(({value, label})=>{
                  const {icon} = getTypeDetails(value);
                  const isOn = aiInterests.includes(value);
                  return (
                    <button key={value} type="button" className={`chip ${isOn?'active':''}`}
                      onClick={() => {
                        setAiInterests(prev => prev.includes(value)
                          ? prev.filter(v => v !== value)
                          : [...prev, value]);
                      }}>
                      <span style={{display:'flex',alignItems:'center',gap:'3px'}}>{icon} {label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Radius circle around the pin */}
              {searchRadius != null && setSearchRadius && (
                <>
                  <div className="layer-menu-header">Search radius</div>
                  <p style={{fontSize:'0.67rem',color:'var(--text-secondary)',margin:'2px 0 6px',lineHeight:1.4}}>The blue circle on the map — only places inside it are loaded.</p>
                  <div style={{display:'flex',alignItems:'center',gap:'10px',paddingBottom:'12px'}}>
                    <input type="range" min={1} max={20} step={1} value={searchRadius}
                      onChange={e=>setSearchRadius(Number(e.target.value))}
                      style={{flex:1, accentColor:'var(--accent-primary)'}}/>
                    <span style={{fontSize:'0.9rem',fontWeight:700,color:'var(--text-primary)',minWidth:'44px',textAlign:'right'}}>{searchRadius} km</span>
                  </div>
                </>
              )}

              {/* How many pins appear at once */}
              <div className="layer-menu-header">Pin density</div>
              <p style={{fontSize:'0.67rem',color:'var(--text-secondary)',margin:'2px 0 6px',lineHeight:1.4}}>How crowded the map looks. Lower = fewer but cleaner. Higher = more places shown.</p>
              <div style={{display:'flex',alignItems:'center',gap:'10px',paddingBottom:'12px'}}>
                <span style={{fontSize:'0.68rem',color:'var(--text-secondary)',whiteSpace:'nowrap'}}>Fewer</span>
                <input type="range" min="0.5" max="3.0" step="0.5" value={mapMarkerLimitFactor}
                  onChange={e=>setMapMarkerLimitFactor(Number(Number(e.target.value).toFixed(1)))}
                  style={{flex:1, accentColor:'var(--accent-primary)'}}/>
                <span style={{fontSize:'0.68rem',color:'var(--text-secondary)',whiteSpace:'nowrap'}}>More</span>
              </div>

              {/* How many results per category in the Explore panel */}
              <div className="layer-menu-header">Results per category</div>
              <p style={{fontSize:'0.67rem',color:'var(--text-secondary)',margin:'2px 0 6px',lineHeight:1.4}}>Max places shown per type (e.g. Restaurants, Museums) in the Explore list.</p>
              <div style={{display:'flex',alignItems:'center',gap:'10px',paddingBottom:'4px'}}>
                <input type="range" min="2" max="20" step="1" value={categoryDisplayLimit}
                  onChange={e=>setCategoryDisplayLimit(Number(e.target.value))}
                  style={{flex:1, accentColor:'var(--accent-primary)'}}/>
                <span style={{fontSize:'0.9rem',fontWeight:700,color:'var(--text-primary)',minWidth:'28px',textAlign:'right'}}>{categoryDisplayLimit}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
