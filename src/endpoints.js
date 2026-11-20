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
