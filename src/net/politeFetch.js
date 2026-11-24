// Client-side rate limiting for the free public services the app uses.
// The app calls these services from ~20 places; wrapping window.fetch once keeps every call site within
// the providers' usage policies (and keeps visitors' IPs from being blocked):
//   • Nominatim: at most 1 request per second, identical searches cached (operations.osmfoundation.org/policies/nominatim)
//   • Overpass: at most 2 requests at a time per server (overpass-api.de/command_line.html)
//   • everything else: at most 6 parallel requests per host
const RULES = [
  { test: (h) => h === 'nominatim.openstreetmap.org', gapMs: 1100, maxParallel: 1, cache: true },
  { test: (h) => /overpass/.test(h), gapMs: 0, maxParallel: 2, cache: false },
  { test: () => true, gapMs: 0, maxParallel: 6, cache: false },
];

const queues = new Map();   // host → { active, last, waiting: [] }
const cache = new Map();    // url → Promise<{ body, init }>
const CACHE_MAX = 300;

export function installPoliteFetch() {
  if (window.__politeFetch) return;
  window.__politeFetch = true;
  const nativeFetch = window.fetch.bind(window);

  const pump = (host, rule) => {
    const q = queues.get(host);
    while (q.waiting.length && q.active < rule.maxParallel) {
      const wait = Math.max(0, q.last + rule.gapMs - Date.now());
      if (wait > 0) { if (!q.timer) q.timer = setTimeout(() => { q.timer = null; pump(host, rule); }, wait); return; }
      const job = q.waiting.shift();
      q.active++; q.last = Date.now();
      job.run().finally(() => { q.active--; pump(host, rule); });
    }
  };

  window.fetch = (input, init) => {
    let url;
    try { url = new URL(typeof input === 'string' ? input : input.url, window.location.href); } catch { return nativeFetch(input, init); }
    if (url.origin === window.location.origin) return nativeFetch(input, init);
    const rule = RULES.find((r) => r.test(url.hostname));
    const method = (init?.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    const cacheable = rule.cache && method === 'GET';
    const key = url.href;
    if (cacheable && cache.has(key)) return cache.get(key).then(({ body, meta }) => new Response(body, meta));

    if (!queues.has(url.hostname)) queues.set(url.hostname, { active: 0, last: 0, waiting: [], timer: null });
    const p = new Promise((resolve, reject) => {
      queues.get(url.hostname).waiting.push({ run: () => nativeFetch(input, init).then(resolve, reject) });
      pump(url.hostname, rule);
    });
    if (!cacheable) return p;
    const stored = p.then(async (res) => {
      if (!res.ok) throw new Error('not cached');
      return { body: await res.clone().arrayBuffer(), meta: { status: res.status, statusText: res.statusText, headers: res.headers } };
    });
    stored.catch(() => cache.delete(key));
    cache.set(key, stored);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return p;
  };
}
