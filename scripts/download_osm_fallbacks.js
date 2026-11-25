// Builds the offline OpenStreetMap extracts in public/preprocessed/osm_<slug>.json.
// The app shows these places at once and fills gaps with a live search, so each extract covers the
// app's default search circle (5 km) with some margin. Only named places in the app's categories are
// kept, with their centre instead of full geometry, so the files stay small.
//
// Usage: node scripts/download_osm_fallbacks.js [--force] [--city london] [--radius 7] [--tiles 3]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../public/preprocessed');
fs.mkdirSync(OUT_DIR, { recursive: true });

const CITIES = [
  { name: 'London', slug: 'london', coords: [51.5074, -0.1278] },
  { name: 'Paris', slug: 'paris', coords: [48.8566, 2.3522] },
  { name: 'Zurich', slug: 'zurich', coords: [47.3769, 8.5417] },
  { name: 'Edinburgh', slug: 'edinburgh', coords: [55.9533, -3.1883] },
  { name: 'New York', slug: 'new_york', coords: [40.7128, -74.0060] },
  { name: 'Tokyo', slug: 'tokyo', coords: [35.6762, 139.6503] },
  { name: 'Rome', slug: 'rome', coords: [41.9028, 12.4964] },
  { name: 'Kyoto', slug: 'kyoto', coords: [35.0116, 135.7681] },
  { name: 'Barcelona', slug: 'barcelona', coords: [41.3851, 2.1734] },
  { name: 'Prague', slug: 'prague', coords: [50.0755, 14.4378] },
  { name: 'Sydney', slug: 'sydney', coords: [-33.8688, 151.2093] },
  { name: 'Amsterdam', slug: 'amsterdam', coords: [52.3676, 4.9041] },
];

// Public Overpass servers; the first that answers is used
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const FORCE = args.includes('--force');
const ONLY = arg('--city');
const RADIUS_KM = Number(arg('--radius') || 7);

// Square around the centre; longitude degrees shrink with latitude
function bbox([lat, lon], km) {
  const dLat = km / 110.574;
  const dLon = km / (111.32 * Math.cos(lat * Math.PI / 180));
  return [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((x) => x.toFixed(5)).join(',');
}

function query(b) {
  return `[out:json][timeout:180];
(
  nw["tourism"]["name"](${b});
  nw["historic"]["name"](${b});
  nw["amenity"~"^(restaurant|fast_food|food_court|pub|bar|cafe|museum|arts_centre|theatre|cinema|place_of_worship)$"]["name"](${b});
  nwr["leisure"~"^(park|garden|nature_reserve|stadium|beach_resort|camp_site)$"]["name"](${b});
  nw["shop"~"^(supermarket|clothes|mall|department_store|bakery|books|gift|art)$"]["name"](${b});
  nwr["natural"~"^(peak|saddle|beach|bay)$"]["name"](${b});
  nw["waterway"="waterfall"]["name"](${b});
);
out center tags;`;
}

// Finished tiles are kept in scratch/ (git-ignored), so a rerun only fetches the tiles that are missing
const TILE_DIR = path.resolve(__dirname, '../scratch/osm_tiles');
fs.mkdirSync(TILE_DIR, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// One request round over all servers; null when none answered
async function tryServers(b, label) {
  const body = 'data=' + encodeURIComponent(query(b));
  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'AlpacaMap-extract-builder' }, signal: AbortSignal.timeout(90000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json.elements)) throw new Error('no elements');
      console.log(`  ${label}: ${json.elements.length} places (${new URL(url).host})`);
      return json;
    } catch (e) {
      console.warn(`  ${label}: ${new URL(url).host} failed (${e.message})`);
    }
  }
  return null;
}

// Dense city centres time out as one query: when no server answers, the area is split into four
// quarters (down to MAX_SPLIT levels, about 0.5 km), and the smallest pieces are retried with pauses.
// Every finished piece is saved, so a rerun continues where the last one stopped.
const MAX_SPLIT = 3;
async function fetchTile(b, label, cacheFile, depth = 0) {
  if (fs.existsSync(cacheFile)) { console.log(`  ${label}: already downloaded`); return JSON.parse(fs.readFileSync(cacheFile, 'utf8')); }
  let json = await tryServers(b, label);
  if (!json && depth < MAX_SPLIT) {
    console.log(`  ${label}: splitting into 4 smaller areas`);
    const [s, w, n, e] = b.split(',').map(Number);
    const ms = (s + n) / 2, mw = (w + e) / 2;
    const quarters = [[s, w, ms, mw], [s, mw, ms, e], [ms, w, n, mw], [ms, mw, n, e]];
    const parts = [];
    for (let k = 0; k < 4; k++) {
      const qb = quarters[k].map((x) => x.toFixed(5)).join(',');
      const part = await fetchTile(qb, `${label}.${k + 1}`, cacheFile.replace(/\.json$/, `_${k}.json`), depth + 1);
      if (!part) return null;
      parts.push(part);
      await wait(1500);
    }
    json = { ...parts[0], elements: parts.flatMap((p) => p.elements) };
  }
  for (let attempt = 0; !json && attempt < 3; attempt++) {   // smallest pieces: retry with pauses
    await wait(20000 * (attempt + 1));
    json = await tryServers(b, label);
  }
  if (json) fs.writeFileSync(cacheFile, JSON.stringify(json));
  return json;
}

// Large city areas time out as one query, so the square is split into TILES × TILES tiles
const TILES = Number(arg('--tiles') || 3);

async function download(city) {
  const outFile = path.join(OUT_DIR, `osm_${city.slug}.json`);
  if (fs.existsSync(outFile) && !FORCE) { console.log(`${city.name}: exists, skipped (use --force)`); return true; }
  const [s, w, n, e] = bbox(city.coords, RADIUS_KM).split(',').map(Number);
  const byId = new Map(); let meta = null; let missing = 0;
  const t = Date.now();
  for (let i = 0; i < TILES; i++) {
    for (let j = 0; j < TILES; j++) {
      const tb = [s + (n - s) * i / TILES, w + (e - w) * j / TILES, s + (n - s) * (i + 1) / TILES, w + (e - w) * (j + 1) / TILES].map((x) => x.toFixed(5)).join(',');
      const cacheFile = path.join(TILE_DIR, `${city.slug}_r${RADIUS_KM}_t${TILES}_${i}_${j}.json`);
      const json = await fetchTile(tb, `${city.name} tile ${i * TILES + j + 1}/${TILES * TILES}`, cacheFile);
      if (!json) { missing++; continue; }   // keep going: the other tiles are saved for the next run
      meta = meta || json;
      for (const el of json.elements) byId.set(`${el.type}/${el.id}`, el);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (missing) { console.error(`${city.name}: ${missing} tile(s) still missing, file not changed. Run the same command again later.`); return false; }
  const elements = [...byId.values()];
  fs.writeFileSync(outFile, JSON.stringify({ generator: meta.generator, osm3s: meta.osm3s, radiusKm: RADIUS_KM, center: city.coords, elements }));
  console.log(`${city.name}: ${elements.length} places, ${(fs.statSync(outFile).size / 1e6).toFixed(1)} MB, ${Math.round((Date.now() - t) / 1000)} s`);
  return true;
}

for (const city of CITIES.filter((c) => !ONLY || c.slug === ONLY)) {
  await download(city);
  await new Promise((r) => setTimeout(r, 3000));   // be polite to the public servers
}
