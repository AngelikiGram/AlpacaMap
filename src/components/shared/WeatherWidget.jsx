import { useState, useEffect } from 'react';


import { Loader2 } from 'lucide-react';


import { wmoIcon } from "../../utils.jsx";

export const WeatherWidget=({coords, startDate, endDate})=>{
  const[forecast,setForecast]=useState(null);
  const[loading,setLoading]=useState(true);
  const[label,setLabel]=useState('5-Day Forecast');
  useEffect(()=>{
    if(!coords)return;
    setLoading(true);setForecast(null);
    const[lat,lon]=coords;
    const today=new Date(); today.setHours(0,0,0,0);
    const maxForecast=new Date(today.getTime()+15*24*60*60*1000);
    const tripStart=startDate?new Date(startDate+'T12:00:00'):null;
    const tripEnd=endDate?new Date(endDate+'T12:00:00'):null;

    const parseDays=d=>d.daily.time.map((date,i)=>({date,code:d.daily.weather_code[i],max:Math.round(d.daily.temperature_2m_max[i]),min:Math.round(d.daily.temperature_2m_min[i])}));

    const tripInForecastWindow=tripStart&&tripEnd&&tripEnd>=today&&tripStart<=maxForecast;
    const tripIsFuture=tripStart&&tripEnd&&tripStart>maxForecast;
    const hasTripDates=tripStart&&tripEnd;

    if(tripInForecastWindow){
      setLabel('Trip Forecast');
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&start_date=${startDate}&end_date=${endDate}&timezone=auto`)
        .then(r=>r.json()).then(d=>{if(d.daily)setForecast(parseDays(d));setLoading(false);}).catch(()=>setLoading(false));
    } else if(tripIsFuture&&hasTripDates){
      // Trip is beyond forecast window, fetch same calendar dates from prior year as climate proxy
      setLabel('Typical Weather (last year)');
      const prevYear=(tripStart.getFullYear()-1).toString();
      const prevStart=startDate.replace(/^\d{4}/,prevYear);
      const prevEnd=endDate.replace(/^\d{4}/,prevYear);
      fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&start_date=${prevStart}&end_date=${prevEnd}&timezone=auto`)
        .then(r=>r.json()).then(d=>{
          if(d.daily){
            // Restamp dates to actual trip dates so day labels are correct
            const days=parseDays(d).map((day,i)=>({...day,date:startDate.replace(/^\d{4}/,tripStart.getFullYear().toString()).replace(/\d{2}$/,String(tripStart.getDate()+i).padStart(2,'0'))}));
            // Use original trip dates for labels
            const tripDates=[];
            for(let dt=new Date(tripStart);dt<=tripEnd;dt.setDate(dt.getDate()+1)){
              tripDates.push(dt.toISOString().slice(0,10));
            }
            setForecast(parseDays(d).map((day,i)=>({...day,date:tripDates[i]||day.date})));
          }
          setLoading(false);
        }).catch(()=>setLoading(false));
    } else {
      setLabel('5-Day Forecast');
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto`)
        .then(r=>r.json()).then(d=>{if(d.daily)setForecast(parseDays(d));setLoading(false);}).catch(()=>setLoading(false));
    }
  },[coords?.[0],coords?.[1],startDate,endDate]);

  const fmtDay=d=>{const dt=new Date(d+'T12:00:00');return dt.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});};
  if(loading)return<div style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.85rem',color:'var(--text-secondary)',padding:'0.5rem 0'}}><Loader2 size={12} className="spin"/>Loading forecast…</div>;
  if(!forecast)return null;
  return(
    <div className="weather-widget">
      <div className="section-label" style={{marginBottom:'0.5rem'}}>{label}</div>
      <div className="weather-days">
        {forecast.map(day=>(
          <div key={day.date} className="weather-day">
            <div style={{fontSize:'0.75rem',color:'var(--text-secondary)',fontWeight:'600',whiteSpace:'nowrap'}}>{fmtDay(day.date)}</div>
            <div style={{fontSize:'1.4rem',lineHeight:1.1}}>{wmoIcon(day.code)}</div>
            <div style={{fontSize:'0.85rem',fontWeight:'700'}}>{day.max}°</div>
            <div style={{fontSize:'0.75rem',color:'var(--text-secondary)'}}>{day.min}°</div>
          </div>
        ))}
      </div>
    </div>
  );
};
