import { useState } from 'react';
import { Download, ExternalLink, MapPin, Navigation, CheckCircle, Copy } from 'lucide-react';
import { getCityColor } from '../../utils.jsx';

const escapeXml = str => (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export const ExportPanel = ({ tripData }) => {
  const [copied, setCopied] = useState(false);
  const { locations, title } = tripData;
  const totalPlaces = locations.reduce((n, l) => n + l.places.length, 0);
  const totalWithCoords = locations.reduce((n, l) => n + l.places.filter(p => p.coords).length, 0);

  const downloadKML = () => {
    const folders = locations.map(loc => {
      const placemarks = loc.places
        .filter(p => p.coords)
        .map(p => `    <Placemark>
      <name>${escapeXml(p.name)}</name>
      ${p.notes ? `<description>${escapeXml(p.notes)}</description>` : ''}
      <Point><coordinates>${p.coords[1]},${p.coords[0]},0</coordinates></Point>
    </Placemark>`).join('\n');
      if (!placemarks) return '';
      return `  <Folder>
    <name>${escapeXml(loc.name.split(',')[0])}</name>
${placemarks}
  </Folder>`;
    }).filter(Boolean).join('\n');

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${escapeXml(title)}</name>
  <description>Created with AlpacaMap</description>
${folders}
</Document>
</kml>`;

    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_places.kml`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const googleMapsUrl = locations.length > 0
    ? `https://www.google.com/maps/dir/${locations.slice(0, 10).map(l => encodeURIComponent(l.name)).join('/')}`
    : null;

  const copyUrl = () => {
    if (!googleMapsUrl) return;
    navigator.clipboard?.writeText(googleMapsUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ fontSize:'0.9rem' }}>
      <div style={{ fontWeight:'700', fontSize:'1rem', marginBottom:'1.2rem', display:'flex', alignItems:'center', gap:'6px', color:'var(--text-primary)' }}>
        <Download size={15} style={{ color:'var(--accent-primary)' }}/> Export & Share
      </div>

      {/* Google My Maps export */}
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'14px', marginBottom:'1rem' }}>
        <div style={{ fontWeight:'700', fontSize:'0.9rem', marginBottom:'6px', display:'flex', alignItems:'center', gap:'6px' }}>
          <MapPin size={13} style={{ color:'#10b981' }}/> Export to Google My Maps
        </div>
        <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', lineHeight:1.6, marginBottom:'10px' }}>
          Download a KML file with all your saved places, each tagged with an emoji by type and any notes you've added. Import it into Google My Maps to create a custom layer for your trip.
        </p>

        {/* Per-destination preview */}
        <div style={{ marginBottom:'12px', display:'flex', flexDirection:'column', gap:'2px' }}>
          {locations.map(loc => {
            const count = loc.places.filter(p => p.coords).length;
            if (!count) return null;
            const color = getCityColor(loc.id, locations);
            return (
              <div key={loc.id} style={{ display:'flex', alignItems:'center', gap:'7px', padding:'4px 6px', borderRadius:'6px', background:'rgba(255,255,255,0.02)' }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }}/>
                <span style={{ flex:1, color:'var(--text-primary)', fontSize:'0.85rem' }}>{loc.name.split(',')[0]}</span>
                <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>
                  {count} place{count !== 1 ? 's' : ''}
                  {loc.places.filter(p => p.notes).length > 0 && <span style={{ color:'var(--accent-primary)', marginLeft:'4px' }}>· {loc.places.filter(p=>p.notes).length} note{loc.places.filter(p=>p.notes).length>1?'s':''}</span>}
                </span>
              </div>
            );
          })}
          {totalPlaces === 0 && <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', fontStyle:'italic', padding:'4px 0' }}>No saved places yet</div>}
        </div>

        <button
          className="btn-primary"
          style={{ width:'100%', padding:'0.55rem', fontSize:'0.9rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', opacity: totalWithCoords === 0 ? 0.4 : 1 }}
          disabled={totalWithCoords === 0}
          onClick={downloadKML}
        >
          <Download size={14}/> Download KML File ({totalWithCoords} places)
        </button>

        {/* How-to steps */}
        <div style={{ marginTop:'10px', padding:'10px', background:'rgba(255,255,255,0.02)', borderRadius:'8px' }}>
          <div style={{ fontSize:'0.75rem', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' }}>How to import</div>
          {['Click "Download KML File" above', 'Open Google My Maps (link below)', 'Create a new map', 'Click Import → upload the .kml file'].map((step, i) => (
            <div key={i} style={{ display:'flex', gap:'7px', fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:'4px', alignItems:'flex-start' }}>
              <span style={{ width:15, height:15, borderRadius:'50%', background:'rgba(59,130,246,0.18)', color:'var(--accent-primary)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:'700', flexShrink:0, marginTop:'1px' }}>{i+1}</span>
              {step}
            </div>
          ))}
        </div>

        <a href="https://www.google.com/maps/d/" target="_blank" rel="noreferrer"
          style={{ display:'flex', alignItems:'center', gap:'5px', marginTop:'8px', fontSize:'0.8rem', color:'var(--accent-primary)', textDecoration:'none', justifyContent:'center' }}>
          Open Google My Maps <ExternalLink size={11}/>
        </a>
      </div>

      {/* Google Maps route */}
      {locations.length > 0 && (
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'14px' }}>
          <div style={{ fontWeight:'700', fontSize:'0.9rem', marginBottom:'6px', display:'flex', alignItems:'center', gap:'6px' }}>
            <Navigation size={13} style={{ color:'#3b82f6' }}/> Destinations Route
          </div>
          <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', lineHeight:1.6, marginBottom:'10px' }}>
            Open all destinations as a multi-stop route in Google Maps.
            {locations.length > 10 && <span style={{ color:'var(--warning)' }}> First 10 only.</span>}
          </p>
          <div style={{ display:'flex', gap:'6px' }}>
            <a href={googleMapsUrl} target="_blank" rel="noreferrer"
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', padding:'0.5rem', background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.25)', borderRadius:'8px', color:'var(--accent-primary)', textDecoration:'none', fontSize:'0.85rem', fontWeight:'600' }}>
              <ExternalLink size={12}/> Open in Maps
            </a>
            <button onClick={copyUrl}
              style={{ display:'flex', alignItems:'center', gap:'5px', padding:'0.5rem 10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', color: copied ? 'var(--success)' : 'var(--text-secondary)', fontSize:'0.8rem', cursor:'pointer' }}>
              {copied ? <CheckCircle size={12}/> : <Copy size={12}/>}
              {copied ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
        </div>
      )}

      {locations.length === 0 && (
        <div style={{ textAlign:'center', padding:'2rem 1rem', color:'var(--text-secondary)', fontSize:'0.85rem' }}>
          Add destinations and save places to export your trip.
        </div>
      )}
    </div>
  );
};
