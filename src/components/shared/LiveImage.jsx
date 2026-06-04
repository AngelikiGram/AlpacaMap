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
  const [tried, setTried] = useState(rec.liveImage === SENTINEL_NONE);
  const imgRef = useRef(null);

  useEffect(() => {
    if (imgUrl || tried) return;
    const observer = new IntersectionObserver(async entries => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      const url = await fetchPlaceImage(rec.osmTags, rec.name, rec.type, activeCityName);
      if (url) { rec.liveImage = url; setImgUrl(url); }
      else { rec.liveImage = SENTINEL_NONE; setTried(true); }
    }, { threshold: 0.1 });
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [rec, imgUrl, tried, activeCityName]);

  if (imgUrl) {
    return (
      <div ref={imgRef} style={{
        backgroundImage: `url(${imgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center',
        width: '46px', height: '46px', borderRadius: '8px', flexShrink: 0,
        border: `1px solid ${color}40`, boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
      }}/>
    );
  }
  return (
    <div ref={imgRef} style={{
      width: '46px', height: '46px', borderRadius: '8px', flexShrink: 0,
      background: `linear-gradient(135deg, ${color}35, ${color}15)`,
      border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ color, opacity: 0.85 }}>{icon}</div>
    </div>
  );
};
