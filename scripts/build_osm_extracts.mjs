// Builds the offline place extracts public/preprocessed/osm_<slug>.json from OpenStreetMap files (.osm.pbf),
// without the public Overpass servers (which time out on dense city centres).
//
// 1. Download the OSM files into scratch/osm_src/ (git-ignored), for example:
//      london.osm.pbf     https://download.geofabrik.de/europe/united-kingdom/england/greater-london-latest.osm.pbf
//      paris.osm.pbf      https://download.bbbike.org/osm/bbbike/Paris/Paris.osm.pbf
//      rome.osm.pbf       https://download.geofabrik.de/europe/italy/centro-latest.osm.pbf
//      edinburgh.osm.pbf  https://download.bbbike.org/osm/bbbike/Edinburgh/Edinburgh.osm.pbf
//      zurich.osm.pbf     https://download.bbbike.org/osm/bbbike/Zuerich/Zuerich.osm.pbf
// 2. node scripts/build_osm_extracts.mjs [--city london] [--radius 10]
//
// Each extract holds every named place of the app's categories in a square of ±radius km around the centre.
// The file records that square ("coverage"), and the app treats it as fully searched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import parseOSM from 'osm-pbf-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../scratch/osm_src');
const OUT_DIR = path.resolve(__dirname, '../public/preprocessed');

const CITIES = [
  { slug: 'london', file: 'london.osm.pbf', center: [51.5074, -0.1278] },
  { slug: 'paris', file: 'paris.osm.pbf', center: [48.8566, 2.3522] },
  { slug: 'rome', file: 'rome.osm.pbf', center: [41.9028, 12.4964] },
  { slug: 'edinburgh', file: 'edinburgh.osm.pbf', center: [55.9533, -3.1883] },
  { slug: 'zurich', file: 'zuerich.osm.pbf', center: [47.3769, 8.5417] },
];

// Same tags as OVERPASS_TAGS in src/config.jsx (keep both in step)
const CATEGORY_TAGS = [
  ['amenity', 'restaurant'], ['amenity', 'fast_food'], ['amenity', 'food_court'], ['amenity', 'pub'], ['amenity', 'cafe'],
  ['amenity', 'museum'], ['tourism', 'museum'], ['tourism', 'gallery'], ['tourism', 'artwork'], ['amenity', 'arts_centre'],
  ['leisure', 'park'], ['leisure', 'garden'], ['leisure', 'nature_reserve'],
  ['shop', 'supermarket'], ['shop', 'clothes'], ['shop', 'mall'], ['amenity', 'marketplace'], ['shop', 'department_store'], ['shop', 'bakery'], ['shop', 'books'],
  ['tourism', 'attraction'], ['amenity', 'theatre'], ['amenity', 'cinema'], ['leisure', 'stadium'],
  ['natural', 'peak'], ['natural', 'saddle'], ['waterway', 'waterfall'], ['natural', 'cave_entrance'], ['tourism', 'viewpoint'],
  ['natural', 'beach'], ['leisure', 'beach_resort'], ['natural', 'bay'],
  ['tourism', 'camp_site'], ['tourism', 'caravan_site'], ['leisure', 'camp_site'],
  ['historic', 'castle'], ['historic', 'ruins'], ['historic', 'monument'], ['historic', 'memorial'], ['historic', 'archaeological_site'],
];
const WANTED = new Map();
for (const [k, v] of CATEGORY_TAGS) { if (!WANTED.has(k)) WANTED.set(k, new Set()); WANTED.get(k).add(v); }
// Tags the app reads (place window, opening hours, photos, quality score); everything else is dropped
const KEEP_TAGS = /^(name|name:en|amenity|tourism|leisure|shop|historic|natural|waterway|opening_hours|cuisine|website|contact:website|url|phone|contact:phone|wikipedia|wikidata|wikimedia_commons|image|wheelchair|fee|stars|description|addr:housenumber|addr:street|addr:city|addr:town|level)$/;

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const ONLY = arg('--city');
const RADIUS_KM = Number(arg('--radius') || 10);

const matches = (tags) => tags?.name && [...WANTED].some(([k, vals]) => vals.has(tags[k]));
const slim = (tags) => Object.fromEntries(Object.entries(tags).filter(([k]) => KEEP_TAGS.test(k)));
function square([lat, lon], km) {
  const dLat = km / 110.574, dLon = km / (111.32 * Math.cos(lat * Math.PI / 180));
  return { south: lat - dLat, north: lat + dLat, west: lon - dLon, east: lon + dLon };
}
const inside = (b, lat, lon) => lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east;

function eachItem(file, fn) {
  return new Promise((resolve, reject) => {
    const parser = parseOSM();
    parser.on('data', (items) => { for (const it of items) fn(it); });
    parser.on('end', resolve);
    parser.on('error', reject);
    fs.createReadStream(file).on('error', reject).pipe(parser);
  });
}

async function build(city) {
  const file = path.join(SRC_DIR, city.file);
  if (!fs.existsSync(file)) { console.warn(`${city.slug}: ${file} not found, skipped`); return; }
  const box = square(city.center, RADIUS_KM);
  const t = Date.now();
  const nodes = []; const ways = []; const needed = new Set();
  // Pass 1: matching nodes inside the square; matching ways (their position comes from their nodes)
  await eachItem(file, (it) => {
    if (it.type === 'node' && matches(it.tags) && inside(box, it.lat, it.lon)) nodes.push({ type: 'node', id: it.id, lat: +it.lat.toFixed(6), lon: +it.lon.toFixed(6), tags: slim(it.tags) });
    else if (it.type === 'way' && matches(it.tags) && it.refs?.length) { ways.push({ id: it.id, tags: slim(it.tags), refs: it.refs }); for (const r of it.refs) needed.add(r); }
  });
  // Pass 2: coordinates of the nodes those ways use, then each way's centre
  const coords = new Map();
  await eachItem(file, (it) => { if (it.type === 'node' && needed.has(it.id)) coords.set(it.id, [it.lat, it.lon]); });
  const wayEls = [];
  for (const w of ways) {
    const pts = w.refs.map((r) => coords.get(r)).filter(Boolean);
    if (!pts.length) continue;
    const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length, lon = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    if (inside(box, lat, lon)) wayEls.push({ type: 'way', id: w.id, center: { lat: +lat.toFixed(6), lon: +lon.toFixed(6) }, tags: w.tags });
  }
  const elements = [...nodes, ...wayEls];
  const out = path.join(OUT_DIR, `osm_${city.slug}.json`);
  fs.writeFileSync(out, JSON.stringify({
    generator: `AlpacaMap scripts/build_osm_extracts.mjs from ${city.file} (OpenStreetMap contributors, ODbL)`,
    date: new Date().toISOString().slice(0, 10), center: city.center, radiusKm: RADIUS_KM,
    coverage: Object.fromEntries(Object.entries(box).map(([k, v]) => [k, +v.toFixed(5)])), complete: true, elements,
  }));
  console.log(`${city.slug}: ${nodes.length} nodes + ${wayEls.length} ways = ${elements.length} places, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${Math.round((Date.now() - t) / 1000)} s`);
}

for (const city of CITIES.filter((c) => !ONLY || c.slug === ONLY)) await build(city);
