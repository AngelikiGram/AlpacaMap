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
import { DonutChart } from "./DonutChart.jsx";
import { InfoWindow } from "./InfoWindow.jsx";
import { PrintView } from "./PrintView.jsx";

















































export const WeatherWidget=({coords, startDate, endDate})=>{
  const[forecast,setForecast]=useState(null);
  const[loading,setLoading]=useState(true);
  const[label,setLabel]=useState('5-Day Forecast');
  useEffect(()=>{
    if(!coords)return;
    setLoading(true);setForecast(null);
    const[lat,lon]=coords;
    const today=new Date(); today.setHours(0,0,0,0);
    const maxForecast=new Date(today.getTime()+15*24*60*60*1000);
    const tripStart=startDate?new Date(startDate+'T12:00:00'):null;
    const tripEnd=endDate?new Date(endDate+'T12:00:00'):null;

    const parseDays=d=>d.daily.time.map((date,i)=>({date,code:d.daily.weather_code[i],max:Math.round(d.daily.temperature_2m_max[i]),min:Math.round(d.daily.temperature_2m_min[i])}));

    const tripInForecastWindow=tripStart&&tripEnd&&tripEnd>=today&&tripStart<=maxForecast;
    const tripIsFuture=tripStart&&tripEnd&&tripStart>maxForecast;
    const hasTripDates=tripStart&&tripEnd;

    if(tripInForecastWindow){
      setLabel('Trip Forecast');
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&start_date=${startDate}&end_date=${endDate}&timezone=auto`)
        .then(r=>r.json()).then(d=>{if(d.daily)setForecast(parseDays(d));setLoading(false);}).catch(()=>setLoading(false));
    } else if(tripIsFuture&&hasTripDates){
      // Trip is beyond forecast window, fetch same calendar dates from prior year as climate proxy
      setLabel('Typical Weather (last year)');
      const prevYear=(tripStart.getFullYear()-1).toString();
      const prevStart=startDate.replace(/^\d{4}/,prevYear);
      const prevEnd=endDate.replace(/^\d{4}/,prevYear);
      fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&start_date=${prevStart}&end_date=${prevEnd}&timezone=auto`)
        .then(r=>r.json()).then(d=>{
          if(d.daily){
            // Restamp dates to actual trip dates so day labels are correct
            const days=parseDays(d).map((day,i)=>({...day,date:startDate.replace(/^\d{4}/,tripStart.getFullYear().toString()).replace(/\d{2}$/,String(tripStart.getDate()+i).padStart(2,'0'))}));
            // Use original trip dates for labels
            const tripDates=[];
            for(let dt=new Date(tripStart);dt<=tripEnd;dt.setDate(dt.getDate()+1)){
              tripDates.push(dt.toISOString().slice(0,10));
            }
            setForecast(parseDays(d).map((day,i)=>({...day,date:tripDates[i]||day.date})));
          }
          setLoading(false);
        }).catch(()=>setLoading(false));
    } else {
      setLabel('5-Day Forecast');
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto`)
        .then(r=>r.json()).then(d=>{if(d.daily)setForecast(parseDays(d));setLoading(false);}).catch(()=>setLoading(false));
    }
  },[coords?.[0],coords?.[1],startDate,endDate]);

  const fmtDay=d=>{const dt=new Date(d+'T12:00:00');return dt.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});};
  if(loading)return<div style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.78rem',color:'var(--text-secondary)',padding:'0.5rem 0'}}><Loader2 size={12} className="spin"/>Loading forecast…</div>;
  if(!forecast)return null;
  return(
    <div className="weather-widget">
      <div className="section-label" style={{marginBottom:'0.5rem'}}>{label}</div>
      <div className="weather-days">
        {forecast.map(day=>(
          <div key={day.date} className="weather-day">
            <div style={{fontSize:'0.6rem',color:'var(--text-secondary)',fontWeight:'600',whiteSpace:'nowrap'}}>{fmtDay(day.date)}</div>
            <div style={{fontSize:'1.4rem',lineHeight:1.1}}>{wmoIcon(day.code)}</div>
            <div style={{fontSize:'0.78rem',fontWeight:'700'}}>{day.max}°</div>
            <div style={{fontSize:'0.65rem',color:'var(--text-secondary)'}}>{day.min}°</div>
          </div>
        ))}
      </div>
    </div>
  );
};
