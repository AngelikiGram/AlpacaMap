

import { MapPin, Calendar as CalendarIcon, ChevronRight, DollarSign, Package } from 'lucide-react';

export const TripInsights=({tripData,setActiveTab})=>{
  const insights=[];
  const emptyDays=tripData.itinerary.filter(d=>d.events.length===0);
  if(emptyDays.length>0) insights.push({Icon:CalendarIcon,text:`${emptyDays.length} day${emptyDays.length>1?'s':''} with no events yet`,tab:'calendar'});
  const noPlaces=tripData.locations.filter(c=>c.places.length===0);
  if(noPlaces.length>0) insights.push({Icon:MapPin,text:`${noPlaces.map(c=>c.name.split(',')[0]).join(', ')}: no saved places`,tab:'locations'});
  const spent=tripData.budget.expenses.reduce((s,e)=>s+Number(e.amount),0);
  const pct=tripData.budget.total>0?spent/tripData.budget.total:0;
  if(pct>0.8) insights.push({Icon:DollarSign,text:`Budget ${Math.round(pct*100)}% used, review spending`,tab:'budget'});
  const pt=tripData.packing.reduce((s,l)=>s+l.items.length,0);
  const pd=tripData.packing.reduce((s,l)=>s+l.items.filter(i=>i.checked).length,0);
  if(pt>0&&pd<pt) insights.push({Icon:Package,text:`Packing ${Math.round(pd/pt*100)}% complete`,tab:'packing'});
  if(insights.length===0)return<div style={{fontSize:'0.8rem',color:'var(--success)',marginBottom:'0.75rem',fontWeight:'500'}}>All good, trip is on track.</div>;
  return(
    <div className="insights-widget">
      <div className="section-label" style={{marginBottom:'0.4rem'}}>Insights</div>
      {insights.map((ins,i)=>(
        <div key={i} className="insight-item" onClick={()=>setActiveTab(ins.tab)}>
          <ins.Icon size={13} color="var(--accent-primary)" style={{flexShrink:0}}/>
          <span style={{flex:1,fontSize:'0.78rem',color:'var(--text-secondary)'}}>{ins.text}</span>
          <ChevronRight size={11} color="var(--text-secondary)"/>
        </div>
      ))}
    </div>
  );
};
