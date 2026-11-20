import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.resolve(__dirname, '../public/preprocessed');
const SCRATCH_DIR = path.resolve(__dirname, '../scratch');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}
if (!fs.existsSync(SCRATCH_DIR)) {
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });
}

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
  { name: 'Amsterdam', slug: 'amsterdam', coords: [52.3676, 4.9041] }
];

async function downloadCity(city, halfSpan = 0.035) {
  const outFile = path.resolve(OUT_DIR, `osm_${city.slug}.json`);
  const queryFile = path.resolve(SCRATCH_DIR, `osm_query_${city.slug}.txt`);

  console.log(`Downloading OSM Fallback for ${city.name} (span: ${halfSpan})...`);

  const centerLat = city.coords[0];
  const centerLon = city.coords[1];
  const qMinLat = (centerLat - halfSpan).toFixed(5);
  const qMaxLat = (centerLat + halfSpan).toFixed(5);
  const qMinLon = (centerLon - halfSpan).toFixed(5);
  const qMaxLon = (centerLon + halfSpan).toFixed(5);
  const bboxStr = `${qMinLat},${qMinLon},${qMaxLat},${qMaxLon}`;

  const query = `[out:json][timeout:90];
(
  nw["tourism"](${bboxStr});
  nw["historic"](${bboxStr});
  nw["amenity"~"^(restaurant|fast_food|food_court|pub|cafe|museum|arts_centre|theatre|cinema)$"](${bboxStr});
  nwr["leisure"~"^(park|garden|nature_reserve|stadium|beach_resort|camp_site)$"](${bboxStr});
  nw["shop"~"^(supermarket|clothes|mall|department_store|bakery|books)$"](${bboxStr});
  nwr["natural"~"^(peak|saddle|beach|bay)$"](${bboxStr});
  nw["waterway"="waterfall"](${bboxStr});
);
out center tags;`;

  const postBody = 'data=' + encodeURIComponent(query);
  fs.writeFileSync(queryFile, postBody, 'utf8');

  const cmd = `curl.exe -X POST -d @"${queryFile}" https://overpass-api.de/api/interpreter -o "${outFile}"`;

  try {
    execSync(cmd, { stdio: 'inherit' });
    const content = fs.readFileSync(outFile, 'utf8');
    const json = JSON.parse(content);
    if (json.elements) {
      console.log(`Successfully downloaded ${json.elements.length} elements for ${city.name}`);
      try { fs.unlinkSync(queryFile); } catch {}
      return true;
    } else {
      throw new Error("No elements in response");
    }
  } catch (e) {
    console.warn(`Attempt failed for ${city.name} (span: ${halfSpan}): ${e.message}`);
    try { fs.unlinkSync(outFile); } catch {}
    try { fs.unlinkSync(queryFile); } catch {}
    return false;
  }
}

async function run() {
  for (const city of CITIES) {
    const outFile = path.resolve(OUT_DIR, `osm_${city.slug}.json`);
    if (fs.existsSync(outFile)) {
      console.log(`Fallback for ${city.name} already exists. Skipping.`);
      continue;
    }

    console.log(`\n========================================`);
    let success = await downloadCity(city, 0.035);
    if (!success) {
      console.log(`Retrying ${city.name} with a smaller bounding box to prevent timeouts...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      success = await downloadCity(city, 0.02);
    }
    
    if (success) {
      console.log(`Finished ${city.name} successfully.`);
    } else {
      console.error(`Failed to download OSM data for ${city.name} after retries.`);
    }

    console.log('Waiting 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

run();
