import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Compass, MapPin, SlidersHorizontal, Route, Info, Layers, Search, Check, ChevronLeft, ChevronRight, Play, Pause, RefreshCw, X, ArrowRight, HelpCircle, ChevronUp, ChevronDown, Trash2, Plus, Loader2 } from 'lucide-react';
import { getDistanceKm, scorePlaceQuality, getTypeDetails } from '../../utils';
import { ENTITY_PROFILES, PACKING_TEMPLATES, INTEREST_CATEGORIES } from '../../config';
import { searchNominatim } from '../../api';
import { buildPlaceEvidence } from '../../knowledge/evidence';
import { strictEvidence } from '../../knowledge/controversy';

// Cluster colors: avoids blue/green/purple (radar) and food-amber/beaches-cyan/shopping-pink (type legend)
const CLUSTER_PALETTE = ['#e879f9', '#facc15', '#2dd4bf', '#f43f5e', '#a3e635'];

// ── Multi-Dimensional K-Means Clustering ───────────────────────────────────────
function runMultiKMeans(vectors, K = 5, iterations = 25) {
  const N = vectors.length;
  const F = vectors[0].length;
  if (N <= K) {
    return {
      assignments: Array.from({ length: N }, (_, i) => i % K)
    };
  }

  // Centroid initialization: pick K distributed points
  let centroids = [];
  centroids.push([...vectors[0]]);
  while (centroids.length < K) {
    let maxDist = -Infinity;
    let candidate = vectors[0];
    for (let i = 0; i < N; i++) {
      const v = vectors[i];
      let minDistToCentroids = Infinity;
      for (const c of centroids) {
        let d = 0;
        for (let f = 0; f < F; f++) {
          d += (v[f] - c[f]) ** 2;
        }
        if (d < minDistToCentroids) minDistToCentroids = d;
      }
      if (minDistToCentroids > maxDist) {
        maxDist = minDistToCentroids;
        candidate = v;
      }
    }
    centroids.push([...candidate]);
  }

  let assignments = new Array(N).fill(0);
  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;
    for (let i = 0; i < N; i++) {
      const v = vectors[i];
      let minDist = Infinity;
      let nearestIdx = 0;
      for (let k = 0; k < K; k++) {
        const c = centroids[k];
        let dist = 0;
        for (let f = 0; f < F; f++) {
          dist += (v[f] - c[f]) ** 2;
        }
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = k;
        }
      }
      if (assignments[i] !== nearestIdx) {
        assignments[i] = nearestIdx;
        changed = true;
      }
    }

    if (!changed) break;

    // Recalculate centroids
    const newCentroids = Array.from({ length: K }, () => new Array(F).fill(0));
    const counts = new Array(K).fill(0);
    for (let i = 0; i < N; i++) {
      const k = assignments[i];
      for (let f = 0; f < F; f++) {
        newCentroids[k][f] += vectors[i][f];
      }
      counts[k]++;
    }

    for (let k = 0; k < K; k++) {
      if (counts[k] > 0) {
        for (let f = 0; f < F; f++) {
          centroids[k][f] = newCentroids[k][f] / counts[k];
        }
      } else {
        const rIdx = Math.floor(Math.random() * N);
        centroids[k] = [...vectors[rIdx]];
      }
    }
  }

  return { assignments };
}

// ── Journey Rhythm Strip ─────────────────────────────────────────────────────
function JourneyRhythm({ stops, height = 11 }) {
  if (!stops?.length) return <div style={{ height, background: 'rgba(255,255,255,0.05)', borderRadius: height/2 }}/>;
  const DUR = { museum:2.5, gallery:2, attraction:2, restaurant:1.5, cafe:1, bar:1.5, park:1.5, hiking:3, landmark:1.5, nature:2, beach:2 };
  const total = stops.reduce((s, p) => s + (DUR[p.type?.toLowerCase()] || 1.5), 0);
  return (
    <div style={{ display:'flex', height, borderRadius: height/2, overflow:'hidden', gap:'1px' }}>
      {stops.map((stop, i) => {
        const dur = DUR[stop.type?.toLowerCase()] || 1.5;
        const { color } = getTypeDetails(stop.type);
        return <div key={i} title={`${i+1}. ${stop.name}`}
          style={{ flex: dur/total, background: color || '#6366f1', minWidth: 4 }}/>;
      })}
    </div>
  );
}


// ── Journey Rhythm Color Legend ──────────────────────────────────────────────
function RhythmLegend({ stopsArrays }) {
  const typeSeen = new Map();
  (stopsArrays || []).forEach(stops => {
    (stops || []).forEach(stop => {
      if (stop?.type) {
        const { color, label } = getTypeDetails(stop.type);
        if (!typeSeen.has(label)) {
          typeSeen.set(label, { color, label });
        }
      }
    });
  });
  if (typeSeen.size === 0) return null;
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:'3px 10px', marginTop:'5px', marginBottom:'2px' }}>
      {[...typeSeen.values()].map(({ color, label }) => (
        <span key={label} style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'0.59rem', color:'var(--text-secondary)' }}>
          <span style={{ width:8, height:8, borderRadius:'2px', background:color, display:'inline-block', flexShrink:0 }}/>
          {label}
        </span>
      ))}
    </div>
  );
}

// ── Sky Lens Radar Chart ─────────────────────────────────────────────────────
function RouteRadarChart({ data, size = 200, onRemoveA, onRemoveB }) {
  const n = data.length;
  if (n === 0) return null;
  const cx = size / 2, cy = size / 2;
  const r = size * 0.38;
  const angles = data.map((_, i) => (2 * Math.PI * i) / n - Math.PI / 2);

  const pt = (score, angle) => {
    const s = typeof score === 'number' && !isNaN(score) ? Math.max(0, score) : 0;
    return [cx + (r * s / 10) * Math.cos(angle), cy + (r * s / 10) * Math.sin(angle)];
  };

  const ptsA = data.map((d, i) => pt(d['Route A'], angles[i]));
  const ptsB = data.map((d, i) => pt(d['Route B'], angles[i]));
  const ptsM = data.map((d, i) => pt(d['Morphed'], angles[i]));

  const toPath = pts => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
      <svg width={size} height={size} style={{ display: 'block', overflow: 'visible', margin: '0 auto' }}>
        <defs>
          <filter id="sky-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Grid rings */}
        {[2.5, 5, 7.5, 10].map(ring => (
          <polygon key={ring}
            points={angles.map(a => `${(cx + r * ring / 10 * Math.cos(a)).toFixed(1)},${(cy + r * ring / 10 * Math.sin(a)).toFixed(1)}`).join(' ')}
            fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.75"/>
        ))}

        {/* Spokes */}
        {angles.map((a, i) => (
          <line key={i} x1={cx} y1={cy}
            x2={(cx + r * Math.cos(a)).toFixed(1)} y2={(cy + r * Math.sin(a)).toFixed(1)}
            stroke="rgba(255,255,255,0.08)" strokeWidth="0.75"/>
        ))}

        {/* Route B polygon, double-click to remove */}
        <polygon points={toPath(ptsB)} fill="rgba(16,185,129,0.08)" stroke="#10b981" strokeWidth="1.8"
          style={{ cursor: onRemoveB ? 'pointer' : 'default' }}
          onDoubleClick={onRemoveB || undefined}
          title={onRemoveB ? 'Double-click to remove Route B' : undefined}/>
        {ptsB.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="#10b981" opacity={0.9}
            style={{ cursor: onRemoveB ? 'pointer' : 'default' }}
            onDoubleClick={onRemoveB || undefined}/>
        ))}

        {/* Route A polygon, double-click to remove */}
        <polygon points={toPath(ptsA)} fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth="1.8"
          style={{ cursor: onRemoveA ? 'pointer' : 'default' }}
          onDoubleClick={onRemoveA || undefined}
          title={onRemoveA ? 'Double-click to remove Route A' : undefined}/>
        {ptsA.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="#3b82f6" opacity={0.9}
            style={{ cursor: onRemoveA ? 'pointer' : 'default' }}
            onDoubleClick={onRemoveA || undefined}/>
        ))}

        {/* Morphed polygon */}
        <polygon points={toPath(ptsM)} fill="rgba(139,92,246,0.25)" stroke="#8b5cf6" strokeWidth="2.5" filter="url(#sky-glow)"/>
        {ptsM.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#c084fc" stroke="#fff" strokeWidth="1"/>)}

        {/* Axis labels */}
        {angles.map((a, i) => {
          const lr = r + 14;
          const lx = cx + lr * Math.cos(a);
          const ly = cy + lr * Math.sin(a);
          const anchor = Math.abs(Math.cos(a)) < 0.15 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
          const dyOff = Math.sin(a) < -0.5 ? -2 : Math.sin(a) > 0.5 ? 9 : 4;
          return (
            <text key={i} x={lx.toFixed(1)} y={(ly + dyOff).toFixed(1)}
              textAnchor={anchor} fill="rgba(255,255,255,0.8)"
              fontSize="7" fontFamily="Inter,sans-serif" fontWeight="700"
              style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {data[i].subject}
            </text>
          );
        })}
      </svg>

      {/* Legend row, HTML for readability */}
      <div style={{ display:'flex', gap:'18px', justifyContent:'center', marginTop:'2px' }}>
        {[['#3b82f6','Route A','A'], ['#8b5cf6','Morphed',null], ['#10b981','Route B','B']].map(([color, lbl, slot]) => {
          const onRemove = slot === 'A' ? onRemoveA : slot === 'B' ? onRemoveB : null;
          return (
            <div key={lbl} style={{ display:'flex', alignItems:'center', gap:'5px', cursor: onRemove ? 'pointer' : 'default', opacity: onRemove ? 1 : 1 }}
              onClick={onRemove || undefined}
              title={onRemove ? `Remove ${lbl}` : undefined}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:color, flexShrink:0 }}/>
              <span style={{ fontSize:'0.68rem', fontWeight:'700', color, letterSpacing:'0.02em' }}>{lbl}{onRemove ? ' ×' : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Type Bucket for Similarity Matching ─────────────────────────────────────
function getTypeBucket(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('restaurant') || t.includes('food') || t.includes('cafe') || t.includes('coffee') || t.includes('bar') || t.includes('bakery') || t.includes('market')) return 'food';
  if (t.includes('museum') || t.includes('gallery') || t.includes('art') || t.includes('historic') || t.includes('castle') || t.includes('monument') || t.includes('landmark')) return 'culture';
  if (t.includes('park') || t.includes('garden') || t.includes('hiking') || t.includes('trail') || t.includes('nature') || t.includes('beach') || t.includes('viewpoint') || t.includes('forest')) return 'nature';
  if (t.includes('shop') || t.includes('mall')) return 'shopping';
  return 'attraction';
}

// ── Route Genome Classification ──────────────────────────────────────────────
function classifyStopGene(stop, idx, allStops, stabilityLookup, themeText) {
  const key = stop.name.toLowerCase();
  const stability = stabilityLookup?.[key] || 'outlier';
  const type = (stop.type || '').toLowerCase();
  const isFirst = idx === 0;
  const isLast = idx === allStops.length - 1 && allStops.length > 1;

  const keywords = (themeText || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
  let themeScore = 0;
  keywords.forEach(w => {
    if (stop.name.toLowerCase().includes(w)) themeScore += 3;
    if (type.includes(w)) themeScore += 2;
    if ((stop.notes || stop.extract || '').toLowerCase().includes(w)) themeScore += 1;
  });

  const isLocal = !stop.osmTags?.wikidata || stop.isSaved;
  const isCostDriver = type.includes('restaurant') || (type.includes('museum') && !isLocal);
  const isSocial = type.includes('restaurant') || type.includes('cafe') || type.includes('coffee') || type.includes('bar') || type.includes('market');

  let detourKm = 0;
  if (idx > 0 && allStops[idx - 1]) {
    detourKm = getDistanceKm(allStops[idx-1].coords[0], allStops[idx-1].coords[1], stop.coords[0], stop.coords[1]);
  }

  const genes = [];

  if (isFirst) {
    genes.push(stability === 'anchor'
      ? { label: 'Anchor', color: '#3b82f6' }
      : { label: 'Opener', color: '#60a5fa' });
  } else if (isLast) {
    genes.push(themeScore > 2
      ? { label: 'Thematic Closure', color: '#a78bfa' }
      : { label: 'Closure', color: '#8b5cf6' });
  } else {
    if (stability === 'anchor')      genes.push({ label: 'Stable Anchor', color: '#3b82f6' });
    else if (stability === 'alternative') genes.push({ label: 'Flex Stop',     color: '#ec4899' });
    else                             genes.push({ label: 'Connector',     color: '#64748b' });
  }

  if (themeScore > 2)                    genes.push({ label: 'Theme Carrier', color: '#f59e0b' });
  if (isLocal && stability !== 'anchor') genes.push({ label: 'Local Gem',     color: '#10b981' });
  if (isSocial)                          genes.push({ label: 'Social',         color: '#f97316' });
  if (detourKm > 2.0)                    genes.push({ label: `Detour +${detourKm.toFixed(1)}km`, color: '#ef4444' });
  if (isCostDriver && !isFirst)          genes.push({ label: 'Cost Driver',    color: '#fb923c' });

  return genes.slice(0, 2);
}

// ── Radar Dimension Config ────────────────────────────────────────────────────
const RADAR_DIMS = [
  { key: 'totalDistance', subject: 'Distance', invert: false },
  { key: 'cost',          subject: 'Budget',   invert: true  },
  { key: 'novelty',       subject: 'Local',    invert: false },
  { key: 'diversity',     subject: 'Variety',  invert: false },
  { key: 'themeDensity',  subject: 'Theme',    invert: false },
  { key: 'spread',        subject: 'Spread',   invert: false },
  { key: 'stopCount',     subject: 'Stops',    invert: false },
  { key: 'popularity',    subject: 'Popular',  invert: false },
];

// ── Main Component ───────────────────────────────────────────────────────────
export function RouteSpacePanel({
  tripData,
  setTripData,
  activeCity: activeCityProp,
  routeSpaceRoute,
  setRouteSpaceRoute,
  routeSpaceSelectedA,
  setRouteSpaceSelectedA,
  routeSpaceSelectedB,
  setRouteSpaceSelectedB,
  setStopStabilityMap,
  triggerPlaceInfo,
  aiInterests = [],
  onSwitchToCalendar,
  showRouteOnMap = true,
  setShowRouteOnMap,
  onOpenTab,
}) {
  const [themeText, setThemeText] = useState(() => localStorage.getItem('routespace_theme') || 'Compact loops, local cafes, and scenic views');
  const [categoryReqs, setCategoryReqs] = useState(() => JSON.parse(localStorage.getItem('routespace_cat_reqs')) || {});
  const [candidates, setCandidates] = useState(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem('routespace_candidates') || '[]');
      // Discard cache if it's missing modern fields like themeDensity
      if (cached.length > 0 && cached.every(c => c && typeof c.themeDensity === 'number')) {
        return cached;
      }
      return [];
    } catch { return []; }
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [viewMode, setViewMode] = useState('places');
  const [brushActive, setBrushActive] = useState(false);
  const [brushStart, setBrushStart] = useState(null);
  const [brushEnd, setBrushEnd] = useState(null);
  const [brushedIds, setBrushedIds] = useState(new Set());
  const [sparseFocusActive, setSparseFocusActive] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const [legendFilters, setLegendFilters] = useState(new Set());

  useEffect(() => {
    setBrushedIds(new Set());
    setBrushStart(null);
    setBrushEnd(null);
    setSparseFocusActive(false);
    setLegendFilters(new Set());
  }, [viewMode, isFullscreen]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [isFullscreen]);

  const [contextMenuRoute, setContextMenuRoute] = useState(null);
  const svgContainerRef = useRef(null);

  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;
    const preventDefaultWheel = (e) => {
      e.preventDefault();
      const scale = e.deltaY < 0 ? 1.15 : 0.85;
      setZoom(prev => Math.max(0.5, Math.min(8, prev * scale)));
    };
    el.addEventListener('wheel', preventDefaultWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', preventDefaultWheel);
    };
  }, [isFullscreen]);

  const [hoveredRoute, setHoveredRoute] = useState(null);
  const [activeClusterTab, setActiveClusterTab] = useState(null);
  const [showHelp, setShowHelp] = useState(() => localStorage.getItem('routespace_show_help') === 'true');
  const [radiusMode, setRadiusMode] = useState(() => localStorage.getItem('routespace_radius_mode') || 'walk');
  const [radarAxisKeys, setRadarAxisKeys] = useState(() => {
    try { return JSON.parse(localStorage.getItem('routespace_radar_axes') || 'null') || ['totalDistance','cost','novelty','diversity','themeDensity']; }
    catch { return ['totalDistance','cost','novelty','diversity','themeDensity']; }
  });
  const [showAxisConfig, setShowAxisConfig] = useState(false);
  const [clusterPopup, setClusterPopup] = useState(null);
  const [minStops, setMinStops] = useState(() => Number(localStorage.getItem('routespace_min_stops') || '3'));
  const [maxStops, setMaxStops] = useState(() => Number(localStorage.getItem('routespace_max_stops') || '5'));
  const [hoveredPlace, setHoveredPlace] = useState(null);
  const [showGenome, setShowGenome] = useState(false);
  const [showMutationStudio, setShowMutationStudio] = useState(false);
  const [activeMutationBtn, setActiveMutationBtn] = useState(null);
  const [pendingMutation, setPendingMutation] = useState(null);
  const [navSliders, setNavSliders] = useState({ local: 50, compact: 50, theme: 50, social: 50 });
  const [typeSliders, setTypeSliders] = useState({ museums: 50, food: 50, parks: 50, shopping: 50 });
  // Multiverse: calm ↔ lively (null = ignore). Uses what sources say about crowds at each stop.
  const [vibe, setVibe] = useState(null);
  const crowdIndex = useMemo(() => buildPlaceEvidence(tripData?.knowledgeGraph?.nodes || [], tripData?.knowledgeGraph?.verified, { cityNames: (tripData?.locations || []).map(l => l.name) }), [tripData?.knowledgeGraph, tripData?.locations]);
  const crowdCache = useRef(new Map());
  useEffect(() => { crowdCache.current = new Map(); }, [crowdIndex]);
  const isCrowded = useCallback((name) => {
    if (!name || !crowdIndex.size) return false;
    if (crowdCache.current.has(name)) return crowdCache.current.get(name);
    const e = strictEvidence(name, crowdIndex);
    const v = !!e && (e.statementsList || []).some(n => /\b(crowd(s|ed)?|busy|packed|queues?|touristy|heaving)\b/i.test(n.claim || '') && n.evaluation?.sentiment !== 'positive');
    crowdCache.current.set(name, v);
    return v;
  }, [crowdIndex]);
  const [spatialFilter, setSpatialFilter] = useState([]);
  const [selectedRouteA, setSelectedRouteA] = useState(null);
  const [selectedRouteB, setSelectedRouteB] = useState(null);
  const [replacingSlot, setReplacingSlot] = useState(null);
  const [activeRouteTab, setActiveRouteTab] = useState('overview');
  const [genomeView, setGenomeView] = useState('active');

  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [isSearchingManual, setIsSearchingManual] = useState(false);
  const [placeSelectValue, setPlaceSelectValue] = useState('');
  const [expandedAlts, setExpandedAlts] = useState(new Set());
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // Use the prop first (city selected in Explore tab), fall back to first location
  const activeCity = activeCityProp || tripData.locations[0] || null;
  const activeCityId = activeCity?.id || null;
  const prevCityIdRef = useRef(activeCityId);

  useEffect(() => {
    if (activeCityId !== prevCityIdRef.current) {
      prevCityIdRef.current = activeCityId;
      setCandidates([]);
      setRouteSpaceRoute(null);
      setContextMenuRoute(null);
    }
  }, [activeCityId, setRouteSpaceRoute]);

  // Re-generate coordinates, cluster properties, and medoid selection dynamically based on radiusMode
  const { clusteredCandidates, clusters } = useMemo(() => {
    if (candidates.length === 0) return { clusteredCandidates: [], clusters: [] };

    // 1. Run K-Means Clustering on the multi-dimensional feature vectors directly
    const featureMatrix = candidates.map(c => c.features);
    const N = featureMatrix.length;
    const F = featureMatrix[0].length;
    const means = new Array(F).fill(0);
    const stds = new Array(F).fill(0);
    for (let f = 0; f < F; f++) {
      let sum = 0;
      for (let i = 0; i < N; i++) sum += featureMatrix[i][f];
      means[f] = sum / N;
    }
    for (let f = 0; f < F; f++) {
      let sumSq = 0;
      for (let i = 0; i < N; i++) sumSq += (featureMatrix[i][f] - means[f]) ** 2;
      stds[f] = Math.sqrt(sumSq / (N - 1 || 1)) || 1.0;
    }
    const standardizedFeatures = featureMatrix.map(row =>
      row.map((val, f) => (val - means[f]) / stds[f])
    );

    const { assignments } = runMultiKMeans(standardizedFeatures, 4);

    // 2. Map coordinates dynamically in a Polar coordinate system
    let radialValues = [];
    if (radiusMode === 'budget') {
      radialValues = candidates.map(c => c.cost);
    } else if (radiusMode === 'theme') {
      radialValues = candidates.map(c => c.themeDensity);
    } else {
      // Default: walking load / distance
      radialValues = candidates.map(c => c.totalDistance);
    }

    const minVal = Math.min(...radialValues);
    const maxVal = Math.max(...radialValues);
    const valSpan = maxVal - minVal || 1;

    // Helper for deterministic jitter
    const getDeterministicJitter = (id) => {
      let hash = 0;
      for (let i = 0; i < id.length; i++) {
        hash = (hash << 5) - hash + id.charCodeAt(i);
        hash |= 0;
      }
      return (Math.abs(hash) % 1000) / 1000;
    };

    // 2D scatter: X = novelty (popular ↔ local), Y = selected axis (compact ↔ wide/costly)
    // Normalise both axes across all candidates
    const noveltyValues = candidates.map(c => c.novelty);
    const minNovelty = Math.min(...noveltyValues);
    const maxNovelty = Math.max(...noveltyValues);
    const noveltySpan = (maxNovelty - minNovelty) || 1;

    const mapped = candidates.map((c, idx) => {
      const cluster = assignments[idx];

      // X: novelty 0→1 mapped to [-105, 105], low novelty = popular (left)
      const normNovelty = (c.novelty - minNovelty) / noveltySpan;
      const baseX = -105 + normNovelty * 210;

      // Y: selected axis, normalised to [-88, 88]; invert so low value = top
      const normVal = (radialValues[idx] - minVal) / valSpan;
      const baseY = 88 - normVal * 176;

      // Deterministic jitter to separate overlapping points (±8px)
      const jx = (getDeterministicJitter(c.id) - 0.5) * 16;
      const jy = (getDeterministicJitter(c.id.split('').reverse().join('')) - 0.5) * 16;

      const x = Math.max(-118, Math.min(118, baseX + jx));
      const y = Math.max(-102, Math.min(102, baseY + jy));

      return {
        ...c,
        cluster,
        x,
        y,
        r: 40, // kept for compat, not used for layout
        angle: 0,
      };
    });

    // 3. Heuristically define properties & labels for the clusters
    // Compute per-cluster stats first so we can rank relative to each other
    const rawStats = Array.from({ length: 4 }, (_, idx) => {
      const members = mapped.filter(c => c.cluster === idx);
      const n = members.length || 1;
      return {
        idx,
        members,
        avgDistance:   members.reduce((s, m) => s + m.totalDistance, 0) / n,
        avgCost:       members.reduce((s, m) => s + m.cost,          0) / n,
        avgStops:      members.reduce((s, m) => s + m.stopCount,     0) / n,
        avgNovelty:    members.reduce((s, m) => s + m.novelty,       0) / n,
        avgPopularity: members.reduce((s, m) => s + m.popularity,    0) / n,
        avgTheme:      members.reduce((s, m) => s + (m.themeDensity||0), 0) / n,
      };
    });

    // Rank each cluster's metrics (0 = lowest, 3 = highest)
    const rankBy = (key, invert = false) => {
      const sorted = [...rawStats].sort((a, b) => invert ? b[key] - a[key] : a[key] - b[key]);
      const rankMap = new Map(sorted.map((s, i) => [s.idx, i]));
      return rankMap;
    };
    const rankDist   = rankBy('avgDistance');
    const rankCost   = rankBy('avgCost');
    const rankStops  = rankBy('avgStops');
    const rankNovel  = rankBy('avgNovelty');
    const rankPop    = rankBy('avgPopularity');
    const rankTheme  = rankBy('avgTheme');

    // Assign labels based on RELATIVE rank across the 4 clusters
    const usedLabels = new Set();
    const LABELS = [
      { label: 'Famous Sights',        desc: 'Iconic museums and historic architecture',       test: s => rankPop.get(s.idx) >= 3 },
      { label: 'Hidden Gems',          desc: 'Off-the-beaten-path spots and local favourites', test: s => rankNovel.get(s.idx) >= 3 && rankPop.get(s.idx) <= 1 },
      { label: 'Short Walks',          desc: 'Core sights in a tight, walkable area',         test: s => rankDist.get(s.idx) <= 1 && rankPop.get(s.idx) >= 1 },
      { label: 'Long Loops',           desc: 'Many stops spread across a wide area',          test: s => rankStops.get(s.idx) >= 2 && rankDist.get(s.idx) >= 2 },
      { label: 'Budget Sights',        desc: 'Free parks, viewpoints, and walking routes',    test: s => rankCost.get(s.idx) <= 1 },
      { label: 'Theme Focused',        desc: 'Concentrated around one type of experience',    test: s => rankTheme.get(s.idx) >= 2 },
      { label: 'Relaxed Walks',        desc: 'Relaxed pace with a handful of stops',          test: s => rankStops.get(s.idx) <= 1 },
      { label: 'Balanced Walks',       desc: 'Mix of landmarks and neighbourhood spots',      test: () => true },
    ];

    const assignLabel = (s) => {
      for (const { label, desc, test } of LABELS) {
        if (!usedLabels.has(label) && test(s)) {
          usedLabels.add(label);
          return { label, desc };
        }
      }
      return { label: 'Mixed Walks', desc: 'Balanced path across mixed spots' };
    };

    // Sort clusters by most-distinctive first so unique labels go to the right cluster
    const sortedStats = [...rawStats].sort((a, b) =>
      Math.max(rankPop.get(b.idx), rankNovel.get(b.idx), rankDist.get(b.idx)) -
      Math.max(rankPop.get(a.idx), rankNovel.get(a.idx), rankDist.get(a.idx))
    );
    const labelMap = new Map();
    for (const s of sortedStats) {
      labelMap.set(s.idx, assignLabel(s));
    }

    const clustersData = rawStats.map(({ idx, members, avgDistance, avgCost, avgStops, avgNovelty, avgPopularity }) => {
      const { label, desc } = labelMap.get(idx);

      // Find medoid (closest candidate to centroid of cluster members in polar space)
      let medoid = members[0] || null;
      if (members.length > 0) {
        const meanX = members.reduce((sum, m) => sum + m.x, 0) / members.length;
        const meanY = members.reduce((sum, m) => sum + m.y, 0) / members.length;
        let minD = Infinity;
        members.forEach(m => {
          const d = (m.x - meanX)**2 + (m.y - meanY)**2;
          if (d < minD) {
            minD = d;
            medoid = m;
          }
        });
      }

      return {
        id: idx,
        label,
        desc,
        avgDistance,
        avgCost,
        avgStops,
        color: CLUSTER_PALETTE[idx % CLUSTER_PALETTE.length],
        medoid,
        membersCount: members.length
      };
    });

    return { clusteredCandidates: mapped, clusters: clustersData };
  }, [candidates, radiusMode]);

  const filteredCandidates = useMemo(() => {
    if (brushedIds.size === 0) return clusteredCandidates;
    if (viewMode === 'routes') {
      return clusteredCandidates.filter(c => brushedIds.has(c.id));
    } else {
      return clusteredCandidates.filter(c =>
        c.stops.some(stop => brushedIds.has(stop.name))
      );
    }
  }, [clusteredCandidates, brushedIds, viewMode]);  
  const [showStabilitySection, setShowStabilitySection] = useState(false);

  const updateRouteWithStops = useCallback((newStops) => {
    let totalDistance = 0;
    for (let i = 1; i < newStops.length; i++) {
      totalDistance += getDistanceKm(newStops[i-1].coords[0], newStops[i-1].coords[1], newStops[i].coords[0], newStops[i].coords[1]);
    }
    const walkingDistance = totalDistance * 0.7;

    let cost = 0;
    const categories = new Set();
    let noveltyCount = 0;
    newStops.forEach(s => {
      categories.add(s.type);
      if (!s.osmTags?.wikidata || s.isSaved) noveltyCount++;
      const type = s.type || '';
      if (type.includes('Restaurant')) cost += 25;
      else if (type.includes('Coffee')) cost += 6;
      else if (type.includes('Museum') || type.includes('Historic')) cost += 15;
      else if (type.includes('Attraction')) cost += 18;
    });

    const stopCount = newStops.length;
    const diversity = categories.size / (stopCount || 1);
    const novelty = noveltyCount / (stopCount || 1);
    
    let themeScoreSum = 0;
    const queryLower = themeText.toLowerCase();
    newStops.forEach(s => {
      let score = 0;
      const n = s.name.toLowerCase();
      const t = (s.type || '').toLowerCase();
      const desc = (s.notes || s.extract || '').toLowerCase();
      const keywords = queryLower.split(/\s+/).filter(w => w.length > 2);
      keywords.forEach(word => {
        if (n.includes(word)) score += 5;
        if (t.includes(word)) score += 4;
        if (desc.includes(word)) score += 2;
      });
      themeScoreSum += score;
    });
    const themeDensity = themeScoreSum / (stopCount || 1);

    let spread = 0;
    if (newStops.length > 0) {
      const latSum = newStops.reduce((sum, s) => sum + s.coords[0], 0);
      const lonSum = newStops.reduce((sum, s) => sum + s.coords[1], 0);
      const center = [latSum / newStops.length, lonSum / newStops.length];
      spread = newStops.reduce((sum, s) => sum + getDistanceKm(center[0], center[1], s.coords[0], s.coords[1]), 0) / newStops.length;
    }

    const updatedRoute = {
      ...routeSpaceRoute,
      stops: newStops,
      totalDistance,
      walkingDistance,
      cost,
      stopCount,
      diversity,
      novelty,
      spread,
      themeDensity,
      name: newStops.length > 0 
        ? `Custom Route: ${newStops[0].name.split(',')[0]} to ${newStops[newStops.length-1].name.split(',')[0]}`
        : 'Empty Route'
    };

    setRouteSpaceRoute(updatedRoute);
  }, [routeSpaceRoute, themeText]);

  const deleteStop = useCallback((idx) => {
    if (!routeSpaceRoute) return;
    const newStops = routeSpaceRoute.stops.filter((_, i) => i !== idx);
    updateRouteWithStops(newStops);
  }, [routeSpaceRoute, updateRouteWithStops]);

  const moveStop = useCallback((idx, direction) => {
    if (!routeSpaceRoute) return;
    const newStops = [...routeSpaceRoute.stops];
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= newStops.length) return;
    const temp = newStops[idx];
    newStops[idx] = newStops[targetIdx];
    newStops[targetIdx] = temp;
    updateRouteWithStops(newStops);
  }, [routeSpaceRoute, updateRouteWithStops]);

  const addStopToActiveRoute = useCallback((place) => {
    if (!routeSpaceRoute) return;
    if (routeSpaceRoute.stops.some(s => s.name.toLowerCase() === place.name.toLowerCase())) return;
    const newStops = [...routeSpaceRoute.stops, place];
    updateRouteWithStops(newStops);
  }, [routeSpaceRoute, updateRouteWithStops]);

  const swapStop = useCallback((idx, newPlace) => {
    if (!routeSpaceRoute) return;
    const newStops = [...routeSpaceRoute.stops];
    newStops[idx] = newPlace;
    updateRouteWithStops(newStops);
    setExpandedAlts(prev => { const s = new Set(prev); s.delete(idx); return s; });
  }, [routeSpaceRoute, updateRouteWithStops]);

  // Set up global hook for adding to active route from InfoWindow click
  useEffect(() => {
    window._addToActiveRoute = (place) => {
      addStopToActiveRoute(place);
    };
    return () => {
      delete window._addToActiveRoute;
    };
  }, [addStopToActiveRoute]);

  // Keep global route name in sync so InfoWindow can show it
  useEffect(() => {
    window._activeRouteName = routeSpaceRoute?.name || null;
  }, [routeSpaceRoute]);


  const stabilityGroups = useMemo(() => {
    if (candidates.length === 0) return { anchors: [], alternatives: [], outliers: [] };
    const counts = {};
    candidates.forEach(c => {
      (c.stops || []).forEach(s => {
        const key = s.name.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      });
    });

    const total = candidates.length;
    const items = [];
    const seen = new Set();

    candidates.forEach(c => {
      (c.stops || []).forEach(s => {
        const key = s.name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);

        const freq = counts[key] / total;
        let group = 'outlier';
        if (freq >= 0.3) group = 'anchor';
        else if (freq >= 0.1) group = 'alternative';

        items.push({
          name: s.name,
          freq,
          group,
          type: s.type
        });
      });
    });

    items.sort((a, b) => b.freq - a.freq);

    return {
      anchors: items.filter(x => x.group === 'anchor'),
      alternatives: items.filter(x => x.group === 'alternative'),
      outliers: items.filter(x => x.group === 'outlier')
    };
  }, [candidates]);

  // Point-in-polygon (ray casting)
  const pointInPolygon = useCallback((lat, lon, poly) => {
    if (!poly || poly.length < 3) return true; // no filter = include all
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi))
        inside = !inside;
    }
    return inside;
  }, []);

  // Slider-based route scoring: rank candidates by proximity to slider targets
  const sliderTopMatches = useMemo(() => {
    if (!clusteredCandidates.length) return [];

    const typeCount = (stops, types) => (stops || []).filter(s => types.some(t => (s.type||'').toLowerCase().includes(t))).length;

    return [...clusteredCandidates]
      .filter(c => {
        if (!spatialFilter.length) return true;
        return (c.stops || []).some(s => pointInPolygon(s.coords[0], s.coords[1], spatialFilter));
      })
      .map(c => {
        const n = Math.max(1, c.stopCount);
        const localScore   = (c.novelty || 0) * 100;
        const compactScore = Math.max(0, 100 - Math.min((c.spread || 0) * 25, 100));
        const themeScore   = Math.min(100, (c.themeDensity || 0) * 10);
        const socialScore  = Math.min(100, (typeCount(c.stops, ['restaurant','cafe','coffee','bar']) / n) * 200);
        const museumsScore = Math.min(100, (typeCount(c.stops, ['museum','art','historic','castle']) / n) * 200);
        const foodScore    = Math.min(100, (typeCount(c.stops, ['restaurant','food','cafe','coffee']) / n) * 200);
        const parksScore   = Math.min(100, (typeCount(c.stops, ['park','nature','hiking','trail','viewpoint','beach']) / n) * 200);
        const shopScore    = Math.min(100, (typeCount(c.stops, ['shop','mall','shopping','market']) / n) * 200);
        const dist = Math.abs(localScore - navSliders.local)
          + Math.abs(compactScore - navSliders.compact)
          + Math.abs(themeScore   - navSliders.theme)
          + Math.abs(socialScore  - navSliders.social)
          + Math.abs(museumsScore - typeSliders.museums)
          + Math.abs(foodScore    - typeSliders.food)
          + Math.abs(parksScore   - typeSliders.parks)
          + Math.abs(shopScore    - typeSliders.shopping);
        // Lively = food/social stops + places sources call crowded; calm = the opposite
        const crowded = (c.stops || []).filter(st => isCrowded(st.name)).length / n;
        const lively = Math.min(100, socialScore * 0.5 + crowded * 100 * 0.7 + (100 - compactScore) * 0.1);
        const vibeDist = vibe == null ? 0 : Math.abs(lively - vibe) * 1.5;
        return { ...c, _sliderDist: dist + vibeDist, _lively: Math.round(lively) };
      })
      .sort((a, b) => a._sliderDist - b._sliderDist)
      .slice(0, 5);
  }, [clusteredCandidates, navSliders, typeSliders, spatialFilter, pointInPolygon, vibe, isCrowded]);

  const sliderMatchIds = useMemo(() => new Set(sliderTopMatches.map(m => m.id)), [sliderTopMatches]);

  useEffect(() => {
    if (sliderTopMatches && sliderTopMatches.length > 0) {
      setRouteSpaceRoute(sliderTopMatches[0]);
    }
  }, [sliderTopMatches, setRouteSpaceRoute]);

  // Quick O(1) lookup: stop name → 'anchor' | 'alternative' | 'outlier'
  const stabilityLookup = useMemo(() => {
    const map = {};
    stabilityGroups.anchors.forEach(s => { map[s.name.toLowerCase()] = 'anchor'; });
    stabilityGroups.alternatives.forEach(s => { map[s.name.toLowerCase()] = 'alternative'; });
    stabilityGroups.outliers.forEach(s => { map[s.name.toLowerCase()] = 'outlier'; });
    return map;
  }, [stabilityGroups]);

  // Sync state changes back to Storage
  useEffect(() => {
    localStorage.setItem('routespace_theme', themeText);
  }, [themeText]);

  useEffect(() => {
    sessionStorage.setItem('routespace_candidates', JSON.stringify(candidates));
  }, [candidates]);


  useEffect(() => {
    localStorage.setItem('routespace_radius_mode', radiusMode);
  }, [radiusMode]);

  // Calculate stop stability map across all candidates
  useEffect(() => {
    if (candidates.length === 0) {
      setStopStabilityMap({});
      return;
    }
    const counts = {};
    candidates.forEach(c => {
      (c.stops || []).forEach(s => {
        const key = s.name.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    
    const total = candidates.length;
    const stabilityMap = {};
    candidates.forEach(c => {
      (c.stops || []).forEach(s => {
        const key = s.name.toLowerCase();
        const freq = counts[key] / total;
        let category = 'outlier';
        if (freq >= 0.3) category = 'anchor';
        else if (freq >= 0.1) category = 'alternative';
        
        stabilityMap[key] = {
          frequency: freq,
          category,
          name: s.name
        };
      });
    });
    setStopStabilityMap(stabilityMap);
  }, [candidates, setStopStabilityMap]);


  useEffect(() => {
    localStorage.setItem('routespace_show_help', showHelp.toString());
  }, [showHelp]);

  useEffect(() => {
    localStorage.setItem('routespace_radar_axes', JSON.stringify(radarAxisKeys));
  }, [radarAxisKeys]);

  useEffect(() => {
    localStorage.setItem('routespace_min_stops', minStops.toString());
    localStorage.setItem('routespace_max_stops', maxStops.toString());
  }, [minStops, maxStops]);

  useEffect(() => {
    const handler = (e) => setSpatialFilter(e.detail || []);
    window.addEventListener('routespace-polygon', handler);
    return () => window.removeEventListener('routespace-polygon', handler);
  }, []);

  // Build local places pool
  const placesPool = useMemo(() => {
    if (!activeCity) return [];
    const pool = [];
    (activeCity.places || []).forEach(p => {
      if (p && p.coords && Array.isArray(p.coords) && p.coords.length >= 2 && typeof p.coords[0] === 'number' && typeof p.coords[1] === 'number') {
        pool.push({ ...p, isSaved: true });
      }
    });
    (activeCity.recommendations || []).forEach(p => {
      if (p && p.coords && Array.isArray(p.coords) && p.coords.length >= 2 && typeof p.coords[0] === 'number' && typeof p.coords[1] === 'number') {
        if (!pool.some(x => x.name.toLowerCase() === p.name.toLowerCase())) {
          pool.push({ ...p, isSaved: false });
        }
      }
    });
    return pool;
  }, [activeCity]);

  const placesConstellation = useMemo(() => {
    if (placesPool.length === 0) return [];
    
    // In sparse focus mode, only calculate bounds and project selected brushed items
    const activePool = (sparseFocusActive && brushedIds.size > 0 && viewMode === 'places')
      ? placesPool.filter(p => brushedIds.has(p.name))
      : placesPool;

    if (activePool.length === 0) return [];

    const lats = activePool.map(p => p.coords[0]);
    const lons = activePool.map(p => p.coords[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const latSpan = (maxLat - minLat) || 0.001;
    const lonSpan = (maxLon - minLon) || 0.001;
    const scaleX = 270 / lonSpan;
    const scaleY = 220 / latSpan;
    const scale = Math.min(scaleX, scaleY) * 0.98;
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    
    const arr = activePool.map(p => {
      const q = scorePlaceQuality(p);
      return {
        ...p,
        px: (p.coords[1] - centerLon) * scale,
        py: -(p.coords[0] - centerLat) * scale,
        qualityScore: typeof q === 'number' ? q : 5,
      };
    });
    
    arr.centerLon = centerLon;
    arr.centerLat = centerLat;
    arr.scale = scale;
    return arr;
  }, [placesPool, sparseFocusActive, brushedIds, viewMode]);

  const presentCategories = useMemo(() => {
    const seen = new Set();
    placesConstellation.forEach(p => {
      seen.add(getTypeDetails(p.type).label);
    });
    return seen;
  }, [placesConstellation]);

  const brushedPlaces = useMemo(() => {
    if (viewMode !== 'places' || brushedIds.size === 0) return [];
    return placesConstellation.filter(p => brushedIds.has(p.name));
  }, [placesConstellation, brushedIds, viewMode]);

  const getSvgCoords = useCallback((e, containerEl) => {
    if (!containerEl) return { x: 0, y: 0 };
    const rect = containerEl.getBoundingClientRect();
    const pctX = (e.clientX - rect.left) / rect.width;
    const pctY = (e.clientY - rect.top) / rect.height;
    const svgX = -145 + pctX * 290;
    const svgY = -120 + pctY * 240;
    return {
      x: (svgX - pan.x) / zoom,
      y: (svgY - pan.y) / zoom
    };
  }, [pan, zoom]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const container = svgContainerRef.current;
    if (brushActive || e.shiftKey) {
      const coords = getSvgCoords(e, container);
      setBrushStart(coords);
      setBrushEnd(coords);
    } else {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan, brushActive, getSvgCoords]);

  const handleMouseMove = useCallback((e) => {
    const container = svgContainerRef.current;
    if (brushStart) {
      const coords = getSvgCoords(e, container);
      setBrushEnd(coords);
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  }, [isPanning, panStart, brushStart, getSvgCoords]);

  const handleMouseUp = useCallback(() => {
    if (brushStart && brushEnd) {
      const x1 = Math.min(brushStart.x, brushEnd.x);
      const x2 = Math.max(brushStart.x, brushEnd.x);
      const y1 = Math.min(brushStart.y, brushEnd.y);
      const y2 = Math.max(brushStart.y, brushEnd.y);
      const dist = Math.sqrt((brushStart.x - brushEnd.x) ** 2 + (brushStart.y - brushEnd.y) ** 2);
      if (dist > 3) {
        const selected = new Set();
        if (viewMode === 'routes') {
          clusteredCandidates.forEach(c => {
            if (c.x >= x1 && c.x <= x2 && c.y >= y1 && c.y <= y2) {
              selected.add(c.id);
            }
          });
        } else {
          placesConstellation.forEach(p => {
            if (p.px >= x1 && p.px <= x2 && p.py >= y1 && p.py <= y2) {
              selected.add(p.name);
            }
          });
        }
        setBrushedIds(selected);
      }
      setBrushStart(null);
      setBrushEnd(null);
    }
    setIsPanning(false);
  }, [brushStart, brushEnd, viewMode, clusteredCandidates, placesConstellation]);

  // Generate route candidates procedurally
  const generateRouteSpace = useCallback(() => {
    if (placesPool.length < 3) return;

    const routes = [];
    const queryLower = themeText.toLowerCase();
    const hasTheme = queryLower.trim().length > 2;

    // 1. Helper to score stops based on query text match
    const getThemeScore = (place) => {
      let score = 0;
      const n = place.name.toLowerCase();
      const t = (place.type || '').toLowerCase();
      const desc = (place.notes || place.extract || '').toLowerCase();

      const keywords = queryLower.split(/\s+/).filter(w => w.length > 2);
      keywords.forEach(word => {
        if (n.includes(word)) score += 5;
        if (t.includes(word)) score += 4;
        if (desc.includes(word)) score += 2;
      });

      // Boost categories in ENTITY_PROFILES matching keywords
      Object.keys(ENTITY_PROFILES).forEach(k => {
        if (queryLower.includes(k.toLowerCase()) && t.includes(k.toLowerCase())) {
          score += 3;
        }
      });
      return score;
    };

    // Calculate place quality and theme relevance once
    const scoredPool = placesPool.map(p => ({
      ...p,
      themeScore: getThemeScore(p),
      qualityScore: scorePlaceQuality(p) || 2
    }));

    const reqLimits = categoryReqs || {};

    const countCategories = (stops) => {
      const counts = {};
      aiInterests.forEach(c => counts[c] = 0);
      stops.forEach(s => {
        if (s.type && counts[s.type] !== undefined) {
           counts[s.type]++;
        }
      });
      return counts;
    };

    const getPlaceCategory = (place) => {
      if (place.type && aiInterests.includes(place.type)) return place.type;
      return null;
    };

    // Diversity validator helper
    const canAddPlace = (stopsList, place) => {
      const currentCounts = countCategories(stopsList);
      const cat = getPlaceCategory(place);

      if (cat) {
        const req = reqLimits[cat];
        if (req > 0) {
          // If a user specifically asked for N, don't exceed N
          if (currentCounts[cat] >= req) return false;
        } else {
          // Default caps if no specific requirement
          // Limit any single category to roughly 1 or 2 to force variety if no hard requirement
          if (currentCounts[cat] >= 2) return false;
        }
      }
      return true;
    };

    const applyRequirementBoost = (candidates, stops) => {
      const currentCounts = countCategories(stops);
      const missingCategories = Object.keys(reqLimits).filter(k => reqLimits[k] > 0 && currentCounts[k] < reqLimits[k]);
      candidates.forEach(c => {
        const cat = getPlaceCategory(c.place);
        if (cat && missingCategories.includes(cat)) {
          c.score = (c.score || 0) + 200; // massive boost to prioritize needed categories
        }
      });
    };

    // 2-opt post-processing: iteratively swap route segments to remove crossings
    const applyTwoOpt = (stops) => {
      if (stops.length <= 3) return stops;
      const d = (a, b) => getDistanceKm(a.coords[0], a.coords[1], b.coords[0], b.coords[1]);
      let best = [...stops];
      let improved = true;
      let iters = 0;
      while (improved && iters++ < 15) {
        improved = false;
        for (let i = 0; i < best.length - 2; i++) {
          for (let j = i + 2; j < best.length; j++) {
            const jNext = j + 1 < best.length ? j + 1 : null;
            const before = d(best[i], best[i + 1]) + (jNext ? d(best[j], best[jNext]) : 0);
            const after  = d(best[i], best[j])     + (jNext ? d(best[i + 1], best[jNext]) : 0);
            if (after < before - 0.05) {
              best = [...best.slice(0, i + 1), ...best.slice(i + 1, j + 1).reverse(), ...best.slice(j + 1)];
              improved = true;
            }
          }
        }
      }
      return best;
    };

    // Strategy 1: Compact Landmark Loops (greedy proximity TSP)
    const generateCompact = (noise = 0) => {
      const stops = [];
      const visited = new Set();
      // Start with a high quality spot, preferring sights/attractions over dining/cafes
      const pool = [...scoredPool].sort((a, b) => (b.qualityScore + (hasTheme ? b.themeScore : 0)) - (a.qualityScore + (hasTheme ? a.themeScore : 0)));
      const sightsStart = pool.filter(p => p.type !== 'Restaurants' && p.type !== 'Coffee');
      const startPool = sightsStart.length > 0 ? sightsStart : pool;
      let curr = startPool[Math.floor(Math.random() * Math.min(5, startPool.length))];
      if (!curr) return null;
      stops.push(curr);
      visited.add(curr.name.toLowerCase());

      const targetCount = minStops + Math.floor(Math.random() * Math.max(1, maxStops - minStops + 1));
      while (stops.length < targetCount) {
        // Find closest unvisited places
        let candidates = scoredPool
          .filter(p => !visited.has(p.name.toLowerCase()))
          .map(p => ({
            place: p,
            dist: getDistanceKm(curr.coords[0], curr.coords[1], p.coords[0], p.coords[1]),
            score: p.themeScore
          }));

        if (!candidates.length) break;

        // Apply diversity filter
        const diverse = candidates.filter(c => canAddPlace(stops, c.place));
        const poolToSelectRaw = diverse.length > 0 ? diverse : candidates;

        // Select closest with some noise jitter, preferring nearby within 5km to avoid huge jumps
        const nearby = poolToSelectRaw.filter(c => c.dist <= 5.0);
        const poolToSelect = nearby.length > 0 ? nearby : poolToSelectRaw;
        
        applyRequirementBoost(poolToSelect, stops);
        
        // Sort by score descending (so massive boosts hit the front), then by distance
        poolToSelect.sort((a, b) => b.score - a.score || a.dist - b.dist);
        
        const idx = Math.min(poolToSelect.length - 1, Math.floor(Math.random() * (1 + noise)));
        curr = poolToSelect[idx].place;
        stops.push(curr);
        visited.add(curr.name.toLowerCase());
      }
      return applyTwoOpt(stops);
    };

    // Strategy 2: Local Discoveries (low popularity, high novelty)
    const generateLocal = () => {
      const stops = [];
      const visited = new Set();
      // Start with a lower quality / custom / saved place, preferring non-dining
      const localPool = scoredPool.filter(p => !p.osmTags?.wikidata || p.isSaved);
      const pool = localPool.length > 0 ? localPool : scoredPool;
      const sightsLocal = pool.filter(p => p.type !== 'Restaurants' && p.type !== 'Coffee');
      const startPool = sightsLocal.length > 0 ? sightsLocal : pool;
      let curr = startPool[Math.floor(Math.random() * startPool.length)];
      if (!curr) return null;
      stops.push(curr);
      visited.add(curr.name.toLowerCase());

      const targetCount = minStops + Math.floor(Math.random() * Math.max(1, maxStops - minStops + 1));
      while (stops.length < targetCount) {
        let candidates = pool
          .filter(p => !visited.has(p.name.toLowerCase()))
          .map(p => ({
            place: p,
            dist: getDistanceKm(curr.coords[0], curr.coords[1], p.coords[0], p.coords[1])
          }));

        if (!candidates.length) break;

        // Apply diversity filter
        const diverse = candidates.filter(c => canAddPlace(stops, c.place));
        const poolToSelectRaw = diverse.length > 0 ? diverse : candidates;

        const nearby = poolToSelectRaw.filter(c => c.dist <= 5.0);
        const poolToSelect = nearby.length > 0 ? nearby : poolToSelectRaw;
        
        applyRequirementBoost(poolToSelect, stops);
        
        poolToSelect.sort((a, b) => b.score - a.score || (a.dist * 1.5 + a.place.qualityScore * 0.1) - (b.dist * 1.5 + b.place.qualityScore * 0.1));

        curr = poolToSelect[0].place;
        stops.push(curr);
        visited.add(curr.name.toLowerCase());
      }
      return applyTwoOpt(stops);
    };

    // Strategy 3: Outdoor Scenic Routes (parks, beaches, viewpoints)
    const generateScenic = () => {
      const stops = [];
      const visited = new Set();
      const scenicPool = scoredPool.filter(p => 
        p.type === 'Parks' || p.type === 'Hiking' || p.type === 'Beaches' || p.type === 'Viewpoints' || p.type === 'Camping'
      );
      const pool = scenicPool.length > 2 ? scenicPool : scoredPool;
      let curr = pool[Math.floor(Math.random() * pool.length)];
      if (!curr) return null;
      stops.push(curr);
      visited.add(curr.name.toLowerCase());

      const targetCount = minStops + Math.floor(Math.random() * Math.max(1, maxStops - minStops + 1));
      while (stops.length < targetCount) {
        let candidates = pool
          .filter(p => !visited.has(p.name.toLowerCase()))
          .map(p => ({
            place: p,
            dist: getDistanceKm(curr.coords[0], curr.coords[1], p.coords[0], p.coords[1]),
            score: p.themeScore
          }));

        if (!candidates.length) break;

        // Apply diversity filter
        const diverse = candidates.filter(c => canAddPlace(stops, c.place));
        const poolToSelectRaw = diverse.length > 0 ? diverse : candidates;

        const nearby = poolToSelectRaw.filter(c => c.dist <= 5.0);
        const poolToSelect = nearby.length > 0 ? nearby : poolToSelectRaw;
        
        applyRequirementBoost(poolToSelect, stops);
        
        poolToSelect.sort((a, b) => b.score - a.score || a.dist - b.dist);
        curr = poolToSelect[0].place;
        stops.push(curr);
        visited.add(curr.name.toLowerCase());
      }
      return applyTwoOpt(stops);
    };

    // Strategy 4: Theme Dedicated
    // Strategy 4: Theme Dedicated
    const generateThemeFocused = () => {
      const stops = [];
      const visited = new Set();
      // Sort pool strictly by theme score
      const themePool = [...scoredPool].sort((a, b) => b.themeScore - a.themeScore);
      let curr = themePool[0];
      if (!curr || curr.themeScore <= 0) {
        // Fallback: pick any random high quality spot (preferring non-dining)
        const sightsPool = scoredPool.filter(p => p.type !== 'Restaurants' && p.type !== 'Coffee');
        const startPool = sightsPool.length > 0 ? sightsPool : scoredPool;
        curr = startPool[Math.floor(Math.random() * Math.min(5, startPool.length))];
      }
      if (!curr) return null;
      stops.push(curr);
      visited.add(curr.name.toLowerCase());

      const targetCount = minStops + Math.floor(Math.random() * Math.max(1, maxStops - minStops + 1));
      while (stops.length < targetCount) {
        let candidates = scoredPool
          .filter(p => !visited.has(p.name.toLowerCase()))
          .map(p => ({
            place: p,
            dist: getDistanceKm(curr.coords[0], curr.coords[1], p.coords[0], p.coords[1]),
            score: p.themeScore
          }));

        if (!candidates.length) break;

        // Apply diversity filter
        const diverse = candidates.filter(c => canAddPlace(stops, c.place));
        const poolToSelectRaw = diverse.length > 0 ? diverse : candidates;

        const nearby = poolToSelectRaw.filter(c => c.dist <= 5.0);
        const poolToSelect = nearby.length > 0 ? nearby : poolToSelectRaw;
        
        applyRequirementBoost(poolToSelect, stops);
        
        // Sort by theme score descending, then distance ascending to avoid huge jumps
        poolToSelect.sort((a, b) => b.score - a.score || a.dist - b.dist);
        curr = poolToSelect[0].place;
        stops.push(curr);
        visited.add(curr.name.toLowerCase());
      }
      return applyTwoOpt(stops);
    };

    // Generate 120 raw routes, filter to top 100 unique routes
    const generatedRaw = [];
    for (let i = 0; i < 120; i++) {
      let routeStops = [];
      if (hasTheme) {
        // If user entered a theme, heavily bias toward theme generation
        if (i % 10 < 6) routeStops = generateThemeFocused(); // 60%
        else if (i % 10 < 8) routeStops = generateCompact(2); // 20%
        else if (i % 10 === 8) routeStops = generateLocal(); // 10%
        else routeStops = generateScenic(); // 10%
      } else {
        // Uniform distribution if no specific theme requested
        if (i % 4 === 0) routeStops = generateCompact(2);
        else if (i % 4 === 1) routeStops = generateLocal();
        else if (i % 4 === 2) routeStops = generateScenic();
        else routeStops = generateThemeFocused();
      }

      if (routeStops && routeStops.length >= 3) {
        generatedRaw.push(routeStops);
      }
    }

    // Keep unique routes by stop names sequence
    const uniqueRoutesMap = new Map();
    generatedRaw.forEach(stops => {
      const signature = stops.map(s => s.name).join('->');
      if (!uniqueRoutesMap.has(signature)) {
        uniqueRoutesMap.set(signature, stops);
      }
    });

    const uniqueStopsLists = Array.from(uniqueRoutesMap.values()).slice(0, 100);

    // Calculate features for each candidate route
    const candidatesData = uniqueStopsLists.map((stops, idx) => {
      let totalDistance = 0;
      let cost = 0;
      const categories = new Set();
      let themeScoreSum = 0;
      let qualitySum = 0;
      let noveltyCount = 0;

      for (let i = 0; i < stops.length; i++) {
        const s = stops[i];
        categories.add(s.type);
        themeScoreSum += s.themeScore;
        qualitySum += s.qualityScore;
        if (!s.osmTags?.wikidata || s.isSaved) noveltyCount++;

        if (i > 0) {
          totalDistance += getDistanceKm(stops[i-1].coords[0], stops[i-1].coords[1], s.coords[0], s.coords[1]);
        }

        // Simulate cost based on type
        const type = s.type || '';
        if (type.includes('Restaurant')) cost += 25;
        else if (type.includes('Coffee')) cost += 6;
        else if (type.includes('Museum') || type.includes('Historic')) cost += 15;
        else if (type.includes('Attraction')) cost += 18;
      }

      // Calculate spatial spread (variance from centroid)
      const latSum = stops.reduce((sum, s) => sum + s.coords[0], 0);
      const lonSum = stops.reduce((sum, s) => sum + s.coords[1], 0);
      const center = [latSum / stops.length, lonSum / stops.length];
      const spread = stops.reduce((sum, s) => sum + getDistanceKm(center[0], center[1], s.coords[0], s.coords[1]), 0) / stops.length;

      const stopCount = stops.length;
      const walkingDistance = totalDistance * 0.7; // Estimated walking portion
      const diversity = categories.size / stopCount;
      const novelty = noveltyCount / stopCount;
      const popularity = qualitySum / stopCount;
      const themeDensity = themeScoreSum / stopCount;

      // Feature array order: distance, cost, stops, diversity, novelty, popularity, spread, themeDensity
      const features = [totalDistance, cost, stopCount, diversity, novelty, popularity, spread, themeDensity];

      return {
        id: `route-${idx}`,
        stops,
        features,
        totalDistance,
        walkingDistance,
        cost,
        stopCount,
        diversity,
        novelty,
        popularity,
        spread,
        themeDensity,
        name: `${stops[0].name.split(',')[0]} to ${stops[stops.length-1].name.split(',')[0]} loop`
      };
    });

    if (candidatesData.length < 5) return;

    // Save outputs
    setCandidates(candidatesData);
    setRouteSpaceRoute(candidatesData[0]);
  }, [placesPool, themeText, minStops, maxStops, setRouteSpaceRoute]);

  // Initial generation / re-initialization of missing selections
  useEffect(() => {
    if (placesPool.length >= 3) {
      if (candidates.length === 0) {
        generateRouteSpace();
      } else {
        if (!routeSpaceRoute) setRouteSpaceRoute(candidates[0]);
      }
    }
  }, [placesPool, candidates, routeSpaceRoute, generateRouteSpace]);

  const handleManualPlaceSearch = async () => {
    const q = manualSearchQuery.trim();
    if (!q) return;
    setIsSearchingManual(true);
    try {
      const queryStr = activeCity ? `${q}, ${activeCity.name}` : q;
      const results = await searchNominatim(queryStr);
      let topResult = results?.[0];
      
      if (!topResult) {
        const globalResults = await searchNominatim(q);
        topResult = globalResults?.[0];
      }

      if (topResult) {
        const lat = parseFloat(topResult.lat);
        const lon = parseFloat(topResult.lon);
        const address = topResult.display_name;
        const nameParts = address.split(', ');
        
        const newPlace = {
          id: topResult.place_id || topResult.osm_id || Date.now(),
          name: nameParts[0] || q,
          type: topResult.class || topResult.type || 'Sight',
          coords: [lat, lon],
          extract: `Added via manual name search: ${address}`,
          isSaved: true,
          osmTags: {
            address: address,
            wikidata: topResult.extratags?.wikidata || null
          }
        };

        if (activeCity) {
          setTripData(prev => ({
            ...prev,
            locations: prev.locations.map(loc => 
              loc.id !== activeCity.id 
                ? loc 
                : {
                    ...loc,
                    places: [...loc.places.filter(p => p.name.toLowerCase() !== newPlace.name.toLowerCase()), newPlace]
                  }
            )
          }));
        }

        addStopToActiveRoute(newPlace);
        setManualSearchQuery('');
      } else {
        if (activeCity) {
          const newPlace = {
            id: Date.now(),
            name: q,
            type: 'Sight',
            coords: [...activeCity.coords],
            extract: `Manually added custom placeholder place`,
            isSaved: true
          };
          setTripData(prev => ({
            ...prev,
            locations: prev.locations.map(loc => 
              loc.id !== activeCity.id 
                ? loc 
                : {
                    ...loc,
                    places: [...loc.places.filter(p => p.name.toLowerCase() !== newPlace.name.toLowerCase()), newPlace]
                  }
            )
          }));
          addStopToActiveRoute(newPlace);
          setManualSearchQuery('');
          alert(`Could not find "${q}" online. Added as custom place at the city center.`);
        } else {
          alert(`Could not find "${q}" online and no destination is active.`);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error searching for place. Please check your network.');
    } finally {
      setIsSearchingManual(false);
    }
  };

  // Render HTML5 Canvas Scatterplot
  // SVG Constellation mouse interaction is handled directly inline in SVG elements.

  // Relocated useMemo for clusteredCandidates to top of file

  // Apply morphed route directly into user itinerary
  const applyMorphedRouteToTrip = () => {
    if (!routeSpaceRoute) return;

    const itinDay = {
      id: Date.now(),
      date: `Day ${tripData.itinerary.length + 1} (RouteSpace)`,
      location: activeCity?.name || 'Trip',
      events: routeSpaceRoute.stops.map((s, idx) => ({
        id: Date.now() + 100 + idx,
        time: `${9 + idx}:30`,
        title: s.name + (s.notes ? `, ${s.notes}` : ''),
        type: s.type || 'activity'
      }))
    };

    setTripData(prev => ({ ...prev, itinerary: [...prev.itinerary, itinDay] }));
    setAppliedSuccess(true);
    setTimeout(() => setAppliedSuccess(false), 4000);
  };

  const computeMutation = useCallback((mutationType) => {
    if (!routeSpaceRoute || placesPool.length === 0) return null;
    const stops = routeSpaceRoute.stops;
    const usedNames = new Set(stops.map(s => s.name.toLowerCase()));
    const pool = placesPool.filter(p => !usedNames.has(p.name.toLowerCase()));

    const nearbyAlt = (fromStop, filterFn) => pool
      .filter(filterFn)
      .map(p => ({ p, d: getDistanceKm(fromStop.coords[0], fromStop.coords[1], p.coords[0], p.coords[1]) }))
      .filter(x => x.d < 5)
      .sort((a, b) => a.d - b.d)[0]?.p;

    if (mutationType === 'reorder') {
      if (stops.length <= 2) return null;
      const first = stops[0];
      const last = stops[stops.length - 1];
      let remaining = stops.slice(1, -1);
      const newMiddle = [];
      let curr = first;
      while (remaining.length > 0) {
        const nearest = remaining.reduce((best, s) => {
          const d = getDistanceKm(curr.coords[0], curr.coords[1], s.coords[0], s.coords[1]);
          return d < best.d ? { s, d } : best;
        }, { s: remaining[0], d: Infinity });
        newMiddle.push(nearest.s);
        remaining = remaining.filter(s => s !== nearest.s);
        curr = nearest.s;
      }
      const newStops = [first, ...newMiddle, last];
      const oldDist = stops.reduce((sum, s, i) => i > 0 ? sum + getDistanceKm(stops[i-1].coords[0], stops[i-1].coords[1], s.coords[0], s.coords[1]) : sum, 0);
      const newDist = newStops.reduce((sum, s, i) => i > 0 ? sum + getDistanceKm(newStops[i-1].coords[0], newStops[i-1].coords[1], s.coords[0], s.coords[1]) : sum, 0);
      if (oldDist - newDist < 0.05) return null;
      return { mutationType, newStops, targetStop: null, replacement: null,
        reason: `Reorder stops for a more efficient walking path`,
        savings: `saves ~${(oldDist - newDist).toFixed(2)} km`,
        diff: stops.map((s, i) => ({ gene: `Stop ${i+1}`, original: s.name, mutation: newStops[i]?.name || s.name, kept: s.name === newStops[i]?.name })) };
    }

    if (mutationType === 'local') {
      const targets = stops
        .map((s, i) => ({ s, i, score: (s.osmTags?.wikidata && !s.isSaved) ? 1 : 0 }))
        .filter(x => x.score > 0).sort((a, b) => b.score - a.score);
      if (!targets.length) return null;
      const { s: target, i: ti } = targets[0];
      const rep = nearbyAlt(target, p => !p.osmTags?.wikidata || p.isSaved);
      if (!rep) return null;
      return { mutationType, newStops: stops.map((s, i) => i === ti ? rep : s), targetStop: target, replacement: rep,
        reason: `Replace a well-known landmark with a more local, off-the-beaten-path stop`,
        diff: [{ gene: 'Replaced', original: target.name, mutation: rep.name, kept: false }] };
    }

    if (mutationType === 'theme') {
      const kws = themeText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const score = s => kws.reduce((n, w) => n + (s.name.toLowerCase().includes(w) ? 3 : 0) + ((s.type||'').toLowerCase().includes(w) ? 2 : 0), 0);
      const targets = stops.map((s, i) => ({ s, i, score: score(s) })).sort((a, b) => a.score - b.score);
      const { s: target, i: ti } = targets[0];
      const rep = pool
        .map(p => ({ p, score: score(p), d: getDistanceKm(target.coords[0], target.coords[1], p.coords[0], p.coords[1]) }))
        .filter(x => x.score > targets[0].score && x.d < 5)
        .sort((a, b) => b.score - a.score || a.d - b.d)[0]?.p;
      if (!rep) return null;
      return { mutationType, newStops: stops.map((s, i) => i === ti ? rep : s), targetStop: target, replacement: rep,
        reason: `Replace the least thematic stop with one that better matches "${themeText.slice(0, 35)}…"`,
        diff: [{ gene: 'Theme upgrade', original: target.name, mutation: rep.name, kept: false }] };
    }

    if (mutationType === 'compact') {
      const cLat = stops.reduce((s, p) => s + p.coords[0], 0) / stops.length;
      const cLon = stops.reduce((s, p) => s + p.coords[1], 0) / stops.length;
      const farthest = stops.map((s, i) => ({ s, i, d: getDistanceKm(cLat, cLon, s.coords[0], s.coords[1]) })).sort((a, b) => b.d - a.d)[0];
      if (farthest.d < 1.0) return null;
      const rep = pool
        .map(p => ({ p, d: getDistanceKm(cLat, cLon, p.coords[0], p.coords[1]) }))
        .filter(x => x.d < farthest.d * 0.65)
        .sort((a, b) => a.d - b.d)[0]?.p;
      if (!rep) return null;
      return { mutationType, newStops: stops.map((s, i) => i === farthest.i ? rep : s), targetStop: farthest.s, replacement: rep,
        reason: `Remove the geographic outlier to tighten the spatial footprint`,
        diff: [{ gene: 'Compacted', original: farthest.s.name, mutation: rep.name, kept: false }] };
    }

    if (mutationType === 'unusual') {
      const anchors = stops.map((s, i) => ({ s, i, cat: stabilityLookup[s.name.toLowerCase()] }))
        .filter(x => x.cat === 'anchor').sort(() => 0);
      if (!anchors.length) return null;
      const { s: target, i: ti } = anchors[0];
      const outlierPool = pool.filter(p => stabilityLookup[p.name.toLowerCase()] === 'outlier' || !p.osmTags?.wikidata || p.isSaved);
      const rep = nearbyAlt(target, p => outlierPool.includes(p));
      if (!rep) return null;
      return { mutationType, newStops: stops.map((s, i) => i === ti ? rep : s), targetStop: target, replacement: rep,
        reason: `Swap a common landmark for a rarer, less-visited discovery`,
        diff: [{ gene: 'Discovery swap', original: target.name, mutation: rep.name, kept: false }] };
    }

    if (mutationType === 'social') {
      const socialTypes = ['restaurant', 'cafe', 'coffee', 'bar', 'market', 'food'];
      const nonSocial = stops.map((s, i) => ({ s, i }))
        .filter(x => !socialTypes.some(t => (x.s.type||'').toLowerCase().includes(t))).slice(-1)[0];
      if (!nonSocial) return null;
      const rep = nearbyAlt(nonSocial.s, p => socialTypes.some(t => (p.type||'').toLowerCase().includes(t)));
      if (!rep) return null;
      return { mutationType, newStops: stops.map((s, i) => i === nonSocial.i ? rep : s), targetStop: nonSocial.s, replacement: rep,
        reason: `Add a food or social stop by swapping a non-social place`,
        diff: [{ gene: 'Social add', original: nonSocial.s.name, mutation: rep.name, kept: false }] };
    }

    return null;
  }, [routeSpaceRoute, placesPool, themeText, stabilityLookup]);

  const getPercentageString = (val, max = 20) => {
    return `${Math.min(100, Math.round((val / max) * 100))}%`;
  };

  if (placesPool.length < 3) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-secondary)' }}>
        <HelpCircle size={32} style={{ color: 'var(--accent-primary)', marginBottom: '1rem', opacity: 0.8 }} />
        <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Destination Loaded</h4>
        <p style={{ fontSize: '0.8rem', lineHeight: 1.6, maxWidth: '280px', margin: '0 auto' }}>
          Routes are built from the places of a city. Open <strong>Explore</strong>, pick a city in your trip and let it load its places, then come back here.
        </p>
        {onOpenTab && <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => onOpenTab('locations')}>Open Explore</button>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'0.88rem', fontWeight:'700', color:'var(--text-primary)' }}>
          <Compass size={15} className="spin" style={{ color:'var(--accent-primary)' }}/> Route Multiverse
          {candidates.length > 0 && <span style={{ fontSize:'0.65rem', color:'var(--text-secondary)', fontWeight:'400', marginLeft:'4px' }}>{candidates.length} routes · {clusters.length} clusters</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
          <button className="btn-primary" onClick={() => setIsFullscreen(true)} style={{ fontSize:'0.64rem', padding:'3px 8px', borderRadius:'6px', display:'flex', alignItems:'center', gap:'3px', background:'rgba(139,92,246,0.18)', border:'1px solid rgba(139,92,246,0.3)', color:'#c4b5fd', cursor:'pointer' }}>
            ⛶ Expand
          </button>
          <button className="btn-icon" onClick={() => setShowHelp(h => !h)} style={{ padding:'3px' }}>
            <HelpCircle size={13} style={{ color: showHelp ? 'var(--accent-primary)' : 'var(--text-secondary)' }}/>
          </button>
        </div>
      </div>
      {showHelp && (
        <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', padding:'10px 12px', fontSize:'0.71rem', color:'var(--text-secondary)', lineHeight:1.5 }}>
          Generate routes → dots appear in the map below, grouped by experience type. <strong style={{color:'var(--text-primary)'}}>Click two dots</strong> to set A and B. Drag the <strong style={{color:'#c084fc'}}>morph slider</strong> to blend between them. The colored rhythm strip shows the day's stop sequence, each color = a place type.
        </div>
      )}

      {/* Multiverse, three big sliders that reshape the route on the map live */}
      {candidates.length > 0 && (() => {
        const best = sliderTopMatches[0];
        const cultureFood = Math.round((typeSliders.food + (100 - typeSliders.museums)) / 2);
        const universes = [
          { key: 'cf', left: '🏛️ Culture', right: 'Food 🍜', value: cultureFood, set: v => setTypeSliders(prev => ({ ...prev, museums: 100 - v, food: v })) },
          { key: 'ih', left: '📸 Iconic', right: 'Hidden 🗝️', value: navSliders.local, set: v => setNavSliders(prev => ({ ...prev, local: v })) },
          { key: 'cl', left: '🌿 Calm', right: 'Lively 🎉', value: vibe ?? 50, set: v => setVibe(v) },
        ];
        const anchors = (stabilityGroups?.anchors || []).slice(0, 5);
        return (
          <div className="multiverse">
            <div className="multiverse-head">
              <span>🌌 Route multiverse</span>
              <button type="button" onClick={() => { const r = () => Math.round(Math.random() * 100); setTypeSliders(prev => { const v = r(); return { ...prev, museums: 100 - v, food: v }; }); setNavSliders(prev => ({ ...prev, local: r() })); setVibe(r()); }}>🎲 Surprise me</button>
            </div>
            {universes.map(u => (
              <label key={u.key} className="multiverse-row">
                <span>{u.left}</span>
                <input type="range" min="0" max="100" value={u.value} onChange={e => u.set(Number(e.target.value))} aria-label={`${u.left} to ${u.right}`} />
                <span>{u.right}</span>
              </label>
            ))}
            {best && (
              <div className="multiverse-now">
                In this universe: <b>{best.name}</b> · {best.stopCount} stops · {best.totalDistance?.toFixed?.(1)} km{best._lively != null ? ` · ${best._lively > 60 ? 'lively' : best._lively < 35 ? 'calm' : 'balanced'}` : ''}
              </div>
            )}
            {anchors.length > 0 && (
              <div className="multiverse-anchors">
                <span>Survives every universe:</span>
                {anchors.map(a => <em key={a.name}>{a.name}</em>)}
              </div>
            )}
          </div>
        );
      })()}

      {/* Route Recipe, unified generation card */}
      <div style={{ background:'linear-gradient(160deg,rgba(139,92,246,0.08),rgba(59,130,246,0.05))', border:'1px solid rgba(139,92,246,0.3)', borderRadius:'14px', padding:'14px', display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>

        {/* Header row: title + stops range */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:'0.66rem', fontWeight:'700', color:'#c084fc', textTransform:'uppercase', letterSpacing:'0.07em', display:'flex', alignItems:'center', gap:'5px' }}>
            <Sparkles size={11}/> Route Recipe
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.66rem', color:'var(--text-secondary)' }}>
            <span>Stops:</span>
            <input type="number" min="2" max="10" value={minStops}
              onChange={e => setMinStops(Math.max(2, Math.min(Number(e.target.value), maxStops)))}
              style={{ width:'38px', textAlign:'center', fontSize:'0.72rem', padding:'3px 4px', background:'rgba(30,20,60,0.8)', border:'1px solid rgba(139,92,246,0.4)', borderRadius:'5px', color:'#e2e8f0', fontWeight:'600' }}/>
            <span style={{ opacity:0.5 }}>-</span>
            <input type="number" min="2" max="10" value={maxStops}
              onChange={e => setMaxStops(Math.max(minStops, Math.min(10, Number(e.target.value))))}
              style={{ width:'38px', textAlign:'center', fontSize:'0.72rem', padding:'3px 4px', background:'rgba(30,20,60,0.8)', border:'1px solid rgba(139,92,246,0.4)', borderRadius:'5px', color:'#e2e8f0', fontWeight:'600' }}/>
          </div>
        </div>

        {/* Theme prompt */}
        <div style={{ position:'relative' }}>
          <input
            type="text"
            value={themeText}
            onChange={e => setThemeText(e.target.value)}
            placeholder="Describe your trip theme (e.g. gothic walk, hidden cafes)…"
            style={{ fontSize:'0.82rem', padding:'0.5rem 2rem 0.5rem 0.8rem', width:'100%', borderRadius:'8px', border:'1px solid rgba(139,92,246,0.35)', background:'rgba(0,0,0,0.25)', color:'var(--text-primary)' }}
            onKeyDown={e => e.key === 'Enter' && generateRouteSpace()}
          />
          <Search size={13} style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', opacity:0.35 }}/>
        </div>

        {/* Category constraints */}
        {INTEREST_CATEGORIES.length > 0 ? (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.06)' }}/>
              <span style={{ fontSize:'0.57rem', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>per-route constraints</span>
              <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.06)' }}/>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'5px', maxHeight:'180px', overflowY:'auto', paddingRight:'4px' }}>
              {INTEREST_CATEGORIES.map(catInfo => {
                const catVal = catInfo.value;
                const label = catInfo.label;
                const val = categoryReqs[catVal] || 0;
                return (
                  <div key={catVal} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(0,0,0,0.18)', padding:'7px 10px', borderRadius:'7px', border:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
                    <span style={{ fontSize:'0.72rem', color:'var(--text-primary)', minWidth:'64px' }}>{label}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginLeft:'10px' }}>
                      <span style={{ fontSize:'0.63rem', color: val === 0 ? 'rgba(255,255,255,0.28)' : '#a5b4fc', minWidth:'32px', textAlign:'right', fontWeight: val > 0 ? '700' : '400' }}>
                        {val === 0 ? 'Auto' : val}
                      </span>
                      <div style={{ display:'flex', alignItems:'center', gap:'3px' }}>
                        {[0,1,2,3,4,5].map(n => (
                          <button key={n} onClick={() => setCategoryReqs(prev => {
                            const next = { ...prev, [catVal]: n };
                            localStorage.setItem('routespace_cat_reqs', JSON.stringify(next));
                            return next;
                          })} style={{
                            width:'22px', height:'22px', borderRadius:'5px', cursor:'pointer',
                            border: val === n ? '1.5px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)',
                            background: val === n ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)',
                            color: val === n ? '#c084fc' : 'rgba(255,255,255,0.35)',
                            fontSize:'0.65rem', fontWeight: val === n ? '800' : '400',
                            transition:'all 0.12s', lineHeight:1,
                          }}>
                            {n === 0 ? '-' : n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ fontSize:'0.65rem', color:'var(--text-secondary)', fontStyle:'italic', textAlign:'center', padding:'2px 0' }}>
            No categories available.
          </div>
        )}

        {/* Live recipe summary */}
        {(() => {
          const activeConstraints = INTEREST_CATEGORIES.map(c => c.value).filter(c => (categoryReqs[c] || 0) > 0);
          if (!themeText && activeConstraints.length === 0) return null;
          return (
            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', padding:'6px 8px', background:'rgba(0,0,0,0.22)', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize:'0.56rem', color:'var(--text-secondary)', width:'100%', marginBottom:'2px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Generating with:</span>
              {themeText && (
                <span style={{ fontSize:'0.62rem', padding:'2px 8px', borderRadius:'10px', background:'rgba(139,92,246,0.18)', border:'1px solid rgba(139,92,246,0.3)', color:'#c084fc' }}>
                  "{themeText.length > 28 ? themeText.slice(0, 28) + '…' : themeText}"
                </span>
              )}
              <span style={{ fontSize:'0.62rem', padding:'2px 8px', borderRadius:'10px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'var(--text-secondary)' }}>
                {minStops}–{maxStops} stops
              </span>
              {activeConstraints.map(c => {
                const catInfo = INTEREST_CATEGORIES.find(x => x.value === c);
                return (
                  <span key={c} style={{ fontSize:'0.62rem', padding:'2px 8px', borderRadius:'10px', background:'rgba(99,102,241,0.18)', border:'1px solid rgba(99,102,241,0.3)', color:'#a5b4fc' }}>
                    {categoryReqs[c]}× {catInfo?.label || c}
                  </span>
                );
              })}
            </div>
          );
        })()}

        {/* Generate button */}
        <button className="btn-primary" onClick={generateRouteSpace}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'0.6rem 1rem', width:'100%', fontSize:'0.82rem', fontWeight:'700', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', borderRadius:'9px' }}>
          <Sparkles size={14}/> Generate Routes
        </button>
      </div>


      {/* Constellation */}
      <div>
        <div style={{ display:'flex', flexDirection:'column', gap:'4px', marginBottom:'6px' }}>
          {/* Row 1: label + toggle */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span className="section-label" style={{ margin:0 }}>Experience Space</span>
            <div style={{ display:'flex', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
              {[['routes','Routes'],['places','Places']].map(([m, label]) => (
                <button key={m} onClick={() => setViewMode(m)}
                  style={{ fontSize:'0.62rem', padding:'2px 8px', background: viewMode===m ? 'rgba(255,255,255,0.12)' : 'transparent', color: viewMode===m ? 'var(--text-primary)' : 'var(--text-secondary)', border:'none', cursor:'pointer', fontWeight: viewMode===m ? '700' : '400' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Row 2: axis select (routes only) */}
          {viewMode === 'routes' && (
            <div>
              <select value={radiusMode} onChange={e => setRadiusMode(e.target.value)}
                style={{ background:'rgba(8,12,26,0.85)', color:'var(--text-primary)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', fontSize:'0.64rem', padding:'2px 6px', cursor:'pointer', fontFamily:'inherit', outline:'none' }}>
                <option value="walk">Axis: Distance</option>
                <option value="budget">Axis: Budget</option>
                <option value="theme">Axis: Theme</option>
              </select>
            </div>
          )}
        </div>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1.2', background: 'rgba(8,12,26,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', overflow: 'hidden' }}>
          <svg
            viewBox="-145 -120 290 240"
            style={{ width: '100%', height: '100%', background: 'radial-gradient(circle at center, rgba(14, 20, 42, 0.4) 0%, rgba(8, 12, 26, 0.95) 100%)' }}
          >
            <defs>
              <filter id="glow-star" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="comet-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {viewMode === 'places' && (<>
            {/* Geographic grid */}
            <line x1="-130" y1="0" x2="130" y2="0" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5"/>
            <line x1="0" y1="-110" x2="0" y2="110" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5"/>

            {/* Active Route Path Overlay */}
            {routeSpaceRoute && (
              <g opacity="0.8">
                {routeSpaceRoute.stops.map((stop, sIdx) => {
                  if (sIdx === 0) return null;
                  const prev = routeSpaceRoute.stops[sIdx - 1];
                  const p1 = placesConstellation.find(pl => pl.name.toLowerCase() === prev.name.toLowerCase()) || { px: (prev.coords[1] - placesConstellation.centerLon) * placesConstellation.scale, py: -(prev.coords[0] - placesConstellation.centerLat) * placesConstellation.scale };
                  const p2 = placesConstellation.find(pl => pl.name.toLowerCase() === stop.name.toLowerCase()) || { px: (stop.coords[1] - placesConstellation.centerLon) * placesConstellation.scale, py: -(stop.coords[0] - placesConstellation.centerLat) * placesConstellation.scale };
                  return (
                    <g key={`path-${sIdx}`}>
                      <line
                        x1={p1.px} y1={p1.py}
                        x2={p2.px} y2={p2.py}
                        stroke="rgba(139, 92, 246, 0.75)"
                        strokeWidth="1.8"
                        strokeDasharray="3,3"
                      />
                      {/* Arrow marker indicator */}
                      <circle cx={(p1.px + p2.px)/2} cy={(p1.py + p2.py)/2} r="1.5" fill="#c084fc"/>
                    </g>
                  );
                })}
              </g>
            )}

            {[...placesConstellation]
              .sort((a, b) => {
                const aInRoute = routeSpaceRoute && routeSpaceRoute.stops.some(s => s.name.toLowerCase() === a.name.toLowerCase());
                const bInRoute = routeSpaceRoute && routeSpaceRoute.stops.some(s => s.name.toLowerCase() === b.name.toLowerCase());
                if (aInRoute && !bInRoute) return 1;
                if (!aInRoute && bInRoute) return -1;

                const aFiltered = legendFilters.size > 0 && !legendFilters.has(getTypeDetails(a.type).label);
                const bFiltered = legendFilters.size > 0 && !legendFilters.has(getTypeDetails(b.type).label);
                if (aFiltered && !bFiltered) return -1;
                if (!aFiltered && bFiltered) return 1;
                return 0;
              })
              .map((p, i) => {
                const { color } = getTypeDetails(p.type);
                const isHov = hoveredPlace?.name === p.name;
                
                // Find index in active route if exists
                const activeStopIdx = routeSpaceRoute ? routeSpaceRoute.stops.findIndex(s => s.name.toLowerCase() === p.name.toLowerCase()) : -1;
                const isInActiveRoute = activeStopIdx !== -1;
                
                const r = isInActiveRoute ? 4.5 : Math.max(2.5, Math.min(5.5, (p.qualityScore || 5) * 0.5));
                
                const isFiltered = legendFilters.size > 0 && !legendFilters.has(getTypeDetails(p.type).label);
              return (
                <g key={p.name || i} style={{ cursor: isFiltered ? 'default' : 'pointer', pointerEvents: isFiltered ? 'none' : 'auto' }}
                  onMouseEnter={() => setHoveredPlace(p)}
                  onMouseLeave={() => setHoveredPlace(null)}
                  onClick={() => triggerPlaceInfo(p)}
                  opacity={isFiltered ? 0.15 : 0.88}>
                  {isHov && <circle cx={p.px} cy={p.py} r={r+5} fill={color+'20'} filter="url(#glow-star)"/>}
                  
                  {/* Glowing background ring for stops on the active route */}
                  {isInActiveRoute && (
                    <circle cx={p.px} cy={p.py} r={r + 3} fill="rgba(139, 92, 246, 0.3)" stroke="#c084fc" strokeWidth="0.5" filter="url(#glow-star)"/>
                  )}

                  <circle cx={p.px} cy={p.py} r={r} fill={isInActiveRoute ? '#8b5cf6' : color} stroke={isHov || isInActiveRoute ? '#ffffff' : 'rgba(255,255,255,0.3)'} strokeWidth={isHov || isInActiveRoute ? 1 : 0.5} opacity={0.9}/>
                  
                  {/* Stop Number Badge */}
                  {isInActiveRoute && (
                    <text x={p.px} y={p.py + 1.8} fill="#ffffff" fontSize="5" fontWeight="900" textAnchor="middle">
                      {activeStopIdx + 1}
                    </text>
                  )}
                </g>
              );
            })}
            </>)}

            {viewMode === 'routes' && (<>
            {/* 2D scatter axis grid */}
            <line x1="-130" y1="0" x2="130" y2="0" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6"/>
            <line x1="0" y1="-108" x2="0" y2="108" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6"/>
            {/* X axis labels: novelty */}
            <text x="-125" y="115" fill="rgba(255,255,255,0.3)" fontSize="5" fontWeight="600" textAnchor="start">◀ Popular</text>
            <text x="125" y="115" fill="rgba(255,255,255,0.3)" fontSize="5" fontWeight="600" textAnchor="end">Local ▶</text>
            {/* Y axis labels: selected mode */}
            <text x="5" y="-100" fill="rgba(255,255,255,0.3)" fontSize="5" fontWeight="600" textAnchor="start">
              {radiusMode === 'budget' ? 'Low cost ▲' : radiusMode === 'theme' ? 'General ▲' : 'Compact ▲'}
            </text>
            <text x="5" y="112" fill="rgba(255,255,255,0.3)" fontSize="5" fontWeight="600" textAnchor="start">
              {radiusMode === 'budget' ? '▼ Expensive' : radiusMode === 'theme' ? '▼ Thematic' : '▼ Wide walk'}
            </text>

            {/* Cluster halos */}
            {clusters.map((cls, idx) => {
              const members = clusteredCandidates.filter(c => c.cluster === idx);
              if (members.length === 0) return null;
              const mx = members.reduce((s, m) => s + m.x, 0) / members.length;
              const my = members.reduce((s, m) => s + m.y, 0) / members.length;
              const maxR = members.reduce((max, m) => Math.max(max, Math.sqrt((m.x-mx)**2+(m.y-my)**2)), 0);
              return (
                <ellipse key={`halo-${idx}`} cx={mx} cy={my}
                  rx={Math.max(9, maxR + 8)} ry={Math.max(9, maxR + 8)}
                  fill={cls.color + '10'} stroke={cls.color + '25'} strokeWidth="0.8" strokeDasharray="2,3"/>
              );
            })}

            {/* Cluster centroid labels */}
            {clusters.map((cls, idx) => {
              const members = clusteredCandidates.filter(c => c.cluster === idx);
              if (members.length === 0) return null;
              const mx = members.reduce((s, m) => s + m.x, 0) / members.length;
              const my = members.reduce((s, m) => s + m.y, 0) / members.length;
              const words = cls.label.split(' ');
              const half = Math.ceil(words.length / 2);
              return (
                <text key={`lbl-${idx}`} x={mx} y={my - Math.max(9, members.reduce((max, m) => Math.max(max, Math.sqrt((m.x-mx)**2+(m.y-my)**2)), 0) + 12)}
                  fill={cls.color} fontSize="4.5" fontWeight="700" textAnchor="middle" opacity="0.75"
                  style={{ textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  <tspan x={mx} dy="0">{words.slice(0, half).join(' ')}</tspan>
                  {words.length > half && <tspan x={mx} dy="5.5">{words.slice(half).join(' ')}</tspan>}
                </text>
              );
            })}



            {/* Stars / Route Nodes */}
            {clusteredCandidates.map(c => {
              const isHovered = hoveredRoute?.id === c.id;
              const isActive = routeSpaceRoute?.id === c.id;
              const clusterColor = CLUSTER_PALETTE[c.cluster % CLUSTER_PALETTE.length];
              const starColor = isActive ? '#c084fc' : clusterColor;

              return (
                <g
                  key={c.id}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredRoute(c)}
                  onMouseLeave={() => setHoveredRoute(null)}
                  onClick={() => {
                    setRouteSpaceRoute(c);
                  }}
                >
                  {/* Slider match highlight ring */}
                  {sliderMatchIds.has(c.id) && (
                    <circle cx={c.x} cy={c.y} r="13"
                      fill="rgba(251,191,36,0.06)" stroke="rgba(251,191,36,0.4)"
                      strokeWidth="1" strokeDasharray="2,3"/>
                  )}

                  {/* Glowing background ring for active/hovered */}
                  {(isActive || isHovered) && (
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isActive ? 9 : 7}
                      fill={isActive ? '#8b5cf6' : clusterColor}
                      opacity={isActive ? 0.4 : 0.25}
                      filter="url(#glow-star)"
                    />
                  )}

                  {/* Core Star Circle */}
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={isActive ? 5.5 : 3}
                    fill={starColor}
                    stroke={isActive ? '#ffffff' : 'rgba(255,255,255,0.3)'}
                    strokeWidth={isActive ? 1.5 : 0.5}
                    style={{ transition: 'all 0.2s' }}
                  />
                </g>
              );
            })}
            </>)}
          </svg>

          {/* Floating Tooltip, Routes mode */}
          {viewMode === 'routes' && hoveredRoute && (
            <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(8,12,26,0.95)', border: `1px solid ${CLUSTER_PALETTE[hoveredRoute.cluster % CLUSTER_PALETTE.length]}70`, borderRadius: '10px', padding: '8px 10px', width: '190px', pointerEvents: 'none', boxShadow: '0 6px 20px rgba(0,0,0,0.5)', zIndex: 10 }}>
              <div style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                {hoveredRoute.name}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 6px', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                <div>Stops: <strong style={{ color: 'var(--text-primary)' }}>{hoveredRoute.stopCount}</strong></div>
                <div>Dist: <strong style={{ color: 'var(--text-primary)' }}>{hoveredRoute.totalDistance.toFixed(1)} km</strong></div>
                <div>Cost: <strong style={{ color: 'var(--text-primary)' }}>€{hoveredRoute.cost}</strong></div>
                <div>Nov: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(hoveredRoute.novelty * 100)}%</strong></div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '5px', paddingTop: '4px', fontSize: '0.58rem', color: CLUSTER_PALETTE[hoveredRoute.cluster % CLUSTER_PALETTE.length], fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Click → set A or B · previews route
              </div>
            </div>
          )}
          {/* Places hint text, outside SVG */}
          {viewMode === 'places' && (
            <div style={{ position:'absolute', bottom:'6px', left:0, right:0, pointerEvents:'none' }}>
              <div style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.28)', textAlign:'center' }}>Places shown in their real geographic positions · dot size = quality</div>
            </div>
          )}
          {/* Floating Tooltip, Places mode */}
          {viewMode === 'places' && hoveredPlace && (
            <div style={{ position:'absolute', top:'10px', right:'10px', background:'rgba(8,12,26,0.95)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'10px', padding:'8px 10px', width:'175px', pointerEvents:'none', boxShadow:'0 6px 20px rgba(0,0,0,0.5)', zIndex:10 }}>
              <div style={{ fontSize:'0.74rem', fontWeight:'700', color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'3px' }}>
                {hoveredPlace.name}
              </div>
              <div style={{ fontSize:'0.65rem', color:'var(--text-secondary)' }}>
                {hoveredPlace.type || 'Sight'}{hoveredPlace.isSaved ? ' · saved' : ''}
              </div>
              <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', marginTop:'4px', paddingTop:'4px', fontSize:'0.58rem', color:'var(--accent-primary)', fontWeight:'bold', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                Click for details
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cluster legend chips, click to open route list popup */}
      <div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'6px' }}>
          {clusters.map(cls => (
            <button key={cls.id}
              onClick={() => setClusterPopup(clusterPopup === cls.id ? null : cls.id)}
              style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.65rem', padding:'3px 8px', borderRadius:'12px', background: clusterPopup === cls.id ? cls.color+'35' : cls.color+'18', border:`1px solid ${clusterPopup === cls.id ? cls.color+'80' : cls.color+'40'}`, color:'var(--text-primary)', cursor:'pointer', fontWeight:'500', transition:'all 0.15s' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:cls.color, display:'inline-block', flexShrink:0 }}/>
              {cls.label}
              <span style={{ color:cls.color, fontWeight:'700', opacity:0.7 }}>{cls.membersCount}</span>
            </button>
          ))}
        </div>

        {/* Cluster route popup */}
        {clusterPopup !== null && (() => {
          const cls = clusters.find(c => c.id === clusterPopup);
          if (!cls) return null;
          const members = clusteredCandidates.filter(c => c.cluster === clusterPopup);
          return (
            <div style={{ background:'rgba(8,12,26,0.95)', border:`1px solid ${cls.color}40`, borderRadius:'12px', padding:'10px 12px', marginBottom:'6px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:cls.color, display:'inline-block' }}/>
                  <span style={{ fontSize:'0.74rem', fontWeight:'700', color:'var(--text-primary)' }}>{cls.label}</span>
                  <span style={{ fontSize:'0.64rem', color:'var(--text-secondary)' }}>{members.length} routes, click any row to preview, then set as A or B</span>
                </div>
                <button className="btn-icon" style={{ padding:'2px' }} onClick={() => setClusterPopup(null)}><X size={11}/></button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'4px', maxHeight:'220px', overflowY:'auto', paddingRight:'2px' }}>
                {members.map(m => {
                  const isActive = routeSpaceRoute?.id === m.id;
                  return (
                    <div key={m.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px', borderRadius:'8px', background: isActive ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)', border:`1px solid ${isActive ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.04)'}`, cursor:'pointer' }}
                      onClick={() => setRouteSpaceRoute(m)}>
                      <div style={{ flex:1, minWidth:0, marginRight:'8px' }}>
                        <div style={{ fontSize:'0.72rem', fontWeight:'600', color: isActive ? 'var(--accent-light)' : 'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {m.name}
                        </div>
                        <div style={{ fontSize:'0.6rem', color:'var(--text-secondary)', marginTop:'1px', marginBottom:'3px' }}>
                          {m.stopCount} stops · {m.totalDistance.toFixed(1)}km · €{m.cost}
                        </div>
                        <JourneyRhythm stops={m.stops} height={5}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Route collections ({brushedIds.size > 0 ? `${filteredCandidates.length} / ${candidates.length} selected` : `${candidates.length} options`})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {clusters.map(cls => {
              const filteredMembers = filteredCandidates.filter(c => c.cluster === cls.id);
              if (filteredMembers.length === 0 && brushedIds.size > 0) return null;
              
              return (
                <div key={cls.id} style={{ background: 'rgba(255,255,255,0.01)', border: `1px solid ${activeClusterTab === cls.id ? cls.color + '40' : 'rgba(255,255,255,0.04)'}`, borderRadius: '10px', overflow: 'hidden' }}>
                  <div 
                    onClick={() => setActiveClusterTab(activeClusterTab === cls.id ? null : cls.id)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', background: activeClusterTab === cls.id ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: cls.color }} />
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: '0.76rem', fontWeight: '600', color: 'var(--text-primary)' }}>{cls.label}</span>
                        <span style={{ display: 'block', fontSize: '0.62rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cls.desc}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                        <strong>{filteredMembers.length}</strong>{brushedIds.size > 0 ? ` / ${cls.membersCount}` : ''} options
                      </span>
                      <ChevronRight size={13} style={{ transform: activeClusterTab === cls.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', opacity: 0.5 }} />
                    </div>
                  </div>

                  {activeClusterTab === cls.id && (
                    <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: 'var(--text-secondary)', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span>Average stats:</span>
                        <span>Stops: <strong>{cls.avgStops.toFixed(1)}</strong> · Dist: <strong>{cls.avgDistance.toFixed(1)} km</strong> · Cost: <strong>€{Math.round(cls.avgCost)}</strong></span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                        {filteredMembers.map(m => {
                          const isActive = routeSpaceRoute?.id === m.id;
                          const isMedoid = cls.medoid?.id === m.id;
                        return (
                          <div 
                            key={m.id} 
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'flex-start', 
                              padding: '8px 10px', 
                              borderRadius: '8px', 
                              background: isActive ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.02)', 
                              border: `1px solid ${isActive ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.03)'}`,
                              cursor: 'pointer',
                              transition: 'background 0.15s'
                            }}
                            onClick={() => setRouteSpaceRoute(m)}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: '600', color: isActive ? 'var(--accent-light)' : 'var(--text-primary)', lineHeight: '1.3', wordBreak: 'break-word' }}>
                                {m.name}
                                {isMedoid && (
                                  <span style={{ fontSize: '0.58rem', color: '#fbbf24', marginLeft: '6px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', padding: '0 4px', borderRadius: '4px', display: 'inline-block', fontWeight: 'bold' }}>
                                    ★ Recommended
                                  </span>
                                )}
                              </span>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                                {m.stopCount} stops · {m.totalDistance.toFixed(1)} km · €{m.cost}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Stop Stability - hidden, logic kept for map pins */}

      {/* Active Route */}
      {routeSpaceRoute && (
        <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'14px', padding:'12px 14px' }}>
          {/* Header, makes clear THIS is what "Add to Active Route ◈" modifies */}
          <div style={{ display:'flex', alignItems:'center', gap:'5px', marginBottom:'4px' }}>
            <span style={{ fontSize:'0.6rem', fontWeight:'700', color:'#c084fc', textTransform:'uppercase', letterSpacing:'0.06em' }}>◈ Active Route</span>
            <span style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.25)' }}>what "Add to Active Route" edits</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
            <span style={{ fontSize:'0.75rem', fontWeight:'700', color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, minWidth:0 }}>{routeSpaceRoute.name}</span>
            <div style={{ display:'flex', gap:'8px', fontSize:'0.65rem', color:'var(--text-secondary)', flexShrink:0, marginLeft:'8px', alignItems:'center' }}>
              <span>{routeSpaceRoute.stopCount} stops</span>
              <span>{routeSpaceRoute.totalDistance.toFixed(1)} km</span>
              <span>€{routeSpaceRoute.cost}</span>
              {setShowRouteOnMap && (
                <button
                  onClick={() => setShowRouteOnMap(v => !v)}
                  title={showRouteOnMap ? 'Hide route on map' : 'Show route on map'}
                  style={{ padding:'2px 7px', borderRadius:'6px', border:'1px solid rgba(255,255,255,0.12)', background: showRouteOnMap ? 'rgba(192,132,252,0.18)' : 'rgba(255,255,255,0.05)', color: showRouteOnMap ? '#c084fc' : 'rgba(255,255,255,0.3)', fontSize:'0.6rem', cursor:'pointer', fontWeight:'600', letterSpacing:'0.03em', lineHeight:1 }}>
                  {showRouteOnMap ? '● on map' : '○ hidden'}
                </button>
              )}
            </div>
          </div>
          {/* Tab strip */}
          <div style={{ display:'flex', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden', marginBottom:'10px' }}>
            {[['overview','Overview'],['stops','Stops']].map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveRouteTab(tab)}
                style={{ flex:1, fontSize:'0.64rem', padding:'5px 0', background: activeRouteTab===tab ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeRouteTab===tab ? 'var(--text-primary)' : 'var(--text-secondary)', border:'none', cursor:'pointer', fontWeight: activeRouteTab===tab ? '700' : '400' }}>
                {label}
              </button>
            ))}
          </div>

          {/* OVERVIEW TAB: Rhythm + Fingerprint */}
          {activeRouteTab === 'overview' && (<>
            <JourneyRhythm stops={routeSpaceRoute.stops} height={12}/>
            <RhythmLegend stopsArrays={[routeSpaceRoute.stops]}/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px', marginTop:'10px' }}>
              {[
                { name:'Landmarks',   val: Math.min(10, Math.max(1,(routeSpaceRoute.popularity/16)*10)), color:'#3b82f6', desc:'Famous sights & popular attractions' },
                { name:'Hidden gems', val: routeSpaceRoute.novelty*10, color:'#10b981', desc:'Local & off-the-beaten-path stops' },
                { name:'Walkability', val: (routeSpaceRoute.walkingDistance/(routeSpaceRoute.totalDistance||1))*10, color:'#0ea5e9', desc:'How much can be done on foot' },
                { name:'Spread',      val: Math.min(10,(routeSpaceRoute.spread/4.0)*10), color:'#8b5cf6', desc:'Geographic footprint across the city' },
                { name:'Theme fit',   val: Math.min(10,routeSpaceRoute.themeDensity*2), color:'#fbbf24', desc:'Match to your goal / theme query' },
                { name:'Cost',        val: Math.min(10,(routeSpaceRoute.cost/120)*10), color:'#f97316', desc:'Estimated spend (entries + food)' },
              ].map(m => (
                <div key={m.name} style={{ padding:'5px 6px', background:'rgba(0,0,0,0.15)', borderRadius:'6px', border:'1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.62rem', marginBottom:'3px' }}>
                    <span style={{ color:'var(--text-primary)', fontWeight:'600' }}>{m.name}</span>
                    <strong style={{ color:m.color }}>{m.val.toFixed(1)}</strong>
                  </div>
                  <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:'3px', height:'4px', overflow:'hidden', marginBottom:'3px' }}>
                    <div style={{ width:`${m.val*10}%`, height:'100%', background:m.color, borderRadius:'3px' }}/>
                  </div>
                  <div style={{ fontSize:'0.55rem', color:'var(--text-secondary)', lineHeight:1.3 }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </>)}

          {/* STOPS TAB: Timeline with genome labels */}
          {activeRouteTab === 'stops' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
              <span style={{ fontSize:'0.64rem', fontWeight:'700', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Route Genome</span>
              <button onClick={() => setShowGenome(g => !g)}
                style={{ fontSize:'0.6rem', padding:'2px 6px', borderRadius:'6px', background: showGenome ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', border:`1px solid ${showGenome ? '#6366f1' : 'rgba(255,255,255,0.1)'}`, color: showGenome ? '#a5b4fc' : 'var(--text-secondary)', cursor:'pointer' }}>
                🧬 Gene labels
              </button>
            </div>

            {/* Genome view sub-toggle */}
            <div style={{ display:'flex', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden', marginBottom:'10px' }}>
              {[
                ['a', 'Route A', !!selectedRouteA],
                ['active', 'Active Mutation', true],
                ['b', 'Route B', !!selectedRouteB],
              ].map(([key, label, enabled]) => (
                <button key={key} onClick={() => enabled && setGenomeView(key)} disabled={!enabled}
                  style={{ flex:1, fontSize:'0.6rem', padding:'4px 0', background: genomeView===key ? 'rgba(255,255,255,0.1)' : 'transparent', color: !enabled ? 'rgba(255,255,255,0.2)' : genomeView===key ? 'var(--text-primary)' : 'var(--text-secondary)', border:'none', cursor: enabled ? 'pointer' : 'default', fontWeight: genomeView===key ? '700' : '400' }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', paddingLeft: '6px', marginBottom: '14px' }}>
              {((genomeView==='a' ? selectedRouteA : genomeView==='b' ? selectedRouteB : routeSpaceRoute)?.stops || []).map((stop, sIdx) => {
                const _activeStops = (genomeView==='a' ? selectedRouteA : genomeView==='b' ? selectedRouteB : routeSpaceRoute)?.stops || [];
                const { icon, color } = getTypeDetails(stop.type);
                return (
                  <div key={stop.id || sIdx} style={{ display: 'flex', gap: '10px', position: 'relative' }}>

                    {/* Vertical Connector Line */}
                    {sIdx < _activeStops.length - 1 && (
                      <div style={{ position: 'absolute', left: '10px', top: '22px', bottom: '-8px', width: '2px', background: 'rgba(255,255,255,0.06)' }} />
                    )}

                    {/* Numeric Stop Pin */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: color, color: '#ffffff', fontSize: '0.65rem', fontWeight: 'bold' }}>
                        {sIdx + 1}
                      </div>
                    </div>

                    {/* Stop Details */}
                    <div style={{ flex: 1, paddingBottom: '12px', minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div 
                          style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          onClick={() => triggerPlaceInfo(stop)}
                        >
                          {stop.name}
                        </div>
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          <span style={{ color }}>{icon}</span> {stop.type || 'Sight'}
                          {stop.distanceKm > 0 && <span>· {stop.distanceKm.toFixed(2)} km</span>}
                        </div>
                        {showGenome && (() => {
                          const genes = classifyStopGene(stop, sIdx, _activeStops, stabilityLookup, themeText);
                          return genes.length > 0 ? (
                            <div style={{ display:'flex', gap:'4px', marginTop:'4px', flexWrap:'wrap' }}>
                              {genes.map((g, gi) => (
                                <span key={gi} style={{ fontSize:'0.57rem', fontWeight:'700', color:g.color, background:g.color+'15', border:`1px solid ${g.color}35`, borderRadius:'6px', padding:'1px 6px', letterSpacing:'0.04em', textTransform:'uppercase' }}>
                                  {g.label}
                                </span>
                              ))}
                            </div>
                          ) : null;
                        })()}
                      </div>
                      
                      {/* Stop Action Buttons, only for active mutation */}
                      {genomeView === 'active' && (
                      <div style={{ display: 'flex', gap: '2px', flexShrink: 0, opacity: 0.5 }} className="stop-action-buttons">
                        <button
                          className="btn-icon"
                          style={{ padding: '2.5px', background: 'transparent', border: 'none', cursor: sIdx === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          disabled={sIdx === 0}
                          onClick={() => moveStop(sIdx, -1)}
                          title="Move Up"
                        >
                          <ChevronUp size={11} />
                        </button>
                        <button
                          className="btn-icon"
                          style={{ padding: '2.5px', background: 'transparent', border: 'none', cursor: sIdx === _activeStops.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          disabled={sIdx === _activeStops.length - 1}
                          onClick={() => moveStop(sIdx, 1)}
                          title="Move Down"
                        >
                          <ChevronDown size={11} />
                        </button>
                        <button
                          className="btn-icon"
                          title="Swap with nearby alternative"
                          style={{ padding: '2.5px', background: expandedAlts.has(sIdx) ? 'rgba(99,102,241,0.2)' : 'transparent', border: 'none', color: expandedAlts.has(sIdx) ? '#a5b4fc' : 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => setExpandedAlts(prev => {
                            const s = new Set(prev);
                            s.has(sIdx) ? s.delete(sIdx) : s.add(sIdx);
                            return s;
                          })}
                        >
                          <RefreshCw size={11} />
                        </button>
                        <button
                          className="btn-icon"
                          style={{ padding: '2.5px', background: 'transparent', border: 'none', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => deleteStop(sIdx)}
                          title="Remove Stop"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                      )}
                    </div>

                    {/* Nearby Alternatives panel */}
                    {genomeView === 'active' && expandedAlts.has(sIdx) && (() => {
                      const bucket = getTypeBucket(stop.type);
                      const usedNames = new Set(routeSpaceRoute.stops.map(s => s.name.toLowerCase()));
                      const alts = placesPool
                        .filter(p => !usedNames.has(p.name.toLowerCase()) && getTypeBucket(p.type) === bucket)
                        .map(p => ({ p, d: getDistanceKm(stop.coords[0], stop.coords[1], p.coords[0], p.coords[1]) }))
                        .filter(x => x.d < 5)
                        .sort((a, b) => a.d - b.d)
                        .slice(0, 5);
                      if (alts.length === 0) return (
                        <div style={{ marginLeft: '32px', marginBottom: '10px', fontSize: '0.65rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          No nearby alternatives of the same type in your pool.
                        </div>
                      );
                      return (
                        <div style={{ marginLeft: '32px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ fontSize: '0.58rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                            Swap with nearby {bucket}
                          </div>
                          {alts.map(({ p, d }) => {
                            const { icon: altIcon, color: altColor } = getTypeDetails(p.type);
                            return (
                              <div key={p.id || p.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '4px 8px' }}>
                                <span style={{ color: altColor, flexShrink: 0 }}>{altIcon}</span>
                                <span style={{ flex: 1, fontSize: '0.72rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{d.toFixed(1)} km</span>
                                {p.isSaved && <span style={{ fontSize: '0.55rem', color: '#facc15', flexShrink: 0 }}>★</span>}
                                <button
                                  onClick={() => swapStop(sIdx, p)}
                                  style={{ flexShrink: 0, fontSize: '0.6rem', padding: '2px 7px', borderRadius: '5px', background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc', cursor: 'pointer', fontWeight: '700' }}
                                >
                                  Swap
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

          </div>
          )}

          {/* Customize + Apply, always visible at bottom of active route card */}
          {(() => {
            const currentNames = new Set(routeSpaceRoute.stops.map(s => s.name.toLowerCase()));
            const availablePlaces = placesPool.filter(p => !currentNames.has(p.name.toLowerCase()));
            return (
              <div style={{ marginTop: '8px', marginBottom: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 10px' }}>
                <div style={{ fontSize: '0.66rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                  Customize: Add Your Own Place
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {availablePlaces.length > 0 ? (
                    <select value={placeSelectValue}
                      onChange={e => {
                        const val = e.target.value;
                        if (!val) return;
                        const place = availablePlaces.find(p => p.id.toString() === val);
                        if (place) addStopToActiveRoute(place);
                        setPlaceSelectValue('');
                      }}
                      style={{ width:'100%', background:'rgba(8,12,26,0.85)', color:'var(--text-primary)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'6px', fontSize:'0.74rem', padding:'4px 8px', cursor:'pointer' }}>
                      <option value="">Select a saved place or recommendation to insert...</option>
                      {availablePlaces.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.type || 'Sight'})</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ fontSize:'0.68rem', color:'var(--text-secondary)', fontStyle:'italic', padding:'2px 0' }}>
                      All saved places and recommendations are added.
                    </div>
                  )}
                  <div style={{ display:'flex', gap:'6px', marginTop:'4px' }}>
                    <input type="text" placeholder="Or search and add by name (e.g. Cafe Nero)..."
                      value={manualSearchQuery}
                      onChange={e => setManualSearchQuery(e.target.value)}
                      onKeyDown={async e => { if (e.key === 'Enter') { e.preventDefault(); await handleManualPlaceSearch(); } }}
                      style={{ flex:1, fontSize:'0.74rem', padding:'4px 8px', background:'rgba(8,12,26,0.6)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', color:'var(--text-primary)' }}/>
                    <button className="btn-primary" onClick={handleManualPlaceSearch} disabled={isSearchingManual}
                      style={{ fontSize:'0.72rem', padding:'4px 10px', display:'flex', alignItems:'center', gap:'4px', borderRadius:'6px', whiteSpace:'nowrap', boxShadow:'none' }}>
                      {isSearchingManual ? <Loader2 size={11} className="spin"/> : <Plus size={11}/>} Find & Add
                    </button>
                  </div>
                </div>
                <div style={{ fontSize:'0.6rem', color:'var(--text-secondary)', marginTop:'6px', fontStyle:'italic' }}>
                  Tip: Click any place on the map and tap "Add to Active Mutation ◈" to insert it into the current route. This adds to the Active Mutation, not to Route A or B.
                </div>
              </div>
            );
          })()}
          {appliedSuccess ? (
            <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'0.45rem 1rem', borderRadius:'8px', background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)', color:'#34d399', fontSize:'0.8rem', fontWeight:'600' }}>
                <Check size={14}/> Added as Day {tripData.itinerary.length}
              </div>
              {onSwitchToCalendar && (
                <button onClick={onSwitchToCalendar} style={{ flexShrink:0, padding:'0.45rem 0.8rem', borderRadius:'8px', background:'rgba(59,130,246,0.2)', border:'1px solid rgba(59,130,246,0.35)', color:'#93c5fd', fontSize:'0.75rem', fontWeight:'600', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}>
                  Open Planner <ArrowRight size={12}/>
                </button>
              )}
            </div>
          ) : (
            <button className="btn-primary" onClick={applyMorphedRouteToTrip} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'0.45rem 1rem' }}>
              <Check size={14}/> Apply to My Itinerary
            </button>
          )}

        </div>
      )}

      {/* Route Navigator, standalone collapsible section */}
      {routeSpaceRoute && (
      <div style={{ marginBottom:'12px', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', overflow:'hidden' }}>
        <button onClick={() => setShowMutationStudio(s => !s)}
          style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'transparent', border:'none', cursor:'pointer', color:'var(--text-primary)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
            <span style={{ fontSize:'0.72rem', fontWeight:'700' }}>Route Navigator</span>
            <span style={{ fontSize:'0.6rem', color:'var(--text-secondary)' }}>drag sliders · matching routes glow in constellation</span>
          </div>
          <ChevronDown size={13} style={{ transform: showMutationStudio ? 'rotate(180deg)' : 'none', transition:'transform 0.15s', opacity:0.5, flexShrink:0 }}/>
        </button>

              {showMutationStudio && (
                <div style={{ padding:'10px 12px 12px', borderTop:'1px solid rgba(255,255,255,0.05)', background:'rgba(0,0,0,0.1)' }}>
                  {spatialFilter.length > 0 && (
                    <div style={{ fontSize:'0.62rem', color:'#fbbf24', marginBottom:'8px', display:'flex', alignItems:'center', gap:'5px' }}>
                      <span>◉</span> Filtering by drawn area on map
                    </div>
                  )}

                  <div style={{ fontSize:'0.6rem', fontWeight:'700', color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' }}>Route character</div>
                  {[
                    { key:'local',   left:'Well-known spots', right:'Hidden gems',    color:'#10b981', label:'Local vs. popular'    },
                    { key:'compact', left:'Wide area',        right:'Short walks',     color:'#3b82f6', label:'Walking distance'      },
                    { key:'theme',   left:'Open/mixed',       right:'Match my theme',  color:'#f59e0b', label:'Theme focus'           },
                    { key:'social',  left:'No food stops',    right:'Food & social',   color:'#f97316', label:'Social stops'          },
                  ].map(({ key, left, right, color, label }) => (
                    <div key={key} style={{ marginBottom:'10px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'2px' }}>
                        <span style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)' }}>{left}</span>
                        <span style={{ fontSize:'0.63rem', fontWeight:'700', color }}>{label} <span style={{ fontWeight:'400', opacity:0.55 }}>{navSliders[key]}%</span></span>
                        <span style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)' }}>{right}</span>
                      </div>
                      <input type="range" min="0" max="100" value={navSliders[key]}
                        onChange={e => setNavSliders(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                        style={{ width:'100%', accentColor: color }}/>
                    </div>
                  ))}

                  <div style={{ fontSize:'0.6rem', fontWeight:'700', color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px', marginTop:'4px' }}>Place type mix</div>
                  {[
                    { key:'museums',  left:'No museums',     right:'Museum-heavy',  color:'#dc2626', label:'Museums & culture'  },
                    { key:'food',     left:'No food',         right:'Food-heavy',    color:'#f59e0b', label:'Food & cafes'       },
                    { key:'parks',    left:'No outdoors',     right:'Nature-heavy',  color:'#16a34a', label:'Parks & outdoors'   },
                    { key:'shopping', left:'No shopping',     right:'Shop-heavy',    color:'#ec4899', label:'Shopping'           },
                  ].map(({ key, left, right, color, label }) => (
                    <div key={key} style={{ marginBottom:'10px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'2px' }}>
                        <span style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)' }}>{left}</span>
                        <span style={{ fontSize:'0.63rem', fontWeight:'700', color }}>{label} <span style={{ fontWeight:'400', opacity:0.55 }}>{typeSliders[key]}%</span></span>
                        <span style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)' }}>{right}</span>
                      </div>
                      <input type="range" min="0" max="100" value={typeSliders[key]}
                        onChange={e => setTypeSliders(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                        style={{ width:'100%', accentColor: color }}/>
                    </div>
                  ))}

                  {sliderTopMatches.length > 0 && (
                    <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:'8px' }}>
                      <div style={{ fontSize:'0.62rem', color:'var(--text-secondary)', marginBottom:'5px' }}>
                        Top matches <span style={{ color:'#fbbf24' }}>◉</span> highlighted in constellation, switch to <strong>Routes</strong> tab to see them
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                        {sliderTopMatches.slice(0, 3).map(m => {
                          const isA = selectedRouteA?.id === m.id;
                          const isB = selectedRouteB?.id === m.id;
                          return (
                            <div key={m.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', borderRadius:'7px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(251,191,36,0.15)' }}>
                              <div style={{ flex:1, minWidth:0, cursor:'pointer' }} onClick={() => setRouteSpaceRoute(m)}>
                                <div style={{ fontSize:'0.68rem', color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</div>
                                <div style={{ fontSize:'0.59rem', color:'var(--text-secondary)', marginTop:'1px' }}>{m.stopCount} stops · {m.totalDistance.toFixed(1)}km · €{m.cost}</div>
                              </div>
                              <div style={{ display:'flex', gap:'3px', marginLeft:'6px' }}>
                                <button onClick={() => { setRouteSpaceRoute(m); setSelectedRouteA(m); setReplacingSlot('B'); }}
                                  style={{ fontSize:'0.6rem', padding:'2px 6px', borderRadius:'4px', background: isA ? '#3b82f6' : 'rgba(255,255,255,0.04)', color: isA ? '#fff' : 'var(--text-secondary)', border:`1px solid ${isA ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`, cursor:'pointer', fontWeight:'700' }}>A</button>
                                <button onClick={() => { setRouteSpaceRoute(m); setSelectedRouteB(m); setReplacingSlot('A'); }}
                                  style={{ fontSize:'0.6rem', padding:'2px 6px', borderRadius:'4px', background: isB ? '#10b981' : 'rgba(255,255,255,0.04)', color: isB ? '#fff' : 'var(--text-secondary)', border:`1px solid ${isB ? '#10b981' : 'rgba(255,255,255,0.08)'}`, cursor:'pointer', fontWeight:'700' }}>B</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
      )}

      {/* Fullscreen white-background TripSpace Portal Modal */}
      {isFullscreen && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: '#ffffff', color: '#1e293b',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'Inter, sans-serif', padding: '20px',
          boxSizing: 'border-box'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Compass size={22} style={{ color: '#6366f1' }}/>
              <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>Route Multiverse</span>
              <span style={{ fontSize: '0.75rem', background: '#e0e7ff', color: '#4338ca', padding: '3px 8px', borderRadius: '12px', fontWeight: '600' }}>
                {candidates.length} routes · {clusters.length} clusters
              </span>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              style={{
                background: '#f1f5f9', border: 'none', borderRadius: '6px',
                color: '#64748b', cursor: 'pointer', padding: '6px 16px',
                fontSize: '0.82rem', fontWeight: '700', transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
              onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
            >
              ✕ Close Explorer
            </button>
          </div>

          {/* Three Column Unified Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '370px 1fr 340px', gap: '20px', flex: 1, minHeight: 0 }}>
            
            {/* Column 1: Configs & Recipe (White background themed style) */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Route Recipe</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '600', color: '#475569' }}>Theme Prompt:</span>
                <input
                  type="text" value={themeText} onChange={e => setThemeText(e.target.value)}
                  placeholder="Trip theme (e.g. gothic walk, hidden cafes)…"
                  style={{ fontSize: '0.8rem', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '600', color: '#475569' }}>Stops count range:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="number" min="2" max="10" value={minStops}
                    onChange={e => setMinStops(Math.max(2, Math.min(Number(e.target.value), maxStops)))}
                    style={{ width: '54px', textAlign: 'center', fontSize: '0.75rem', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: '700', color: '#0f172a', background: '#ffffff' }}/>
                  <span style={{ opacity: 0.5 }}>-</span>
                  <input type="number" min="2" max="10" value={maxStops}
                    onChange={e => setMaxStops(Math.max(minStops, Math.min(10, Number(e.target.value))))}
                    style={{ width: '54px', textAlign: 'center', fontSize: '0.75rem', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: '700', color: '#0f172a', background: '#ffffff' }}/>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '600', color: '#475569' }}>Category constraints:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                  {INTEREST_CATEGORIES.map(cat => {
                    const val = categoryReqs[cat.value] || 0;
                    return (
                      <div key={cat.value} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '4px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#334155' }}>{cat.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button 
                            onClick={() => setCategoryReqs(prev => {
                              const next = { ...prev, [cat.value]: Math.max(0, val - 1) };
                              localStorage.setItem('routespace_cat_reqs', JSON.stringify(next));
                              return next;
                            })}
                            style={{ width: '18px', height: '18px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', color: '#64748b', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                          
                          <span style={{ fontSize: '0.68rem', fontWeight: '850', color: val > 0 ? '#4f46e5' : '#94a3b8', minWidth: '52px', textAlign: 'center' }}>
                            {val === 0 ? 'Any' : val === 5 ? '5+ stops' : `${val} stop${val > 1 ? 's' : ''}`}
                          </span>

                          <button 
                            onClick={() => setCategoryReqs(prev => {
                              const next = { ...prev, [cat.value]: Math.min(5, val + 1) };
                              localStorage.setItem('routespace_cat_reqs', JSON.stringify(next));
                              return next;
                            })}
                            style={{ width: '18px', height: '18px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', color: '#64748b', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sliders in full layout */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: '4px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Route Character Sliders</div>
                {[
                  { key: 'local', left: 'Popular', right: 'Hidden Gems', color: '#10b981', label: 'Local vs. Popular' },
                  { key: 'compact', left: 'Wide Area', right: 'Short Walks', color: '#3b82f6', label: 'Walking Distance' },
                  { key: 'theme', left: 'Mixed', right: 'Theme Focus', color: '#f59e0b', label: 'Theme Focus' },
                  { key: 'social', left: 'No Food', right: 'Food Stops', color: '#f97316', label: 'Social Stops' },
                ].map(({ key, left, right, color, label }) => (
                  <div key={key} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: '#64748b', marginBottom: '2px' }}>
                      <span>{left}</span>
                      <strong style={{ color }}>{label} ({navSliders[key]}%)</strong>
                      <span>{right}</span>
                    </div>
                    <input type="range" min="0" max="100" value={navSliders[key]}
                      onChange={e => setNavSliders(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                      style={{ width: '100%', accentColor: color }}/>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => {
                  setIsGenerating(true);
                  setJustGenerated(false);
                  setTimeout(() => {
                    generateRouteSpace();
                    setIsGenerating(false);
                    setJustGenerated(true);
                    setTimeout(() => setJustGenerated(false), 2000);
                  }, 200);
                }}
                disabled={isGenerating}
                style={{
                  background: justGenerated 
                    ? '#10b981' 
                    : isGenerating 
                      ? '#94a3b8' 
                      : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  textAlign: 'center',
                  marginTop: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(99,102,241,0.2)',
                  transition: 'all 0.2s'
                }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={14} className="spin" /> Generating...
                  </>
                ) : justGenerated ? (
                  <>✓ Generated successfully!</>
                ) : (
                  <>Generate Route Space</>
                )}
              </button>
            </div>

            {/* Column 2: Large Map/Constellation View (White background themed style) */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc', padding: '16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexShrink: 0 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0f172a' }}>Experience Constellation</span>
                <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '8px', padding: '2px' }}>
                  {[['routes', 'Routes Space'], ['places', 'Geographic Places']].map(([m, label]) => (
                    <button key={m} onClick={() => setViewMode(m)}
                      style={{ fontSize: '0.65rem', padding: '4px 12px', border: 'none', borderRadius: '6px', background: viewMode === m ? '#ffffff' : 'transparent', color: viewMode === m ? '#0f172a' : '#64748b', fontWeight: '600', cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div ref={svgContainerRef} style={{ flex: 1, minHeight: 0, position: 'relative', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', background: '#ffffff', cursor: isPanning ? 'grabbing' : 'grab' }}>
                <svg
                  viewBox="-145 -120 290 240"
                  style={{ width: '100%', height: '100%' }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <defs>
                    <filter id="glow-star" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="2.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Wrapper group applying pan and zoom transforms */}
                  <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {viewMode === 'places' && (<>
                      <line x1="-130" y1="0" x2="130" y2="0" stroke="rgba(0,0,0,0.07)" strokeWidth="0.5"/>
                      <line x1="0" y1="-110" x2="0" y2="110" stroke="rgba(0,0,0,0.07)" strokeWidth="0.5"/>

                      {/* Active Route Path Overlay */}
                      {routeSpaceRoute && (
                        <g opacity="0.75">
                          {routeSpaceRoute.stops.map((stop, sIdx) => {
                            if (sIdx === 0) return null;
                            const prev = routeSpaceRoute.stops[sIdx - 1];
                            const p1 = placesConstellation.find(pl => pl.name.toLowerCase() === prev.name.toLowerCase()) || { px: (prev.coords[1] - placesConstellation.centerLon) * placesConstellation.scale, py: -(prev.coords[0] - placesConstellation.centerLat) * placesConstellation.scale };
                            const p2 = placesConstellation.find(pl => pl.name.toLowerCase() === stop.name.toLowerCase()) || { px: (stop.coords[1] - placesConstellation.centerLon) * placesConstellation.scale, py: -(stop.coords[0] - placesConstellation.centerLat) * placesConstellation.scale };
                            return (
                              <g key={`modal-path-${sIdx}`}>
                                <line
                                  x1={p1.px} y1={p1.py}
                                  x2={p2.px} y2={p2.py}
                                  stroke="rgba(99, 102, 241, 0.85)"
                                  strokeWidth="1.8"
                                  strokeDasharray="3,3"
                                />
                                <circle cx={(p1.px + p2.px)/2} cy={(p1.py + p2.py)/2} r="1.5" fill="#6366f1"/>
                              </g>
                            );
                          })}
                        </g>
                      )}

                      {[...placesConstellation]
                        .sort((a, b) => {
                          const aInRoute = routeSpaceRoute && routeSpaceRoute.stops.some(s => s.name.toLowerCase() === a.name.toLowerCase());
                          const bInRoute = routeSpaceRoute && routeSpaceRoute.stops.some(s => s.name.toLowerCase() === b.name.toLowerCase());
                          if (aInRoute && !bInRoute) return 1;
                          if (!aInRoute && bInRoute) return -1;

                          const aFiltered = (brushedIds.size > 0 && !brushedIds.has(a.name)) || (legendFilters.size > 0 && !legendFilters.has(getTypeDetails(a.type).label));
                          const bFiltered = (brushedIds.size > 0 && !brushedIds.has(b.name)) || (legendFilters.size > 0 && !legendFilters.has(getTypeDetails(b.type).label));
                          if (aFiltered && !bFiltered) return -1;
                          if (!aFiltered && bFiltered) return 1;
                          return 0;
                        })
                        .map((p, i) => {
                          const { color } = getTypeDetails(p.type);
                          const isHov = hoveredPlace?.name === p.name;
                          
                          // Find index in active route if exists
                          const activeStopIdx = routeSpaceRoute ? routeSpaceRoute.stops.findIndex(s => s.name.toLowerCase() === p.name.toLowerCase()) : -1;
                          const isInActiveRoute = activeStopIdx !== -1;
                          
                          const placeLabel = getTypeDetails(p.type).label;
                          const isFilteredOut = (brushedIds.size > 0 && !brushedIds.has(p.name)) || (legendFilters.size > 0 && !legendFilters.has(placeLabel));
                          const r = isInActiveRoute ? 4.8 : Math.max(2.5, Math.min(5.5, (p.qualityScore || 5) * 0.5));
                        
                        return (
                          <g key={p.name || i} style={{ cursor: isFilteredOut ? 'default' : 'pointer', pointerEvents: isFilteredOut ? 'none' : 'auto' }}
                            onMouseEnter={() => setHoveredPlace(p)}
                            onMouseLeave={() => setHoveredPlace(null)}
                            onClick={() => triggerPlaceInfo(p)}
                            opacity={isFilteredOut ? 0.15 : 0.88}>
                            {isHov && <circle cx={p.px} cy={p.py} r={r + 5} fill={color + '30'} filter="url(#glow-star)"/>}
                            
                            {/* Glowing ring for active route stops */}
                            {isInActiveRoute && (
                              <circle cx={p.px} cy={p.py} r={r + 3.2} fill="rgba(99, 102, 241, 0.28)" stroke="#818cf8" strokeWidth="0.5" filter="url(#glow-star)"/>
                            )}

                            <circle cx={p.px} cy={p.py} r={r} fill={isInActiveRoute ? '#4f46e5' : color} stroke={isHov || isInActiveRoute ? '#0f172a' : 'rgba(0,0,0,0.15)'} strokeWidth={isHov || isInActiveRoute ? 1.2 : 0.5}/>
                            
                            {/* Stop Number Badge */}
                            {isInActiveRoute && (
                              <text x={p.px} y={p.py + 1.8} fill="#ffffff" fontSize="5" fontWeight="900" textAnchor="middle">
                                {activeStopIdx + 1}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </>)}

                    {viewMode === 'routes' && (<>
                      {/* 2D scatter axes */}
                      <line x1="-130" y1="0" x2="130" y2="0" stroke="rgba(0,0,0,0.08)" strokeWidth="0.6"/>
                      <line x1="0" y1="-108" x2="0" y2="108" stroke="rgba(0,0,0,0.08)" strokeWidth="0.6"/>
                      <text x="-125" y="116" fill="rgba(0,0,0,0.3)" fontSize="5" fontWeight="600" textAnchor="start">◀ Popular</text>
                      <text x="125" y="116" fill="rgba(0,0,0,0.3)" fontSize="5" fontWeight="600" textAnchor="end">Local ▶</text>
                      <text x="4" y="-100" fill="rgba(0,0,0,0.3)" fontSize="5" fontWeight="600">
                        {radiusMode === 'budget' ? 'Low cost ▲' : radiusMode === 'theme' ? 'General ▲' : 'Compact ▲'}
                      </text>
                      <text x="4" y="113" fill="rgba(0,0,0,0.3)" fontSize="5" fontWeight="600">
                        {radiusMode === 'budget' ? '▼ Expensive' : radiusMode === 'theme' ? '▼ Thematic' : '▼ Wide walk'}
                      </text>

                      {/* Dynamic Sparse Focus Coordinates & Halos Render Block */}
                      {(() => {
                        const selectedMembers = clusteredCandidates.filter(c => brushedIds.has(c.id));
                        const xs = selectedMembers.map(c => c.x);
                        const ys = selectedMembers.map(c => c.y);
                        const minX = xs.length > 0 ? Math.min(...xs) : -100;
                        const maxX = xs.length > 0 ? Math.max(...xs) : 100;
                        const minY = ys.length > 0 ? Math.min(...ys) : -80;
                        const maxY = ys.length > 0 ? Math.max(...ys) : 80;
                        const xSpan = (maxX - minX) || 10;
                        const ySpan = (maxY - minY) || 10;
                        
                        const getCoords = (c) => {
                          if (sparseFocusActive && brushedIds.size > 0) {
                            const normX = (c.x - minX) / xSpan;
                            const normY = (c.y - minY) / ySpan;
                            return { x: -110 + normX * 220, y: -90 + normY * 180 };
                          }
                          return { x: c.x, y: c.y };
                        };

                        return (<>
                          {/* Cluster halos - only show if not in sparse focus */}
                          {!sparseFocusActive && clusters.map((cls, idx) => {
                            const members = clusteredCandidates.filter(c => c.cluster === idx);
                            if (members.length === 0) return null;
                            const mx = members.reduce((s, m) => s + m.x, 0) / members.length;
                            const my = members.reduce((s, m) => s + m.y, 0) / members.length;
                            const maxR = members.reduce((max, m) => Math.max(max, Math.sqrt((m.x-mx)**2+(m.y-my)**2)), 0);
                            return (
                              <ellipse key={`whalo-${idx}`} cx={mx} cy={my}
                                rx={Math.max(9, maxR + 8)} ry={Math.max(9, maxR + 8)}
                                fill={cls.color + '12'} stroke={cls.color + '35'} strokeWidth="0.8" strokeDasharray="2,3"/>
                            );
                          })}

                          {clusteredCandidates.map(c => {
                            const isFilteredOut = brushedIds.size > 0 && !brushedIds.has(c.id);
                            if (sparseFocusActive && isFilteredOut) return null; // Hide in sparse focus!
                            
                            const pos = getCoords(c);
                            const isActive = routeSpaceRoute?.id === c.id;
                            const isHov = hoveredRoute?.id === c.id;
                            const clusterColor = CLUSTER_PALETTE[c.cluster % CLUSTER_PALETTE.length];
                            const starColor = isActive ? '#6d28d9' : clusterColor;
                            
                            return (
                              <g key={c.id} style={{ cursor: 'pointer' }}
                                onMouseEnter={() => setHoveredRoute(c)}
                                onMouseLeave={() => setHoveredRoute(null)}
                                onClick={() => setRouteSpaceRoute(c)}
                                opacity={sparseFocusActive ? 1.0 : isFilteredOut ? 0.15 : 0.9}>
                                {(isActive || isHov) && <circle cx={pos.x} cy={pos.y} r="9" fill={starColor} opacity="0.18" filter="url(#glow-star)"/>}
                                <circle cx={pos.x} cy={pos.y} r={isActive ? 6 : isHov ? 5 : 3.5} fill={starColor} stroke={isActive ? '#6d28d9' : isHov ? '#0f172a' : 'rgba(0,0,0,0.2)'} strokeWidth={isActive ? 1.5 : 0.8}/>
                              </g>
                            );
                          })}
                        </>);
                      })()}
                    </>)}

                    {/* Rendering the active Selection Brush Box */}
                    {brushStart && brushEnd && (
                      <rect
                        x={Math.min(brushStart.x, brushEnd.x)}
                        y={Math.min(brushStart.y, brushEnd.y)}
                        width={Math.abs(brushStart.x - brushEnd.x)}
                        height={Math.abs(brushStart.y - brushEnd.y)}
                        fill="rgba(99, 102, 241, 0.12)"
                        stroke="#6366f1"
                        strokeWidth="0.8"
                        strokeDasharray="2,2"
                      />
                    )}
                  </g>
                </svg>

                {/* Floating Clear Selection Pill & Sparse Focus Toggle */}
                {brushedIds.size > 0 && (
                  <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 25, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => { setBrushedIds(new Set()); setSparseFocusActive(false); }} style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '20px', color: '#991b1b', fontSize: '0.68rem', fontWeight: '700', padding: '4px 12px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Clear Brush Selection ({brushedIds.size}) ✕
                    </button>
                    <button onClick={() => setSparseFocusActive(!sparseFocusActive)} 
                      style={{ 
                        background: sparseFocusActive ? 'linear-gradient(135deg, #10b981, #059669)' : '#ffffff',
                        border: sparseFocusActive ? 'none' : '1px solid #cbd5e1', 
                        borderRadius: '20px', 
                        color: sparseFocusActive ? '#ffffff' : '#475569', 
                        fontSize: '0.68rem', 
                        fontWeight: '700', 
                        padding: '4px 14px', 
                        cursor: 'pointer', 
                        boxShadow: '0 2px 6px rgba(0,0,0,0.05)', 
                        transition: 'all 0.15s'
                      }}
                    >
                      {sparseFocusActive ? '✓ Sparse Focus Active' : 'Sparse Focus Mode'}
                    </button>
                  </div>
                )}

                {/* Floating zoom control buttons */}
                <div style={{ position: 'absolute', bottom: '10px', right: '10px', display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.92)', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '3px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', zIndex: 20 }}>
                  <button onClick={() => setBrushActive(!brushActive)} title="Toggle Selection Brush Mode (or Shift+Drag)" style={{ border: 'none', background: brushActive ? '#6366f1' : 'none', color: brushActive ? '#ffffff' : '#475569', fontWeight: '800', fontSize: '0.68rem', padding: '0 8px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', transition: 'all 0.15s' }}>
                    Brush
                  </button>
                  <button onClick={() => setZoom(z => Math.min(8, z * 1.25))} title="Zoom In" style={{ border: 'none', background: 'none', color: '#0f172a', fontWeight: 'bold', fontSize: '0.9rem', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>+</button>
                  <button onClick={() => setZoom(z => Math.max(0.5, z * 0.8))} title="Zoom Out" style={{ border: 'none', background: 'none', color: '#0f172a', fontWeight: 'bold', fontSize: '0.9rem', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>-</button>
                  <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setBrushedIds(new Set()); }} title="Reset View & Selection" style={{ border: 'none', background: 'none', color: '#64748b', fontWeight: 'bold', fontSize: '0.78rem', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>⟲</button>
                </div>

                {/* Hover tooltip for places mode */}
                {viewMode === 'places' && hoveredPlace && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,255,255,0.97)', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '9px 12px', width: '190px', pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 10 }}>
                    <div style={{ fontSize: '0.73rem', fontWeight: '800', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>{hoveredPlace.name}</div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{hoveredPlace.type || 'Sight'}</div>
                    <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '5px', paddingTop: '4px', fontSize: '0.6rem', color: '#4f46e5', fontWeight: '700' }}>Click to view details</div>
                  </div>
                )}

                {/* Hover tooltip for routes mode */}
                {viewMode === 'routes' && hoveredRoute && !routeSpaceRoute && (
                  <div style={{ position:'absolute', top:'10px', right:'10px', background:'rgba(255,255,255,0.97)', border:`1px solid ${CLUSTER_PALETTE[hoveredRoute.cluster % CLUSTER_PALETTE.length]}60`, borderRadius:'10px', padding:'9px 12px', width:'190px', pointerEvents:'none', boxShadow:'0 4px 16px rgba(0,0,0,0.1)', zIndex:10 }}>
                    <div style={{ fontSize:'0.73rem', fontWeight:'800', color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'3px' }}>{hoveredRoute.name}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 8px', fontSize:'0.63rem', color:'#64748b' }}>
                      <div>Stops <strong style={{color:'#0f172a'}}>{hoveredRoute.stopCount}</strong></div>
                      <div>Dist <strong style={{color:'#0f172a'}}>{hoveredRoute.totalDistance.toFixed(1)} km</strong></div>
                      <div>Cost <strong style={{color:'#0f172a'}}>€{hoveredRoute.cost}</strong></div>
                      <div>Local <strong style={{color:'#0f172a'}}>{Math.round(hoveredRoute.novelty*100)}%</strong></div>
                    </div>
                    <div style={{ marginTop:'5px', fontSize:'0.6rem', color: CLUSTER_PALETTE[hoveredRoute.cluster % CLUSTER_PALETTE.length], fontWeight:'700' }}>
                      {clusters.find(cl => cl.id === hoveredRoute.cluster)?.label}
                    </div>
                  </div>
                )}

                {/* Floating selected route chip */}
                {viewMode === 'routes' && routeSpaceRoute && (
                  <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(255,255,255,0.95)', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '7px 12px', maxWidth: '200px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', zIndex: 15 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{routeSpaceRoute.name}</div>
                    <div style={{ fontSize: '0.62rem', color: '#64748b', marginTop: '2px' }}>
                      {routeSpaceRoute.stopCount} stops · {routeSpaceRoute.totalDistance.toFixed(1)} km · €{routeSpaceRoute.cost}
                    </div>
                  </div>
                )}
              </div>

              {/* Informative Legend & Explainer Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f5f9', borderRadius: '8px', padding: '10px 14px', marginTop: '8px', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                {viewMode === 'routes' ? (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.66rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginRight: '4px' }}>Clusters:</span>
                      {clusters.map(cl => (
                        <div key={cl.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', color: '#0f172a', fontWeight: '600' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cl.color, display: 'inline-block' }}/>
                          {cl.label}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', textAlign: 'right', maxWidth: '300px', lineHeight: '1.3' }}>
                      <strong>Projection:</strong> projecting all generated itineraries. <strong>Horizontal:</strong> popular vs. off-the-beaten-path. <strong>Vertical:</strong> walking distance scale.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.66rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginRight: '4px' }}>Legend:</span>
                      {[
                        { label: 'Food', color: '#f59e0b' },
                        { label: 'Cafes', color: '#d97706' },
                        { label: 'Museums', color: '#dc2626' },
                        { label: 'Parks', color: '#16a34a' },
                        { label: 'Shopping', color: '#ec4899' },
                        { label: 'Sights', color: '#0ea5e9' },
                        { label: 'Historic', color: '#92400e' },
                        { label: 'Hiking', color: '#16a34a' },
                        { label: 'Views', color: '#0ea5e9' },
                        { label: 'Beaches', color: '#06b6d4' },
                        { label: 'Camping', color: '#84cc16' },
                      ].filter(cat => presentCategories.has(cat.label))
                       .map(cat => {
                        const isActive = legendFilters.has(cat.label);
                        const isAnyActive = legendFilters.size > 0;
                        const isDisabled = (cat.label === 'Shopping' && legendFilters.has('Cafes')) || (cat.label === 'Cafes' && legendFilters.has('Shopping'));
                        return (
                          <button key={cat.label} 
                            disabled={isDisabled}
                            onClick={() => setLegendFilters(prev => {
                              const next = new Set(prev);
                              if (next.has(cat.label)) {
                                next.delete(cat.label);
                              } else {
                                next.add(cat.label);
                              }
                              return next;
                            })}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem',
                              color: '#0f172a', fontWeight: '700', cursor: isDisabled ? 'not-allowed' : 'pointer',
                              background: isActive ? cat.color + '22' : 'transparent',
                              border: isActive ? `1.5px solid ${cat.color}` : '1.5px solid transparent',
                              borderRadius: '12px', padding: '3px 8px',
                              opacity: isDisabled ? 0.2 : (!isAnyActive || isActive ? 1.0 : 0.45),
                              transition: 'all 0.15s',
                              outline: 'none'
                            }}
                          >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, display: 'inline-block' }}/>
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', textAlign: 'right', maxWidth: '300px', lineHeight: '1.3' }}>
                      <strong>Geographic view:</strong> Places are mapped onto their actual coordinates on the city grid, with dot size representing place quality.
                    </div>
                  </>
                )}
              </div>

              {/* Route list grouped by cluster */}
              {viewMode === 'routes' && clusters.length > 0 && (
                <div style={{ flexShrink: 0, maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
                  {clusters.map(cl => {
                    const members = clusteredCandidates.filter(c => c.cluster === cl.id);
                    if (members.length === 0) return null;
                    return (
                      <div key={cl.id}>
                        <div style={{ fontSize: '0.65rem', fontWeight: '700', color: cl.color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cl.color, display: 'inline-block' }}/>
                          {cl.label}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '6px' }}>
                          {members.slice(0, 5).map(c => {
                            const isActive = routeSpaceRoute?.id === c.id;
                            return (
                              <button key={c.id} onClick={() => setRouteSpaceRoute(c)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '7px', border: isActive ? `1.5px solid ${cl.color}` : '1px solid #e2e8f0', background: isActive ? cl.color + '12' : '#ffffff', cursor: 'pointer', textAlign: 'left' }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: cl.color, flexShrink: 0 }}/>
                                <span style={{ fontSize: '0.72rem', fontWeight: isActive ? '700' : '500', color: '#0f172a', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                                <span style={{ fontSize: '0.62rem', color: '#94a3b8', flexShrink: 0 }}>{c.stopCount} stops · {c.totalDistance.toFixed(1)}km</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Column 3: Brushed details / Active Route Details (White background themed style) */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
              {viewMode === 'places' && brushedPlaces.length > 0 ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Brushed Places ({brushedPlaces.length})</span>
                    <button 
                      onClick={() => {
                        const sorted = [...brushedPlaces].sort((a, b) => b.coords[0] - a.coords[0]);
                        updateRouteWithStops(sorted);
                        setViewMode('routes');
                        setBrushedIds(new Set());
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '6px 14px',
                        fontSize: '0.66rem',
                        fontWeight: '750',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(99, 102, 241, 0.25)',
                        transition: 'transform 0.15s, opacity 0.15s'
                      }}
                      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      Create Route
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {(() => {
                      const sorted = [...brushedPlaces].sort((a, b) => b.coords[0] - a.coords[0]);
                      return sorted.map((p, idx) => {
                        const { icon, color } = getTypeDetails(p.type);
                        const nextPlace = sorted[idx + 1];
                        let nextDist = 0;
                        if (nextPlace) {
                          nextDist = getDistanceKm(p.coords[0], p.coords[1], nextPlace.coords[0], nextPlace.coords[1]);
                        }

                        return (
                          <div key={p.name || idx}>
                            <div style={{ display: 'flex', gap: '8px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px', alignItems: 'center' }}>
                              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: color, color: '#ffffff', fontSize: '0.6rem', fontWeight: '800', flexShrink: 0 }}>
                                {idx + 1}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                <div style={{ fontSize: '0.62rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                                  <span style={{ color }}>{icon}</span> {p.type || 'Sight'}
                                </div>
                              </div>
                            </div>
                            
                            {/* Consecutive distance indicator */}
                            {nextPlace && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 4px 18px', fontSize: '0.62rem', color: '#6366f1', fontWeight: '600' }}>
                                <span style={{ borderLeft: '1.5px dashed #818cf8', height: '12px', display: 'inline-block' }}/>
                                <span>↕ {nextDist.toFixed(2)} km to next</span>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </>
              ) : (
                <>
                  {routeSpaceRoute ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>◈ Active Route</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{routeSpaceRoute.name}</span>
                          <span style={{ fontSize: '0.64rem', color: '#64748b', whiteSpace: 'nowrap' }}>{routeSpaceRoute.stopCount} stops · {routeSpaceRoute.totalDistance.toFixed(1)} km</span>
                        </div>
                      </div>

                      {/* Overview section */}
                      <div style={{ flexShrink: 0 }}>
                        <JourneyRhythm stops={routeSpaceRoute.stops} height={12}/>
                        <RhythmLegend stopsArrays={[routeSpaceRoute.stops]}/>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px' }}>
                          {[
                            { name: 'Landmarks', val: Math.min(10, Math.max(1, (routeSpaceRoute.popularity / 16) * 10)), color: '#3b82f6', desc: 'Famous sights & popular attractions' },
                            { name: 'Hidden gems', val: routeSpaceRoute.novelty * 10, color: '#10b981', desc: 'Local & off-the-beaten-path stops' },
                            { name: 'Walkability', val: (routeSpaceRoute.walkingDistance / (routeSpaceRoute.totalDistance || 1)) * 10, color: '#0ea5e9', desc: 'How much can be done on foot' },
                            { name: 'Spread', val: Math.min(10, (routeSpaceRoute.spread / 4.0) * 10), color: '#8b5cf6', desc: 'Geographic footprint across the city' },
                            { name: 'Theme fit', val: Math.min(10, routeSpaceRoute.themeDensity * 2), color: '#fbbf24', desc: 'Match to your goal / theme query' },
                            { name: 'Cost', val: Math.min(10, (routeSpaceRoute.cost / 120) * 10), color: '#f97316', desc: 'Estimated spend (entries + food)' },
                          ].map(m => (
                            <div key={m.name} style={{ padding: '4px 6px', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', marginBottom: '2px' }}>
                                <span style={{ color: '#334155', fontWeight: '750' }}>{m.name}</span>
                                <strong style={{ color: m.color }}>{m.val.toFixed(1)}</strong>
                              </div>
                              <div style={{ background: '#f1f5f9', borderRadius: '3px', height: '3px', overflow: 'hidden', marginBottom: '2px' }}>
                                <div style={{ width: `${m.val * 10}%`, height: '100%', background: m.color, borderRadius: '3px' }}/>
                              </div>
                              <div style={{ fontSize: '0.54rem', color: '#64748b', lineHeight: 1.2 }}>{m.desc}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Stops list section */}
                      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid #e2e8f0', paddingTop: '10px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stops Timeline</div>
                        {routeSpaceRoute.stops.map((stop, sIdx) => {
                          const { icon, color } = getTypeDetails(stop.type);
                          return (
                            <div key={stop.id || sIdx} style={{ display: 'flex', gap: '6px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 8px', alignItems: 'center' }}>
                              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: color, color: '#ffffff', fontSize: '0.6rem', fontWeight: '700', flexShrink: 0 }}>
                                {sIdx + 1}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stop.name}</div>
                                <div style={{ fontSize: '0.58rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                                  <span style={{ color }}>{icon}</span> {stop.type} {stop.distanceKm > 0 && `· ${stop.distanceKm.toFixed(1)}km`}
                                </div>
                              </div>
                              <button onClick={() => deleteStop(sIdx)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                                <Trash2 size={12}/>
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569' }}>Add Place to Custom Route:</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input type="text" placeholder="Search & add by name..."
                            value={manualSearchQuery}
                            onChange={e => setManualSearchQuery(e.target.value)}
                            onKeyDown={async e => { if (e.key === 'Enter') { e.preventDefault(); await handleManualPlaceSearch(); } }}
                            style={{ flex: 1, fontSize: '0.74rem', padding: '6px 10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a' }}/>
                          <button onClick={handleManualPlaceSearch} disabled={isSearchingManual}
                            style={{ background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {isSearchingManual ? <Loader2 size={11} className="spin"/> : <Plus size={12}/>} Add
                          </button>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: 'auto' }}>
                        {appliedSuccess ? (
                          <div style={{ background: '#ecfdf5', border: '1px solid #059669', color: '#059669', borderRadius: '8px', padding: '8px', fontSize: '0.8rem', fontWeight: '700', textAlign: 'center' }}>
                            ✓ Applied to Planner Itinerary!
                          </div>
                        ) : (
                          <button onClick={applyMorphedRouteToTrip}
                            style={{ width: '100%', background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <Check size={14}/> Apply to My Itinerary
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '40px 0' }}>
                      Select or generate a route to view its details.
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
