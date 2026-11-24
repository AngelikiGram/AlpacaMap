

import { getCityColor } from "../../utils.jsx";
import { EVT_EMOJI } from "../../config.jsx";

export const TimelineStrip=({tripData,setActiveCity,setActiveTab,setCalendarExpandedDay,panelOpen})=>{
  const sorted=[...tripData.itinerary].sort((a,b)=>a.date.localeCompare(b.date));
  if(sorted.length===0)return null;
  const fmtDate=(d)=>{ const pt=new Date(d+'T12:00:00'); return isNaN(pt)?d:pt.toLocaleDateString('en-US',{month:'short',day:'numeric'}); };
  const fmtDay=(d)=>{ const pt=new Date(d+'T12:00:00'); return isNaN(pt)?'---':pt.toLocaleDateString('en-US',{weekday:'short'}); };

  return(
    <div className="timeline-strip" style={{
      left: panelOpen ? 'calc(clamp(380px, 40%, 650px) + 28px)' : '80px',
      right: '24px',
      transition: 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <div className="timeline-label">TRIP TIMELINE</div>
      <div className="timeline-scroll">
        {sorted.map(day=>{
          const city=tripData.locations.find(l=>l.name.toLowerCase().startsWith(day.location.toLowerCase().split(',')[0].toLowerCase()));
          const color=city?getCityColor(city.id,tripData.locations):'#64748b';
          return(
            <div key={day.id} className="timeline-day" role="button" tabIndex={0} style={{'--city-color':color}}
              onClick={()=>{
                setCalendarExpandedDay(day.id);
                setActiveTab('calendar');
              }}
            >
              <div className="tl-date-row">
                <div className="tl-color-dot" style={{background:color,boxShadow:`0 0 6px ${color}80`}}/>
                <div>
                  <div className="tl-weekday">{fmtDay(day.date)}</div>
                  <div className="tl-date">{fmtDate(day.date)}</div>
                </div>
              </div>
              <div className="tl-location">{day.location.split(',')[0].slice(0,11)}</div>
              <div className="tl-events-row">
                {day.events.length===0
                  ?<span className="tl-free">free</span>
                  :day.events.map(evt=><span key={evt.id} className="tl-evt-dot" title={`${evt.time} ${evt.title}`}>{EVT_EMOJI[evt.type]||'•'}</span>)
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
