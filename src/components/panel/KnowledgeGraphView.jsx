import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { X, ExternalLink, Maximize2 } from 'lucide-react';

// Smart client-side AI/NLP key-phrase extractor to summarize travel claims cleanly on the map/graph
function summarizeClaim(str) {
  if (!str) return '';
  
  // 1. Clean up common wiki notation, symbols, list items, quotes
  let clean = str.replace(/^[\s*"'•\-[-]+|[\s"'\]\-\:]+$/g, '').trim();
  
  // 2. Remove common filler phrases / introductory boilerplates case-insensitively
  const boilerplates = [
    /^(?:note|remember|please note|keep in mind|be aware|make sure|be sure|don't forget|it is worth noting|it's worth noting|it is recommended|highly recommended|for those looking for|for those looking to|good to know|the fact that)\s+(?:that|to|for|about)?\s*/i,
    /^(?:there are|there is|this is|you can|you should|we recommend|visitors should|visitors can)\s+/i,
    /^(?:the|a|an)\s+/i
  ];
  
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of boilerplates) {
      const next = clean.replace(pattern, '');
      if (next !== clean) {
        clean = next;
        changed = true;
      }
    }
  }
  
  // 3. Match specific key travel terms and map to concise summaries if present (AI intent extraction)
  const lower = clean.toLowerCase();
  if (lower.includes('card-only') || lower.includes('only cards') || lower.includes('no cash')) {
    return 'Card-only Payments';
  }
  if (lower.includes('cash only') || lower.includes('no cards') || lower.includes('only cash')) {
    return 'Cash Only Required';
  }
  if (lower.includes('free entry') || lower.includes('free admission') || lower.includes('free to visit') || lower.includes('free of charge')) {
    return 'Free Admission';
  }
  if (lower.includes('closed on') || lower.includes('closes on')) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const foundDay = days.find(d => lower.includes(d));
    return `Closed ${foundDay ? foundDay.charAt(0).toUpperCase() + foundDay.slice(1) + 's' : 'Days'}`;
  }
  if (lower.includes('very busy') || lower.includes('extremely busy') || lower.includes('crowded')) {
    if (lower.includes('weekend')) return 'Crowded Weekends';
    if (lower.includes('morning')) return 'Crowded Mornings';
    if (lower.includes('rush hour')) return 'Rush Hour Crowds';
    return 'Highly Crowded';
  }
  if (lower.includes('book in advance') || lower.includes('booking in advance') || lower.includes('pre-book') || lower.includes('buy tickets online')) {
    return 'Pre-booking Required';
  }
  if (lower.includes('underground') || lower.includes('tube station') || lower.includes('metro station')) {
    if (lower.includes('closed')) return 'Tube Station Closed';
    if (lower.includes('busy')) return 'Busy Tube Hub';
    return 'Tube Station Info';
  }

  // Capitalize first letter
  clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  
  // 4. Truncate to word boundary (max 28 characters)
  const maxLen = 28;
  if (clean.length <= maxLen) return clean;
  
  const cutIdx = clean.lastIndexOf(' ', maxLen);
  if (cutIdx > 8) {
    return clean.slice(0, cutIdx) + '…';
  }
  return clean.slice(0, maxLen - 1) + '…';
}

// Build graph — savedPos pins existing nodes so expanding one place doesn't shuffle everything else
function buildGraphData(claims, city, expandedPlaces, showAllClaims, savedPos = {}) {
  const nodes = [];
  const links = [];
  const seenPlaces = new Set();

  const claimCount = {};
  claims.forEach(c => {
    const pid = `place-${(c.place || 'unknown').toLowerCase()}`;
    claimCount[pid] = (claimCount[pid] || 0) + 1;
  });

  // Pre-compute contested places (have both positive AND negative claims)
  const placeSentiments = {};
  claims.forEach(c => {
    const pid = `place-${(c.place || 'unknown').toLowerCase()}`;
    if (!placeSentiments[pid]) placeSentiments[pid] = { pos: 0, neg: 0 };
    if (c.evaluation?.sentiment === 'positive') placeSentiments[pid].pos++;
    if (c.evaluation?.sentiment === 'negative') placeSentiments[pid].neg++;
  });
  const contestedPlaces = new Set(
    Object.entries(placeSentiments)
      .filter(([, v]) => v.pos > 0 && v.neg > 0)
      .map(([k]) => k)
  );

  const hubSaved = savedPos['city-hub'];
  nodes.push({
    id: 'city-hub', label: city, type: 'city', color: '#c084fc', size: 9,
    x: hubSaved?.x, y: hubSaved?.y, fx: hubSaved?.x, fy: hubSaved?.y,
  });

  claims.forEach(claim => {
    const placeName = claim.place || 'Unknown Place';
    const placeId = `place-${placeName.toLowerCase()}`;
    const cnt = claimCount[placeId] || 1;
    const isExpanded = showAllClaims || expandedPlaces.has(placeId);
    const isContested = contestedPlaces.has(placeId);

    if (!seenPlaces.has(placeId)) {
      seenPlaces.add(placeId);
      const ps = savedPos[placeId];
      const sInfo = placeSentiments[placeId] || { pos: 0, neg: 0 };
      const posRatio = cnt > 0 ? sInfo.pos / cnt : 0.5;
      const sentimentColor = posRatio > 0.6 ? '#10b981' : (posRatio < 0.3 ? '#f97316' : '#38bdf8');
      
      nodes.push({
        id: placeId, label: placeName, type: 'place',
        color: isContested ? '#fb923c' : sentimentColor,
        sentimentColor,
        size: Math.min(9, 4.5 + Math.sqrt(cnt) * 0.8), claimCount: cnt, isExpanded, isContested,
        x: ps?.x, y: ps?.y, fx: ps?.x, fy: ps?.y,
      });
      links.push({
        source: 'city-hub', target: placeId,
        relType: isContested ? 'contested' : 'hub',
        color: isContested ? 'rgba(251,146,60,0.28)' : 'rgba(255,255,255,0.07)',
      });
    }

    if (isExpanded) {
      const sentiment = claim.evaluation?.sentiment || 'neutral';
      const claimColor = sentiment === 'positive' ? '#10b981' : sentiment === 'negative' ? '#ef4444' : '#a1a1aa';
      const edgeColor = sentiment === 'positive' ? 'rgba(16,185,129,0.3)' : sentiment === 'negative' ? 'rgba(239,68,68,0.3)' : 'rgba(161,161,170,0.18)';
      const relType = sentiment === 'positive' ? 'supports' : sentiment === 'negative' ? 'criticizes' : 'neutral';
      const ps = savedPos[placeId];
      const angle = Math.random() * 2 * Math.PI;
      const dist = 8 + Math.random() * 5;
      const cred = typeof claim.credibility === 'number' ? claim.credibility : 0.55;
      const claimSize = 1.6 + cred * 2.8; // size represents credibility
      
      nodes.push({
        id: claim.id, label: claim.claim, type: 'claim', color: claimColor, size: claimSize, claim, sentiment,
        x: ps ? ps.x + Math.cos(angle) * dist : undefined,
        y: ps ? ps.y + Math.sin(angle) * dist : undefined,
      });
      links.push({ source: placeId, target: claim.id, color: edgeColor, relType });
    }

    if (claim.claimType === 'sequence' && claim.nextPlace) {
      const nextId = `place-${claim.nextPlace.toLowerCase()}`;
      if (!seenPlaces.has(nextId)) {
        seenPlaces.add(nextId);
        const cnt2 = claimCount[nextId] || 1;
        const ns = savedPos[nextId];
        const sInfo2 = placeSentiments[nextId] || { pos: 0, neg: 0 };
        const posRatio2 = cnt2 > 0 ? sInfo2.pos / cnt2 : 0.5;
        const sentimentColor2 = posRatio2 > 0.6 ? '#10b981' : (posRatio2 < 0.3 ? '#f97316' : '#38bdf8');
        
        nodes.push({
          id: nextId, label: claim.nextPlace, type: 'place', color: sentimentColor2,
          sentimentColor: sentimentColor2,
          size: Math.min(9, 4.5 + Math.sqrt(cnt2) * 0.8), claimCount: cnt2,
          isExpanded: showAllClaims || expandedPlaces.has(nextId),
          x: ns?.x, y: ns?.y, fx: ns?.x, fy: ns?.y,
        });
        links.push({ source: 'city-hub', target: nextId, color: 'rgba(255,255,255,0.07)', relType: 'hub' });
      }
      links.push({ source: placeId, target: nextId, color: '#fb7185', relType: 'sequence', isSequence: true });
    }
  });

  return { nodes, links };
}

// Module-level component — stable identity across renders (no unmount/remount on parent re-render)
function ClaimCard({ claim, onClose, onNavigate }) {
  if (!claim) return null;
  const s = claim.evaluation?.sentiment || 'neutral';
  const sc = s === 'positive' ? '#818cf8' : s === 'negative' ? '#fb923c' : '#cbd5e1';
  const bg = s === 'positive' ? 'rgba(99,102,241,0.15)' : s === 'negative' ? 'rgba(249,115,22,0.15)' : 'rgba(161,161,170,0.15)';
  const bd = s === 'positive' ? 'rgba(99,102,241,0.3)' : s === 'negative' ? 'rgba(249,115,22,0.3)' : 'rgba(161,161,170,0.3)';
  return (
    <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px', background: 'rgba(9,9,11,0.96)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 15px', zIndex: 20, display: 'flex', flexDirection: 'column', gap: '7px', boxShadow: '0 10px 30px rgba(0,0,0,0.7)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div>
          <button onClick={() => onNavigate(claim.place)} style={{ fontSize: '0.68rem', fontWeight: '700', color: '#38bdf8', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textAlign: 'left' }}>{claim.place}</button>
          <div style={{ fontSize: '0.78rem', fontWeight: '600', color: '#f8fafc', marginTop: '2px', lineHeight: 1.35 }}>{claim.claim}</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '50%', width: '22px', height: '22px', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={12}/></button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '7px', fontSize: '0.64rem' }}>
        <span style={{ padding: '2px 7px', borderRadius: '6px', fontWeight: '700', textTransform: 'uppercase', background: bg, color: sc, border: `1px solid ${bd}` }}>{s}</span>
        {claim.claimType && <span style={{ padding: '2px 7px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}>{claim.claimType}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.6rem' }}>Credibility:</span>
          <div style={{ width: '44px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${(claim.credibility || 0.5) * 100}%`, height: '100%', background: (claim.credibility || 0.5) > 0.7 ? '#10b981' : (claim.credibility || 0.5) > 0.4 ? '#f59e0b' : '#ef4444' }}/>
          </div>
          <span style={{ fontWeight: '700', fontSize: '0.62rem', color: (claim.credibility || 0.5) > 0.7 ? '#34d399' : '#fbbf24' }}>{Math.round((claim.credibility || 0.5) * 100)}%</span>
        </div>
      </div>
      {claim.advice && <div style={{ background: 'rgba(251,191,36,0.07)', borderLeft: '3px solid #fbbf24', padding: '5px 9px', borderRadius: '0 7px 7px 0', fontSize: '0.66rem', color: '#fef08a', lineHeight: 1.35 }}>💡 {claim.advice}</div>}
      {claim.source?.snippet && <div style={{ fontSize: '0.63rem', color: '#94a3b8', fontStyle: 'italic', lineHeight: 1.35, background: 'rgba(255,255,255,0.02)', padding: '5px 8px', borderRadius: '6px', borderLeft: '2px solid rgba(255,255,255,0.07)' }}>"{claim.source.snippet}"</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '5px' }}>
        <span>Source: {claim.source?.sourceLabel || claim.source?.sourceType || 'unknown'}</span>
        {claim.source?.url && <a href={claim.source.url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}>Source <ExternalLink size={9}/></a>}
      </div>
    </div>
  );
}

export default function KnowledgeGraphView({ claims = [], city = 'Destination', triggerPlaceInfo, tripData }) {
  const containerRef = useRef(null);
  const fgRef = useRef(null);
  const expandedFgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 450, height: 450 });
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [expandedPlaces, setExpandedPlaces] = useState(new Set());
  const [showAllClaims, setShowAllClaims] = useState(false);
  const [graphSearch, setGraphSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [expandedDims, setExpandedDims] = useState({ w: 1200, h: 800 });

  // Refs so canvas renderer always reads the latest values without re-creating the callback
  const graphSearchRef = useRef('');
  const expandedPlacesRef = useRef(expandedPlaces);
  graphSearchRef.current = graphSearch;
  expandedPlacesRef.current = expandedPlaces;

  // Saved node positions — snapshotted before any graphData change so existing nodes stay put
  const posRef = useRef({});
  // Always points to the live graphData so D3-modified x/y are readable without the graph ref
  const graphDataRef = useRef({ nodes: [], links: [] });

  const snapshotPositions = useCallback(() => {
    graphDataRef.current.nodes.forEach(n => {
      if (n.x != null) posRef.current[n.id] = { x: n.x, y: n.y };
    });
  }, []);

  // After simulation settles, release pins so nodes can be freely dragged
  const releaseAllPins = useCallback(() => {
    graphDataRef.current.nodes.forEach(n => { n.fx = undefined; n.fy = undefined; });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(es => {
      const { width } = es[0].contentRect;
      setDimensions({ width: width || 450, height: 450 });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const h = (e) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [expanded]);

  const graphData = useMemo(
    () => buildGraphData(claims, city, expandedPlaces, showAllClaims, posRef.current),
    [claims, city, expandedPlaces, showAllClaims]
  );
  // Keep ref in sync so snapshotPositions/releaseAllPins always read live D3-modified nodes
  graphDataRef.current = graphData;

  // Configure D3 forces for better space utilization (tighter coordinates)
  const configureForces = useCallback((fg, isExpanded = false) => {
    if (!fg) return;
    // If showAllClaims is on, there are way too many nodes. We must significantly reduce the repulsion (charge)
    // and pull links tighter so everything fits on the screen cleanly without flying apart.
    const charge = showAllClaims 
      ? (isExpanded ? -65 : -45) 
      : (isExpanded ? -120 : -80);

    const hubDist = showAllClaims
      ? (isExpanded ? 35 : 24)
      : (isExpanded ? 64 : 42);

    const claimDist = showAllClaims
      ? (isExpanded ? 8 : 6)
      : (isExpanded ? 13 : 9);

    fg.d3Force('charge').strength(charge);
    fg.d3Force('link')
      .distance(link => {
        if (link.isSequence) return showAllClaims ? (isExpanded ? 28 : 20) : (isExpanded ? 52 : 38);
        if (link.source?.id === 'city-hub' || link.target?.id === 'city-hub') return hubDist;
        return claimDist;
      })
      .strength(link => {
        if (link.source?.id === 'city-hub' || link.target?.id === 'city-hub') return 0.75;
        return 1.0;
      });
  }, [showAllClaims]);

  useEffect(() => { configureForces(fgRef.current, false); }, [graphData, configureForces]);
  useEffect(() => { configureForces(expandedFgRef.current, true); }, [expanded, configureForces]);

  // Pre-build place lookup for O(1) clicks
  const placeLookup = useMemo(() => {
    const map = new Map();
    (tripData?.locations || []).forEach(loc => {
      [...(loc.places || []), ...(loc.recommendations || [])].forEach(p => map.set(p.name.toLowerCase(), p));
    });
    return map;
  }, [tripData]);

  const resolvePlaceNav = useCallback((placeName) => {
    if (!triggerPlaceInfo) return;
    const found = placeLookup.get(placeName.toLowerCase());
    const fallback = tripData?.locations?.[0]?.coords || [51.5074, -0.1278];
    triggerPlaceInfo(found || { name: placeName, type: 'custom', coords: fallback });
  }, [triggerPlaceInfo, placeLookup, tripData]);

  const handleNodeClick = useCallback((node) => {
    if (node.type === 'place') {
      // Snapshot positions BEFORE graphData changes — pins existing nodes in place
      snapshotPositions();
      const isAlreadySelected = selectedPlace?.id === node.id;
      setExpandedPlaces(prev => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
      setSelectedPlace(isAlreadySelected ? null : node);
      setSelectedClaim(null);
    } else if (node.type === 'claim' && node.claim) {
      const isAlreadySelected = selectedClaim?.id === node.claim.id;
      setSelectedClaim(isAlreadySelected ? null : node.claim);
      setSelectedPlace(null);
    }
  }, [snapshotPositions, selectedPlace, selectedClaim]);

  // Search: zoom to first matching node (debounced)
  useEffect(() => {
    if (!graphSearch.trim()) return;
    const timer = setTimeout(() => {
      const q = graphSearch.toLowerCase();
      const match = graphData.nodes.find(n =>
        (n.type === 'place' || n.type === 'city') && n.label.toLowerCase().includes(q)
      );
      if (match && match.x != null && fgRef.current) {
        fgRef.current.centerAt(match.x, match.y, 600);
        fgRef.current.zoom(5, 600);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [graphSearch, graphData.nodes]);

  // Same for expanded graph search
  const [expandedSearch, setExpandedSearch] = useState('');
  useEffect(() => {
    if (!expandedSearch.trim()) return;
    const timer = setTimeout(() => {
      const q = expandedSearch.toLowerCase();
      const match = graphData.nodes.find(n =>
        (n.type === 'place' || n.type === 'city') && n.label.toLowerCase().includes(q)
      );
      if (match && match.x != null && expandedFgRef.current) {
        expandedFgRef.current.centerAt(match.x, match.y, 600);
        expandedFgRef.current.zoom(5, 600);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [expandedSearch, graphData.nodes]);

  const generateTooltip = useCallback((node) => {
    if (node.type === 'city') return `<div style="padding:6px 10px;background:rgba(8,12,26,.96);border:1.5px solid #c084fc;border-radius:8px;font-family:Inter,sans-serif;font-size:.72rem;color:#fff"><b style="color:#c084fc">Destination Hub</b><br>${node.label}</div>`;
    if (node.type === 'place') return `<div style="padding:6px 10px;background:rgba(8,12,26,.96);border:1.5px solid ${node.isContested ? '#fb923c' : '#38bdf8'};border-radius:8px;font-family:Inter,sans-serif;font-size:.72rem;color:#fff"><b style="color:${node.isContested ? '#fb923c' : '#38bdf8'}">${node.isContested ? '⚡ Contested · ' : ''}Place · ${node.claimCount || 0} claims</b><br>${node.label}<br><span style="font-size:.6rem;color:#a1a1aa;margin-top:3px;display:block">${node.isExpanded ? 'Click to collapse claims' : 'Click to expand claims'}</span></div>`;
    if (node.type === 'claim' && node.claim) {
      const c = node.claim;
      const s = c.evaluation?.sentiment || 'neutral';
      const sc = s === 'positive' ? '#6366f1' : s === 'negative' ? '#f97316' : '#a1a1aa';
      return `<div style="padding:8px 12px;background:rgba(8,12,26,.98);border:1.5px solid ${sc};border-radius:8px;font-family:Inter,sans-serif;font-size:.7rem;color:#fff;max-width:240px;white-space:normal;line-height:1.4"><span style="font-size:.58rem;padding:1px 5px;border-radius:5px;background:${sc}22;color:${sc};font-weight:700;border:1px solid ${sc}30">${s.toUpperCase()}</span><div style="margin-top:4px;font-weight:600">${(c.claim || '').slice(0, 120)}</div>${c.advice ? `<div style="color:#fcd34d;font-size:.62rem;margin-top:3px">💡 ${c.advice}</div>` : ''}<div style="color:#64748b;font-size:.58rem;margin-top:5px;border-top:1px solid rgba(255,255,255,.07);padding-top:4px">Click for full detail</div></div>`;
    }
    return node.label;
  }, []);

  // Canvas renderer — uses refs so it never causes graph re-mount
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    if (node.x == null || node.y == null || isNaN(node.x) || isNaN(node.y)) return;
    const sq = graphSearchRef.current;
    const isSearchActive = sq.length > 0;
    const isMatch = !isSearchActive || node.label.toLowerCase().includes(sq.toLowerCase());
    ctx.globalAlpha = isSearchActive && !isMatch ? 0.1 : 1;

    const size = node.size || 4;

    // A. Node Glow backdrops
    if (node.type === 'city') {
      const grad = ctx.createRadialGradient(node.x, node.y, 1, node.x, node.y, size + 6);
      grad.addColorStop(0, 'rgba(192,132,252,0.3)');
      grad.addColorStop(1, 'rgba(192,132,252,0)');
      ctx.beginPath(); ctx.arc(node.x, node.y, size + 6, 0, 2 * Math.PI);
      ctx.fillStyle = grad; ctx.fill();
    } else if (node.type === 'place') {
      const grad = ctx.createRadialGradient(node.x, node.y, 1, node.x, node.y, size + 4);
      const col = node.isExpanded ? '240,171,252' : (node.isContested ? '251,146,60' : '56,189,248');
      grad.addColorStop(0, `rgba(${col},0.24)`);
      grad.addColorStop(1, `rgba(${col},0)`);
      ctx.beginPath(); ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
      ctx.fillStyle = grad; ctx.fill();
    }

    // B. Main node body (clean flat look)
    const bodyColor = node.color;

    ctx.beginPath(); ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = bodyColor;
    ctx.fill();

    // Node outer stroke rings
    if (node.type === 'city' || node.type === 'place') {
      ctx.strokeStyle = 'rgba(255,255,255,0.72)';
      ctx.lineWidth = 1.4 / globalScale;
      ctx.stroke();
    }

    // Search matches
    if (isMatch && isSearchActive && (node.type === 'place' || node.type === 'city')) {
      ctx.beginPath(); ctx.arc(node.x, node.y, size + 3, 0, 2 * Math.PI);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.2 / globalScale;
      ctx.stroke();
    }

    // C. Label pills
    const showLabel = node.type === 'city' || node.type === 'place' || globalScale > 2.2;
    if (showLabel) {
      const label = node.type === 'claim' ? summarizeClaim(node.label) : (node.label || '').slice(0, 24);
      // Simulation-space font sizes (scale naturally with D3 zoom)
      const fontSize = node.type === 'city' ? 5.2 : node.type === 'place' ? 3.8 : 2.8;
      ctx.font = `${node.type === 'city' ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(label).width;
      
      const padX = 1.6;
      const padY = 0.8;
      const rectW = tw + padX * 2;
      const rectH = fontSize + padY * 2;
      const rx = node.x - rectW / 2;
      const ry = node.y - size - rectH - 1.2;
      const radius = 1.0;

      // Draw premium rounded pill in simulation-space
      ctx.beginPath();
      ctx.moveTo(rx + radius, ry);
      ctx.lineTo(rx + rectW - radius, ry);
      ctx.quadraticCurveTo(rx + rectW, ry, rx + rectW, ry + radius);
      ctx.lineTo(rx + rectW, ry + rectH - radius);
      ctx.quadraticCurveTo(rx + rectW, ry + rectH, rx + rectW - radius, ry + rectH);
      ctx.lineTo(rx + radius, ry + rectH);
      ctx.quadraticCurveTo(rx, ry + rectH, rx, ry + rectH - radius);
      ctx.lineTo(rx, ry + radius);
      ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
      ctx.closePath();
      
      ctx.fillStyle = 'rgba(10, 10, 18, 0.76)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 0.35;
      ctx.stroke();

      // Label text
      ctx.fillStyle = node.type === 'city' ? '#e9d5ff' : node.type === 'place' ? (node.isExpanded ? '#f5d0fe' : '#e0f2fe') : '#e4e4e7';
      ctx.fillText(label, node.x, ry + rectH / 2);
    }

    // D. Internal Node Value Encodings (Smarter Visuals)
    if (node.type === 'place' && node.claimCount > 0 && size >= 5.2) {
      // Draw total claim count directly inside the place node
      ctx.font = `800 ${size * 0.9}px Inter, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(node.claimCount, node.x, node.y);
    } else if (node.type === 'claim' && node.sentiment && size >= 2.5) {
      // Draw sentiment indicators inside claim nodes
      ctx.font = `800 ${size * 0.9}px Inter, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const sym = node.sentiment === 'positive' ? '✓' : (node.sentiment === 'negative' ? '!' : '•');
      ctx.fillText(sym, node.x, node.y);
    }

    ctx.globalAlpha = 1;
  }, []); // stable — reads graphSearchRef / node.isExpanded on every frame

  const placeCount = useMemo(() => new Set(claims.map(c => c.place).filter(Boolean)).size, [claims]);
  const expandedCount = expandedPlaces.size;

  const sharedProps = {
    nodeLabel: generateTooltip,
    nodeVal: n => n.size,
    onNodeClick: handleNodeClick,
    onBackgroundClick: () => {
      setSelectedPlace(null);
      setSelectedClaim(null);
    },
    linkColor: l => {
      if (expanded) {
        if (l.isSequence) return '#fb7185';
        if (l.relType === 'supports') return 'rgba(99,102,241,0.22)';
        if (l.relType === 'criticizes') return 'rgba(249,115,22,0.22)';
        return 'rgba(15, 23, 42, 0.07)';
      } else {
        if (l.isSequence) return '#fb7185';
        if (l.relType === 'supports') return 'rgba(99,102,241,0.3)';
        if (l.relType === 'criticizes') return 'rgba(249,115,22,0.3)';
        return 'rgba(255,255,255,0.06)';
      }
    },
    linkWidth: l => l.isSequence ? 2 : 1,
    linkDirectionalParticles: l => l.isSequence ? 3 : 0,
    linkDirectionalParticleSpeed: 0.007,
    linkDirectionalParticleWidth: 2,
    linkDirectionalParticleColor: () => '#fb7185',
    nodeCanvasObject,
    nodeCanvasObjectMode: () => 'replace',
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '450px', background: '#09090b', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', position: 'relative' }}>
      {/* Legend */}
      <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, background: 'rgba(0,0,0,0.85)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', pointerEvents: 'none', width: '265px', fontFamily: 'Inter,sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: '#e4e4e7', marginBottom: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', flexShrink: 0 }}/>
          <strong>Places</strong> (Colored by sentiment)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: '#e4e4e7', marginBottom: '6px', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}/>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}/>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a1a1aa' }}/>
          </div>
          <strong style={{ marginLeft: '2px' }}>Claims:</strong> ✓ Pos / ! Neg / • Neu
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: '#e4e4e7', marginBottom: '3px' }}>
          <span style={{ width: '14px', height: '2px', background: 'rgba(99,102,241,0.85)', flexShrink: 0 }}/>
          <strong>Indigo Edge:</strong> Positive claim link
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: '#e4e4e7', marginBottom: '3px' }}>
          <span style={{ width: '14px', height: '2px', background: 'rgba(249,115,22,0.85)', flexShrink: 0 }}/>
          <strong>Orange Edge:</strong> Negative/Caution link
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: '#e4e4e7', marginBottom: '3px' }}>
          <span style={{ width: '14px', height: '2px', background: 'rgba(255,255,255,0.22)', flexShrink: 0 }}/>
          <strong>Grey Edge:</strong> Neutral/Hub link
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: '#e4e4e7', marginBottom: '4px' }}>
          <span style={{ width: '14px', height: '2px', background: '#fb7185', flexShrink: 0 }}/>
          <strong>Route Sequence Edge</strong>
        </div>
        <div style={{ fontSize: '0.52rem', color: '#a1a1aa', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '8px', paddingTop: '6px' }}>
          <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>All Claims Mode:</span>
          <div style={{ marginTop: '2px' }}>• OFF: Click place to expand claims</div>
          <div>• ON: Show all claims on graph</div>
        </div>
      </div>

      {/* Controls (top-right) */}
      <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, display: 'flex', gap: '5px', alignItems: 'center' }}>
        <input
          value={graphSearch} onChange={e => setGraphSearch(e.target.value)}
          placeholder="🔍 Find node…"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '7px', padding: '4px 9px', fontSize: '0.65rem', color: 'rgba(255,255,255,0.75)', outline: 'none', width: '130px', fontFamily: 'Inter,sans-serif' }}
        />
        {expandedCount > 0 && !showAllClaims && (
          <button onClick={() => { snapshotPositions(); setExpandedPlaces(new Set()); }} title="Collapse all claims"
            style={{ background: 'rgba(240,171,252,0.15)', border: '1px solid rgba(240,171,252,0.3)', borderRadius: '6px', color: '#f0abfc', cursor: 'pointer', padding: '4px 8px', fontSize: '0.63rem', fontFamily: 'Inter,sans-serif' }}>
            ○ Collapse {expandedCount}
          </button>
        )}
        <button onClick={() => { snapshotPositions(); setShowAllClaims(s => !s); }} title={showAllClaims ? 'Hide all claim nodes' : 'Show all claim nodes'}
          style={{ background: showAllClaims ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.07)', border: `1px solid ${showAllClaims ? 'rgba(99,102,241,0.38)' : 'rgba(255,255,255,0.14)'}`, borderRadius: '6px', color: showAllClaims ? '#818cf8' : 'rgba(255,255,255,0.45)', cursor: 'pointer', padding: '4px 8px', fontSize: '0.63rem', fontFamily: 'Inter,sans-serif' }}>
          {showAllClaims ? '⬤ All claims' : '○ All claims'}
        </button>
        <button onClick={() => { setExpandedDims({ w: window.innerWidth, h: window.innerHeight - 50 }); setExpanded(true); }} title="Expand full screen"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.63rem', fontFamily: 'Inter,sans-serif' }}>
          <Maximize2 size={11}/> Expand
        </button>
      </div>

      {/* Hint */}
      <div style={{ position: 'absolute', bottom: selectedClaim || selectedPlace ? '135px' : '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 8, pointerEvents: 'none', fontSize: '0.58rem', color: 'rgba(255,255,255,0.18)', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap' }}>
        {placeCount} places · {claims.length} claims · click place to expand its claims
      </div>

      <ForceGraph2D ref={fgRef} graphData={graphData} width={dimensions.width} height={dimensions.height} {...sharedProps} cooldownTicks={50} d3AlphaDecay={0.04} d3VelocityDecay={0.4} onEngineStop={releaseAllPins}/>

      {/* Claim info card */}
      <ClaimCard claim={selectedClaim} onClose={() => setSelectedClaim(null)} onNavigate={resolvePlaceNav}/>

      {/* Place info card */}
      {selectedPlace && !selectedClaim && (() => {
        const placeNode = selectedPlace;
        const placeClaims = claims.filter(c => `place-${(c.place||'').toLowerCase()}` === placeNode.id);
        return (
          <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px', background: 'rgba(9,9,11,0.96)', backdropFilter: 'blur(12px)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '12px', padding: '12px 15px', zIndex: 20, display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '200px', boxShadow: '0 10px 30px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#38bdf8' }}>{placeNode.label}</span>
                <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', marginLeft: '8px' }}>{placeNode.claimCount} claims · {expandedPlaces.has(placeNode.id) ? 'expanded' : 'collapsed'}</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button onClick={() => resolvePlaceNav(placeNode.label)} style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', padding: '3px 9px', fontSize: '0.62rem', fontFamily: 'Inter,sans-serif' }}>
                  Navigate →
                </button>
                <button onClick={() => setSelectedPlace(null)} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '50%', width: '20px', height: '20px', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={11}/></button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {placeClaims.slice(0, 4).map((c, i) => {
                const s = c.evaluation?.sentiment;
                const col = s === 'positive' ? '#34d399' : s === 'negative' ? '#f87171' : '#94a3b8';
                return <span key={i} style={{ fontSize: '0.6rem', color: col, background: `${col}12`, border: `1px solid ${col}25`, borderRadius: '5px', padding: '2px 7px', lineHeight: 1.4 }}>{(c.claim || '').slice(0, 60)}</span>;
              })}
              {placeClaims.length > 4 && <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)' }}>+{placeClaims.length - 4} more</span>}
            </div>
          </div>
        );
      })()}

      {/* ── Fullscreen expanded modal ── */}
      {expanded && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', borderBottom: '1px solid #e4e4e7', background: '#ffffff', flexShrink: 0 }}>
            <span style={{ fontSize: '0.78rem', color: '#475569', fontFamily: 'Inter,sans-serif' }}>
              Force Graph · <strong style={{ color: '#0ea5e9' }}>{placeCount}</strong> places · <strong style={{ color: '#6366f1' }}>{claims.length}</strong> claims — {city}
            </span>
            <input value={expandedSearch} onChange={e => setExpandedSearch(e.target.value)}
              placeholder="🔍 Find node…"
              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '7px', padding: '4px 10px', fontSize: '0.68rem', color: '#1e293b', outline: 'none', width: '180px', fontFamily: 'Inter,sans-serif' }}/>
            <button onClick={() => setShowAllClaims(s => !s)}
              style={{ background: showAllClaims ? 'rgba(99,102,241,0.12)' : '#f1f5f9', border: `1px solid ${showAllClaims ? '#818cf8' : '#cbd5e1'}`, borderRadius: '6px', color: showAllClaims ? '#4f46e5' : '#475569', cursor: 'pointer', padding: '4px 10px', fontSize: '0.65rem', fontFamily: 'Inter,sans-serif' }}>
              {showAllClaims ? '⬤ All claims on' : '○ All claims off'}
            </button>
            <div style={{ flex: 1 }}/>
            <span style={{ fontSize: '0.62rem', color: '#64748b', fontFamily: 'Inter,sans-serif' }}>Scroll=zoom · Drag=pan · Click place=expand · Esc to close</span>
            <button onClick={() => setExpanded(false)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#475569', cursor: 'pointer', padding: '4px 12px', fontSize: '0.7rem', fontFamily: 'Inter,sans-serif' }}>✕ Close</button>
          </div>
          
          {/* Main Visualizer Area */}
          <div style={{ flex: 1, background: '#ffffff', position: 'relative' }}>
            {/* Light Theme Legend */}
            <div style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 10, background: 'rgba(255,255,255,0.92)', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', pointerEvents: 'none', width: '265px', fontFamily: 'Inter,sans-serif' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: '#334155', marginBottom: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', flexShrink: 0 }}/>
                <strong>Places</strong> (Colored by sentiment)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: '#334155', marginBottom: '6px', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}/>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}/>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a1a1aa' }}/>
                </div>
                <strong style={{ marginLeft: '2px' }}>Claims:</strong> ✓ Pos / ! Neg / • Neu
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: '#334155', marginBottom: '3px' }}>
                <span style={{ width: '14px', height: '2px', background: 'rgba(99,102,241,0.85)', flexShrink: 0 }}/>
                <strong>Indigo Edge:</strong> Positive claim link
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: '#334155', marginBottom: '3px' }}>
                <span style={{ width: '14px', height: '2px', background: 'rgba(249,115,22,0.85)', flexShrink: 0 }}/>
                <strong>Orange Edge:</strong> Negative/Caution link
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: '#334155', marginBottom: '3px' }}>
                <span style={{ width: '14px', height: '2px', background: 'rgba(15, 23, 42, 0.22)', flexShrink: 0 }}/>
                <strong>Grey Edge:</strong> Neutral/Hub link
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: '#334155', marginBottom: '4px' }}>
                <span style={{ width: '14px', height: '2px', background: '#fb7185', flexShrink: 0 }}/>
                <strong>Route Sequence Edge</strong>
              </div>
              <div style={{ fontSize: '0.55rem', color: '#64748b', borderTop: '1px solid #e2e8f0', marginTop: '8px', paddingTop: '6px' }}>
                <span style={{ fontWeight: 'bold', color: '#0ea5e9' }}>All Claims Mode:</span>
                <div style={{ marginTop: '2px' }}>• OFF: Click place to expand claims</div>
                <div>• ON: Show all claims on graph</div>
              </div>
            </div>

            <ForceGraph2D ref={expandedFgRef} graphData={graphData} width={expandedDims.w} height={expandedDims.h} {...sharedProps} cooldownTicks={80} d3AlphaDecay={0.04} d3VelocityDecay={0.4} onEngineStop={releaseAllPins}/>
            
            {/* Claim details card overlay */}
            <div style={{ zIndex: 20, position: 'absolute', bottom: '0', left: '0', right: '0' }}>
              <ClaimCard claim={selectedClaim} onClose={() => setSelectedClaim(null)} onNavigate={resolvePlaceNav}/>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
