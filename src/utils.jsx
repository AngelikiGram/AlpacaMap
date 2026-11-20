import L from 'leaflet';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Accessibility, Activity, BookOpen, Bed, Brain, Bus, Camera, Car, Castle, Clock, Coffee, Compass, CreditCard, DollarSign, Download, Droplets, Globe, Info, Landmark, MapPin, MountainSnow, Package, Plane, Search, Ship, ShoppingBag, Sparkles, Tent, Train, TreePine, Utensils, Calendar as CalendarIcon, FileText, Layers, Satellite, Moon, Navigation } from 'lucide-react';
import { CATEGORY_ZOOM_PRIORITY, OVERPASS_TAGS, TOURIST_LANDMARK_TAGS, OVERPASS_URL } from "./config";

export const CITY_PALETTE = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#ef4444','#84cc16','#f97316','#a78bfa'];

export const getCityColor = (id, locations) => CITY_PALETTE[locations.findIndex(l => l.id === id) % CITY_PALETTE.length] || '#3b82f6';

export const MAP_LAYERS = [
  {
    id:'streets', icon:<MapPin size={14}/>, label:'Streets (OSM)', desc:'Detailed OSM map with places & roads',
    url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr:'© OpenStreetMap', maxNative:19, subdomains:'abc',
  },
  {
    id:'clean', icon:<Layers size={14}/>, label:'Clean', desc:'Clean street map (Voyager)',
    url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attr:'© CARTO', maxNative:19, subdomains:'abcd',
  },
  {
    id:'satellite', icon:<Satellite size={14}/>, label:'Satellite', desc:'Aerial imagery with place labels',
    url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelsUrl:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
    attr:'© Esri', maxNative:17, subdomains:'',
  },
  {
    id:'terrain', icon:<MountainSnow size={14}/>, label:'Terrain', desc:'Topographic map — trails, elevation',
    url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attr:'© Esri', maxNative:19, subdomains:'',
  },
  {
    id:'dark', icon:<Moon size={14}/>, label:'Dark', desc:'Dark mode — great for night planning',
    url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr:'© CARTO', maxNative:19, subdomains:'abcd',
  },
  {
    id:'osm', icon:<TreePine size={14}/>, label:'Outdoors', desc:'Full OSM detail — trails, parks, POIs',
    url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr:'© OpenStreetMap contributors', maxNative:19, subdomains:'abc',
  },
];

export const SENTINEL_NONE = '__none__';

export const getTypeDetails = (typeString) => {
  if (!typeString) return { icon:<Camera size={14}/>, color:'#0ea5e9', label:'Sight' };
  const t = typeString.toLowerCase();
  if (t.includes('food') || t.includes('restaurant') || t === 'pub' || t.includes('bar') || t.includes('nightlife')) return { icon:<Utensils size={14}/>,    color:'#f59e0b', label:'Food'     };
  if (t.includes('cafe') || t.includes('coffee'))      return { icon:<Coffee size={14}/>,      color:'#d97706', label:'Cafes'    };
  if (t.includes('museum'))                            return { icon:<Landmark size={14}/>,    color:'#dc2626', label:'Museums'  };
  if (t.includes('gallery') || t.includes('art'))     return { icon:<Camera size={14}/>,      color:'#a855f7', label:'Art'      };
  if (t.includes('church') || t.includes('cathedral') || t.includes('abbey') || t.includes('mosque') || t.includes('synagogue')) return { icon:<Landmark size={14}/>, color:'#7c3aed', label:'Religious' };
  if (t.includes('historic') || t.includes('castle') || t.includes('ruins') || t.includes('monument') || t.includes('memorial')) return { icon:<Castle size={14}/>, color:'#92400e', label:'Historic' };
  if (t.includes('viewpoint') || t.includes('view'))  return { icon:<MountainSnow size={14}/>,color:'#0284c7', label:'Views'    };
  if (t.includes('park') || t.includes('garden') || t.includes('nature')) return { icon:<TreePine size={14}/>, color:'#16a34a', label:'Parks' };
  if (t.includes('hiking') || t.includes('trail') || t.includes('peak') || t.includes('mountain')) return { icon:<MountainSnow size={14}/>, color:'#15803d', label:'Hiking' };
  if (t.includes('beach') || t.includes('coast') || t.includes('bay'))    return { icon:<Droplets size={14}/>,    color:'#06b6d4', label:'Beaches'  };
  if (t.includes('camping') || t.includes('camp'))    return { icon:<Tent size={14}/>,        color:'#84cc16', label:'Camping'  };
  if (t.includes('shop') || t.includes('mall') || t.includes('market'))   return { icon:<ShoppingBag size={14}/>, color:'#ec4899', label:'Shopping' };
  if (t.includes('attraction') || t.includes('sight') || t.includes('theatre') || t.includes('cinema') || t.includes('stadium')) return { icon:<Camera size={14}/>, color:'#0ea5e9', label:'Sights' };
  if (t.includes('street') || t.includes('square') || t.includes('plaza') || t.includes('piazza')) return { icon:<MapPin size={14}/>, color:'#64748b', label:'Street' };
  if (t.includes('custom') || t.includes('user'))     return { icon:<MapPin size={14}/>,      color:'#ef4444', label:'Custom'   };
  if (t.includes('city'))                             return { icon:<Compass size={14}/>,     color:'#06b6d4', label:'City'     };
  return { icon:<Camera size={14}/>, color:'#0ea5e9', label:'Sight' };
};

export const createDayStopIcon = (num, color) => L.divIcon({
  className: '',
  html: `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 7px rgba(0,0,0,0.55)) drop-shadow(0 1px 3px rgba(0,0,0,0.4));overflow:visible"><path d="M13 1C6.4 1 1 6.4 1 13c0 8.8 12 20 12 20S25 21.8 25 13C25 6.4 19.6 1 13 1z" fill="${color}"/><circle cx="13" cy="12.5" r="6.5" fill="rgba(255,255,255,0.18)"/><text x="13" y="16.5" text-anchor="middle" fill="white" font-size="9.5" font-weight="700" font-family="Inter,-apple-system,sans-serif">${num}</text></svg>`,
  iconSize: [26, 34],
  iconAnchor: [13, 34],
  popupAnchor: [0, -36],
});

export const createGlyphIcon = (typeString, highlighted = false) => {
  const details = getTypeDetails(typeString);
  const color = details.color;
  // Use React to render the lucide component, then extract its inner paths.
  const iconHtml = renderToString(details.icon).replace(/<svg[^>]*>|<\/svg>/gi, '');
  const sz = highlighted ? 40 : 32;
  const h = Math.round(sz * 44 / 36);
  const tipY = Math.round(h * 42 / 44);
  const midY = Math.round(h * 17 / 44);
  const html = `<svg width="${sz}" height="${h}" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));overflow:visible"><path d="M18 2C9.7 2 3 8.7 3 18c0 11.6 15 24 15 24S33 29.6 33 18C33 8.7 26.3 2 18 2z" fill="${color}"/><circle cx="18" cy="17" r="11" fill="rgba(255,255,255,0.15)"/><g transform="translate(8,7) scale(0.833)" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">${iconHtml}</g></svg>`;
  return L.divIcon({ className:'', html, iconSize:[sz,h], iconAnchor:[sz/2, tipY], popupAnchor:[0, -tipY+midY] });
};

// White-border + glow variant for saved places — bigger, crisper than recommendation pins
export const createSavedGlyphIcon = (typeString) => {
  const details = getTypeDetails(typeString);
  const color = details.color;
  const iconHtml = renderToString(details.icon).replace(/<svg[^>]*>|<\/svg>/gi, '');
  const sz = 38;
  const h = Math.round(sz * 44 / 36);
  const tipY = Math.round(h * 42 / 44);
  const midY = Math.round(h * 17 / 44);
  const html = `<svg width="${sz}" height="${h}" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 0 5px rgba(255,255,255,0.9)) drop-shadow(0 0 10px rgba(255,255,255,0.45)) drop-shadow(0 3px 8px rgba(0,0,0,0.6));overflow:visible"><path d="M18 2C9.7 2 3 8.7 3 18c0 11.6 15 24 15 24S33 29.6 33 18C33 8.7 26.3 2 18 2z" fill="${color}"/><path d="M18 2C9.7 2 3 8.7 3 18c0 11.6 15 24 15 24S33 29.6 33 18C33 8.7 26.3 2 18 2z" fill="none" stroke="white" stroke-width="2.5" stroke-linejoin="round"/><circle cx="18" cy="17" r="10.5" fill="rgba(255,255,255,0.22)"/><g transform="translate(8,7) scale(0.833)" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">${iconHtml}</g></svg>`;
  return L.divIcon({ className:'', html, iconSize:[sz,h], iconAnchor:[sz/2, tipY], popupAnchor:[0, -tipY+midY] });
};

// AI-suggested preview marker — amber/gold glyph with dashed outline to distinguish from all other pin types
export const createPreviewIcon = (typeString) => {
  const details = getTypeDetails(typeString);
  const color = details.color;
  const iconHtml = renderToString(details.icon).replace(/<svg[^>]*>|<\/svg>/gi, '');
  const sz = 30;
  const h = Math.round(sz * 44 / 36);
  const tipY = Math.round(h * 42 / 44);
  const midY = Math.round(h * 17 / 44);
  const html = `<svg width="${sz}" height="${h}" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.35));overflow:visible"><path d="M18 2C9.7 2 3 8.7 3 18c0 11.6 15 24 15 24S33 29.6 33 18C33 8.7 26.3 2 18 2z" fill="${color}" opacity="0.55"/><path d="M18 2C9.7 2 3 8.7 3 18c0 11.6 15 24 15 24S33 29.6 33 18C33 8.7 26.3 2 18 2z" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="4 2.5" stroke-linejoin="round"/><g transform="translate(8,7) scale(0.833)" stroke="#fbbf24" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">${iconHtml}</g></svg>`;
  return L.divIcon({ className:'', html, iconSize:[sz,h], iconAnchor:[sz/2, tipY], popupAnchor:[0, -tipY+midY] });
};

export const createCityIcon = (color = '#3b82f6') => {
  const cityIconHtml = renderToString(getTypeDetails('city').icon).replace(/<svg[^>]*>|<\/svg>/gi, '');
  const html = `<div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;width:44px;height:44px;border-radius:50%;border:2px solid ${color};opacity:0.35;animation:cityPulse 2s ease-out infinite"></div>
    <div style="background:${color};border:2.5px solid rgba(255,255,255,0.92);border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px ${color}70,0 4px 14px rgba(0,0,0,0.45);position:relative;z-index:1">
      <svg width="20" height="20" viewBox="0 0 24 24" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">${cityIconHtml}</svg>
    </div>
  </div>`;
  return L.divIcon({ className:'', html, iconSize:[44,44], iconAnchor:[22,22], popupAnchor:[0,-24] });
};

export const classifyWeather = (forecast) => {
  if (!forecast?.length) return null;
  const {code, max: temp} = forecast[0];
  const c = Number(code);
  if (c >= 80) return {profile:'storm', temp, label:'Storm warning', emoji:'⛈️'};
  if (c >= 70) return {profile:'snow',  temp, label:'Snow expected',  emoji:'❄️'};
  if (c >= 50) return {profile:'rain',  temp, label:'Rain likely',    emoji:'🌧️'};
  if (temp >= 30) return {profile:'hot', temp, label:'Hot weather',   emoji:'☀️'};
  if (temp <=  5) return {profile:'cold',temp, label:'Cold conditions',emoji:'🧊'};
  return null;
};

const KEY_FALLBACK_CATEGORY = {
  amenity: 'Attractions', tourism: 'Attractions', leisure: 'Parks',
  shop: 'Shopping', historic: 'Historic', natural: 'Hiking', waterway: 'Hiking',
};

export const detectOSMCategory = (tags, requestedCategories) => {
  for (const cat of requestedCategories) {
    for (const [k, v] of (OVERPASS_TAGS[cat] || [])) {
      if (tags[k] === v) return cat;
    }
  }
  for (const [key, fallbackCat] of Object.entries(KEY_FALLBACK_CATEGORY)) {
    if (tags[key]) return fallbackCat;
  }
  return requestedCategories[0] || 'Attractions';
};

export const processOverpassResults = (data, categories, centerCoords = null, maxRadiusKm = 3, hardCap = 500) => {
  if (!data.elements) return [];
  const seen = new Set();
  // Group by category for per-category guarantees
  const byCategory = {};
  for (const cat of categories) byCategory[cat] = [];
  data.elements.forEach(el => {
    const tags = el.tags || {};
    const name = tags.name || tags['name:en'];
    if (!name) return;
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (!elLat || !elLon) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const category = detectOSMCategory(tags, categories);
    if (!byCategory[category]) byCategory[category] = [];
    const addrParts = [tags['addr:housenumber'],tags['addr:street'],tags['addr:city']||tags['addr:town']].filter(Boolean);
    const dist = centerCoords ? getDistanceKm(centerCoords[0], centerCoords[1], elLat, elLon) : 0;
    byCategory[category].push({
      id: el.id,
      name,
      type: category,
      coords: [elLat, elLon],
      distanceKm: dist,
      osmTags: {
        address:     addrParts.join(' ') || null,
        phone:       tags.phone || tags['contact:phone'] || null,
        website:     tags.website || tags['contact:website'] || tags.url || null,
        hours:       tags.opening_hours || null,
        cuisine:     tags.cuisine?.replace(/[;_]/g,x=>x===';'?', ':' ') || null,
        stars:       tags.stars || null,
        wheelchair:  tags.wheelchair || null,
        description: tags.description || null,
        wikipedia:   tags.wikipedia || null,
        image:       tags.image || null,
        fee:         tags.fee || null,
        level:       tags.level || null,
        wikidata:          tags.wikidata || null,
        wikimedia_commons: tags.wikimedia_commons || null,
        tourism:           tags.tourism || null,
        historic:          tags.historic || null,
      },
    });
  });

  // For each category, spatially distribute up to hardCap across the full radius
  let allResults = [];
  for (const cat of categories) {
    let arr = byCategory[cat] || [];
    arr = arr.filter(p => p.distanceKm <= maxRadiusKm);
    if (arr.length <= hardCap) {
      allResults.push(...arr.sort((a,b) => a.distanceKm - b.distanceKm));
      continue;
    }
    // Grid bucketing for spatial spread
    const buckets = new Map();
    const DEG = 0.02;
    arr.forEach(p => {
      const q = (p.osmTags.wikipedia || p.osmTags.wikidata ? 2 : 0) + (p.osmTags.website ? 1 : 0);
      p._q = q;
      const key = `${Math.floor(p.coords[0]/DEG)},${Math.floor(p.coords[1]/DEG)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(p);
    });
    for (const list of buckets.values()) {
      list.sort((a,b) => {
        if (b._q !== a._q) return b._q - a._q;
        return a.distanceKm - b.distanceKm;
      });
    }
    let catResult = [];
    const lists = Array.from(buckets.values());
    let idx = 0;
    while (catResult.length < hardCap && lists.some(l => l.length > idx)) {
      for (const list of lists) {
        if (list.length > idx && catResult.length < hardCap) {
          catResult.push(list[idx]);
        }
      }
      idx++;
    }
    allResults.push(...catResult.sort((a,b) => a.distanceKm - b.distanceKm));
  }
  return allResults;
};

export const nameSim = (a, b) => {
  const tok = s => new Set(s.toLowerCase().replace(/[\u2018\u2019\u0027]/g,'').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w => w.length > 2));
  const ta = tok(a), tb = tok(b);
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  for (const w of ta) if (tb.has(w)) common++;
  return common / Math.max(ta.size, tb.size);
};

export const isPlaceInAiPlan = (placeName, aiPlan) => {
  if (!placeName || !aiPlan || !aiPlan.days) return false;
  const nameLower = placeName.toLowerCase();
  for (const day of aiPlan.days) {
    const stops = day.stops || day.places || [];
    for (const stop of stops) {
      if (stop && stop.name) {
        if (stop.name.toLowerCase() === nameLower) return true;
        if (nameSim(stop.name, placeName) > 0.8) return true;
      }
    }
  }
  return false;
};

export const scorePlaceQuality = (place, aiPlan = null) => {
  const t = place.osmTags || {};
  let score = 0;
  const reasons = [];
  if (t.wikipedia || t.wikidata) { score += 8; reasons.push('Landmark'); }
  if (t.image || t.wikimedia_commons) { score += 3; }
  if (t.website && t.hours) { score += 7; reasons.push('Full details listed'); }
  else if (t.website) { score += 4; }
  else if (t.hours)   { score += 3; }
  if (t.phone)       { score += 2; }
  if (t.address)     { score += 2; }
  if (t.description) { score += 2; }
  if (t.cuisine)     { score += 1; }
  if (t.tourism && TOURIST_LANDMARK_TAGS.has(t.tourism)) { score += 6; reasons.push('Tourist attraction'); }
  else if (t.tourism) { score += 3; }
  if (t.historic)    { score += 5; reasons.push('Historic site'); }
  if (place.rankNumber) score += (6 - place.rankNumber);
  // Remove the default +1 for short names, as it causes all places to have at least 1.0
  // if ((place.name || '').split(' ').length <= 3) score += 1;

  if (aiPlan && isPlaceInAiPlan(place.name, aiPlan)) {
    score += 15;
    if (!reasons.includes('AI Planned')) {
      reasons.unshift('AI Planned');
    }
  }

  // Only assign a score if it's positive and meaningful
  place._qualityScore = score > 0 ? Math.round(score * 10) / 10 : null;
  place._qualityReasons = reasons.slice(0, 3);
  return score;
};

export const semanticDedup = (places, minGapKm = 0.12) => {
  const DEG = minGapKm / 111;
  const kept = [];
  return places.filter(p => {
    const isDup = kept.some(k => {
      if (Math.abs(p.coords[0]-k.coords[0]) >= DEG || Math.abs(p.coords[1]-k.coords[1]) >= DEG) return false;
      if (p.osmTags?.wikidata && p.osmTags.wikidata === k.osmTags?.wikidata) return true;
      if (p.osmTags?.website && p.osmTags.website === k.osmTags?.website) return true;
      if (nameSim(p.name, k.name) > 0.75) return true;
      return false;
    });
    if (!isDup) kept.push(p);
    return !isDup;
  });
};

export const getZoomParams = (zoom) => {
  if (zoom >= 18) return { limit:50, gap:0.003, tier:'high' };
  if (zoom >= 16) return { limit:25, gap:0.007, tier:'high' };
  if (zoom >= 14) return { limit:20, gap:0.012, tier:'medium' };
  if (zoom >= 13) return { limit:15, gap:0.018, tier:'medium' };
  if (zoom >= 11) return { limit:12, gap:0.025, tier:'low' };
  return                { limit:6,  gap:0.04,  tier:'low' };
};

export const filterMarkersAdaptive = (recs, zoom = 14, aiPlan = null, limitMultiplier = 1) => {
  const { limit, gap, tier } = getZoomParams(zoom);
  const adjustedLimit = Math.max(1, Math.round(limit * limitMultiplier));
  const allowed = CATEGORY_ZOOM_PRIORITY[tier];
  const pool = allowed ? recs.filter(r => allowed.has(r.type)) : recs;
  const byCategory = {};
  for (const r of pool) {
    if (!byCategory[r.type]) byCategory[r.type] = [];
    byCategory[r.type].push(r);
  }
  const result = [];
  for (const group of Object.values(byCategory)) {
    const scored = [...group].sort((a,b) => (scorePlaceQuality(b, aiPlan)+(b._weatherBoost||0)) - (scorePlaceQuality(a, aiPlan)+(a._weatherBoost||0)));
    // Geographic grid spread: pick the best-scored place in each grid cell.
    // This prevents all markers clustering at the highest-quality area (e.g. central London)
    // and instead distributes them across the full search radius.
    const grid = new Map();
    for (const p of scored) {
      const key = `${Math.floor(p.coords[0] / gap)},${Math.floor(p.coords[1] / gap)}`;
      if (!grid.has(key)) grid.set(key, p); // scored best-first, so first in each cell wins
    }
    result.push(...[...grid.values()].slice(0, adjustedLimit));
  }
  return result;
};

export const loadTrips = () => {
  try {
    const raw = localStorage.getItem(TRIPS_KEY);
    if (!raw) return [{ id: 'default', name: INITIAL_TRIP.title, data: INITIAL_TRIP }];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [{ id: 'default', name: INITIAL_TRIP.title, data: INITIAL_TRIP }];
    }
    // Migration: seed missing fields without wiping user data
    if (parsed[0] && parsed[0].data && !parsed[0].data.knowledgeGraph) {
      parsed[0].data.knowledgeGraph = { nodes:[], edges:[], lastUpdated:null };
      localStorage.setItem(TRIPS_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return [{ id: 'default', name: INITIAL_TRIP.title, data: INITIAL_TRIP }];
  }
};

export const loadPrefs  = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; } };

export const saveTrips  = (trips) => localStorage.setItem(TRIPS_KEY, JSON.stringify(trips.slice(0, 30)));

export const savePrefs  = (prefs) => localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));

export const detectLocationType = (name='') => {
  const n=name.toLowerCase();
  if(n.includes('national park')||n.includes('nature reserve')||n.includes('forest')||n.includes('wilderness')||n.includes('canyon')||n.includes('valley')) return 'nature';
  if(n.includes('beach')||n.includes('coast')||n.includes('bay')||n.includes('island')||n.includes('sea')||n.includes('ocean')) return 'coastal';
  if(n.includes('mountain')||n.includes('peak')||n.includes('alps')||n.includes('highland')||n.includes('range')||n.includes('glacier')) return 'mountain';
  return 'city';
};

export const createSearchResultIcon = () => {
  const mapPinHtml = renderToString(<MapPin size={24} color="#ef4444" />);
  return L.divIcon({
    className: 'srm-wrapper',
    html: `<div class="srm-pulse"></div><div class="srm-pin" style="display:flex;align-items:center;justify-content:center;background:white;border-radius:50%;padding:4px">${mapPinHtml}</div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -28],
  });
};

export const getAllMapPoints = (locations) => locations.flatMap(loc => [
  { id: loc.id, name: loc.name, coords: loc.coords, parentId: loc.id },
  ...loc.places.map(p => ({ id: p.id, name: p.name, coords: p.coords, parentId: loc.id }))
]);

export function buildArc(from,to,n=60){
  const mx=(from[0]+to[0])/2,my=(from[1]+to[1])/2;
  const dx=to[0]-from[0],dy=to[1]-from[1];
  const len=Math.sqrt(dx*dx+dy*dy);
  const px=-dy/len,py=dx/len,curv=len*0.35;
  const cx=mx+px*curv,cy=my+py*curv;
  return Array.from({length:n+1},(_,i)=>{const t=i/n;return[(1-t)**2*from[0]+2*t*(1-t)*cx+t**2*to[0],(1-t)**2*from[1]+2*t*(1-t)*cy+t**2*to[1]];});
}

export function getDistanceKm(lat1,lon1,lat2,lon2){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

export const INITIAL_TRIP = {
  title:'Euro Trip 2026',
  locations:[
    {id:1,name:'Paris, France',      coords:[48.8566,2.3522], zoomLevel:14, places:[{id:101,name:'Louvre Museum',type:'museum',coords:[48.8606,2.3376]}], recommendations:[]},
    {id:2,name:'Zurich, Switzerland',coords:[47.3769,8.5417], zoomLevel:14, places:[], recommendations:[]},
  ],
  routes:[{id:101,from:1,to:2,mode:'train',path:[[48.8566,2.3522],[47.3769,8.5417]]}],
  itinerary:[
    {id:1,date:'2026-09-10',location:'Paris', events:[{id:11,time:'10:00',title:'Flight Arrival CDG',type:'flight'}]},
    {id:2,date:'2026-09-11',location:'Paris', events:[{id:12,time:'09:00',title:'Louvre Museum',type:'activity'}]},
    {id:3,date:'2026-09-12',location:'Paris', events:[]},
    {id:4,date:'2026-09-13',location:'Zurich',events:[{id:13,time:'08:30',title:'Train to Zurich',type:'train'},{id:14,time:'14:00',title:'Hotel check-in',type:'hotel'}]},
  ],
  notes:{general:'Remember universal adapters.\nCall bank to authorize cards for Europe.',cities:{}},
  documents:{flights:[],trains:[],hotels:[],leisure:[]},
  budget:{
    total:3000,currency:'EUR',
    expenses:[
      {id:1,name:'Return Flights',amount:450,category:'transport',city:'Paris, France'},
      {id:2,name:'Hotel Paris (3n)',amount:320,category:'accommodation',city:'Paris, France'},
    ],
  },
  packing:[
    {id:1,name:'Documents',items:[{id:11,text:'Passport',checked:true},{id:12,text:'Travel Insurance',checked:false},{id:13,text:'Emergency Contacts',checked:false}]},
    {id:2,name:'Clothes',items:[{id:21,text:'T-shirts (5x)',checked:false},{id:22,text:'Rain jacket',checked:false},{id:23,text:'Smart outfit',checked:false}]},
    {id:3,name:'Electronics',items:[{id:31,text:'Phone + charger',checked:false},{id:32,text:'Universal adapter',checked:true},{id:33,text:'Power bank',checked:false}]},
  ],
  knowledgeGraph:{ nodes:[], edges:[], lastUpdated:null },
};

export const TRIPS_KEY = 'alpacamap_trips_v1';

export const PREFS_KEY = 'alpacamap_prefs_v1';

export const TABS=[
  {id:'locations',  label:'Explore',    Icon:MapPin},
  {id:'tripmind',   label:'Planner',    Icon:Sparkles},
  {id:'routespace', label:'TripSpace',  Icon:Compass},
  {id:'analytics',  label:'Insights',   Icon:Activity},
  {id:'knowledge',  label:'Knowledge',  Icon:Brain},
  {id:'calendar',   label:'Itinerary',  Icon:CalendarIcon},
  {id:'budget',     label:'Budget',     Icon:DollarSign},
  {id:'packing',    label:'Packing',    Icon:Package},
  {id:'notes',      label:'Notes',      Icon:BookOpen},
  {id:'documents',  label:'Docs',       Icon:FileText},
  {id:'route',      label:'Export',     Icon:Download},
];


export const wmoIcon=(code)=>{const c=Number(code);if(c===0)return'☀️';if(c<=3)return['🌤️','🌤️','⛅','☁️'][c]||'⛅';if(c<=49)return'🌫️';if(c<=59)return'🌦️';if(c<=69)return'🌧️';if(c<=79)return'❄️';if(c<=84)return'🌦️';return'⛈️';};

export const formatDur=(mins)=>{if(mins<60)return`${mins} min`;const h=Math.floor(mins/60),m=mins%60;return m>0?`${h}h ${m}m`:`${h}h`;};

// Module-level cache for Overpass queries
const overpassCache = {
  queries: [],     // Array of { south, west, north, east, categories: Set }
  elements: new Map(), // id -> element
};

// Restore cache from sessionStorage (survives page navigation, cleared on tab close)
const OVERPASS_CACHE_KEY = 'alpacamap_overpass_v9';
const OVERPASS_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
// Purge all old versioned cache keys so stale data never bleeds through
try {
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith('alpacamap_overpass_') && k !== OVERPASS_CACHE_KEY) {
      sessionStorage.removeItem(k); i--;
    }
  }
} catch {}
try {
  const saved = sessionStorage.getItem(OVERPASS_CACHE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Date.now() - (parsed.ts || 0) < OVERPASS_CACHE_TTL) {
      overpassCache.queries = (parsed.queries || []).map(q => ({ ...q, categories: new Set(q.categories || []) }));
      for (const [id, el] of (parsed.elements || [])) overpassCache.elements.set(id, el);
    }
  }
} catch {}

const persistCache = () => {
  try {
    sessionStorage.setItem(OVERPASS_CACHE_KEY, JSON.stringify({
      ts: Date.now(),
      queries: overpassCache.queries.map(q => ({ ...q, categories: [...q.categories] })),
      elements: [...overpassCache.elements.entries()].slice(0, 8000),
    }));
  } catch {} // ignore quota errors
};

export const seedOverpassElements = (elements) => {
  if (!elements || !Array.isArray(elements)) return;
  for (const el of elements) {
    if (el && el.id != null) {
      overpassCache.elements.set(el.id, el);
    }
  }
  if (elements.length > 0) {
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    let hasCoords = false;
    for (const el of elements) {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat != null && lon != null) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        hasCoords = true;
      }
    }
    if (hasCoords) {
      const allCats = [
        'Restaurants', 'Coffee', 'Museums', 'Art', 'Parks', 'Shopping',
        'Attractions', 'Hiking', 'Viewpoints', 'Beaches', 'Camping', 'Historic'
      ];
      // Mark this box as cached for all categories
      overpassCache.queries.push({
        south: minLat - 0.01,
        north: maxLat + 0.01,
        west: minLon - 0.01,
        east: maxLon + 0.01,
        categories: new Set(allCats)
      });
    }
  }
  persistCache();
};

let currentAbortController = null;

export const getCachedElementsInView = (bounds, categories) => {
  const { south, west, north, east } = bounds;
  const result = [];
  for (const el of overpassCache.elements.values()) {
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (elLat == null || elLon == null) continue;
    if (elLat < south || elLat > north || elLon < west || elLon > east) continue;
    const matches = categories.some(cat =>
      (OVERPASS_TAGS[cat] || []).some(([k, v]) => el.tags?.[k] === v)
    );
    if (matches) result.push(el);
  }
  return result;
};

export const searchOverpass = async (center, radiusKm, categories) => {
  const lat = Array.isArray(center) ? center[0] : (center ? (center.lat ?? center.latitude) : null);
  const lon = Array.isArray(center) ? center[1] : (center ? (center.lng ?? center.lon ?? center.longitude) : null);

  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
    console.error("searchOverpass: Invalid center coordinates", center);
    throw new Error(`Invalid center coordinates: ${JSON.stringify(center)}`);
  }
  if (radiusKm == null || isNaN(radiusKm) || radiusKm <= 0) {
    console.error("searchOverpass: Invalid search radius", radiusKm);
    throw new Error(`Invalid search radius: ${radiusKm}`);
  }

  // 1. Compute bounding box for the search circle
  const offsetLat = radiusKm / 110.574;
  const offsetLng = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));

  const south = lat - offsetLat;
  const north = lat + offsetLat;
  const west = lon - offsetLng;
  const east = lon + offsetLng;

  // Pad bounding box to cache surrounding areas, scaled down for larger radii to prevent timeouts
  const pad = radiusKm > 8 ? 0.05 : (radiusKm > 4 ? 0.15 : 0.4);
  const qSouth = lat - offsetLat * (1 + pad);
  const qNorth = lat + offsetLat * (1 + pad);
  const qWest = lon - offsetLng * (1 + pad);
  const qEast = lon + offsetLng * (1 + pad);

  const getCachedElements = () => {
    const result = [];
    for (const el of overpassCache.elements.values()) {
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      if (elLat == null || elLon == null) continue;
      if (elLat < south || elLat > north || elLon < west || elLon > east) continue;
      if (categories.some(cat => (OVERPASS_TAGS[cat] || []).some(([k, v]) => el.tags?.[k] === v))) {
        result.push(el);
      }
    }
    return result;
  };

  // Only fetch categories not already cached — a cached query covers our area if its bbox contains our actual search bbox
  const uncachedCats = categories.filter(cat =>
    !overpassCache.queries.some(q =>
      q.categories?.has(cat) &&
      q.south <= south && q.north >= north &&
      q.west <= west && q.east >= east
    )
  );

  if (uncachedCats.length === 0) {
    return { elements: getCachedElements(), isFresh: true };
  }

  // Create a new abort controller for this request (don't abort previous, allow parallel fetches to complete)
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  const bbox = `(${qSouth},${qWest},${qNorth},${qEast})`;

  // Parks/beaches/hiking are stored as way+relation in OSM — must use nwr.
  // All other categories are nodes or ways → nw is sufficient and much faster.
  // Splitting into two parallel queries prevents a slow nwr from blocking everything.
  const AREA_CATS = new Set(['Parks', 'Hiking', 'Beaches', 'Camping', 'Viewpoints']);
  const pointCats = uncachedCats.filter(c => !AREA_CATS.has(c));
  const areaCats  = uncachedCats.filter(c =>  AREA_CATS.has(c));

  // Build nw query (point categories, grouped by key for compactness)
  const pointByKey = new Map();
  for (const cat of pointCats) {
    for (const [k, v] of (OVERPASS_TAGS[cat] || [])) {
      if (!pointByKey.has(k)) pointByKey.set(k, new Set());
      pointByKey.get(k).add(v);
    }
  }
  const nwLines = [...pointByKey.entries()].map(([k, vals]) => {
    const arr = [...vals];
    return arr.length === 1
      ? `  nw["${k}"="${arr[0]}"]["name"]${bbox};`
      : `  nw["${k}"~"^(${arr.join('|')})$"]["name"]${bbox};`;
  });

  // Build nwr query (area categories, one line per tag pair)
  const nwrLines = [];
  for (const cat of areaCats) {
    for (const [k, v] of (OVERPASS_TAGS[cat] || [])) {
      nwrLines.push(`  nwr["${k}"="${v}"]["name"]${bbox};`);
    }
  }

  // Only endpoints with CORS headers — others block browser requests
  const urls = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  const filterToView = els => els.filter(el => {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    return lat >= south && lat <= north && lon >= west && lon <= east;
  });

  // Race all endpoints; resolve with first successful response
  const raceOverpass = (query, cats, timeoutMs) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const controllers = [];
    const promises = urls.map(url => new Promise(async (res, rej) => {
      const ctrl = new AbortController();
      controllers.push(ctrl);
      const onAbort = () => ctrl.abort();
      if (signal) signal.addEventListener('abort', onAbort);
      const tid = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const r = await fetch(url, { method: 'POST', body: query, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl.signal });
        clearTimeout(tid);
        if (signal) signal.removeEventListener('abort', onAbort);
        if (r.ok) {
          const json = await r.json();
          if (json.elements) for (const el of json.elements) overpassCache.elements.set(el.id, el);
          overpassCache.queries.push({ south: qSouth, west: qWest, north: qNorth, east: qEast, categories: new Set(cats) });
          persistCache();
          res(json.elements || []);
        } else { rej(new Error(`${r.status}`)); }
      } catch (e) {
        clearTimeout(tid);
        if (signal) signal.removeEventListener('abort', onAbort);
        rej(e);
      }
    }));
    Promise.any(promises)
      .then(els => { for (const c of controllers) c.abort(); resolve(els); })
      .catch(err => { for (const c of controllers) c.abort(); reject(err); });
  });

  const fetchPromise = (async () => {
    const allLines = [...nwLines, ...nwrLines];
    if (allLines.length === 0) return { elements: [] };
    // Single combined query: nw for point categories + nwr for area categories.
    // One request avoids the 4-connection overload that caused nw to time out.
    const q = `[out:json][timeout:30];\n(\n${allLines.join('\n')}\n);\nout center tags;`;
    const els = await raceOverpass(q, uncachedCats, 28000).then(filterToView).catch(() => []);
    return { elements: els };
  })();

  return { elements: getCachedElements(), isFresh: false, fetchPromise };
};
