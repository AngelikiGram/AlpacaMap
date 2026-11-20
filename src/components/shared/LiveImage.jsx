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

import { PortalDropdown } from "./PortalDropdown.jsx";
import { WeatherWidget } from "./WeatherWidget.jsx";
import { DonutChart } from "./DonutChart.jsx";
import { InfoWindow } from "./InfoWindow.jsx";
import { PrintView } from "./PrintView.jsx";

















































export const LiveImage = ({ rec, color, icon, activeCityName }) => {
  const initial = (rec.liveImage && rec.liveImage !== SENTINEL_NONE) ? rec.liveImage : (rec.osmTags?.image || null);
  const [imgUrl, setImgUrl] = useState(initial);
  const [imgBroken, setImgBroken] = useState(false);
  const fetchedRef = useRef(!!initial || rec.liveImage === SENTINEL_NONE);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchPlaceImage(rec.osmTags, rec.name, rec.type, activeCityName).then(url => {
      if (url) { rec.liveImage = url; setImgUrl(url); }
      else { rec.liveImage = SENTINEL_NONE; }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleError = () => {
    // Cached URL is broken — clear it and retry fetch
    rec.liveImage = null;
    setImgUrl(null);
    setImgBroken(false);
    fetchedRef.current = false;
    fetchPlaceImage(rec.osmTags, rec.name, rec.type, activeCityName).then(url => {
      if (url) { rec.liveImage = url; setImgUrl(url); }
      else { rec.liveImage = SENTINEL_NONE; setImgBroken(true); }
    });
  };

  if (imgUrl && !imgBroken) {
    return (
      <div style={{
        width: '46px', height: '46px', borderRadius: '8px', flexShrink: 0,
        border: `1px solid ${color}40`, boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}>
        <img
          src={imgUrl}
          alt=""
          onError={handleError}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }
  return (
    <div style={{
      width: '46px', height: '46px', borderRadius: '8px', flexShrink: 0,
      background: `linear-gradient(135deg, ${color}35, ${color}15)`,
      border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ color, opacity: 0.85 }}>{icon}</div>
    </div>
  );
};
