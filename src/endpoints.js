// Where external APIs are reached from.
// - `npm run dev`: through the Vite dev-server proxies in vite.config.js.
// - Built site (GitHub Pages): directly — there is no server to proxy through,
//   so only services that send CORS headers can be used.
const DEV = import.meta.env.DEV;

export const API = {
  wikivoyage:    DEV ? '/wikivoyage-proxy'    : 'https://en.wikivoyage.org',
  wikipedia:     DEV ? '/wikipedia-proxy'     : 'https://en.wikipedia.org',
  stackexchange: DEV ? '/stackexchange-proxy' : 'https://api.stackexchange.com',
  overpass:      DEV ? '/overpass-proxy'      : 'https://overpass-api.de',
  pullpush:      'https://api.pullpush.io',
};

// Reddit's own API, DuckDuckGo HTML and Wikitravel block browser (CORS) requests,
// so they only work through the dev-server proxy.
export const HAS_DEV_PROXY = DEV;

export const ollamaChatUrl = (endpoint) =>
  DEV && /localhost|127\.0\.0\.1/.test(endpoint)
    ? '/ollama-proxy/api/chat'
    : `${endpoint.replace(/\/$/, '')}/api/chat`;

// Files in /public, resolved relative to wherever the site is hosted.
export const assetUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

// Tiny requests used to check whether a source is reachable before fetching from it.
export const HEALTH_CHECKS = {
  wikivoyage:    `${API.wikivoyage}/w/api.php?action=query&meta=siteinfo&format=json&origin=*`,
  wikipedia:     `${API.wikipedia}/w/api.php?action=query&meta=siteinfo&format=json&origin=*`,
  stackexchange: `${API.stackexchange}/2.3/info?site=travel`,
  reddit:        `${API.pullpush}/reddit/search/submission/?q=travel&size=1`,
};

/** Resolves true/false within `ms`. Sources without a check (dev-only ones) count as reachable. */
export async function isReachable(source, ms = 4000) {
  const url = HEALTH_CHECKS[source];
  if (!url || (source === 'reddit' && HAS_DEV_PROXY)) return true;
  try { const r = await fetch(url, { signal: AbortSignal.timeout(ms), credentials: 'omit' }); return r.ok || r.status === 429; }
  catch { return false; }
}

// Overpass has several public servers; the main one is often overloaded.
export const OVERPASS_MIRRORS = DEV
  ? ['/overpass-proxy/api/interpreter']
  : ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
