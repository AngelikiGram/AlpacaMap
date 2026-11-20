import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { searchNominatim } from '../../api';

function sentimentColor(placeNodes) {
  const pos = placeNodes.filter(n => n.evaluation?.sentiment === 'positive').length;
  const neg = placeNodes.filter(n => n.evaluation?.sentiment === 'negative').length;
  const ratio = placeNodes.length > 0 ? pos / placeNodes.length : 0.5;
  const warn = placeNodes.some(n => {
    const t = (n.claim || '').toLowerCase();
    return t.includes('scam') || t.includes('avoid') || t.includes('pickpocket') || t.includes('beware') || t.includes('thief');
  });
  if (warn || (neg > 0 && ratio < 0.35)) return '#f59e0b';
  if (ratio > 0.6) return '#10b981';
  return '#8b5cf6';
}

function makeRings(n) {
  const sizes = [5, 7, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 28, 28, 28, 28, 28, 28, 28];
  const rings = [];
  let rem = n;
  for (const s of sizes) {
    if (rem <= 0) break;
    rings.push(Math.min(rem, s));
    rem -= s;
  }
  while (rem > 0) { rings.push(Math.min(rem, 28)); rem -= 28; }
  return rings;
}

// Progressive elliptical layout: inner rings stay near-circular, outer rings
// expand to fill the full canvas aspect ratio. No more min(w,h) bottleneck.
function forceLayout(places, w, h, { iterations = 22, maxNodeR = 22, gap = 40, centerPull = true } = {}) {
  const n = places.length;
  if (n === 0) return {};
  const cx = w / 2, cy = h / 2;
  const canvasAspect = w / h;           // e.g. 4.06 for an ultra-wide popup
  const positions = {};

  const rings = makeRings(n);
  const totalRings = rings.length;
  let pi = 0;
  rings.forEach((rn, ri) => {
    const progress = (ri + 1) / (totalRings + 0.5);
    // sqrt curve: inner rings ≈ circular, outer rings fill canvas aspect ratio
    const ringAspect = 1 + (canvasAspect - 1) * Math.sqrt(progress);
    const hBase = progress * Math.min(w, h) * 0.46;
    const ringRx = hBase * ringAspect;
    const ringRy = hBase;
    for (let i = 0; i < rn && pi < n; i++, pi++) {
      // Stagger successive rings using a golden-angle shift to break straight radial spokes and create an organic constellation spiral
      const ringOffset = ri * 2.39996; 
      const angle = (i / rn) * 2 * Math.PI - Math.PI / 2 + ringOffset;
      const jitter = (pi % 2 === 0 ? 1 : -1) * 0.04;
      const count = places[pi].nodes.length;
      // Widen the size distribution dramatically: base starts at 8px, scaling up to 38px
      const sizeMultiplier = maxNodeR / 22;
      const r = Math.min(maxNodeR * 2.2, Math.log10(count + 1) * 22 * sizeMultiplier + 8);
      positions[places[pi].name.toLowerCase()] = {
        x: cx + ringRx * Math.cos(angle + jitter),
        y: cy + ringRy * Math.sin(angle + jitter),
        r,
      };
    }
  });

  const keys = Object.keys(positions);
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = positions[keys[i]], b = positions[keys[j]];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const minD = a.r + b.r + gap;
        if (dist < minD) {
          const f = (minD - dist) / minD * 0.5;
          a.x -= dx * f * 0.5; a.y -= dy * f * 0.5;
          b.x += dx * f * 0.5; b.y += dy * f * 0.5;
        }
      }
    }
    keys.forEach(k => {
      const p = positions[k];
      if (centerPull) {
        // gentle pull — keep nodes from drifting in the regular view
        p.x = cx + (p.x - cx) * 0.996;
        p.y = cy + (p.y - cy) * 0.996;
      }
      const pad = p.r + 16;
      p.x = Math.max(pad, Math.min(w - pad, p.x));
      p.y = Math.max(pad, Math.min(h - pad, p.y));
    });
  }
  return positions;
}

const STARS = Array.from({ length: 120 }, (_, i) => {
  const r1 = s => { const x = Math.sin(s) * 99999; return x - Math.floor(x); };
  return { fx: r1(i * 3.7 + 1), fy: r1(i * 2.3 + 2), r: r1(i * 1.1 + 3) * 1.2 + 0.2, op: r1(i * 5.9 + 4) * 0.28 + 0.05 };
});

const PAGE_SIZE = 30;

// ── Timeline view ─────────────────────────────────────────────────────────────
function TimelineView({ nodes, w, h }) {
  const [hovYear, setHovYear] = useState(null);

  const yearData = useMemo(() => {
    const m = {};
    nodes.forEach(n => {
      const raw = n.date || n.source?.date || n.extractedAt;
      if (!raw) return;
      const yr = parseInt(raw.slice(0, 4), 10);
      if (!yr || yr < 2010 || yr > 2030) return;
      if (!m[yr]) m[yr] = { year: yr, count: 0, pos: 0, neg: 0, claims: [] };
      m[yr].count++;
      if (n.evaluation?.sentiment === 'positive') m[yr].pos++;
      if (n.evaluation?.sentiment === 'negative') m[yr].neg++;
      if (m[yr].claims.length < 5) m[yr].claims.push(n);
    });
    return Object.values(m).sort((a, b) => a.year - b.year);
  }, [nodes]);

  const nodesWithDates = nodes.filter(n => {
    const raw = n.date || n.source?.date || n.extractedAt;
    if (!raw) return false;
    const yr = parseInt(raw.slice(0, 4), 10);
    return yr >= 2010 && yr <= 2030;
  }).length;

  if (yearData.length === 0) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem' }}>
      No source dates found in extracted claims.<br/>
      <span style={{ fontSize: '0.62rem', opacity: 0.7 }}>Source dates appear on Wikipedia & Reddit content.</span>
    </div>
  );

  const maxCount = Math.max(...yearData.map(d => d.count), 1);
  const padX = 28, padY = 20, barArea = h - padY * 2 - 50;
  const colW = Math.min(72, (w - padX * 2) / yearData.length);
  const totalW = colW * yearData.length;
  const startX = (w - totalW) / 2;

  // Freshness score: % of claims from last 3 years
  const recentYears = new Set([new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]);
  const recentCount = yearData.filter(d => recentYears.has(d.year)).reduce((s, d) => s + d.count, 0);
  const freshnessPct = nodesWithDates > 0 ? Math.round((recentCount / nodesWithDates) * 100) : 0;
  const freshnessColor = freshnessPct > 60 ? '#10b981' : freshnessPct > 30 ? '#f59e0b' : '#ef4444';

  const hovData = hovYear !== null ? yearData.find(d => d.year === hovYear) : null;

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {/* Freshness indicator */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 8px 10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
          Source freshness:
          <strong style={{ color: freshnessColor, marginLeft: '4px' }}>{freshnessPct}% recent</strong>
          <span style={{ color: 'rgba(255,255,255,0.25)', marginLeft: '4px' }}>({recentCount} of {nodesWithDates} dated claims from last 3 years)</span>
        </span>
        <div style={{ flex: 1, minWidth: '60px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${freshnessPct}%`, background: freshnessColor, borderRadius: '2px', transition: 'width 0.6s' }} />
        </div>
      </div>

      {/* SVG timeline */}
      <svg width={w} height={h - 60} style={{ display: 'block', borderRadius: '10px', overflow: 'hidden' }}>
        <defs>
          <radialGradient id="tl-bg" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#12103a" />
            <stop offset="100%" stopColor="#07080f" />
          </radialGradient>
        </defs>
        <rect width={w} height={h - 60} fill="url(#tl-bg)" />

        {/* Baseline */}
        <line x1={padX} y1={padY + barArea + 2} x2={w - padX} y2={padY + barArea + 2} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

        {yearData.map((d, i) => {
          const cx = startX + i * colW + colW / 2;
          const barH = Math.round((d.count / maxCount) * barArea * 0.88) + 4;
          const by = padY + barArea - barH + 2;
          const sentRatio = d.count > 0 ? d.pos / d.count : 0.5;
          const col = sentRatio > 0.55 ? '#10b981' : sentRatio < 0.3 ? '#f59e0b' : '#8b5cf6';
          const isHov = hovYear === d.year;
          const barW = Math.min(colW * 0.72, 42);

          return (
            <g key={d.year} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovYear(d.year)}
              onMouseLeave={() => setHovYear(null)}>
              {/* Hover highlight */}
              {isHov && <rect x={cx - colW / 2} y={padY} width={colW} height={barArea + 4} fill="rgba(255,255,255,0.04)" rx="4" />}
              {/* Bar */}
              <rect x={cx - barW / 2} y={by} width={barW} height={barH} rx="4"
                fill={col} opacity={isHov ? 0.95 : 0.65}
                style={{ transition: 'opacity 0.15s' }} />
              {/* Top gradient gleam */}
              <rect x={cx - barW / 2} y={by} width={barW} height={Math.min(6, barH)} rx="4"
                fill="rgba(255,255,255,0.18)" />
              {/* Count label */}
              {barH > 14 && (
                <text x={cx} y={by + barH / 2 + 4} textAnchor="middle"
                  fill="white" fontSize="9" fontWeight="700" fontFamily="Inter,sans-serif"
                  opacity={isHov ? 1 : 0.85} pointerEvents="none">
                  {d.count}
                </text>
              )}
              {/* Year label */}
              <text x={cx} y={padY + barArea + 18} textAnchor="middle"
                fill={isHov ? col : 'rgba(255,255,255,0.45)'}
                fontSize={isHov ? 10 : 9} fontWeight={isHov ? '700' : '400'}
                fontFamily="Inter,sans-serif" pointerEvents="none">
                {d.year}
              </text>
              {/* Sentiment dots */}
              <circle cx={cx - 5} cy={padY + barArea + 29} r="2.5" fill="#10b981" opacity={d.count > 0 ? d.pos / d.count : 0} />
              <circle cx={cx + 5} cy={padY + barArea + 29} r="2.5" fill="#f97316" opacity={d.count > 0 ? d.neg / d.count : 0} />
            </g>
          );
        })}

        {/* Y-axis label */}
        <text x={padX - 4} y={padY + 8} textAnchor="end" fill="rgba(255,255,255,0.2)"
          fontSize="8" fontFamily="Inter,sans-serif">{maxCount}</text>
        <text x={padX - 4} y={padY + barArea} textAnchor="end" fill="rgba(255,255,255,0.2)"
          fontSize="8" fontFamily="Inter,sans-serif">0</text>

        {/* Hover tooltip */}
        {hovData && (() => {
          const i = yearData.findIndex(d => d.year === hovData.year);
          const cx = startX + i * colW + colW / 2;
          const tipW = 190, tipH = Math.min(160, 70 + hovData.claims.length * 22);
          let tx = cx + 14; if (tx + tipW > w - 8) tx = cx - tipW - 14;
          const ty = Math.max(8, padY - 10);
          const sentRatio = hovData.count > 0 ? hovData.pos / hovData.count : 0.5;
          const col = sentRatio > 0.55 ? '#10b981' : sentRatio < 0.3 ? '#f59e0b' : '#8b5cf6';
          return (
            <foreignObject x={tx} y={ty} width={tipW} height={tipH} style={{ overflow: 'visible', pointerEvents: 'none' }}>
              <div xmlns="http://www.w3.org/1999/xhtml" style={{
                background: 'rgba(5,7,18,0.97)', border: `1px solid ${col}35`,
                borderRadius: '10px', padding: '9px 11px', width: tipW + 'px',
                boxShadow: '0 6px 28px rgba(0,0,0,0.8)', fontFamily: 'Inter,sans-serif',
              }}>
                <div style={{ fontWeight: '700', color: col, fontSize: '0.72rem', marginBottom: '4px' }}>
                  {hovData.year} · {hovData.count} claims
                </div>
                <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', marginBottom: '6px' }}>
                  {hovData.pos}✓ positive · {hovData.neg}⚠ negative
                </div>
                {hovData.claims.slice(0, 3).map((n, ci) => (
                  <div key={ci} style={{ fontSize: '0.6rem', lineHeight: 1.4, marginBottom: '3px',
                    color: n.evaluation?.sentiment === 'positive' ? '#34d399' : n.evaluation?.sentiment === 'negative' ? '#f87171' : '#94a3b8' }}>
                    {n.evaluation?.sentiment === 'positive' ? '✓' : n.evaluation?.sentiment === 'negative' ? '⚠' : '·'} {(n.claim || '').slice(0, 72)}
                  </div>
                ))}
              </div>
            </foreignObject>
          );
        })()}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', padding: '4px 0 2px', flexWrap: 'wrap' }}>
        {[['#10b981', 'Mostly positive'], ['#f59e0b', 'Cautionary'], ['#8b5cf6', 'Mixed']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: c, opacity: 0.8 }} />
            <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{l}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="16" height="8"><circle cx="4" cy="4" r="3" fill="#10b981" opacity="0.7" /><circle cx="12" cy="4" r="3" fill="#f97316" opacity="0.7" /></svg>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>+/– dots</span>
        </div>
      </div>
    </div>
  );
}

// ── SVG body shared between normal + expanded views ──────────────────────────
function ConstellationSVG({ places, layout, placeColors, seqLinks, stars, city, w, h, onNodeClick, searchQuery, bottomHint }) {
  const [hov, setHov] = useState(null);
  const sq = (searchQuery || '').toLowerCase().trim();
  const isSearchActive = sq.length > 0;

  const hovPlace = hov ? places.find(p => p.name.toLowerCase() === hov) : null;
  const hovPos   = hov ? layout[hov] : null;

  return (
    <svg width={w} height={h} style={{ display: 'block', borderRadius: '12px', overflow: 'hidden' }}>
      <defs>
        <radialGradient id="cst-bg3" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#16103a"/>
          <stop offset="100%" stopColor="#07080f"/>
        </radialGradient>
        {places.map(p => {
          const col = placeColors[p.name.toLowerCase()] || '#8b5cf6';
          const id = 'cst-g3-' + p.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18);
          return (
            <radialGradient key={id} id={id} cx="36%" cy="30%" r="68%">
              <stop offset="0%" stopColor="white" stopOpacity="0.2"/>
              <stop offset="100%" stopColor={col} stopOpacity="0.92"/>
            </radialGradient>
          );
        })}
      </defs>

      <rect width={w} height={h} fill="url(#cst-bg3)"/>
      {stars.map((s, i) => <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.op}/>)}

      <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="middle"
        fill="rgba(255,255,255,0.025)" fontSize={Math.min(w / 3, 90)} fontWeight="900"
        fontFamily="Inter,sans-serif" pointerEvents="none">
        {(city || '').toUpperCase().split(',')[0].slice(0, 10)}
      </text>

      {seqLinks.map((lk, i) => {
        const f = layout[lk.from], t = layout[lk.to];
        if (!f || !t) return null;
        const mx = (f.x + t.x) / 2, my = (f.y + t.y) / 2 - 50;
        return <path key={i} d={`M ${f.x} ${f.y} Q ${mx} ${my} ${t.x} ${t.y}`}
          fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.4"/>;
      })}

      {places.map(p => {
        const pos = layout[p.name.toLowerCase()];
        if (!pos) return null;
        const col = placeColors[p.name.toLowerCase()] || '#8b5cf6';
        const gradId = 'cst-g3-' + p.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18);
        const isHov = hov === p.name.toLowerCase();
        const isMatch = !isSearchActive || p.name.toLowerCase().includes(sq);
        const r = isHov ? pos.r * 1.25 : pos.r;
        const isCat = p.isCategory;
        
        // Calculate positive ratio & warning presence to encode in other channels
        const totalClaims = p.nodes.length;
        const posClaims = p.nodes.filter(n => n.evaluation?.sentiment === 'positive').length;
        const negClaims = p.nodes.filter(n => n.evaluation?.sentiment === 'negative').length;
        const posRatio = totalClaims > 0 ? posClaims / totalClaims : 0.5;
        
        const hasWarning = p.nodes.some(n => {
          const t = (n.claim || '').toLowerCase();
          return t.includes('scam') || t.includes('avoid') || t.includes('pickpocket') || t.includes('beware') || t.includes('thief');
        });

        // Encode sentiment ratio in color opacity / glow intensity
        const baseOpacity = isCat ? 0.55 : (0.75 + Math.abs(posRatio - 0.5) * 0.4);
        const opacity = isSearchActive
          ? (isMatch ? 1 : 0.08)
          : (isHov ? 1 : baseOpacity);
          
        const rawLabel = isCat ? p.name.split(' · ')[1] || p.name : p.name;
        const label = rawLabel.length > 16 ? rawLabel.slice(0, 14) + '…' : rawLabel;

        // Custom stroke for Warning nodes to encode details in outlines
        let strokeColor = isMatch && isSearchActive ? 'white' : col;
        let strokeWidth = isMatch && isSearchActive ? 2.5 : (isHov ? 2.4 : (hasWarning ? 2.0 : 1.4));
        let strokeDash = isCat ? '4 2.5' : (hasWarning ? '2 2' : 'none');

        return (
          <g key={p.name} style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHov(p.name.toLowerCase())}
            onMouseLeave={() => setHov(null)}
            onClick={() => onNodeClick && onNodeClick(p)}>
            {/* Outer glow ring - larger for positive or warning highlights */}
            <circle cx={pos.x} cy={pos.y} r={r + 8 + (hasWarning ? 3 : 0)} fill="none" 
              stroke={hasWarning ? '#ef4444' : col} 
              strokeWidth={hasWarning ? 1.5 : 1.1}
              opacity={isHov ? 0.6 : (hasWarning ? 0.35 : 0.12)}
              style={isHov || hasWarning ? { transformOrigin: `${pos.x}px ${pos.y}px`, animation: 'cst-orbit 2s ease-out infinite' } : {}}/>
            {/* Halo */}
            <circle cx={pos.x} cy={pos.y} r={r + 4} fill={col} opacity={isHov ? 0.22 : 0.07}/>
            {/* Main sphere */}
            <circle cx={pos.x} cy={pos.y} r={r} fill={`url(#${gradId})`}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              opacity={opacity}/>
            {/* Specular highlight */}
            <circle cx={pos.x - r * 0.3} cy={pos.y - r * 0.3} r={r * 0.2} fill="white" opacity="0.22" pointerEvents="none"/>
            {/* Count */}
            <text x={pos.x} y={pos.y + (r > 10 ? 3.5 : 2.5)} textAnchor="middle" fill="white"
              fontSize={r > 14 ? 10.5 : (r > 9 ? 8.5 : 7.5)} fontWeight="900" fontFamily="Inter,sans-serif"
              opacity={opacity * 0.95} pointerEvents="none">
              {totalClaims}
            </text>
            {/* Label */}
            <text x={pos.x} y={pos.y + r + 13} textAnchor="middle"
              fill={isHov || (isMatch && isSearchActive) ? (hasWarning ? '#fb923c' : col) : 'rgba(255,255,255,0.55)'}
              fontSize={isHov || (isMatch && isSearchActive) ? 9.5 : 8.5}
              fontWeight={isHov || (isMatch && isSearchActive) ? '700' : '400'}
              fontFamily="Inter,sans-serif" opacity={opacity} pointerEvents="none">
              {label}
            </text>
          </g>
        );
      })}

      {bottomHint && (
        <text x={w / 2} y={h - 10} textAnchor="middle" fill="rgba(255,255,255,0.16)"
          fontSize="9" fontFamily="Inter,sans-serif">{bottomHint}</text>
      )}

      {/* Hover tooltip */}
      {hovPlace && hovPos && (() => {
        const col = placeColors[hovPlace.name.toLowerCase()] || '#8b5cf6';
        const claims = [...hovPlace.nodes].sort((a, b) => (b.credibility || 0) - (a.credibility || 0)).slice(0, 5);
        const tipW = 220;
        let tx = hovPos.x + hovPos.r + 12;
        let ty = hovPos.y - 30;
        if (tx + tipW > w - 8) tx = hovPos.x - tipW - 12;
        ty = Math.max(8, Math.min(h - 240, ty));
        return (
          <foreignObject x={tx} y={ty} width={tipW} height={240} style={{ overflow: 'visible', pointerEvents: 'none' }}>
            <div xmlns="http://www.w3.org/1999/xhtml" style={{
              background: 'rgba(6,8,20,0.97)', border: `1px solid ${col}35`,
              borderRadius: '11px', padding: '10px 12px', width: tipW + 'px',
              boxShadow: `0 6px 28px rgba(0,0,0,0.85)`, fontFamily: 'Inter,sans-serif',
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: col, marginBottom: '6px' }}>
                {hovPlace.name}
                <span style={{ fontSize: '0.58rem', fontWeight: '400', color: 'rgba(255,255,255,0.3)', marginLeft: '6px' }}>
                  {hovPlace.nodes.length} claims
                </span>
              </div>
              {claims.map((n, i) => (
                <div key={i} style={{ fontSize: '0.6rem', lineHeight: 1.4, marginBottom: '4px',
                  color: n.evaluation?.sentiment === 'positive' ? '#34d399' : n.evaluation?.sentiment === 'negative' ? '#f87171' : '#94a3b8' }}>
                  {n.evaluation?.sentiment === 'positive' ? '✓' : n.evaluation?.sentiment === 'negative' ? '⚠' : '·'} {(n.claim || '').slice(0, 90)}
                </div>
              ))}
              <div style={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.2)', marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px' }}>
                Click → details
              </div>
            </div>
          </foreignObject>
        );
      })()}
    </svg>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function KnowledgeConstellationView({ nodes, triggerPlaceInfo, tripData, city, cityNamesSet }) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 420, h: 460 });
  const [viewMode, setViewMode] = useState('constellation');
  const [listFilter, setListFilter] = useState('');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [expandedDims, setExpandedDims] = useState({ w: 1200, h: 800 });
  const [expandedSearch, setExpandedSearch] = useState('');
  const [expandedSelected, setExpandedSelected] = useState(null);
  const [expZoom, setExpZoom] = useState(1);
  const [expPan, setExpPan] = useState({ x: 0, y: 0 });
  const expPanRef = useRef(null); // {startX, startY, panX, panY} during drag
  const expSvgRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(es => {
      const { width } = es[0].contentRect;
      if (width > 0) setDims({ w: width, h: Math.min(520, Math.max(360, width * 0.9)) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { setPage(0); }, [nodes]);

  useEffect(() => {
    if (!expanded) { setExpZoom(1); setExpPan({ x: 0, y: 0 }); return; }
    const h = (e) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [expanded]);

  const handleExpWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setExpZoom(z => Math.max(0.25, Math.min(6, z * factor)));
  }, []);

  const handleExpMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    expPanRef.current = { startX: e.clientX, startY: e.clientY, panX: expPan.x, panY: expPan.y };
  }, [expPan]);

  const handleExpMouseMove = useCallback((e) => {
    if (!expPanRef.current) return;
    const dx = (e.clientX - expPanRef.current.startX) / expZoom;
    const dy = (e.clientY - expPanRef.current.startY) / expZoom;
    setExpPan({ x: expPanRef.current.panX + dx, y: expPanRef.current.panY + dy });
  }, [expZoom]);

  const handleExpMouseUp = useCallback(() => { expPanRef.current = null; }, []);

  const cityBase = (city || '').split(',')[0].trim().toLowerCase();

  const allPlaces = useMemo(() => {
    const m = {};
    nodes.forEach(n => {
      const pName = (n.place || '').trim();
      if (!pName) return;
      const pLower = pName.toLowerCase();
      if (cityBase && pLower === cityBase) return;
      if (cityNamesSet?.has(pLower)) return;
      if (pLower === 'general info' || pLower === 'general' || pLower === 'unknown') return;
      if (!m[pLower]) m[pLower] = { name: pName, nodes: [], isCategory: pName.includes(' · ') };
      m[pLower].nodes.push(n);
    });
    return Object.values(m).sort((a, b) => {
      if (a.isCategory !== b.isCategory) return a.isCategory ? 1 : -1;
      return b.nodes.length - a.nodes.length;
    });
  }, [nodes, cityBase, cityNamesSet]);

  const placeColors = useMemo(() => {
    const m = {};
    allPlaces.forEach(p => { m[p.name.toLowerCase()] = sentimentColor(p.nodes); });
    return m;
  }, [allPlaces]);

  const locationLookup = useMemo(() => {
    const map = new Map();
    (tripData?.locations || [])
      .flatMap(l => [...(l.places || []), ...(l.recommendations || [])])
      .forEach(x => map.set(x.name.toLowerCase(), x));
    return map;
  }, [tripData]);

  const handleClick = useCallback(async (p) => {
    if (!triggerPlaceInfo) return;
    const pLower = p.name.toLowerCase();
    let found = locationLookup.get(pLower);
    if (!found) {
      const pWords = pLower.split(/\s+/).filter(w => w.length > 2);
      if (pWords.length >= 2) {
        for (const [key, val] of locationLookup) {
          const xWords = key.split(/\s+/).filter(w => w.length > 2);
          if (!xWords.length) continue;
          const xSet = new Set(xWords);
          const common = pWords.filter(w => xSet.has(w));
          if (common.length >= 2 && common.length >= Math.ceil(Math.min(xWords.length, pWords.length) * 0.65)) {
            found = val; break;
          }
        }
      }
    }
    if (!found) {
      // Geocode via Nominatim — place not in saved trip data
      try {
        const cityBase = (city || '').split(',')[0].trim();
        const q = cityBase ? `${p.name}, ${cityBase}` : p.name;
        const results = await searchNominatim(q);
        if (results?.length > 0) {
          found = { name: p.name, type: 'attraction', coords: [parseFloat(results[0].lat), parseFloat(results[0].lon)] };
        }
      } catch {}
    }
    const fallback = tripData?.locations?.[0]?.coords || [51.5, -0.1];
    triggerPlaceInfo(found || { name: p.name, type: 'attraction', coords: fallback });
  }, [triggerPlaceInfo, locationLookup, tripData, city]);

  const seqLinks = useMemo(() => {
    const seen = new Set(), links = [];
    nodes.filter(n => n.claimType === 'sequence' && n.nextPlace && n.place).forEach(n => {
      const k = `${n.place.toLowerCase()}→${n.nextPlace.toLowerCase()}`;
      if (!seen.has(k)) { seen.add(k); links.push({ from: n.place.toLowerCase(), to: n.nextPlace.toLowerCase() }); }
    });
    return links;
  }, [nodes]);

  const searchLower = search.toLowerCase().trim();
  // When searching: show all matching places (ignores pagination)
  // When not: show the current page
  const displayPlaces = useMemo(() => {
    if (searchLower) return allPlaces.filter(p => p.name.toLowerCase().includes(searchLower));
    return allPlaces.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [searchLower, allPlaces, page]);

  const totalPages = useMemo(() => Math.ceil(allPlaces.length / PAGE_SIZE), [allPlaces]);

  const layout = useMemo(
    () => forceLayout(displayPlaces, dims.w, dims.h, { iterations: 22, maxNodeR: 28, gap: 40, centerPull: true }),
    [displayPlaces, dims]
  );
  const stars = useMemo(() => STARS.map(s => ({ cx: s.fx * dims.w, cy: s.fy * dims.h, r: s.r, op: s.op })), [dims]);

  const [expMinClaims, setExpMinClaims] = useState(1);

  // Expanded view — filter by minimum claims, cap at top 200, increase spacing
  const expandedPlaces = useMemo(() => {
    if (!expanded) return [];
    const filtered = allPlaces.filter(p => p.nodes.length >= expMinClaims);
    // Sort by node count desc, cap at 200 for legibility
    return filtered.slice(0, 200);
  }, [expanded, allPlaces, expMinClaims]);

  const expandedLayout = useMemo(() => {
    if (!expanded) return {};
    const n = expandedPlaces.length;
    const maxR = n > 120 ? 16 : n > 60 ? 20 : 26;
    const gap  = n > 120 ? 48 : n > 60 ? 60 : 72;
    const iters = n > 150 ? 0 : n > 80 ? 8 : 16;
    return forceLayout(expandedPlaces, expandedDims.w - 40, expandedDims.h - 80, { iterations: iters, maxNodeR: maxR, gap, centerPull: false });
  }, [expanded, expandedPlaces, expandedDims]);

  const expandedStars = useMemo(
    () => STARS.map(s => ({ cx: s.fx * expandedDims.w, cy: s.fy * expandedDims.h, r: s.r * 1.5, op: s.op })),
    [expandedDims]
  );

  const filteredList = useMemo(() => {
    if (!listFilter.trim()) return allPlaces;
    const q = listFilter.toLowerCase();
    return allPlaces.filter(p => p.name.toLowerCase().includes(q));
  }, [allPlaces, listFilter]);

  const { w, h } = dims;

  if (allPlaces.length === 0) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
      No specific places extracted yet.<br/>
      <span style={{ fontSize: '0.68rem', opacity: 0.6 }}>Fetch knowledge to see the constellation.</span>
    </div>
  );

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative', userSelect: 'none' }}>
      <style>{`
        @keyframes cst-orbit { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:.1;transform:scale(1.6)} }
        .cst-tab{background:none;border:none;cursor:pointer;padding:5px 13px;border-radius:20px;font-size:0.67rem;font-family:Inter,sans-serif;transition:background .15s}
        .cst-tab.active{background:rgba(139,92,246,.22);color:#c4b5fd}
        .cst-tab:not(.active){color:rgba(255,255,255,.32)}
        .cst-tab:not(.active):hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.6)}
        .cst-row{display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:7px;cursor:pointer;transition:background .1s}
        .cst-row:hover{background:rgba(255,255,255,.06)}
        .cst-input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:4px 9px;font-size:0.68rem;color:rgba(255,255,255,.7);outline:none;width:140px;font-family:Inter,sans-serif}
        .cst-input::placeholder{color:rgba(255,255,255,.22)}
        .cst-input:focus{border-color:rgba(139,92,246,.45)}
        .cst-pag-btn{background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.22);border-radius:6px;color:#a78bfa;font-size:0.7rem;padding:3px 10px;cursor:pointer;transition:background .15s}
        .cst-pag-btn:disabled{background:rgba(255,255,255,.03);color:rgba(255,255,255,.18);border-color:rgba(255,255,255,.06);cursor:default}
        .cst-pag-btn:not(:disabled):hover{background:rgba(139,92,246,.24)}
        .cst-expand-btn{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);border-radius:6px;color:rgba(255,255,255,.5);cursor:pointer;padding:3px 8px;font-size:0.67rem;transition:background .15s;font-family:Inter,sans-serif}
        .cst-expand-btn:hover{background:rgba(139,92,246,.2);color:#c4b5fd}
      `}</style>

      {/* Tab + search bar */}
      <div style={{ display: 'flex', gap: '4px', padding: '4px 4px 6px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className={`cst-tab${viewMode === 'constellation' ? ' active' : ''}`} onClick={() => setViewMode('constellation')}>⬤ Constellation</button>
        <button className={`cst-tab${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')}>
          ≡ All Places {allPlaces.length > 0 && <span style={{ opacity: 0.55, fontSize: '0.6rem' }}>({allPlaces.length})</span>}
        </button>
        <button className={`cst-tab${viewMode === 'timeline' ? ' active' : ''}`} onClick={() => setViewMode('timeline')}>⏱ Source Age</button>
        {viewMode === 'constellation' && (
          <>
            <div style={{ flex: 1 }}/>
            <input className="cst-input" placeholder="Search places…" value={search} onChange={e => setSearch(e.target.value)}/>
            <button className="cst-expand-btn" onClick={() => {
              setExpandedDims({ w: window.innerWidth - 20, h: window.innerHeight - 56 });
              setExpanded(true);
            }}>⛶ Expand</button>
          </>
        )}
      </div>

      {viewMode === 'constellation' && (
        <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', padding: '0 4px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>✦</span>
          <span>Most mentioned places are placed closer to the center, radiating outward to less mentioned ones.</span>
        </div>
      )}

      {viewMode === 'timeline' ? (
        <TimelineView nodes={nodes} w={w} h={h} />
      ) : viewMode === 'constellation' ? (
        <>
          <ConstellationSVG
            places={displayPlaces}
            layout={layout}
            placeColors={placeColors}
            seqLinks={seqLinks}
            stars={stars}
            city={city}
            w={w} h={h}
            onNodeClick={handleClick}
            searchQuery={search}
            bottomHint={
              searchLower
                ? `${displayPlaces.length} match${displayPlaces.length !== 1 ? 'es' : ''} for "${search}"`
                : totalPages > 1
                  ? `Page ${page + 1} / ${totalPages} · hover for claims · click to navigate`
                  : 'Hover for claims · Click to navigate on map'
            }
          />

          {/* Legend */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '7px 4px 2px', justifyContent: 'center' }}>
            {[['#10b981','Mostly positive'], ['#f59e0b','Warning / caution'], ['#8b5cf6','Neutral / mixed'], ['#8b5cf6','- - -  Category']].map(([c, l], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                {l.startsWith('- - -')
                  ? <svg width="16" height="12"><circle cx="8" cy="6" r="5" fill="none" stroke={c} strokeWidth="1.5" strokeDasharray="3 2"/></svg>
                  : <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill={c} opacity="0.85"/></svg>}
                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{l.replace('- - -  ', '')}</span>
              </div>
            ))}
          </div>

          {/* Pagination — only shown when not searching */}
          {!searchLower && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '5px 0 2px' }}>
              <button className="cst-pag-btn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
              <span style={{ fontSize: '0.63rem', color: 'var(--text-secondary)' }}>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, allPlaces.length)} of {allPlaces.length}
              </span>
              <button className="cst-pag-btn" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next →</button>
            </div>
          )}
          {!searchLower && totalPages <= 1 && (
            <div style={{ textAlign: 'center', fontSize: '0.6rem', color: 'rgba(255,255,255,0.16)', padding: '3px 0' }}>
              {allPlaces.length} unique places
            </div>
          )}
        </>
      ) : viewMode === 'list' ? (
        /* ── All Places list ── */
        <div style={{ background: 'rgba(6,8,20,0.85)', borderRadius: '14px', padding: '10px 8px', border: '1px solid rgba(255,255,255,0.07)' }}>
          <input className="cst-input" style={{ width: '100%', boxSizing: 'border-box', marginBottom: '6px' }}
            placeholder={`Search ${allPlaces.length} places…`} value={listFilter} onChange={e => setListFilter(e.target.value)}/>
          <div style={{ maxHeight: `${h - 60}px`, overflowY: 'auto', paddingRight: '2px' }}>
            {filteredList.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'rgba(255,255,255,0.28)', fontSize: '0.7rem' }}>No matches for "{listFilter}"</div>
            )}
            {filteredList.map((p, idx) => {
              const col = placeColors[p.name.toLowerCase()] || '#8b5cf6';
              const isCat = p.isCategory;
              const label = isCat ? (p.name.split(' · ')[1] || p.name) : p.name;
              const sentiment = p.nodes.filter(n => n.evaluation?.sentiment === 'positive').length > p.nodes.length * 0.6 ? '✓'
                : p.nodes.some(n => { const t = (n.claim || '').toLowerCase(); return t.includes('scam') || t.includes('avoid'); }) ? '⚠' : '·';
              return (
                <div key={p.name} className="cst-row" onClick={() => handleClick(p)}>
                  <span style={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.16)', minWidth: '18px', textAlign: 'right' }}>{idx + 1}</span>
                  <svg width="10" height="10" style={{ flexShrink: 0 }}>
                    {isCat
                      ? <circle cx="5" cy="5" r="4" fill="none" stroke={col} strokeWidth="1.2" strokeDasharray="2 1.5"/>
                      : <circle cx="5" cy="5" r="4" fill={col} opacity="0.9"/>}
                  </svg>
                  <span style={{ flex: 1, fontSize: '0.68rem', color: 'rgba(255,255,255,0.76)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                  <span style={{ fontSize: '0.63rem', color: col, flexShrink: 0 }}>{sentiment}</span>
                  <span style={{ fontSize: '0.6rem', background: `${col}22`, color: col, border: `1px solid ${col}40`, borderRadius: '10px', padding: '1px 5px', flexShrink: 0, minWidth: '22px', textAlign: 'center' }}>{p.nodes.length}</span>
                </div>
              );
            })}
          </div>
          {filteredList.length > 0 && (
            <div style={{ textAlign: 'center', fontSize: '0.56rem', color: 'rgba(255,255,255,0.18)', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '4px' }}>
              {listFilter ? `${filteredList.length} of ${allPlaces.length}` : `${allPlaces.length} places`} · click to navigate on map
            </div>
          )}
        </div>
      ) : null}

      {/* ── Fullscreen modal ── */}
      {expanded && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(2,3,12,0.98)', display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
          <style>{`
            @keyframes cst-orbit { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:.1;transform:scale(1.6)} }
            .exp-input{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);border-radius:8px;padding:4px 10px;font-size:0.7rem;color:rgba(255,255,255,.75);outline:none;width:200px;font-family:Inter,sans-serif}
            .exp-input::placeholder{color:rgba(255,255,255,.25)}
            .exp-input:focus{border-color:rgba(139,92,246,.5)}
            .exp-slider{-webkit-appearance:none;appearance:none;height:4px;background:rgba(139,92,246,.25);border-radius:4px;outline:none;cursor:pointer;accent-color:#8b5cf6;}
            .exp-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#8b5cf6;cursor:pointer;}
          `}</style>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '7px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter,sans-serif' }}>
              ⬤ <strong style={{ color: '#c4b5fd' }}>{expandedPlaces.length}</strong>
              <span style={{ color: 'rgba(255,255,255,0.25)', marginLeft: '3px' }}>of {allPlaces.length} places shown</span>
              <span style={{ color: 'rgba(255,255,255,0.18)', marginLeft: '6px' }}>— {(city || '').split(',')[0]}</span>
            </span>
            <input className="exp-input" placeholder="Search nodes…" value={expandedSearch} onChange={e => setExpandedSearch(e.target.value)}/>
            {expandedSearch && (
              <span style={{ fontSize: '0.65rem', color: '#a78bfa', fontFamily: 'Inter,sans-serif' }}>
                {expandedPlaces.filter(p => p.name.toLowerCase().includes(expandedSearch.toLowerCase())).length} match
              </span>
            )}
            <div style={{ flex: 1 }}/>
            <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'Inter,sans-serif' }}>Esc · scroll to zoom · drag to pan</span>
            <button onClick={() => setExpanded(false)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '6px', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '4px 12px', fontSize: '0.7rem', fontFamily: 'Inter,sans-serif' }}>
              ✕ Close
            </button>
          </div>

          {/* SVG fills remaining space — wheel to zoom, drag to pan */}
          <div
            ref={expSvgRef}
            style={{ flex: 1, overflow: 'hidden', padding: '6px 10px 6px', cursor: expPanRef.current ? 'grabbing' : 'grab', position: 'relative' }}
            onWheel={handleExpWheel}
            onMouseDown={handleExpMouseDown}
            onMouseMove={handleExpMouseMove}
            onMouseUp={handleExpMouseUp}
            onMouseLeave={handleExpMouseUp}
          >
            {/* Zoom indicator */}
            {expZoom !== 1 && (
              <div style={{ position: 'absolute', top: 10, right: 14, zIndex: 5, fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '2px 7px', fontFamily: 'Inter,sans-serif', pointerEvents: 'none' }}>
                {Math.round(expZoom * 100)}%
              </div>
            )}
            <div style={{ transform: `scale(${expZoom}) translate(${expPan.x}px, ${expPan.y}px)`, transformOrigin: 'center center', width: '100%', height: '100%' }}>
              <ConstellationSVG
                places={expandedPlaces}
                layout={expandedLayout}
                placeColors={placeColors}
                seqLinks={seqLinks}
                stars={expandedStars}
                city={city}
                w={expandedDims.w - 20}
                h={expandedDims.h - 12}
                onNodeClick={p => setExpandedSelected(p)}
                searchQuery={expandedSearch}
                bottomHint={`${expandedPlaces.length} places shown · scroll to zoom · drag to pan · click for details`}
              />
            </div>
          </div>

          {/* Bottom filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.4)', flexShrink: 0, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap' }}>Min mentions:</span>
              <input type="range" className="exp-slider" min={1} max={Math.max(1, Math.ceil(allPlaces[Math.floor(allPlaces.length * 0.25)]?.nodes.length || 1))} value={expMinClaims}
                onChange={e => { setExpMinClaims(Number(e.target.value)); setExpZoom(1); setExpPan({ x: 0, y: 0 }); }}
                style={{ width: '120px' }}/>
              <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#a78bfa', fontFamily: 'Inter,sans-serif', minWidth: '20px' }}>{expMinClaims}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {[['#10b981','Positive'],['#f59e0b','Caution'],['#8b5cf6','Mixed']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.85 }}/>
                  <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter,sans-serif' }}>{l}</span>
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }}/>
            <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.18)', fontFamily: 'Inter,sans-serif' }}>
              Node size = mention count · Showing top {expandedPlaces.length} most-mentioned places
            </span>
          </div>

          {/* Bottom-left info panel — shown when a node is clicked */}
          {expandedSelected && (() => {
            const col = placeColors[expandedSelected.name.toLowerCase()] || '#8b5cf6';
            const claims = [...expandedSelected.nodes]
              .sort((a, b) => (b.credibility || 0) - (a.credibility || 0))
              .slice(0, 7);
            return (
              <div style={{
                position: 'absolute', bottom: '20px', left: '20px', width: '310px',
                background: 'rgba(5,7,18,0.97)', border: `1px solid ${col}40`,
                borderRadius: '14px', padding: '14px 16px', zIndex: 10,
                boxShadow: `0 8px 32px rgba(0,0,0,0.85), 0 0 0 1px ${col}18`,
                fontFamily: 'Inter,sans-serif',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: '700', color: col }}>
                      {expandedSelected.name}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                      {expandedSelected.nodes.length} claim{expandedSelected.nodes.length !== 1 ? 's' : ''}
                      {expandedSelected.isCategory ? ' · general category' : ''}
                    </div>
                  </div>
                  <button onClick={() => setExpandedSelected(null)}
                    style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '50%', width: '22px', height: '22px', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    ✕
                  </button>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '2px', marginBottom: '10px' }}>
                  {claims.map((n, i) => (
                    <div key={i} style={{ fontSize: '0.63rem', lineHeight: 1.45, marginBottom: '6px', paddingBottom: '5px', borderBottom: i < claims.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      color: n.evaluation?.sentiment === 'positive' ? '#34d399' : n.evaluation?.sentiment === 'negative' ? '#f87171' : '#94a3b8' }}>
                      {n.evaluation?.sentiment === 'positive' ? '✓' : n.evaluation?.sentiment === 'negative' ? '⚠' : '·'} {n.claim}
                      {n.advice && <span style={{ color: '#c084fc', display: 'block', paddingLeft: '10px', fontSize: '0.58rem', marginTop: '2px' }}>→ {n.advice}</span>}
                    </div>
                  ))}
                  {expandedSelected.nodes.length > 7 && (
                    <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
                      + {expandedSelected.nodes.length - 7} more claims
                    </div>
                  )}
                </div>

                <button
                  onClick={() => { handleClick(expandedSelected); setExpanded(false); }}
                  style={{ width: '100%', background: `${col}22`, border: `1px solid ${col}40`, borderRadius: '8px', color: col, cursor: 'pointer', padding: '7px', fontSize: '0.68rem', fontWeight: '600', fontFamily: 'Inter,sans-serif', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = `${col}38`}
                  onMouseLeave={e => e.currentTarget.style.background = `${col}22`}>
                  Navigate on map →
                </button>
              </div>
            );
          })()}
        </div>,
        document.body
      )}
    </div>
  );
}
