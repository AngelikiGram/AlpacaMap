// Ready-made knowledge bundled with the app (public/preprocessed/<city>.json).
// Loaded automatically when a city with bundled data is added to a trip.
// Files in /public, relative to where the site is hosted (no import of endpoints.js: keeps this testable in node)
const assetUrl = (path) => `${import.meta.env?.BASE_URL ?? './'}${path.replace(/^\//, '')}`;

// Only cities with real bundled statements (the other files in public/preprocessed are empty)
export const BUNDLED_KNOWLEDGE = { edinburgh: 'edinburgh', london: 'london', paris: 'paris', rome: 'rome', zurich: 'zurich', 'zürich': 'zurich' };

// Cities with a bundled OpenStreetMap extract (public/preprocessed/osm_<slug>.json)
export const BUNDLED_OSM = ['edinburgh', 'kyoto', 'london', 'new_york', 'paris', 'prague', 'rome', 'sydney', 'tokyo', 'zurich'];

const SOURCE_LABELS = { wikivoyage: 'Wikivoyage', wikitravel: 'Wikitravel', wikipedia: 'Wikipedia', reddit: 'Reddit', stackexchange: 'StackExchange Travel' };

/** "Greater London, England" → "london" (or null when nothing is bundled). */
export function bundledKeyFor(cityName) {
  const clean = String(cityName || '').split(',')[0].toLowerCase()
    .replace(/^(greater|inner|outer|city of)\s+/i, '').replace(/\s+(region|city|greater|area)$/i, '').trim();
  return BUNDLED_KNOWLEDGE[clean] || null;
}

export const osmSlugFor = (cityName) => {
  const s = String(cityName || '').split(',')[0].toLowerCase().replace(/^(greater|city of)\s+/, '').trim().replace(/\s+/g, '_').replace('ü', 'u');
  return BUNDLED_OSM.includes(s) ? s : null;
};

/** True when this graph already holds the bundled statements of that city. */
export const hasBundled = (nodes, key) => (nodes || []).some((n) => typeof n.id === 'string' && n.id.startsWith(`offline-${key}-`));

/** Statements from a bundled file, normalised like the Knowledge panel's offline loader. */
export function normaliseBundled(data, key) {
  const today = new Date().toISOString().slice(0, 10);
  const out = [];
  if (Array.isArray(data?.nodes)) {
    data.nodes.forEach((n, idx) => {
      const src = n.source || {};
      out.push({ ...n, id: `offline-${key}-${idx}`, source: { ...src, label: src.label || src.sourceLabel || SOURCE_LABELS[src.sourceType] || src.sourceType } });
    });
  }
  // Older files: nodes grouped per source
  Object.entries(data || {}).forEach(([srcKey, srcData]) => {
    if (!srcData || !Array.isArray(srcData.nodes)) return;
    srcData.nodes.forEach((n, idx) => out.push({
      id: `offline-${key}-${srcKey}-${idx}`, place: n.place, claim: n.claim,
      claimType: n.claimType || 'evaluation', knowledge_type: n.knowledge_type || 'stable',
      evaluation: { sentiment: n.sentiment || 'neutral', intensity: n.intensity || 0.5 },
      advice: n.advice || null, conditions: n.conditions || {},
      source: { sourceType: srcKey, label: SOURCE_LABELS[srcKey] || srcKey, date: today, url: srcData.url || null },
    }));
  });
  return out;
}

/** Merges statements, dropping duplicates (same place + same start of text). */
export function mergeStatements(existing = [], incoming = []) {
  const seen = new Set(); const out = [];
  for (const n of [...existing, ...incoming]) {
    const k = `${(n.place || '').toLowerCase()}::${(n.claim || '').toLowerCase().slice(0, 120)}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(n);
  }
  return out;
}

const cache = new Map();
/** Fetches the bundled statements for a city key. */
export function loadBundledKnowledge(key) {
  if (!cache.has(key)) {
    cache.set(key, fetch(assetUrl(`preprocessed/${key}.json`))
      .then((r) => { if (!r.ok) throw new Error(`No bundled knowledge for ${key}`); return r.json(); })
      .then((data) => normaliseBundled(data, key)));
    cache.get(key).catch(() => cache.delete(key));
  }
  return cache.get(key);
}

const osmCache = new Map();
/** Raw OSM elements bundled for a city slug (or [] when none). */
export function loadBundledOsm(slug) {
  if (!slug) return Promise.resolve([]);
  if (!osmCache.has(slug)) {
    osmCache.set(slug, fetch(assetUrl(`preprocessed/osm_${slug}.json`))
      .then((r) => (r.ok ? r.json() : { elements: [] }))
      .then((d) => (Array.isArray(d?.elements) ? d.elements : []))
      .catch(() => []));
  }
  return osmCache.get(slug);
}
