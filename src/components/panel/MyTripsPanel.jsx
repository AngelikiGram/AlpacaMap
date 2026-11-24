

import { Plus, Trash2, X, Upload, FolderOpen, Save } from 'lucide-react';

export const MyTripsPanel = ({ savedTrips, currentTripId, onLoad, onNew, onDelete, onClose, onExport, onImport, onLoadDemo }) => {
  const fmt = (iso) => new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  return (
    <div className="trips-overlay">
      <div className="trips-overlay-header">
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <FolderOpen size={16} color="var(--accent-primary)"/>
          <span style={{ fontWeight:'700', fontSize:'1rem', fontFamily:'Outfit,sans-serif' }}>My Trips</span>
        </div>
        <button className="info-window-close" onClick={onClose}><X size={14}/></button>
      </div>
      <div className="trips-overlay-body">
        <div style={{display:'flex',gap:'0.4rem',marginBottom:'0.5rem'}}>
          <button className="new-trip-btn" style={{flex:1,margin:0}} onClick={onNew}>
            <Plus size={14}/> New
          </button>
          <button className="new-trip-btn" style={{flex:1,margin:0,background:'rgba(16,185,129,0.12)',borderColor:'rgba(16,185,129,0.3)',color:'#10b981'}} onClick={onImport}>
            <Upload size={14}/> Import
          </button>
          <button className="new-trip-btn" style={{flex:1,margin:0,background:'rgba(59,130,246,0.12)',borderColor:'rgba(59,130,246,0.3)',color:'var(--accent-primary)'}} onClick={onExport}>
            <Save size={14}/> Export
          </button>
        </div>
        {onLoadDemo && (
          <button className="new-trip-btn" style={{width:'100%',margin:'0 0 0.5rem',background:'rgba(250,204,21,0.08)',borderColor:'rgba(250,204,21,0.3)',color:'#facc15'}} onClick={onLoadDemo}>
            🦙 Open the London demo trip
          </button>
        )}
        {savedTrips.length === 0 && (
          <p style={{ fontSize:'0.82rem', color:'var(--text-secondary)', margin:'1rem 0', lineHeight:1.5 }}>
            No saved trips yet. Start planning, your trips auto-save every few seconds.
          </p>
        )}
        {savedTrips.map(trip => (
          <div key={trip.id} className={`trip-card ${trip.id === currentTripId ? 'active' : ''}`} onClick={() => onLoad(trip)}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:'600', fontSize:'0.9rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trip.title}</div>
              <div style={{ fontSize:'0.71rem', color:'var(--text-secondary)', marginTop:'2px' }}>
                {trip.data.locations?.length ?? 0} stops · saved {fmt(trip.lastModified)}
              </div>
              <div style={{ display:'flex', gap:'4px', marginTop:'5px', flexWrap:'wrap' }}>
                {(trip.data.locations ?? []).slice(0,4).map(l => (
                  <span key={l.id} style={{ fontSize:'0.62rem', padding:'1px 7px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px' }}>
                    {l.name.split(',')[0]}
                  </span>
                ))}
                {(trip.data.locations?.length ?? 0) > 4 && <span style={{ fontSize:'0.62rem', color:'var(--text-secondary)' }}>+{trip.data.locations.length - 4}</span>}
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', alignItems:'center', flexShrink:0 }}>
              {trip.id === currentTripId && <span className="current-badge">CURRENT</span>}
              <button className="btn-icon" style={{ padding:'0.25rem' }} onClick={e => { e.stopPropagation(); onDelete(trip.id); }}>
                <Trash2 size={12} color="var(--danger)"/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
