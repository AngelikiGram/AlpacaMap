import { createPortal } from 'react-dom';


import { Plus, Loader2, X } from 'lucide-react';

export const MapClickBar = ({ info, onAddDestination, onClose }) => {
  if (!info) return null;
  return createPortal(
    <div className="map-click-bar">
      <div className="mcb-left">
        <div className="mcb-coords">{info.lat.toFixed(5)}°,&nbsp;{info.lon.toFixed(5)}°</div>
        <div className="mcb-address">
          {info.address
            ? info.address
            : <span style={{color:'var(--text-secondary)',display:'flex',alignItems:'center',gap:'4px'}}><Loader2 size={11} className="spin"/> Fetching address…</span>
          }
        </div>
      </div>
      <div className="mcb-actions">
        <button className="btn-primary" style={{padding:'0.4rem 0.85rem',fontSize:'0.8rem',whiteSpace:'nowrap'}} onClick={()=>onAddDestination(info)}>
          <Plus size={12}/> Add to trip
        </button>
        <button className="btn-icon" onClick={onClose} style={{padding:'0.35rem'}}><X size={14}/></button>
      </div>
    </div>,
    document.body
  );
};
