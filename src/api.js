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

// Place photos come only from Wikimedia Commons (directly, via Wikidata P18 or a Wikipedia thumbnail):
// every file there has a known author and free licence, which the app shows next to the photo.
// Web image search, scraped og:images and company logos were removed: their copyright is unknown.
export const isWikimediaImage = (url) =>
  typeof url === 'string' && /^https:\/\/(upload\.wikimedia\.org|commons\.wikimedia\.org)\//.test(url);

// Commons file name from a Special:FilePath or upload.wikimedia.org URL (thumbnails included).
const commonsFileName = (url) => {
  try {
    const u = new URL(url);
    if (u.hostname === 'commons.wikimedia.org') {
      const m = u.pathname.match(/\/(?:wiki\/)?(?:Special:FilePath|File:)\/?(.+)$/);
      return m ? decodeURIComponent(m[1]) : null;
    }
    const parts = u.pathname.split('/').map(decodeURIComponent);
    const i = parts.indexOf('thumb');
    return i >= 0 ? parts[i + 3] : parts[parts.length - 1];
  } catch { return null; }
};

const creditCache = new Map();
const stripHtml = (s) => (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

// { author, license, page } for a Wikimedia image, from the Commons API (cached per file).
export const fetchImageCredit = (url) => {
  const file = isWikimediaImage(url) && commonsFileName(url);
  if (!file) return Promise.resolve(null);
  if (!creditCache.has(file)) {
    creditCache.set(file, fetch(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent('File:' + file)}&prop=imageinfo&iiprop=extmetadata&format=json&origin=*`, { signal: AbortSignal.timeout(6000) })
      .then(r => r.json())
      .then(j => {
        const pg = Object.values(j?.query?.pages || {})[0];
        const md = pg?.imageinfo?.[0]?.extmetadata || {};
        return {
          author: stripHtml(md.Artist?.value) || 'Unknown author',
          license: stripHtml(md.LicenseShortName?.value) || 'see file page',
          page: `https://commons.wikimedia.org/wiki/${encodeURIComponent('File:' + file)}`,
        };
      })
      .catch(() => ({ author: 'Wikimedia Commons', license: 'see file page', page: `https://commons.wikimedia.org/wiki/${encodeURIComponent('File:' + file)}` })));
  }
  return creditCache.get(file);
};

export const fetchPlaceImage = async (osmTags, name, type, cityName) => {
  if (isWikimediaImage(osmTags?.image)) return osmTags.image;

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
  return isWikimediaImage(phase1) ? phase1 : null;
};

