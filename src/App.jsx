import React, { useState, useEffect, useRef, useLayoutEffect, Suspense, lazy, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, ZoomControl, Polyline, Circle, Polygon, ScaleControl, useMap, useMapEvents } from 'react-leaflet';
import TripMindPanel from './TripMindPanel.jsx';
import { Navigation, MapPin, Calendar as CalendarIcon, Search, Compass, ChevronRight, ChevronLeft, Menu, FileText, Plus, ArrowLeft, Trash2, Loader2, SlidersHorizontal, X, Info, Upload, BookOpen, ExternalLink, ChevronDown, ChevronUp, DollarSign, Package, Check, Pencil, Layers, FolderOpen, Save, Clock, Phone, Globe, Accessibility, Utensils, Coffee, Landmark, TreePine, ShoppingBag, Camera, MountainSnow, Tent, Castle, Plane, Train, Bed, Activity, Bus, Ship, CreditCard, Droplets, Car, Moon, Satellite, Eye, Sparkles } from 'lucide-react';
import './App.css';
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { LiveImage } from "./components/shared/LiveImage";
import { PortalDropdown } from "./components/shared/PortalDropdown";
import { WeatherWidget } from "./components/shared/WeatherWidget";
import { DonutChart } from "./components/shared/DonutChart";
import { InfoWindow } from "./components/shared/InfoWindow";
import { PrintView } from "./components/shared/PrintView";
import { MapView } from "./components/map/MapView";
import { MapSearchBar } from "./components/map/MapSearchBar";
import { MapClickBar } from "./components/map/MapClickBar";
import { PinNameOverlay } from "./components/map/PinNameOverlay";
import { SearchResultMarker } from "./components/map/SearchResultMarker";
import { TimelineStrip } from "./components/panel/TimelineStrip";
import { TripInsights } from "./components/panel/TripInsights";
import { MyTripsPanel } from "./components/panel/MyTripsPanel";
import { LocationPlannerPanel } from "./components/panel/LocationPlannerPanel";
import { ExportPanel } from "./components/panel/ExportPanel";
import { CalendarPanel } from "./components/panel/CalendarPanel";
import { BudgetPanel } from "./components/panel/BudgetPanel";
import { PackingPanel } from "./components/panel/PackingPanel";
import { NotesPanel } from "./components/panel/NotesPanel";
import { DocumentsPanel } from "./components/panel/DocumentsPanel";
import { CoherencePanel } from "./components/panel/CoherencePanel";
import { RouteSpacePanel } from "./components/panel/RouteSpacePanel.jsx";
import { MenuPanel } from "./components/panel/MenuPanel.jsx";
const KnowledgePanel = lazy(() => import('./components/panel/KnowledgePanel.jsx'));
const AnalyticsPanel = lazy(() => import('./components/panel/AnalyticsPanel.jsx'));
import { MapBoundsTracker, MapZoomTracker, MapClickHandler, MapFlyController, SmartMapController } from "./components/map/MapControllers";
import { CITY_PALETTE, getCityColor, MAP_LAYERS, SENTINEL_NONE, getTypeDetails, createDayStopIcon, createGlyphIcon, createCityIcon, classifyWeather, detectOSMCategory, processOverpassResults, scorePlaceQuality, nameSim, semanticDedup, getZoomParams, filterMarkersAdaptive, loadTrips, loadPrefs, saveTrips, savePrefs, detectLocationType, createSearchResultIcon, getAllMapPoints, buildArc, getDistanceKm, INITIAL_TRIP, TRIPS_KEY, PREFS_KEY, TABS, wmoIcon, formatDur, searchOverpass } from "./utils";
import { searchNominatim, fetchPlaceImage } from "./api";
import { OVERPASS_URL, OVERPASS_TAGS, TOURIST_LANDMARK_TAGS, CATEGORY_ZOOM_PRIORITY, SEARCH_KEYWORDS, INTEREST_CATEGORIES, LOCATION_TYPE_PRESETS, EVENT_TYPES, TRANSPORT_ICON, EVT_EMOJI, DOC_SECTIONS, BUDGET_CATEGORIES, PACKING_TEMPLATES, ENTITY_PROFILES } from "./config";

let DefaultIcon = L.icon({ iconUrl, shadowUrl: iconShadow, iconSize: [25,41], iconAnchor: [12,41], popupAnchor: [1,-34] });
L.Marker.prototype.options.icon = DefaultIcon;

/* ── City color palette ──────────────────────────────────────────────────────── */
/* ── Map layers ──────────────────────────────────────────────────────────────── */
/* ── Geocoding (direct Nominatim) ────────────────────────────────────────────── */
/* ── Type helpers ────────────────────────────────────────────────────────────── */
/* ── AI Plan day-stop map icon ───────────────────────────────────────────────── */
/* ── SVG Glyph Marker System ─────────────────────────────────────────────────── */
/* ── Images ──────────────────────────────────────────────────────────────────── */
/* ── Distance / Arc ──────────────────────────────────────────────────────────── */
/* ── Weather ─────────────────────────────────────────────────────────────────── */
/* ── Weather classification ──────────────────────────────────────────────────── */
/* ── Overpass API (full OSM data) ────────────────────────────────────────────── */
/* ── Adaptive marker filtering (quality-scored, spatially deduped) ───────────── */
/* ── Portal dropdown (bypasses panel overflow:hidden) ────────────────────────── */
/* ── localStorage helpers ────────────────────────────────────────────────────── */
/* ── Constants ───────────────────────────────────────────────────────────────── */
/* ── Map sub-components ──────────────────────────────────────────────────────── */

function HighlightTracker({highlightedPlace}){ const map = useMap(); useEffect(()=>{ if(highlightedPlace) { map.flyTo(highlightedPlace.coords, 16, {duration: 0.8}); } }, [highlightedPlace, map]); return null; }

/* ── Map location info bar ───────────────────────────────────────────────────── */
/* ── Search result marker ────────────────────────────────────────────────────── */
/* ── Map search + fly ────────────────────────────────────────────────────────── */
/* ── MapView ─────────────────────────────────────────────────────────────────── */
/* ── Timeline Strip ──────────────────────────────────────────────────────────── */
/* ── Donut Chart ─────────────────────────────────────────────────────────────── */
/* ── Trip Insights ───────────────────────────────────────────────────────────── */
/* ── MyTripsPanel ────────────────────────────────────────────────────────────── */
/* ── Entity profiles for trip intelligence ───────────────────────────────────── */
/* ── LocationPlannerPanel ────────────────────────────────────────────────────── */
/* ── RoutePanel ──────────────────────────────────────────────────────────────── */
/* ── CalendarPanel ───────────────────────────────────────────────────────────── */
/* ── BudgetPanel ─────────────────────────────────────────────────────────────── */
/* ── PackingPanel ────────────────────────────────────────────────────────────── */
/* ── NotesPanel ──────────────────────────────────────────────────────────────── */
/* ── DocumentsPanel ──────────────────────────────────────────────────────────── */
/* ── WeatherWidget ───────────────────────────────────────────────────────────── */
/* ── InfoWindow ──────────────────────────────────────────────────────────────── */
/* ── Print View ──────────────────────────────────────────────────────────────── */
/* ── Tabs ────────────────────────────────────────────────────────────────────── */

function useHorizontalScroll() {
  const elRef = useRef();
  useEffect(() => {
    const el = elRef.current;
    if (el) {
      const onWheel = e => {
        if (e.deltaY == 0) return;
        
        // Let it scroll vertically if there's no horizontal overflow
        if (el.scrollWidth <= el.clientWidth) return;
        
        e.preventDefault();
        el.scrollTo({
          left: el.scrollLeft + e.deltaY,
          behavior: 'auto'
        });
      };
      
      let isDown = false;
      let startX;
      let scrollLeft;
      
      const onMouseDown = e => {
        isDown = true;
        el.classList.add('active');
        startX = e.pageX - el.offsetLeft;
        scrollLeft = el.scrollLeft;
      };
      const onMouseLeave = () => {
        isDown = false;
        el.classList.remove('active');
      };
      const onMouseUp = () => {
        isDown = false;
        el.classList.remove('active');
      };
      const onMouseMove = e => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - el.offsetLeft;
        const walk = (x - startX) * 2; // Scroll-fast
        el.scrollLeft = scrollLeft - walk;
      };
      
      el.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('mousedown', onMouseDown);
      el.addEventListener('mouseleave', onMouseLeave);
      el.addEventListener('mouseup', onMouseUp);
      el.addEventListener('mousemove', onMouseMove);
      
      return () => {
        el.removeEventListener('wheel', onWheel);
        el.removeEventListener('mousedown', onMouseDown);
        el.removeEventListener('mouseleave', onMouseLeave);
        el.removeEventListener('mouseup', onMouseUp);
        el.removeEventListener('mousemove', onMouseMove);
      }
    }
  }, []);
  return elRef;
}

/* ── App ─────────────────────────────────────────────────────────────────────── */
export default function App(){
  const[activeTab,       setActiveTab]       =useState('menu');
  const [recFilterText, setRecFilterText] = useState('');
  const tabScrollRef = useHorizontalScroll();
  const[calendarExpandedDays, setCalendarExpandedDays] =useState([]);
  const[tripData,        setTripData]        =useState(()=>{ const t=loadTrips(); return t.length>0?t[0].data:INITIAL_TRIP; });
  const[activeCity,      setActiveCity]      =useState(null);
  const[mapBounds,       setMapBounds]       =useState(null);
  const[searchRadius,    setSearchRadius]    =useState(5);
  const[activePlaceInfo, setActivePlaceInfo] =useState(null);
  const[isInfoLoading,   setIsInfoLoading]   =useState(false);
  const[pendingPin,      setPendingPin]      =useState(null);
  const[mapCenter,       setMapCenter]       =useState(null);
  const[mapLayer,        setMapLayer]        =useState(()=>loadPrefs().mapLayer||'satellite');
  const[editingTitle,    setEditingTitle]    =useState(false);
  const[titleInput,      setTitleInput]      =useState('');
  const[savedTrips,      setSavedTrips]      =useState(()=>loadTrips());
  const[currentTripId,   setCurrentTripId]   =useState(()=>{ const t=loadTrips(); return t.length>0?t[0].id:`trip-${Date.now()}`; });
  const[showTripsPanel,  setShowTripsPanel]  =useState(false);
  const[savedAt,         setSavedAt]         =useState(null);
  const[visibleCategories, setVisibleCategories] =useState([]);
  const[aiInterests,     setAiInterests]     =useState(['Restaurants','Coffee']);
  const[aiActiveDay,       setAiActiveDay]       =useState(0);
  const[aiDayDisplay,      setAiDayDisplay]      =useState('current'); // 'current'|'all'|'none'
  const[showNeighborhoods, setShowNeighborhoods] =useState(false);
  const[osmHardCap, setOsmHardCap] = useState(1500);
  const[categoryDisplayLimit, setCategoryDisplayLimit] = useState(5);
  const[mapMarkerLimitFactor, setMapMarkerLimitFactor] = useState(1.0);
  const[poiQualityThreshold, setPoiQualityThreshold] = useState(0);
  const[tripMindPreviewPlaces, setTripMindPreviewPlaces] = useState([]);
  const[routeSpaceRoute, setRouteSpaceRoute] =useState(() => {
    try { return JSON.parse(sessionStorage.getItem('routespace_route') || 'null'); } catch { return null; }
  });
  const[showRouteOnMap, setShowRouteOnMap] = useState(true);
  const[stopStabilityMap, setStopStabilityMap] =useState({});
  const[previewFlyTarget,     setPreviewFlyTarget]     = useState(null);
  const[panelOpen,            setPanelOpen]            = useState(true);
  const lastCityId      = useRef(null);
  const autoSaveTimer   = useRef(null);
  const poiSearchTrigger = useRef(null);

  // Auto-save trip to localStorage (debounced 1.5s)
  useEffect(()=>{
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current=setTimeout(()=>{
      const trips=loadTrips();
      const idx=trips.findIndex(t=>t.id===currentTripId);
      const entry={id:currentTripId,title:tripData.title,lastModified:new Date().toISOString(),data:tripData};
      if(idx>=0)trips[idx]=entry; else trips.unshift(entry);
      saveTrips(trips);
      setSavedTrips([...trips]);
      setSavedAt(new Date());
    },1500);
    return()=>clearTimeout(autoSaveTimer.current);
  },[tripData,currentTripId]);

  // Persist map layer preference
  useEffect(()=>{ savePrefs({mapLayer}); },[mapLayer]);

  useEffect(()=>{
    if(activeCity){
      const updated=tripData.locations.find(c=>c.id===activeCity.id);
      if(updated)setActiveCity(updated);
      if(lastCityId.current!==activeCity.id){
        lastCityId.current=activeCity.id;
        setMapCenter({lat:activeCity.coords[0],lng:activeCity.coords[1]});
      }
    }else{lastCityId.current=null;setMapCenter(null);}
  },[tripData.locations,activeCity?.id,activeCity?.coords]);

  useEffect(()=>{
    window._confirmPin=(name)=>{
      if(!name?.trim()||!pendingPin){setPendingPin(null);return;}
      const{latlng,mode}=pendingPin;
      if(mode==='place'&&activeCity){
        const newPlace = {id:Date.now(),name:name.trim(),type:'custom',coords:latlng};
        addPlaceToCity(activeCity.id, newPlace);
        setMapCenter({lat:latlng[0],lng:latlng[1]});
        if (activeTab === 'routespace') {
          window._addToActiveRoute?.(newPlace);
        }
      }else if(mode==='city'){
        setTripData(prev=>({...prev,locations:[...prev.locations,{id:Date.now(),name:name.trim(),coords:latlng,zoomLevel:14,places:[],recommendations:[]}]}));
      }
      setPendingPin(null);
    };
    return()=>{delete window._confirmPin;};
  },[pendingPin,activeCity,activeTab]);

  const addPlaceToCity=(cityId,place)=>{
    setTripData(prev=>({...prev,locations:prev.locations.map(city=>city.id!==cityId?city:{...city,places:[...city.places.filter(p=>p.id!==place.id),place]})}));
  };
  const removePlaceFromCity=(cityId,placeId)=>{
    setTripData(prev=>({...prev,locations:prev.locations.map(city=>city.id!==cityId?city:{...city,places:city.places.filter(p=>p.id!==placeId)})}));
  };
  const updatePlaceInCity=(cityId,placeId,updates)=>{
    setTripData(prev=>({...prev,locations:prev.locations.map(city=>city.id!==cityId?city:{...city,places:city.places.map(p=>p.id!==placeId?p:{...p,...updates})})}));
  };

  const exportTrip=()=>{
    const trip={id:currentTripId,title:tripData.title,lastModified:new Date().toISOString(),data:tripData};
    const blob=new Blob([JSON.stringify(trip,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=`${tripData.title.replace(/[^a-z0-9]/gi,'_')}_trip.json`;a.click();
    URL.revokeObjectURL(a.href);
  };
  const importTrip=()=>{
    const input=document.createElement('input');input.type='file';input.accept='.json';
    input.onchange=e=>{
      const file=e.target.files?.[0];if(!file)return;
      const reader=new FileReader();
      reader.onload=ev=>{
        try{
          const parsed=JSON.parse(ev.target.result);
          const entry={id:parsed.id||(`trip-${Date.now()}`),title:parsed.title||'Imported Trip',lastModified:new Date().toISOString(),data:parsed.data||parsed};
          const trips=loadTrips();
          const idx=trips.findIndex(t=>t.id===entry.id);
          if(idx>=0)trips[idx]=entry;else trips.unshift(entry);
          saveTrips(trips);setSavedTrips([...trips]);
          setCurrentTripId(entry.id);setTripData(entry.data);setActiveCity(null);
        }catch{alert('Invalid trip file.');}
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Geocache: count pending missions for tab badge
  const gcUndiscovered = useMemo(() => {
    const nodes = tripData.knowledgeGraph?.nodes || [];
    if (!nodes.length) return 0;
    try {
      const raw = JSON.parse(localStorage.getItem(`gc_intel_v1_${currentTripId}`) || '{}');
      const completed = Object.keys(raw.completed || {});
      // Count unique places with contested claims (proxy for mission count) minus completed
      const contested = new Set(nodes.filter(n => n.evaluation?.sentiment).map(n => (n.place || '').toLowerCase().trim()).filter(Boolean));
      return Math.max(0, contested.size - completed.length);
    } catch { return 0; }
  }, [tripData.knowledgeGraph, currentTripId]);

  // Auto-enable knowledge overlay when switching to analytics tab; disable when leaving
  useEffect(() => {
    if (activeTab === 'analytics') {
      window.dispatchEvent(new CustomEvent('toggle-knowledge-overlay', { detail: true }));
    }
  }, [activeTab]);

  // Listen for knowledge overlay toggle to auto-select a city if needed (so POIs load for the KG to attach to)
  useEffect(() => {
    const handleToggle = (e) => {
      if (e.detail && !activeCity && tripData?.locations?.length > 0) {
        setActiveCity(tripData.locations[0]);
      }
    };
    window.addEventListener('toggle-knowledge-overlay', handleToggle);
    return () => window.removeEventListener('toggle-knowledge-overlay', handleToggle);
  }, [activeCity, tripData]);

  const triggerPlaceInfo=async(place)=>{
    // Analytics: if on analytics tab, investigate the cache for this place
    if (activeTab === 'analytics') {
      const key = (place.name || '').toLowerCase().trim();
      window._geocacheInvestigate?.(key);
    }
    setActivePlaceInfo({...place});setIsInfoLoading(true);
    
    // Fly the map to this place's coordinates
    if (place.coords && Array.isArray(place.coords) && place.coords.length >= 2 && typeof place.coords[0] === 'number') {
      setPreviewFlyTarget({ lat: place.coords[0], lon: place.coords[1], zoom: 15, duration: 0.7 });
    }

    let extract = place.extract || '';
    let heroImage=(place.liveImage&&place.liveImage!==SENTINEL_NONE)?place.liveImage:null;
    // Fetch Wikipedia extract and hero image in parallel (no artificial delay)
    await Promise.allSettled([
      extract ? Promise.resolve() : fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(place.name.split(',')[0])}?origin=*`,{signal:AbortSignal.timeout(5000)})
        .then(res=>res.ok?res.json():null).then(d=>{if(d?.extract)extract=d.extract;}).catch(()=>{}),
      heroImage ? Promise.resolve() : fetchPlaceImage(place.osmTags,place.name.split(',')[0],place.type,null)
        .then(img=>{heroImage=img;}).catch(()=>{}),
    ]);
    if(heroImage&&place.liveImage!==SENTINEL_NONE)place.liveImage=heroImage;
    const realRating = place.osmTags?.stars ? parseFloat(place.osmTags.stars) : null;
    setActivePlaceInfo({...place, rating: realRating, reviewsCount: null, priceRange: null, extract, highlights: null, heroImage, osmTags: place.osmTags||null, reviews: []});
    setIsInfoLoading(false);
  };

  const saveTitle=()=>{if(titleInput.trim())setTripData(prev=>({...prev,title:titleInput.trim()}));setEditingTitle(false);};

  const createNewTrip=()=>{
    const newId=`trip-${Date.now()}`;
    setCurrentTripId(newId);
    setTripData({
      title:'New Trip',
      locations:[],routes:[],itinerary:[],
      notes:{general:'',cities:{}},
      documents:{flights:[],trains:[],hotels:[],leisure:[]},
      budget:{total:2000,currency:'USD',expenses:[]},
      packing:[],
    });
    setActiveCity(null);
    setShowTripsPanel(false);
  };

  const loadTrip=(trip)=>{
    setCurrentTripId(trip.id);
    setTripData(trip.data);
    setActiveCity(null);
    setShowTripsPanel(false);
  };

  const deleteTrip=(id)=>{
    const trips=loadTrips().filter(t=>t.id!==id);
    saveTrips(trips);
    setSavedTrips(trips);
    if(id===currentTripId&&trips.length>0)loadTrip(trips[0]);
  };

  const totalSaved=tripData.locations.reduce((s,c)=>s+c.places.length,0);
  const totalKm = (() => {
    // 1. Try to compute sequential distance along the itinerary path
    const visitedCoords = [];
    const sortedItinerary = [...(tripData.itinerary || [])].sort((a,b) => a.date.localeCompare(b.date));
    sortedItinerary.forEach(day => {
      const loc = tripData.locations.find(l => l.name === day.location || l.name.split(',')[0] === day.location.split(',')[0]);
      if (loc) {
        const last = visitedCoords[visitedCoords.length - 1];
        if (!last || last[0] !== loc.coords[0] || last[1] !== loc.coords[1]) {
          visitedCoords.push(loc.coords);
        }
      }
    });

    let sum = 0;
    if (visitedCoords.length > 1) {
      for (let i = 1; i < visitedCoords.length; i++) {
        sum += getDistanceKm(visitedCoords[i-1][0], visitedCoords[i-1][1], visitedCoords[i][0], visitedCoords[i][1]);
      }
    }

    // 2. Fallback to location list sequence if itinerary is empty
    if (sum === 0 && tripData.locations && tripData.locations.length > 1) {
      for (let i = 1; i < tripData.locations.length; i++) {
        sum += getDistanceKm(
          tripData.locations[i-1].coords[0], tripData.locations[i-1].coords[1],
          tripData.locations[i].coords[0], tripData.locations[i].coords[1]
        );
      }
    }
    return Math.round(sum);
  })();

  const renderPanel=()=>{
    switch(activeTab){
      case 'menu':     return<MenuPanel     activeTab={activeTab} setActiveTab={setActiveTab} gcUndiscovered={gcUndiscovered}/>;
      case 'locations':return null;
      case 'route':    return<ExportPanel   tripData={tripData}/>;
      case 'calendar': return<CalendarPanel tripData={tripData} setTripData={setTripData} expandedDays={calendarExpandedDays} setExpandedDays={setCalendarExpandedDays}/>;
      case 'budget':   return<BudgetPanel   tripData={tripData} setTripData={setTripData}/>;
      case 'packing':  return<PackingPanel  tripData={tripData} setTripData={setTripData}/>;
      case 'notes':    return<NotesPanel    tripData={tripData} setTripData={setTripData}/>;
      case 'documents':return<DocumentsPanel tripData={tripData} setTripData={setTripData}/>;
      case 'tripmind': return<TripMindPanel tripData={tripData} setTripData={setTripData} activeCity={activeCity} aiActiveDay={aiActiveDay} onDayChange={setAiActiveDay} triggerPlaceInfo={triggerPlaceInfo} onPreviewPlaces={setTripMindPreviewPlaces} onFlyTo={coords=>setPreviewFlyTarget({lat:coords[0],lon:coords[1],zoom:16,duration:0.7})} />;
      case 'analyze':  return<CoherencePanel tripData={tripData}/>;
      case 'routespace': return<RouteSpacePanel tripData={tripData} setTripData={setTripData} activeCity={activeCity} routeSpaceRoute={routeSpaceRoute} setRouteSpaceRoute={setRouteSpaceRoute} setStopStabilityMap={setStopStabilityMap} triggerPlaceInfo={triggerPlaceInfo} aiInterests={aiInterests} onSwitchToCalendar={()=>setActiveTab('calendar')} showRouteOnMap={showRouteOnMap} setShowRouteOnMap={setShowRouteOnMap} />;
      case 'knowledge':  return<Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'200px',color:'rgba(255,255,255,0.4)',fontSize:'0.8rem'}}>Loading Knowledge Graph…</div>}><KnowledgePanel tripData={tripData} setTripData={setTripData} triggerPlaceInfo={triggerPlaceInfo} activeCity={activeCity} /></Suspense>;
      case 'analytics':  return<Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'200px',color:'rgba(255,255,255,0.4)',fontSize:'0.8rem'}}>Loading Analytics…</div>}><AnalyticsPanel tripData={tripData} setTripData={setTripData} tripId={currentTripId} activeCity={activeCity} /></Suspense>;
      default:return null;
    }
  };

  return(
    <div className="app-container">
      <MapView mapBounds={mapBounds} setMapBounds={setMapBounds} highlightedPlace={activePlaceInfo} visibleCategories={visibleCategories} setVisibleCategories={setVisibleCategories} aiInterests={aiInterests} setAiInterests={setAiInterests} locations={tripData.locations} routes={tripData.routes} activeCity={activeCity} searchRadius={searchRadius} setSearchRadius={setSearchRadius} triggerPlaceInfo={triggerPlaceInfo} pendingPin={pendingPin} setPendingPin={setPendingPin} mapCenter={mapCenter} setMapCenter={setMapCenter} mapLayer={mapLayer} setMapLayer={setMapLayer}
        aiPlan={tripData.aiPlan} aiActiveDay={aiActiveDay} aiDayDisplay={aiDayDisplay} setAiDayDisplay={setAiDayDisplay}
        showNeighborhoods={showNeighborhoods} setShowNeighborhoods={setShowNeighborhoods}
        onAddClickDestination={(info)=>{
          setPendingPin({latlng:[info.lat,info.lon],mode:'city',suggestedName:info.address?.split(',')[0]||''});
        }}
        osmHardCap={osmHardCap}
        setOsmHardCap={setOsmHardCap}
        categoryDisplayLimit={categoryDisplayLimit}
        setCategoryDisplayLimit={setCategoryDisplayLimit}
        mapMarkerLimitFactor={mapMarkerLimitFactor}
        setMapMarkerLimitFactor={setMapMarkerLimitFactor}
        poiQualityThreshold={poiQualityThreshold}
        setPoiQualityThreshold={setPoiQualityThreshold}
        recFilterText={recFilterText}
        infoOpen={!!activePlaceInfo}
        previewPlaces={tripMindPreviewPlaces}
        previewFlyTarget={previewFlyTarget}
        routeSpaceRoute={routeSpaceRoute}
        showRouteOnMap={showRouteOnMap}
        stopStabilityMap={stopStabilityMap}
        activeTab={activeTab}
        panelOpen={panelOpen}
        hasTimeline={tripData.itinerary && tripData.itinerary.length > 0}
        knowledgeGraph={tripData.knowledgeGraph}
      />
      <TimelineStrip tripData={tripData} setActiveCity={setActiveCity} setActiveTab={setActiveTab} setCalendarExpandedDay={dayId => setCalendarExpandedDays(prev => prev.includes(dayId) ? prev : [...prev, dayId])} panelOpen={panelOpen}/>

      {/* Floating Toggle Button to open the menu when collapsed */}
      {!panelOpen && (
        <button 
          onClick={() => setPanelOpen(true)}
          style={{
            position: 'absolute',
            left: '20px',
            top: '20px',
            zIndex: 1000,
            background: 'rgba(8,12,26,0.93)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '12px',
            padding: '10px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.25)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(8,12,26,0.93)'}
          title="Open Menu"
        >
          <Menu size={18} />
        </button>
      )}

      <div className={`content-panel glass-panel ${panelOpen ? '' : 'collapsed'}`}>
          <div className="mobile-drag-handle"/>
        <div className="panel-top">
          <div style={{display:'flex',alignItems:'center',gap:'0.6rem',flex:1,minWidth:0}}>
            <Compass size={17} style={{color:'var(--accent-primary)',filter:'drop-shadow(0 0 8px rgba(59,130,246,0.6))',flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:'0.58rem',color:'var(--text-secondary)',fontWeight:'700',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'0.1rem'}}>TravelScout</div>
              {editingTitle?(
                <input autoFocus type="text" value={titleInput} onChange={e=>setTitleInput(e.target.value)}
                  onBlur={saveTitle} onKeyDown={e=>{if(e.key==='Enter')saveTitle();if(e.key==='Escape')setEditingTitle(false);}}
                  style={{fontSize:'0.9rem',fontWeight:'700',padding:'0.1rem 0.3rem',width:'100%',fontFamily:'Outfit,sans-serif'}}
                />
              ):(
                <div style={{display:'flex',alignItems:'center',gap:'0.3rem',cursor:'pointer'}} onClick={()=>{setTitleInput(tripData.title);setEditingTitle(true);}}>
                  <span style={{fontWeight:'700',fontSize:'0.9rem',fontFamily:'Outfit,sans-serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tripData.title}</span>
                  <Pencil size={10} color="var(--text-secondary)" style={{flexShrink:0}}/>
                </div>
              )}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'0.4rem',flexShrink:0}}>
            {savedAt&&<span className="saved-badge"><Check size={12} style={{marginRight:'3px'}}/> Saved</span>}
            {activeTab !== 'menu' && (
              <button className="btn-icon" title="Main Menu" onClick={()=>setActiveTab('menu')} style={{padding:'0.35rem', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6'}}>
                <Compass size={15}/>
              </button>
            )}
            <button className="btn-icon" title="Collapse Menu" onClick={() => setPanelOpen(false)} style={{padding:'0.35rem'}}>
              <ChevronLeft size={15}/>
            </button>
            <button className="btn-icon" title="Print / Export PDF" onClick={()=>window.print()} style={{padding:'0.35rem'}}>
              <FileText size={15}/>
            </button>
            <button className="btn-icon" title="My Trips" onClick={()=>setShowTripsPanel(true)} style={{padding:'0.35rem'}}>
              <FolderOpen size={15}/>
            </button>
            <div className="stats-strip">
              <div className="stat-chip"><strong>{tripData.locations.length}</strong> stops</div>
              <div className="stat-chip"><strong>{totalSaved}</strong> saved</div>
              {totalKm>0&&<div className="stat-chip"><strong>{totalKm>999?`${(totalKm/1000).toFixed(1)}k`:totalKm}</strong> km</div>}
            </div>
          </div>
        </div>

        <div className="tab-content">
          <div style={{display: activeTab === 'locations' ? 'block' : 'none', height: '100%', overflow: 'hidden'}}>
            <div className="location-planner-panel-scroll">
              <LocationPlannerPanel mapBounds={mapBounds} tripData={tripData} setTripData={setTripData} activeCity={activeCity} setActiveCity={setActiveCity} searchRadius={searchRadius} setSearchRadius={setSearchRadius} addPlaceToCity={addPlaceToCity} removePlaceFromCity={removePlaceFromCity} updatePlaceInCity={updatePlaceInCity} triggerPlaceInfo={triggerPlaceInfo} mapCenter={mapCenter} setActiveTab={setActiveTab} visibleCategories={visibleCategories} setVisibleCategories={setVisibleCategories} aiInterests={aiInterests} setAiInterests={setAiInterests} poiSearchTrigger={poiSearchTrigger} activePlaceInfo={activePlaceInfo} osmHardCap={osmHardCap} categoryDisplayLimit={categoryDisplayLimit} mapMarkerLimitFactor={mapMarkerLimitFactor} recFilterText={recFilterText} setRecFilterText={setRecFilterText} />
            </div>
          </div>
          {activeTab !== 'locations' && renderPanel()}
        </div>

        {/* My Trips overlay (slides over the panel content) */}
        {showTripsPanel&&(
          <MyTripsPanel
            savedTrips={savedTrips}
            currentTripId={currentTripId}
            onLoad={loadTrip}
            onNew={createNewTrip}
            onDelete={deleteTrip}
            onClose={()=>setShowTripsPanel(false)}
            onExport={exportTrip}
            onImport={importTrip}
          />
        )}
      </div>

      {activePlaceInfo&&(
        <InfoWindow place={activePlaceInfo} isLoading={isInfoLoading} onClose={()=>setActivePlaceInfo(null)}
          onAdd={()=>{if(activeCity){addPlaceToCity(activeCity.id,activePlaceInfo);setActivePlaceInfo(null);}}}
          canAdd={activeCity?activeCity.name.split(',')[0]:false}
          onAddToActiveRoute={activeTab === 'routespace' ? (place) => {
            window._addToActiveRoute?.(place);
            setActivePlaceInfo(null);
          } : null}
          knowledgeGraphNodes={tripData?.knowledgeGraph?.nodes || []}
          allCityNames={[
            ...tripData.locations.map(l => l.name.split(',')[0]),
            activeCity?.name?.split(',')[0]
          ].filter(Boolean)}
        />
      )}

      {/* Print View Wrapper */}
      <PrintView tripData={tripData} />
    </div>
  );
}

