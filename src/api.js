import { SENTINEL_NONE } from './utils';

export const searchNominatim = async (query, opts = {}) => {
  const params = new URLSearchParams({
    format: 'json',
    q: query,
    limit: opts.limit ?? 10,
    addressdetails: 1,
  });
  if (opts.viewbox) {
    // viewbox = { minLng, minLat, maxLng, maxLat }
    const { minLng, minLat, maxLng, maxLat } = opts.viewbox;
    params.set('viewbox', `${minLng},${maxLat},${maxLng},${minLat}`);
    params.set('bounded', opts.bounded ? 1 : 0);
  }
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { 'Accept-Language': 'en', 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
  );
  return r.json();
};

// Optional CORS proxy for scraping images from other sites (set VITE_CORS_PROXY in .env).
// The old default, corsproxy.io, now requires an API key, so these steps are skipped unless one is set.
const CORS_PROXY = import.meta.env.VITE_CORS_PROXY || '';

export const fetchPlaceImage = async (osmTags, name, type, cityName) => {
  if (osmTags?.image && /^https?:\/\//.test(osmTags.image)) return osmTags.image;

  const phase1 = await Promise.race([
    (async () => {
      const candidates = await Promise.all([
        (async () => {
          if (!osmTags?.wikidata || !/^Q\d+$/.test(osmTags.wikidata)) return null;
          try {
            const j = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${osmTags.wikidata}&property=P18&format=json&origin=*`).then(r=>r.json());
            const fname = j?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
            if (fname) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fname)}?width=400`;
          } catch {} return null;
        })(),
        (async () => {
          if (!osmTags?.wikimedia_commons) return null;
          const m = osmTags.wikimedia_commons.match(/^(?:File:)?(.+\.(jpe?g|png|gif|webp|svg))$/i);
          return m ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(m[1])}?width=400` : null;
        })(),
        (async () => {
          if (!osmTags?.wikipedia) return null;
          try {
            const title = osmTags.wikipedia.replace(/^[a-z]{2}:/, '');
            const j = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?origin=*`).then(r=>r.json());
            return j?.thumbnail?.source || null;
          } catch {} return null;
        })(),
        (async () => {
          try {
            const sr = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&limit=3&format=json&origin=*`).then(r=>r.json());
            const nameNorm = name.toLowerCase().replace(/[^a-z0-9\s]/g,'').trim();
            const hit = sr?.search?.find(e=>{
              const lbl=(e.label||'').toLowerCase().replace(/[^a-z0-9\s]/g,'').trim();
              return lbl===nameNorm||(nameNorm.length>5&&(lbl.includes(nameNorm)||nameNorm.includes(lbl)));
            });
            if (hit) {
              const j = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${hit.id}&property=P18&format=json&origin=*`).then(r=>r.json());
              const fname = j?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
              if (fname) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fname)}?width=400`;
            }
          } catch {} return null;
        })(),
      ]);
      return candidates.find(Boolean) || null;
    })(),
    new Promise(resolve => setTimeout(() => resolve(null), 4000)),
  ]);
  if (phase1) return phase1;

  try {
    const q = [name, cityName].filter(Boolean).join(' ');
    // api.duckduckgo.com allows browser requests directly — no proxy needed
    const targetUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const j = await fetch(targetUrl, { signal: AbortSignal.timeout(5000) }).then(r => r.json());
    if (j?.Image && /^https?:\/\//.test(j.Image)) return j.Image;
  } catch {}

  if (CORS_PROXY && osmTags?.website) {
    try {
      const html = await fetch(
        `${CORS_PROXY}${encodeURIComponent(osmTags.website)}`,
        { signal: AbortSignal.timeout(6000) }
      ).then(r => r.text());
      const m = html.match(/property="og:image"\s+content="([^"]+)"/i) ||
                html.match(/content="([^"]+)"\s+property="og:image"/i) ||
                html.match(/name="twitter:image"\s+content="([^"]+)"/i) ||
                html.match(/content="([^"]+)"\s+name="twitter:image"/i);
      if (m?.[1] && /^https?:\/\//.test(m[1])) return m[1];
    } catch {}
  }

  if (CORS_PROXY) try {
    const query = [name, type, cityName].filter(Boolean).join(' ');
    const encoded = encodeURIComponent(query);
    const proxy = CORS_PROXY;
    const html = await fetch(
      `${proxy}${encodeURIComponent(`https://duckduckgo.com/?q=${encoded}&iax=images&ia=images`)}`,
      { signal: AbortSignal.timeout(5000) }
    ).then(r => r.text());
    const vqd = html.match(/\bvqd=([\d-]+)/)?.[1] || html.match(/"vqd":"([^"]+)"/)?.[1];
    if (vqd) {
      const data = await fetch(
        `${proxy}${encodeURIComponent(`https://duckduckgo.com/i.js?q=${encoded}&vqd=${encodeURIComponent(vqd)}&f=,,,,,&p=1&o=json`)}`,
        { signal: AbortSignal.timeout(5000) }
      ).then(r => r.json());
      const img = data?.results?.[0]?.thumbnail || data?.results?.[0]?.image;
      if (img && /^https?:\/\//.test(img)) return img;
    }
  } catch {}

  if (osmTags?.website) {
    try {
      const domain = new URL(osmTags.website).hostname.replace(/^www\./, '');
      const res = await fetch(`https://logo.clearbit.com/${domain}`, { signal: AbortSignal.timeout(4000) });
      if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
        return `https://logo.clearbit.com/${domain}`;
      }
    } catch {}
  }

  return null;
};

