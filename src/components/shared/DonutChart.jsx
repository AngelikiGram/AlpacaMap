

export const DonutChart=({segments,currency,totalSpent,size=148,sw=20})=>{
  const r=(size-sw)/2-2;
  const C=2*Math.PI*r;
  const cx=size/2,cy=size/2;
  const valid=segments.filter(s=>s.total>0);
  let cum=0;
  return(
    <svg width={size} height={size} style={{display:'block',flexShrink:0}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw}/>
      {valid.map((seg,i)=>{
        const pct=totalSpent>0?seg.total/totalSpent:0;
        const dash=C*pct;
        const rotate=`rotate(${cum*360-90},${cx},${cy})`;
        cum+=pct;
        return(
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={sw}
            strokeDasharray={`${dash} ${C-dash}`} transform={rotate}
            style={{transition:'all 0.5s ease',strokeLinecap:'butt'}}
          />
        );
      })}
      <text x={cx} y={cy-10} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="Inter,sans-serif" letterSpacing="0.05em">{currency} SPENT</text>
      <text x={cx} y={cy+10} textAnchor="middle" fill="white" fontSize="18" fontWeight="700" fontFamily="Outfit,sans-serif">{totalSpent.toLocaleString()}</text>
    </svg>
  );
};
