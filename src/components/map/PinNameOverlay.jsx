import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, X } from 'lucide-react';

export function PinNameOverlay({pendingPin,onConfirm,onCancel}){
  const map=useMap();
  const [name,setName]=useState('');
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const inputRef=useRef();

  const updatePosition = useCallback(() => {
    if (!pendingPin) return;
    try {
      const point = map.latLngToContainerPoint(L.latLng(pendingPin.latlng[0], pendingPin.latlng[1]));
      const rect = map.getContainer().getBoundingClientRect();
      setPos({ left: rect.left + point.x, top: rect.top + point.y });
    } catch (err) {
      console.error("Error updating pin overlay position:", err);
    }
  }, [map, pendingPin]);

  useMapEvents({
    zoom: updatePosition,
    move: updatePosition,
    zoomend: updatePosition,
    moveend: updatePosition,
    resize: updatePosition,
  });

  useEffect(() => {
    if (pendingPin) {
      setName(pendingPin.suggestedName || '');
      setTimeout(() => inputRef.current?.focus(), 80);
      updatePosition();
    }
  }, [pendingPin?.latlng, pendingPin?.suggestedName, updatePosition]);

  if(!pendingPin)return null;

  return createPortal(
    <div className="pin-name-overlay" style={{left:pos.left,top:pos.top}} onClick={e=>e.stopPropagation()}>
      <div className="pin-name-caret"/>
      <div className="pin-name-label">{pendingPin.mode==='city'?'Add destination':'Name this place'}</div>
      {pendingPin.address && (
        <div style={{fontSize:'0.68rem',color:'var(--text-secondary)',marginBottom:'0.45rem',maxWidth:'240px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:'3px'}} title={pendingPin.address}>
          <MapPin size={11}/> {pendingPin.address}
        </div>
      )}
      <div style={{display:'flex',gap:'0.35rem'}}>
        <input ref={inputRef} type="text" value={name} onChange={e=>setName(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();onConfirm(name);}if(e.key==='Escape'){e.preventDefault();onCancel();}}}
          placeholder={pendingPin.mode==='city'?'City or place name…':'Place name…'}
          className="pin-name-input"
        />
        <button className="btn-primary" style={{padding:'0.35rem 0.6rem',fontSize:'0.8rem'}} onClick={()=>onConfirm(name)}>Save</button>
        <button className="btn-icon" style={{padding:'0.35rem'}} onClick={onCancel}><X size={13}/></button>
      </div>
    </div>,
    document.body
  );
}
