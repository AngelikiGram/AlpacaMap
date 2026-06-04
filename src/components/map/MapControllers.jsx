import React, { useEffect, useRef, useLayoutEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

export function MapBoundsTracker({onCenterChange, onBoundsChange}){
  const map = useMapEvents({
    moveend(){ 
      const b = map.getBounds();
      if(onCenterChange) {
        const c = map.getCenter();
        onCenterChange({lat:c.lat,lng:c.lng});
      }
      if(onBoundsChange) onBoundsChange({south:b.getSouth(),west:b.getWest(),north:b.getNorth(),east:b.getEast()});
    },
    zoomend(){ 
      const b = map.getBounds();
      if(onCenterChange) {
        const c = map.getCenter();
        onCenterChange({lat:c.lat,lng:c.lng});
      }
      if(onBoundsChange) onBoundsChange({south:b.getSouth(),west:b.getWest(),north:b.getNorth(),east:b.getEast()});
    },
  });
  useLayoutEffect(() => {
    if(map){
      const b = map.getBounds();
      if(onBoundsChange) onBoundsChange({south:b.getSouth(),west:b.getWest(),north:b.getNorth(),east:b.getEast()});
    }
  }, [map]);
  return null;
}

export function MapZoomTracker({onZoomChange}){
  const map=useMapEvents({zoomend(){onZoomChange(map.getZoom());}});
  return null;
}

export function MapClickHandler({activeCity,setPendingPin,setClickInfo,triggerPlaceInfo}){
  useMapEvents({
    click(e){
      const lat=e.latlng.lat, lon=e.latlng.lng;
      if(activeCity){
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18`,{
          headers:{'Accept-Language':'en'},
          signal: controller.signal
        })
          .then(r=>r.json())
          .then(d=>{
            clearTimeout(timeoutId);
            const a = d.address || {};
            const parts = (d.display_name || '').split(',').map(s => s.trim());
            const firstPart = parts[0];

            let detectedPoiName = null;
            if (firstPart) {
              const isNumber = !isNaN(Number(firstPart.replace(/[-–\s]/g, '')));
              const isRoad = a.road && firstPart.toLowerCase() === a.road.toLowerCase();
              const isPostcode = a.postcode && firstPart.toLowerCase() === a.postcode.toLowerCase();
              const isArea = (a.city && firstPart.toLowerCase() === a.city.toLowerCase()) ||
                             (a.town && firstPart.toLowerCase() === a.town.toLowerCase()) ||
                             (a.village && firstPart.toLowerCase() === a.village.toLowerCase()) ||
                             (a.suburb && firstPart.toLowerCase() === a.suburb.toLowerCase()) ||
                             (a.neighbourhood && firstPart.toLowerCase() === a.neighbourhood.toLowerCase()) ||
                             (a.country && firstPart.toLowerCase() === a.country.toLowerCase());

              // Filter out street-address like names (e.g. "12 High St")
              const hasStreetSuffix = /\b(street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|way|court|ct|square|sq|terrace|ter|place|pl|parkway|pkwy)\b/i.test(firstPart);
              const startsWithNumber = /^\d+/.test(firstPart);
              const isStreetAddress = startsWithNumber && hasStreetSuffix;

              if (!isNumber && !isRoad && !isPostcode && !isArea && !isStreetAddress && firstPart.length > 2) {
                detectedPoiName = firstPart;
              }
            }

            const category = d.category || d.class || '';
            const type = d.type || '';
            const poiCategories = [
              'amenity', 'tourism', 'historic', 'shop', 'leisure', 
              'natural', 'man_made', 'office', 'craft', 'aeroway', 
              'railway', 'waterway'
            ];
            const isPoiCategory = poiCategories.includes(category);
            const isSomething = isPoiCategory || (detectedPoiName && category !== 'highway' && category !== 'boundary' && type !== 'postcode');

            if (isSomething) {
              const fallbackName = category ? `${category.charAt(0).toUpperCase() + category.slice(1)}: ${type.replace(/_/g, ' ')}` : 'Selected Place';
              const name = detectedPoiName || d.name || fallbackName;

              triggerPlaceInfo({
                id: d.place_id || d.osm_id || Date.now(),
                name: name,
                type: category || type || 'custom',
                coords: [lat, lon],
                extract: `A location along ${[a.road, a.city||a.town||a.suburb].filter(Boolean).join(', ')}`,
                osmTags: {
                  address: d.display_name,
                  tourism: category === 'tourism' ? type : null,
                  amenity: category === 'amenity' ? type : null,
                  historic: category === 'historic' ? type : null,
                  shop: category === 'shop' ? type : null,
                  leisure: category === 'leisure' ? type : null,
                  natural: category === 'natural' ? type : null
                }
              });
            } else {
              const addr = [
                a.house_number ? `${a.house_number} ${a.road || ''}`.trim() : a.road,
                a.suburb || a.neighbourhood,
                a.city || a.town || a.village
              ].filter(Boolean).join(', ');

              setPendingPin({
                latlng: [lat, lon],
                mode: 'place',
                suggestedName: '',
                address: addr || d.display_name || 'Selected coordinate'
              });
            }
          }).catch(()=>{
            clearTimeout(timeoutId);
            setPendingPin({latlng:[lat,lon],mode:'place',suggestedName:'',address:''});
          });
      }else{
        // In overview mode: show location info bar
        setClickInfo({lat,lon,address:null});
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,{
          headers:{'Accept-Language':'en'},
          signal: controller.signal
        })
          .then(r=>r.json())
          .then(d=>{
            clearTimeout(timeoutId);
            const a=d.address||{};
            const addr=[a.road,a.suburb||a.neighbourhood,a.city||a.town||a.village,a.country].filter(Boolean).join(', ');
            setClickInfo(prev=>prev?{...prev,address:addr,display_name:d.display_name}:null);
          }).catch(()=>{
            clearTimeout(timeoutId);
          });
      }
    }
  });
  return null;
}

export function MapFlyController({ target }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    if (target && target !== prev.current) {
      prev.current = target;
      map.flyTo([target.lat, target.lon], target.zoom ?? 14, { duration: target.duration ?? 1.3 });
    }
  }, [target, map]);
  return null;
}


export const SmartMapController=({activeCity,locations})=>{
  const map=useMap();
  const cityId = activeCity?.id;
  const locStr = locations.map(l=>l.id).join(',');
  const prevCityId = useRef(null);
  useEffect(()=>{
    if(cityId){
      // Only fly when the city actually changes — not when recommendations or places update
      if(prevCityId.current !== cityId){
        prevCityId.current = cityId;
        map.flyTo(activeCity.coords,activeCity.zoomLevel||14,{duration:1.5});
      }
    }else{
      prevCityId.current = null;
      if(locations.length>0){map.fitBounds(L.latLngBounds(locations.map(l=>l.coords)),{padding:[60,60],duration:1.5});}
    }
  },[cityId,locStr,map]);
  return null;
};
