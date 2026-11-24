import { useEffect, useRef } from 'react';

import { Marker, Popup } from 'react-leaflet';

import { createSearchResultIcon } from "../../utils.jsx";

export const SearchResultMarker = ({ target }) => {
  const markerRef = useRef(null);
  useEffect(() => {
    if (markerRef.current && target) {
      setTimeout(() => markerRef.current?.openPopup(), 200);
    }
  }, [target?.lat, target?.lon]);
  if (!target) return null;
  return (
    <Marker ref={markerRef} position={[target.lat, target.lon]} icon={createSearchResultIcon()} zIndexOffset={1000}>
      <Popup closeButton={false} className="search-result-popup">
        <div style={{ fontFamily: 'Inter,sans-serif', minWidth: '120px', maxWidth: '200px' }}>
          <div style={{ fontWeight: '700', fontSize: '0.92rem', lineHeight: '1.3' }}>{target.name}</div>
          {target.fullName && target.fullName !== target.name && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: '1.4' }}>{target.fullName}</div>
          )}
          <div style={{ fontSize: '0.68rem', color: 'var(--accent-primary)', marginTop: '5px', opacity: 0.8 }}>
            {target.lat.toFixed(4)}°, {target.lon.toFixed(4)}°
          </div>
        </div>
      </Popup>
    </Marker>
  );
};
