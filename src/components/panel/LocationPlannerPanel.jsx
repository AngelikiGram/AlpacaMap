import { useState, useEffect, useRef } from 'react';


import { MapPin, ChevronRight, Plus, ArrowLeft, Trash2, Loader2, ExternalLink, ChevronDown, ChevronUp, Globe, TreePine, MountainSnow, Droplets, Building } from 'lucide-react';


import { getCityColor, getTypeDetails, classifyWeather, spreadByQuality, resetOverpassServers, processOverpassResults, scorePlaceQuality, detectLocationType, getDistanceKm, searchOverpass, getCachedElementsInView, seedOverpassElements } from "../../utils.jsx";
import { searchNominatim } from "../../api.js";
import { INTEREST_CATEGORIES, LOCATION_TYPE_PRESETS, ENTITY_PROFILES } from "../../config.jsx";
import { LiveImage } from "../shared/LiveImage.jsx";
import { PortalDropdown } from "../shared/PortalDropdown.jsx";
import { WeatherWidget } from "../shared/WeatherWidget.jsx";
import { TripInsights } from "./TripInsights.jsx";

export const LocationPlannerPanel=({tripData,setTripData,activeCity,setActiveCity,mapBounds,addPlaceToCity,removePlaceFromCity,updatePlaceInCity,triggerPlaceInfo,mapCenter,setActiveTab,visibleCategories,setVisibleCategories, aiInterests, setAiInterests, searchRadius, poiSearchTrigger, activePlaceInfo, osmHardCap, categoryDisplayLimit, mapMarkerLimitFactor })=>{
      // For scrolling/highlighting selected place
      const recRefs = useRef({});
      const placeRefs = useRef({});
      useEffect(() => {
        if (activePlaceInfo && activePlaceInfo.id) {
          // If it is a saved place, expand it automatically
          const isSaved = activeCity?.places.some(p => p.id === activePlaceInfo.id);
          if (isSaved) {
            setExpandedPlaces(prev => ({ ...prev, [activePlaceInfo.id]: true }));
          }

          // If it is a recommendation, make sure its category is visible
          const isRec = activeCity?.recommendations.some(r => r.id === activePlaceInfo.id);
          if (isRec && visibleCategories.length > 0 && !visibleCategories.includes(activePlaceInfo.type)) {
            setVisibleCategories([]);
          }

          // Wait a tick for React to render the newly expanded/visible elements
          setTimeout(() => {
            const el = recRefs.current[activePlaceInfo.id] || placeRefs.current[activePlaceInfo.id];
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
          }, 100);
        }
      }, [activePlaceInfo, activeCity?.id]);
  const [newCityName,  setNewCityName]  =useState('');
  const [newPlaceName, setNewPlaceName] =useState('');
  const [isSearching,  setIsSearching]  =useState(false);
  const [llmStatus,    setLlmStatus]    =useState('');
  const [recFilterText,setRecFilterText]=useState('');
  const [suggestions,       setSuggestions]       = useState([]);
  const [placeSuggestions,  setPlaceSuggestions]  = useState([]);
  const [showSugg,          setShowSugg]          = useState(false);
  const [showPlaceSugg,     setShowPlaceSugg]     = useState(false);
  const [citySearching,     setCitySearching]     = useState(false);
  const debRef       = useRef(null);
  const pDebRef      = useRef(null);
  const requestCountRef = useRef(0);
  const cityAnchorRef  = useRef(null);
  const placeAnchorRef = useRef(null);
  const findRecsRef  = useRef(null);
  const panTimerRef  = useRef(null);
  const lastSearchCenterRef = useRef(null);
  const [cityWeather, setCityWeather] = useState(null);
  const [expandedPlaces, setExpandedPlaces] = useState({});
  const [catPages, setCatPages] = useState({});  // cat.value → number of pages shown (each page = base limit)

  const lastActiveCityIdRef = useRef(null);

  useEffect(()=>{
    if(activeCity){
      lastActiveCityIdRef.current = activeCity.id;
      const locType=detectLocationType(activeCity.name);
      const preset=LOCATION_TYPE_PRESETS[locType];
      setAiInterests(preset);
    }
  },[activeCity?.id]);


  // Move currentInterestsStr above all its usages
  const currentInterestsStr = aiInterests.slice().sort().join(',');

  // Re-search when user manually changes interest chips (not triggered by preset-on-city-change)
  useEffect(() => {
    if (!activeCity || !mapBounds) return;
    // If the city just changed, do not run duplicate searches (handled by main load/map bounds effect)
    if (lastActiveCityIdRef.current !== activeCity.id) {
      lastActiveCityIdRef.current = activeCity.id;
      return;
    }
    lastSearchCenterRef.current = null;
    findRecsRef.current?.();
  }, [currentInterestsStr, activeCity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCityWeather(null);
    if (!activeCity?.coords) return;
    const [lat, lon] = activeCity.coords;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max&forecast_days=1&timezone=auto`)
      .then(r => r.json())
      .then(d => {
        if (d.daily) setCityWeather(classifyWeather([{code:d.daily.weather_code[0], max:Math.round(d.daily.temperature_2m_max[0])}]));
      }).catch(() => {});
  }, [activeCity?.id]);

  useEffect(() => {
    if (!activeCity) return;
    const slug = activeCity.name.split(',')[0].toLowerCase().replace(/\s+/g, '_');
    
    fetch(`./preprocessed/osm_${slug}.json`)
      .then(r => {
        if (!r.ok) throw new Error('No fallback file');
        return r.json();
      })
      .then(data => {
        if (data && Array.isArray(data.elements) && data.elements.length > 0) {
          console.log(`Seeding ${data.elements.length} offline OSM elements for ${activeCity.name}`);
          seedOverpassElements(data.elements);
          // Refresh recommendations list immediately with the newly seeded cached elements
          findRecsRef.current?.();
        }
      })
      .catch(() => {
        // Safe to ignore, will fall back to live Overpass query
      });
  }, [activeCity?.id]);

  // Keep latest handleFindRecs accessible without stale closures
  useEffect(() => {
    findRecsRef.current = handleFindRecs;
    if (poiSearchTrigger) poiSearchTrigger.current = handleFindRecs;
  });

  // (removed duplicate declaration of currentInterestsStr)

  // Initial search when city is first selected and has no results yet
  useEffect(() => {
    if (activeCity && mapBounds && activeCity.recommendations.length === 0) {
      const c = mapCenter ?? { lat: activeCity.coords[0], lng: activeCity.coords[1] };
      lastSearchCenterRef.current = { lat: c.lat, lng: c.lng, radius: searchRadius };
      handleFindRecs();
    }
  }, [activeCity?.id, mapBounds != null]);

  // "Try again" on the map (App) searches the current circle again
  useEffect(() => {
    const on = () => { resetOverpassServers(); lastSearchCenterRef.current = null; findRecsRef.current?.(); };
    window.addEventListener('alpacamap-search-area', on);
    return () => window.removeEventListener('alpacamap-search-area', on);
  }, []);

  // Auto-search as the map pans to a new area or radius changes
  // Note: aiInterests changes do NOT re-query because we always fetch ALL_CATEGORIES;
  // interest chips are purely a display filter.
  useEffect(() => {
    if (!activeCity || !mapBounds || !mapCenter) return;
    clearTimeout(panTimerRef.current);
    panTimerRef.current = setTimeout(() => {
      const ref = lastSearchCenterRef.current;
      const moved = !ref || getDistanceKm(mapCenter.lat, mapCenter.lng, ref.lat, ref.lng) > Math.min(1.5, searchRadius * 0.4);
      const radiusChanged = ref?.radius !== searchRadius;
      if (moved || radiusChanged) {
        lastSearchCenterRef.current = { lat: mapCenter.lat, lng: mapCenter.lng, radius: searchRadius };
        findRecsRef.current?.();
      }
    }, 1500);
    return () => clearTimeout(panTimerRef.current);
  }, [mapCenter, searchRadius, activeCity?.id]);

  const handleCityInput=(val)=>{
    setNewCityName(val);
    clearTimeout(debRef.current);
    if(val.length<2){setSuggestions([]);setShowSugg(false);return;}
    debRef.current=setTimeout(async()=>{
      setCitySearching(true);
      try{
        const r=await searchNominatim(val);
        setSuggestions(r.slice(0,6).map(x=>({
          label:x.display_name.split(', ').slice(0,4).join(', '),
          lat:parseFloat(x.lat),lon:parseFloat(x.lon),
          shortName:[x.display_name.split(', ')[0], x.address?.country].filter(Boolean).join(', '),
          type: x.type || x.category || 'place',
        })));
        setShowSugg(true);
      }catch{}finally{setCitySearching(false);}
        },150);
  };

  const handlePlaceInput=(val)=>{
    setNewPlaceName(val);
    clearTimeout(pDebRef.current);
    if(val.length<2||!activeCity){setPlaceSuggestions([]);setShowPlaceSugg(false);return;}
    pDebRef.current=setTimeout(async()=>{
      try{
        const r=await searchNominatim(`${val} ${activeCity.name}`);
        setPlaceSuggestions(r.slice(0,4).map(x=>({
          label:x.display_name.split(', ')[0],
          lat:parseFloat(x.lat),lon:parseFloat(x.lon),
          fullLabel:x.display_name.split(', ').slice(0,2).join(', '),
        })));
        setShowPlaceSugg(true);
      }catch{}
        },180);
  };

  const selectCitySuggestion=(s)=>{
    setTripData(prev=>({...prev,locations:[...prev.locations,{id:Date.now(),name:s.shortName,coords:[s.lat,s.lon],zoomLevel:14,places:[],recommendations:[]}]}));
    setNewCityName('');setSuggestions([]);setShowSugg(false);
  };

  const selectPlaceSuggestion=(s)=>{
    addPlaceToCity(activeCity.id,{id:Date.now(),name:s.label,type:'custom',coords:[s.lat,s.lon]});
    setNewPlaceName('');setPlaceSuggestions([]);setShowPlaceSugg(false);
  };


  const applyResults = (results, reqId, rawCount, dedupedCount) => {
    if (reqId !== requestCountRef.current) return;
    if (!results.length) return;
    results.sort((a,b)=>(b._qualityScore||0)-(a._qualityScore||0));

    // Determine which category types are in this new result set
    const updatedTypes = new Set(results.map(r => r.type));

    setTripData(prev => {
      const loc = prev.locations.find(c => c.id === activeCity.id);
      if (!loc) return prev;

      // Keep existing recs for categories NOT in this update, add/replace those that are
      const existingForOtherCats = (loc.recommendations || []).filter(r => !updatedTypes.has(r.type));
      const merged = [...existingForOtherCats, ...results];
      merged.sort((a,b) => (b._qualityScore||0) - (a._qualityScore||0));
      const ranked = merged.map((item, i) => ({...item, rankNumber: i < 5 ? i + 1 : null}));

      return {
        ...prev,
        locations: prev.locations.map(c => c.id !== activeCity.id ? c : {
          ...c,
          recommendations: ranked,
          ...(rawCount != null ? {_pipelineStats:{raw:rawCount,deduped:dedupedCount}} : {})
        })
      };
    });
  };

  const applyWeather = (resList) => {
    if (!cityWeather) return;
    const INDOOR_BOOST = new Set(['Museums','Coffee','Restaurants','Shopping','Historic']);
    const OUTDOOR_RISKY = new Set(['Hiking','Viewpoints','Beaches','Camping']);
    resList.forEach(r => {
      const prof = cityWeather.profile;
      if (prof==='rain'||prof==='storm'||prof==='snow') {
        if (INDOOR_BOOST.has(r.type)) r._weatherBoost = 4;
        if (OUTDOOR_RISKY.has(r.type)) { r._weatherWarning = true; r._weatherBoost = (r._weatherBoost||0) - 3; }
      } else if (prof==='hot') {
        if (r.type==='Beaches') r._weatherBoost = 3;
        if (r.type==='Hiking') r._weatherWarning = true;
      }
    });
  };

  const handleFindRecs=async()=>{
    if(!activeCity||!mapBounds)return;
    const cats = aiInterests;
    if (cats.length === 0) {
      setTripData(prev=>({...prev,locations:prev.locations.map(c=>c.id!==activeCity.id?c:{...c,recommendations:[]})}));
      setIsSearching(false);
      setLlmStatus('');
      return;
    }
    const reqId = ++requestCountRef.current;
    const currentCenter = mapCenter ? [mapCenter.lat, mapCenter.lng] : activeCity.coords;
    lastSearchCenterRef.current = { lat: currentCenter[0], lng: currentCenter[1], radius: searchRadius, interests: currentInterestsStr };

    const latDeg = (searchRadius || 5) / 111.0;
    const lonDeg = (searchRadius || 5) / (111.0 * Math.cos(currentCenter[0] * Math.PI / 180));
    const searchBounds = {
      south: currentCenter[0] - latDeg,
      north: currentCenter[0] + latDeg,
      west:  currentCenter[1] - lonDeg,
      east:  currentCenter[1] + lonDeg,
    };

    // Phase 1: show cached elements immediately (zero latency)
    const cachedEls = getCachedElementsInView(searchBounds, cats);
    if (cachedEls.length > 0) {
      const phase1 = processOverpassResults({ elements: cachedEls }, cats, currentCenter, searchRadius, osmHardCap);
      phase1.forEach(r => scorePlaceQuality(r, tripData.aiPlan));
      applyWeather(phase1);
      applyResults(phase1, reqId, null, null);
    }

    setIsSearching(true);
    setLlmStatus('Querying OpenStreetMap…');

    // searchOverpass fetches the circle in tiles; each finished tile is shown right away (onProgress)
    let anyLoaded = false;
    const places = (status) => window.dispatchEvent(new CustomEvent('alpacamap-places', { detail: status }));
    const showPartial = (elements) => {
      if (reqId !== requestCountRef.current) return;
      const partial = processOverpassResults({ elements }, cats, currentCenter, searchRadius, osmHardCap);
      partial.forEach(r => scorePlaceQuality(r, tripData.aiPlan));
      applyWeather(partial);
      if (partial.length) { anyLoaded = true; applyResults(partial, reqId, null, null); }
    };
    try {
      let data = await searchOverpass(currentCenter, searchRadius, cats, { onProgress: showPartial });
      if (reqId !== requestCountRef.current) return;

      if (data.fetchPromise) {
        // The map shows the search state for the circle (App listens): loading, done, or partly failed
        places({ state: 'loading' });
        data = await data.fetchPromise;
        if (reqId !== requestCountRef.current) return;
        if (data.failed) lastSearchCenterRef.current = null;   // any map move retries the missing tiles
        places(data.failed ? { state: 'partial', missing: data.failedTiles, total: data.totalTiles } : { state: 'idle' });
      } else {
        places({ state: 'idle' });
      }

      const results = processOverpassResults(data, cats, currentCenter, searchRadius, osmHardCap);
      results.forEach(r => scorePlaceQuality(r, tripData.aiPlan));
      applyWeather(results);
      const rawCount = results.length;
      const dedupedCount = results.length;
      if (results.length > 0) {
        anyLoaded = true;
        applyResults(results, reqId, rawCount, dedupedCount);
      }
    } catch (err) {
      if (reqId !== requestCountRef.current) return;
      const isAbort = err.name === 'AbortError' ||
        (err instanceof AggregateError && err.errors?.every(e => e.name === 'AbortError'));
      if (!isAbort) console.warn('Overpass fetch failed:', err.message);
      places(isAbort ? { state: 'idle' } : { state: 'partial' });
    }

    if (reqId === requestCountRef.current) {
      setIsSearching(false);
      setLlmStatus(anyLoaded ? '' : (cachedEls.length > 0 ? '' : 'No OSM data found in view.'));
      if (!anyLoaded && cachedEls.length === 0) {
        setTimeout(()=>{ if (reqId === requestCountRef.current) setLlmStatus(''); }, 3000);
      }
    }
  };

  const deleteCity=(cityId,e)=>{
    e.stopPropagation();
    setTripData(prev=>({...prev,locations:prev.locations.filter(c=>c.id!==cityId),routes:prev.routes.filter(r=>r.from!==cityId&&r.to!==cityId)}));
  };
  const handleSavePlace=(rec)=>{
    addPlaceToCity(activeCity.id, rec);
    setExpandedPlaces(prev => ({...prev, [rec.id]: true}));
  };

  if(!activeCity){
    return(
      <div>
        <TripInsights tripData={tripData} setActiveTab={setActiveTab}/>
        <p className="panel-hint">Select a destination or click the map to drop a pin.</p>
        <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',marginBottom:'1rem'}}>
          {tripData.locations.map(city=>{
            const locType=detectLocationType(city.name);
            const typeLabel={city:'City',nature:'Nature',coastal:'Coastal',mountain:'Mountain'}[locType];
            const color=getCityColor(city.id,tripData.locations);
            return(
              <div key={city.id} className="city-card" role="button" tabIndex={0} style={{'--card-color':color}} onClick={()=>setActiveCity(city)}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:'600',fontSize:'0.9rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{city.name}</div>
                  <div style={{display:'flex',gap:'0.4rem',alignItems:'center',marginTop:'0.25rem'}}>
                    <span className="tag" style={{fontSize:'0.75rem',background:`${color}20`,color,borderColor:`${color}40`,border:'1px solid'}}>{typeLabel}</span>
                    <span style={{fontSize:'0.8rem',color:'var(--text-secondary)'}}>{city.places.length} saved · {city.recommendations.length} suggestions</span>
                  </div>
                </div>
                <div style={{display:'flex',gap:'0.25rem',alignItems:'center',flexShrink:0}}>
                  <ChevronRight size={16} color="var(--text-secondary)"/>
                  <button className="btn-icon" style={{padding:'0.3rem'}} onClick={e=>deleteCity(city.id,e)} title="Remove destination"><Trash2 size={13} color="var(--danger)"/></button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add city with suggestions, portal dropdown avoids overflow clipping */}
        <div ref={cityAnchorRef}>
          <div className="add-form" style={{marginTop:'0.5rem'}}>
            <input
              type="text"
              placeholder="Add any destination (city, park, beach…)"
              value={newCityName}
              onChange={e=>handleCityInput(e.target.value)}
              onKeyDown={e=>{
                if(e.key==='Enter'&&suggestions.length>0){selectCitySuggestion(suggestions[0]);}
                if(e.key==='Escape'){setSuggestions([]);setShowSugg(false);}
              }}
            />
            <button className="btn-primary btn-sq" disabled={citySearching||(!newCityName.trim()&&suggestions.length===0)}
              onClick={async()=>{
                if(suggestions.length>0){selectCitySuggestion(suggestions[0]);return;}
                if(!newCityName.trim())return;
                setCitySearching(true);
                try{
                  const r=await searchNominatim(newCityName);
                  if(r.length>0){
                    const x=r[0];
                    setTripData(prev=>({...prev,locations:[...prev.locations,{id:Date.now(),name:[x.display_name.split(', ')[0],x.address?.country].filter(Boolean).join(', '),coords:[parseFloat(x.lat),parseFloat(x.lon)],zoomLevel:14,places:[],recommendations:[]}]}));
                    setNewCityName('');setSuggestions([]);setShowSugg(false);
                  }
                }catch{}finally{setCitySearching(false);}
              }}>
              {citySearching?<Loader2 size={16} className="spin"/>:<Plus size={16}/>}
            </button>
          </div>
          {suggestions.length>0&&(
            <div className="suggestions-inline-hint">
              Press <kbd>Enter</kbd> to add <strong>{suggestions[0]?.shortName}</strong>
            </div>
          )}
        </div>
        <PortalDropdown anchorRef={cityAnchorRef} show={showSugg&&suggestions.length>0} onClose={()=>setShowSugg(false)}>
          {suggestions.map((s,i)=>{
            const getTypeIcon = (type) => {
              if (type === 'country') return <Globe size={16} color="#10b981"/>;
              if (type === 'city' || type === 'town') return <Building size={16} color="#3b82f6"/>;
              if (type === 'peak' || type === 'natural') return <MountainSnow size={16} color="#8b5cf6"/>;
              if (type === 'water' || type === 'bay' || type === 'beach') return <Droplets size={16} color="#0ea5e9"/>;
              if (type?.includes('park') || type === 'forest') return <TreePine size={16} color="#22c55e"/>;
              return <MapPin size={16} color="#ef4444"/>;
            };
            const typeIcon = getTypeIcon(s.type);
            return(
              <div key={i} className="suggestion-item" onMouseDown={()=>selectCitySuggestion(s)}>
                <span style={{flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', width:'24px'}}>{typeIcon}</span>
                <div style={{overflow:'hidden',flex:1}}>
                  <div style={{fontWeight:'600',fontSize:'0.9rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.shortName}</div>
                  <div style={{fontSize:'0.75rem',color:'var(--text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.label}</div>
                </div>
                {i===0&&<span style={{fontSize:'0.75rem',color:'var(--accent-primary)',flexShrink:0,fontWeight:'700'}}>↵ ENTER</span>}
              </div>
            );
          })}
        </PortalDropdown>
      </div>
    );
  }

  const locType=detectLocationType(activeCity.name);
  const typeLabel={city:'City',nature:'Nature',coastal:'Coastal',mountain:'Mountain'}[locType];
  const cityColor=getCityColor(activeCity.id,tripData.locations);
  return(
    <div className="location-planner-panel-scroll">
      <button className="back-button" onClick={()=>setActiveCity(null)}><ArrowLeft size={13}/> All destinations</button>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'0.75rem 0 0.25rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
          <div style={{width:'10px',height:'10px',borderRadius:'50%',background:cityColor,boxShadow:`0 0 8px ${cityColor}`}}/>
          <div style={{fontWeight:'700',fontSize:'1rem'}}>{activeCity.name}</div>
        </div>
        <span className="tag" style={{fontSize:'0.75rem',background:`${cityColor}20`,color:cityColor,border:`1px solid ${cityColor}40`}}>{typeLabel}</span>
      </div>
      <p style={{fontSize:'0.8rem',color:'var(--text-secondary)',marginBottom:'0.5rem'}}>Click map to pin a place · Drag circle center to shift search</p>
      <WeatherWidget coords={activeCity.coords}
        startDate={(()=>{const ds=(tripData.itinerary||[]).filter(d=>d.date).map(d=>d.date).sort();return ds[0]||null;})()}
        endDate={(()=>{const ds=(tripData.itinerary||[]).filter(d=>d.date).map(d=>d.date).sort();return ds[ds.length-1]||null;})()}
      />
      {cityWeather&&(
        <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 12px',borderRadius:'8px',
          background: cityWeather.profile==='rain'||cityWeather.profile==='storm'||cityWeather.profile==='snow' ? 'rgba(59,130,246,0.12)' :
                      cityWeather.profile==='hot' ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)',
          border:'1px solid rgba(255,255,255,0.06)', marginTop:'8px', marginBottom:'4px'}}>
          <span style={{fontSize:'1.1rem'}}>{cityWeather.emoji}</span>
          <div style={{flex:1, minWidth:0}}>
            <span style={{fontSize:'0.8rem',fontWeight:'600',color:'var(--text-primary)'}}>{cityWeather.label} · {cityWeather.temp}°C  </span>
            <span style={{fontSize:'0.75rem',color:'var(--text-secondary)'}}>
              {(cityWeather.profile==='rain'||cityWeather.profile==='storm'||cityWeather.profile==='snow') && 'Indoor venues prioritised'}
              {cityWeather.profile==='hot' && 'Beaches & shaded spots boosted'}
              {cityWeather.profile==='cold' && 'Layer up for outdoor activities'}
            </span>
          </div>
        </div>
      )}

      {llmStatus&&(
        <div style={{fontSize:'0.8rem',color:cityColor,marginBottom:'0.5rem',textAlign:'center',display:'flex',justifyContent:'center',alignItems:'center',gap:'4px'}}>
          {isSearching&&<Loader2 size={12} className="spin"/>}{llmStatus}
        </div>
      )}

      <div style={{fontSize:'0.8rem',color:'var(--text-secondary)',marginBottom:'0.4rem',marginTop:'0.75rem'}}>Categories:</div>
      <div className="chip-group" style={{marginBottom:'0.75rem',flexWrap:'wrap'}}>
        {INTEREST_CATEGORIES.map(cat => {
          const isOn = aiInterests.includes(cat.value);
          return (
            <button key={cat.value} type="button" className={`chip ${isOn ? 'active' : ''}`}
              style={{ background: isOn ? cityColor : 'transparent', borderColor: isOn ? 'transparent' : undefined }}
              onClick={() => {
                setAiInterests(prev => {
                  const next = prev.includes(cat.value) ? prev.filter(v => v !== cat.value) : [...prev, cat.value];
                  // After state update, scroll to the category section if adding
                  setTimeout(() => {
                    if (!prev.includes(cat.value)) {
                      const section = document.getElementById(`cat-section-${cat.value}`);
                      if (section) {
                        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                      // Trigger POI search for new category
                      if (findRecsRef.current) findRecsRef.current();
                    }
                  }, 100);
                  return next;
                });
              }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{getTypeDetails(cat.value).icon} {cat.label}</span>
            </button>
          );
        })}
      </div>

      {activeCity.recommendations.length>0&&(
        <>
          <div className="section-label" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
            <span>Nearby ({activeCity.recommendations.length})</span>
            <input type="text" placeholder="Filter…" value={recFilterText} onChange={e=>setRecFilterText(e.target.value)}
              style={{width:'90px',padding:'0.25rem 0.5rem',fontSize:'0.8rem',borderRadius:'4px',background:'rgba(255,255,255,0.05)',color:'white',border:'1px solid rgba(255,255,255,0.1)'}}
            />
          </div>

          {[...INTEREST_CATEGORIES]
            .filter(cat => activeCity.recommendations.some(r => r.type === cat.value))
            // Filter by visibleCategories choice (matching the map selection logic)
            .filter(cat => visibleCategories.length === 0 || visibleCategories.includes(cat.value))
            // Sort: show categories in the order they were added to aiInterests (last added at the end)
            .sort((a, b) => {
              const ia = aiInterests.indexOf(a.value);
              const ib = aiInterests.indexOf(b.value);
              // If not present, keep original order
              if (ia === -1 && ib === -1) return 0;
              if (ia === -1) return -1;
              if (ib === -1) return 1;
              return ia - ib;
            })
            .map(cat => {
              const allForCat = activeCity.recommendations.filter(r => r.type === cat.value && r.name.toLowerCase().includes(recFilterText.toLowerCase()));
              const sorted = spreadByQuality(allForCat);   // same order as the map pins
              const baseLimit = Math.max(1, Math.round(categoryDisplayLimit * mapMarkerLimitFactor));
              const pages = catPages[cat.value] || 1;
              const shownLimit = baseLimit * pages;
              let recsForCat = sorted.slice(0, shownLimit);
              recsForCat.forEach((r, i) => { r.rankNumber = i + 1; });
              if (recsForCat.length === 0) return null;
              const {icon, color} = getTypeDetails(cat.value);
              const totalCount = sorted.length;
              const hasMore = shownLimit < totalCount;
              return (
                <div key={cat.value} id={`cat-section-${cat.value}`} style={{marginBottom:'1.5rem'}}>
                  <div style={{fontSize:'0.9rem',fontWeight:'600',marginBottom:'0.5rem',display:'flex',alignItems:'center',gap:'0.4rem',color}}>
                    {icon} {cat.label}
                    <span style={{color:'var(--text-secondary)',fontWeight:'400',fontSize:'0.8rem'}}>({recsForCat.length}/{totalCount})</span>
                    {pages > 1 && (
                      <button onClick={() => setCatPages(prev => ({...prev, [cat.value]: 1}))}
                        style={{marginLeft:'auto',fontSize:'0.75rem',color:'var(--text-secondary)',background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'1px 8px',cursor:'pointer',fontWeight:'600',flexShrink:0}}>
                        Show less
                      </button>
                    )}
                  </div>
                  <div className="rec-card-row">
                    {recsForCat.map(rec => {
                      const isSaved = activeCity.places.some(p => p.id === rec.id || p.name === rec.name);
                      const isHighlighted = activePlaceInfo && activePlaceInfo.id === rec.id;
                      return(
                        <div
                          key={rec.id}
                          className={`rec-card${isHighlighted ? ' highlighted-pulse' : ''}`}
                          style={{padding:'0.6rem', flex:'0 0 250px', outline: isHighlighted ? '2px solid #3b82f6' : undefined, outlineOffset: 2}}
                          ref={el => { recRefs.current[rec.id] = el; }}
                        >
                          <div className="rec-card-left" role="button" tabIndex={0} onClick={()=>triggerPlaceInfo(rec)} style={{gap:'10px'}}>
                            <LiveImage rec={rec} color={color} icon={icon} activeCityName={activeCity.name} />
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'center',gap:'5px',justifyContent:'space-between',width:'100%'}}>
                                <div style={{display:'flex',alignItems:'center',gap:'5px',minWidth:0,flex:1}}>
                                  {rec.rankNumber&&<span style={{background:cityColor,color:'white',fontSize:'0.72rem',padding:'1px 4px',borderRadius:'8px',fontWeight:'700'}}>#{rec.rankNumber}</span>}
                                  <div style={{fontWeight:'600',fontSize:'0.9rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--text-primary)'}}>{rec.name}</div>
                                </div>
                                {rec._qualityScore > 1 && (
                                  <span style={{fontSize:'0.75rem',color:'var(--text-secondary)',background:'rgba(255,255,255,0.06)',padding:'1px 4px',borderRadius:'4px',flexShrink:0}} title="Quality score">★ {rec._qualityScore}</span>
                                )}
                              </div>
                              <div style={{fontSize:'0.8rem',color:'var(--text-secondary)', marginTop:'3px', display:'flex', alignItems:'center', gap:'6px'}}>
                                <span style={{color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{rec.type}</span>
                                {rec.distanceKm!=null&&<span style={{whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'2px'}}>· <MapPin size={10} color="#ef4444"/> {Number(rec.distanceKm).toFixed(1)} km</span>}
                              </div>
                              {rec._qualityReasons?.length>0&&(
                                <div style={{display:'flex',gap:'3px',flexWrap:'wrap',marginTop:'3px'}}>
                                  {rec._qualityReasons.map(r=>(
                                    <span key={r} style={{
                                      fontSize:'0.72rem',
                                      background: r === 'AI Planned' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                                      color: r === 'AI Planned' ? '#10b981' : 'var(--accent-primary)',
                                      padding:'1px 5px',borderRadius:'8px',whiteSpace:'nowrap',
                                      fontWeight: r === 'AI Planned' ? '700' : 'normal',
                                      border: r === 'AI Planned' ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent'
                                    }}>{r}</span>
                                  ))}
                                </div>
                              )}
                              {rec._weatherWarning&&(
                                <div style={{fontSize:'0.72rem',color:'#f59e0b',marginTop:'3px',display:'flex',alignItems:'center',gap:'3px'}}>
                                  <span>⚠️</span><span>Not ideal today</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{display:'flex',flexDirection:'column',gap:'0.35rem',alignItems:'center'}}>
                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rec.name+' '+activeCity.name)}`} target="_blank" rel="noreferrer" className="btn-icon" onClick={e=>e.stopPropagation()}><ExternalLink size={12}/></a>
                            {isSaved ? (
                              <button className="chip" style={{fontSize:'0.75rem',padding:'0.2rem 0.5rem',borderColor:'var(--text-secondary)'}} onClick={(e)=>{e.stopPropagation(); removePlaceFromCity(activeCity.id, activeCity.places.find(p=>p.name===rec.name||p.id===rec.id)?.id);}}>- Remove</button>
                            ) : (
                              <button className="chip active" style={{fontSize:'0.75rem',padding:'0.2rem 0.5rem',background:cityColor}} onClick={(e)=>{e.stopPropagation(); handleSavePlace(rec);}}>+ Save</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {hasMore && (
                    <button onClick={() => setCatPages(prev => ({...prev, [cat.value]: (prev[cat.value] || 1) + 1}))}
                      style={{marginTop:'8px',width:'100%',padding:'6px',fontSize:'0.8rem',fontWeight:'600',color,background:'transparent',border:`1px solid ${color}30`,borderRadius:'8px',cursor:'pointer'}}>
                      Load {Math.min(baseLimit, totalCount - shownLimit)} more · {totalCount - shownLimit} remaining
                    </button>
                  )}
                </div>
              );
            })}
        </>
      )}

      <div className="section-label">Saved ({activeCity.places.length})</div>
      {activeCity.places.length===0&&<p style={{fontSize:'0.9rem',color:'var(--text-secondary)',marginBottom:'0.75rem'}}>No saved places yet.</p>}
      {activeCity.places.map(place=>{
        const{icon,color}=getTypeDetails(place.type);
        const profile = ENTITY_PROFILES[place.type];
        const isExpanded = expandedPlaces[place.id];
        const isHighlighted = activePlaceInfo && activePlaceInfo.id === place.id;
        return(
          <div
            key={place.id}
            className={`place-card${isHighlighted ? ' highlighted-pulse' : ''}`}
            role="button" tabIndex={0}
            onClick={()=>triggerPlaceInfo(place)}
            style={{alignItems:'flex-start', flexDirection: 'column', outline: isHighlighted ? '2px solid #3b82f6' : undefined, outlineOffset: 2}}
            ref={el => { placeRefs.current[place.id] = el; }}
          >
            <div style={{display:'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <div style={{display:'flex',gap:'0.6rem',alignItems:'flex-start', flex: 1}}>
                <span className="place-emoji" style={{background:color,color:'white',display:'flex',alignItems:'center',justifyContent:'center',marginTop:'2px',flexShrink:0}}>{icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:'500',fontSize:'0.9rem'}}>{place.name}</div>
                </div>
              </div>
              <div style={{display:'flex',gap:'0.25rem',marginTop:'2px'}}>
                <button className="btn-icon" onClick={e=>{e.stopPropagation();setExpandedPlaces(prev=>({...prev, [place.id]: !isExpanded}));}}>
                  {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                </button>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`} target="_blank" rel="noreferrer" className="btn-icon" onClick={e=>e.stopPropagation()}><ExternalLink size={12}/></a>
                <button className="btn-icon" onClick={e=>{e.stopPropagation();removePlaceFromCity(activeCity.id,place.id);}}><Trash2 size={12} color="var(--danger)"/></button>
              </div>
            </div>
            {isExpanded && (
              <div style={{paddingLeft:'2.5rem', width:'100%', marginTop:'8px'}}>
                {profile && (
                  <div style={{display:'flex',gap:'6px',fontSize:'0.75rem',color:'var(--text-secondary)',flexWrap:'wrap',marginBottom:'8px'}}>
                    <span style={{background:'rgba(255,255,255,0.05)',padding:'2px 5px',borderRadius:'4px',display:'inline-flex',alignItems:'center'}}>⏱ {profile.duration}</span>
                    <span style={{background:'rgba(255,255,255,0.05)',padding:'2px 5px',borderRadius:'4px',display:'inline-flex',alignItems:'center'}}>💳 {profile.budget}</span>
                    {profile.tip && <span style={{background:'rgba(255,255,255,0.05)',padding:'2px 5px',borderRadius:'4px',display:'inline-flex',alignItems:'center'}}>💡 {profile.tip}</span>}
                    {profile.packing && profile.packing.length>0 && (
                      <span style={{background:'rgba(255,255,255,0.05)',padding:'2px 5px',borderRadius:'4px',display:'inline-flex',alignItems:'center'}}>🎒 {profile.packing.join(', ')}</span>
                    )}
                  </div>
                )}
                <textarea
                  placeholder="Add a note about this place…"
                  value={place.notes || ''}
                  rows={2}
                  onChange={e => updatePlaceInCity && updatePlaceInCity(activeCity.id, place.id, { notes: e.target.value })}
                  onClick={e => e.stopPropagation()}
                  onFocus={e => e.stopPropagation()}
                  style={{width:'100%',resize:'vertical',fontSize:'0.8rem',lineHeight:'1.5',borderRadius:'6px',padding:'5px 8px',background:'rgba(255,255,255,0.05)',color:'var(--text-primary)',border:'1px solid rgba(255,255,255,0.1)',fontFamily:'Inter,sans-serif'}}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Place search with portal suggestions */}
      <div ref={placeAnchorRef} style={{marginTop:'1rem'}}>
        <div className="add-form" style={{marginTop:0}}>
          <input type="text" placeholder="Search a specific place…" value={newPlaceName}
            onChange={e=>handlePlaceInput(e.target.value)}
            onKeyDown={e=>{
              if(e.key==='Enter'&&placeSuggestions.length>0){selectPlaceSuggestion(placeSuggestions[0]);}
              if(e.key==='Escape'){setPlaceSuggestions([]);setShowPlaceSugg(false);}
            }}
          />
          <button className="btn-primary btn-sq" disabled={isSearching||!newPlaceName.trim()}
            onClick={async()=>{
              if(placeSuggestions.length>0){selectPlaceSuggestion(placeSuggestions[0]);return;}
              if(!newPlaceName.trim())return;
              setIsSearching(true);
              try{
                const r=await searchNominatim(`${newPlaceName} ${activeCity.name}`);
                if(r.length>0){const x=r[0];addPlaceToCity(activeCity.id,{id:Date.now(),name:x.display_name.split(', ')[0],type:'custom',coords:[parseFloat(x.lat),parseFloat(x.lon)]});setNewPlaceName('');}
              }catch{}finally{setIsSearching(false);}
            }}>
            {isSearching?<Loader2 size={16} className="spin"/>:<Plus size={16}/>}
          </button>
        </div>
      </div>
      <PortalDropdown anchorRef={placeAnchorRef} show={showPlaceSugg&&placeSuggestions.length>0} onClose={()=>setShowPlaceSugg(false)}>
        {placeSuggestions.map((s,i)=>(
          <div key={i} className="suggestion-item" onMouseDown={()=>selectPlaceSuggestion(s)}>
            <MapPin size={11} style={{flexShrink:0,color:'var(--accent-primary)'}}/>
            <div style={{overflow:'hidden',flex:1}}>
              <div style={{fontWeight:'600',fontSize:'0.9rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.label}</div>
              <div style={{fontSize:'0.75rem',color:'var(--text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.fullLabel}</div>
            </div>
            {i===0&&<span style={{fontSize:'0.75rem',color:'var(--accent-primary)',flexShrink:0,fontWeight:'700'}}>↵</span>}
          </div>
        ))}
      </PortalDropdown>
    </div>
  );
};
