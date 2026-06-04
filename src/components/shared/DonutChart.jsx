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

import { LiveImage } from "./LiveImage.jsx";
import { PortalDropdown } from "./PortalDropdown.jsx";
import { WeatherWidget } from "./WeatherWidget.jsx";
import { InfoWindow } from "./InfoWindow.jsx";
import { PrintView } from "./PrintView.jsx";

















































export const DonutChart=({segments,currency,totalSpent,size=148,sw=20})=>{
  const r=(size-sw)/2-2;
  const C=2*Math.PI*r;
  const cx=size/2,cy=size/2;
  const valid=segments.filter(s=>s.total>0);
  let cum=0;
  return(
    <svg width={size} height={size} style={{display:'block',flexShrink:0}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw}/>
      {valid.map((seg,i)=>{
        const pct=totalSpent>0?seg.total/totalSpent:0;
        const dash=C*pct;
        const rotate=`rotate(${cum*360-90},${cx},${cy})`;
        cum+=pct;
        return(
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={sw}
            strokeDasharray={`${dash} ${C-dash}`} transform={rotate}
            style={{transition:'all 0.5s ease',strokeLinecap:'butt'}}
          />
        );
      })}
      <text x={cx} y={cy-10} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="Inter,sans-serif" letterSpacing="0.05em">{currency} SPENT</text>
      <text x={cx} y={cy+10} textAnchor="middle" fill="white" fontSize="18" fontWeight="700" fontFamily="Outfit,sans-serif">{totalSpent.toLocaleString()}</text>
    </svg>
  );
};
