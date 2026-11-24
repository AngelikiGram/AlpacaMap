import { useState, useRef } from 'react';


import { Search, Loader2, X } from 'lucide-react';


import { searchNominatim } from "../../api.js";

// keyword → OSM tag pairs for direct POI search
const POI_KEYWORDS = {
  library:['amenity=library'], libraries:['amenity=library'],
  restaurant:['amenity=restaurant','amenity=fast_food'], restaurants:['amenity=restaurant','amenity=fast_food'],
  cafe:['amenity=cafe'], cafes:['amenity=cafe'], coffee:['amenity=cafe'],
  pharmacy:['amenity=pharmacy'], pharmacies:['amenity=pharmacy'],
  hospital:['amenity=hospital'], hospitals:['amenity=hospital'],
  clinic:['amenity=clinic'], clinics:['amenity=clinic'],
  museum:['amenity=museum','tourism=museum'], museums:['amenity=museum','tourism=museum'],
  park:['leisure=park','leisure=garden'], parks:['leisure=park','leisure=garden'],
  bank:['amenity=bank'], banks:['amenity=bank'],
  atm:['amenity=atm'], atms:['amenity=atm'],
  supermarket:['shop=supermarket'], supermarkets:['shop=supermarket'],
  hotel:['tourism=hotel'], hotels:['tourism=hotel'],
  church:['amenity=place_of_worship'], churches:['amenity=place_of_worship'],
  mosque:['amenity=place_of_worship'], temple:['amenity=place_of_worship'],
  school:['amenity=school'], schools:['amenity=school'],
  university:['amenity=university'], universities:['amenity=university'],
  gym:['leisure=fitness_centre','leisure=sports_centre'],
  cinema:['amenity=cinema'], cinemas:['amenity=cinema'],
  theatre:['amenity=theatre'], theater:['amenity=theatre'], theatres:['amenity=theatre'],
  bar:['amenity=bar','amenity=pub'], bars:['amenity=bar','amenity=pub'],
  pub:['amenity=pub'], pubs:['amenity=pub'],
  bakery:['shop=bakery'], bakeries:['shop=bakery'],
  parking:['amenity=parking'],
  toilet:['amenity=toilets'], toilets:['amenity=toilets'],
  playground:['leisure=playground'], playgrounds:['leisure=playground'],
  market:['amenity=marketplace','shop=market'], markets:['amenity=marketplace','shop=market'],
  gallery:['tourism=gallery','amenity=arts_centre'], galleries:['tourism=gallery','amenity=arts_centre'],
  pool:['leisure=swimming_pool'], 'swimming pool':['leisure=swimming_pool'],
  monument:['historic=monument','historic=memorial'], monuments:['historic=monument','historic=memorial'],
  castle:['historic=castle'], castles:['historic=castle'],
  viewpoint:['tourism=viewpoint'], viewpoints:['tourism=viewpoint'],
  hostel:['tourism=hostel'], hostels:['tourism=hostel'],
  kindergarten:['amenity=kindergarten'],
  post:['amenity=post_office'], 'post office':['amenity=post_office'],
};

async function searchOverpassPOI(tagPairs, bounds, limit = 40) {
  const { south, west, north, east } = bounds;
  const bbox = `${south},${west},${north},${east}`;
  const clauses = tagPairs.map(pair => {
    const [k, v] = pair.split('=');
    return `node["${k}"="${v}"](${bbox});\nway["${k}"="${v}"](${bbox});`;
  }).join('\n');
  const query = `[out:json][timeout:20];\n(\n${clauses}\n);\nout center ${limit};`;
  const r = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', body: query, signal: AbortSignal.timeout(20000),
  });
  const json = await r.json();
  return (json.elements || [])
    .filter(el => el.tags?.name)
    .map(el => {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      const addr = [el.tags?.['addr:street'] && (el.tags['addr:street'] + (el.tags['addr:housenumber'] ? ' ' + el.tags['addr:housenumber'] : '')), el.tags?.['addr:city']].filter(Boolean).join(', ');
      const tagType = Object.entries(el.tags || {}).find(([k]) => ['amenity','leisure','tourism','shop','historic','natural'].includes(k))?.[1] || 'place';
      return { lat, lon, display_name: el.tags.name, _addr: addr, type: tagType, _osm: true, boundingbox: null };
    })
    .filter(r => r.lat != null && r.lon != null);
}

export const MapSearchBar = ({ onFlyTo, panelOpen, onSearchResults, mapBounds }) => {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const debRef = useRef(null);

  const getViewbox = () => {
    if (!mapBounds) return undefined;
    return {
      minLng: mapBounds.minLng ?? mapBounds._southWest?.lng,
      minLat: mapBounds.minLat ?? mapBounds._southWest?.lat,
      maxLng: mapBounds.maxLng ?? mapBounds._northEast?.lng,
      maxLat: mapBounds.maxLat ?? mapBounds._northEast?.lat,
    };
  };

  const handleInput = (val) => {
    setQuery(val);
    clearTimeout(debRef.current);
    if (val.length < 2) { setResults([]); setShowResults(false); return; }
    debRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchNominatim(val, { viewbox: getViewbox(), bounded: 0 });
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
          onKeyDown={async e => {
            if (e.key === 'Enter' && query.length >= 2) {
              setShowResults(false);
              setLoading(true);
              const key = query.trim().toLowerCase();
              const poiTags = POI_KEYWORDS[key];
              if (poiTags && mapBounds) {
                // OSM POI search within current viewport
                try {
                  const hits = await searchOverpassPOI(poiTags, mapBounds);
                  setLoading(false);
                  onSearchResults?.(hits, query);
                } catch { setLoading(false); }
              } else {
                // Fall back to Nominatim geocoding
                try {
                  const r = await searchNominatim(query, { viewbox: getViewbox(), bounded: 0 });
                  const hits = r.slice(0, 10);
                  setResults(hits);
                  setLoading(false);
                  onSearchResults?.(hits, query);
                } catch { setLoading(false); }
              }
            }
          }}
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
