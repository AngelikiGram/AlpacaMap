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

















































export const MapSearchBar = ({ onFlyTo, panelOpen }) => {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const debRef = useRef(null);

  const handleInput = (val) => {
    setQuery(val);
    clearTimeout(debRef.current);
    if (val.length < 2) { setResults([]); setShowResults(false); return; }
    debRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchNominatim(val);
        setResults(r.slice(0, 7));
        setShowResults(true);
      } catch {}
      setLoading(false);
    }, 350);
  };

  const select = (r) => {
    const parts = r.display_name.split(', ');
    setQuery(parts.slice(0, 2).join(', '));
    setShowResults(false);
    setResults([]);
    const bbox = r.boundingbox;
    let zoom = 14;
    if (bbox) {
      const latSpan = Math.abs(parseFloat(bbox[1]) - parseFloat(bbox[0]));
      if (latSpan > 10) zoom = 4;
      else if (latSpan > 3)  zoom = 7;
      else if (latSpan > 0.5) zoom = 11;
      else if (latSpan > 0.1) zoom = 13;
    }
    onFlyTo({
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      zoom,
      name: parts[0],
      fullName: parts.slice(1, 4).filter(Boolean).join(', '),
    });
  };

  return (
    <div className="map-searchbar" style={{
      left: panelOpen ? 'calc(clamp(380px, 40%, 650px) + 28px)' : '80px',
      right: '210px',
      transition: 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <div className="map-searchbar-input">
        <Search size={14} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder="Search any place on the map…"
        />
        {loading && <Loader2 size={13} className="spin" style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}
        {query && !loading && (
          <button style={{ background: 'none', border: 'none', padding: '0.2rem', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
            onClick={() => { setQuery(''); setResults([]); setShowResults(false); onFlyTo(null); }}>
            <X size={13} />
          </button>
        )}
      </div>
      {showResults && results.length > 0 && (
        <div className="map-searchbar-results">
          {results.map((r, i) => {
            const parts = r.display_name.split(', ');
            const typeIcon = r.type === 'country' ? '🌍' : r.type === 'city' || r.category === 'place' ? '🏙️' : r.type === 'peak' || r.type === 'natural' ? '⛰️' : r.type === 'water' || r.type === 'bay' ? '🌊' : '📍';
            return (
              <div key={i} className="map-searchbar-item" onMouseDown={() => select(r)}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{typeIcon}</span>
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '0.83rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parts[0]}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parts.slice(1, 4).join(', ')}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
