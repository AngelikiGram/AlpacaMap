// Cleans the bundled knowledge files in public/preprocessed/<city>.json:
//  - drops non-English text, website boilerplate and junk "place" names
//  - re-assigns topic labels ("Paris · Transport") with the keyword rules in src/knowledge/topics.js
//  - Reddit: keeps only short excerpts (≤ 280 chars) with a link, never full posts
//  - removes the duplicated `source.snippet`, de-duplicates statements
//  - records retrieval date separately from (unknown) publication date
//  - adds license / attribution metadata to every file
// Usage: node scripts/clean_preprocessed.mjs [--dry-run] [city ...]
import fs from 'node:fs';
import path from 'node:path';
import { classifyTopic } from '../src/knowledge/topics.js';
import { isUsefulClaim, isJunkPlace, excerpt } from '../src/knowledge/quality.js';

export const ATTRIBUTION = {
  wikivoyage:    { name: 'Wikivoyage',          license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', note: 'Text from Wikivoyage contributors; changes: split into sentences, classified.' },
  wikitravel:    { name: 'Wikitravel',          license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', note: 'Text from Wikitravel contributors; changes: split into sentences, classified.' },
  wikipedia:     { name: 'Wikipedia',           license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', note: 'Text from Wikipedia contributors; changes: split into sentences, classified.' },
  stackexchange: { name: 'Travel StackExchange', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', note: 'Answers by StackExchange users; linked to the original question.' },
  reddit:        { name: 'Reddit',               license: 'Reddit User Agreement', licenseUrl: 'https://redditinc.com/policies/user-agreement', note: 'Short excerpts only (≤ 280 characters), each linked to its source; full posts are not redistributed.' },
};

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'public', 'preprocessed');
const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const only = args.filter((a) => !a.startsWith('--'));

export function cleanNodes(nodes, cityBase) {
  const seen = new Set();
  const stats = { in: nodes.length, notUseful: 0, junkPlace: 0, duplicate: 0, retopic: 0, redditTrimmed: 0 };
  const out = [];
  for (const n of nodes) {
    const src = { ...(n.source || {}) };
    let claim = (n.claim || '').trim();
    if (src.sourceType === 'reddit') { const e = excerpt(claim, 280); if (e !== claim) stats.redditTrimmed++; claim = e; }
    if (!isUsefulClaim(claim.replace(/ …$/, ''))) { stats.notUseful++; continue; }
    if (isJunkPlace(n.place)) { stats.junkPlace++; continue; }
    const key = claim.toLowerCase().replace(/\W+/g, ' ').trim();
    if (seen.has(key)) { stats.duplicate++; continue; }
    seen.add(key);
    let place = n.place;
    if (place.includes(' · ')) {
      const next = `${cityBase} · ${classifyTopic(claim)}`;
      if (next !== place) stats.retopic++;
      place = next;
    }
    delete src.snippet;
    if (!src.retrievedAt) src.retrievedAt = src.date || null;
    if (!('publishedAt' in src)) src.publishedAt = null; // unknown for bundled data
    if (src.url && src.sourceType === 'reddit' && !/\/comments\//.test(src.url)) src.urlKind = 'subreddit';
    const { nextPlace, ...rest } = n;
    out.push({ ...rest, place, claim, source: src });
  }
  stats.out = out.length;
  return { nodes: out, stats };
}

function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('osm_'));
  for (const f of files) {
    const slug = f.replace('.json', '');
    if (only.length && !only.includes(slug)) continue;
    const file = path.join(DIR, f);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data.nodes)) { console.log(`${slug}: old per-source format, ${fs.statSync(file).size} bytes — skipped (no usable data)`); continue; }
    const cityBase = (data.city || slug).split(',')[0].trim();
    const { nodes, stats } = cleanNodes(data.nodes, cityBase);
    const topics = {};
    for (const n of nodes) if (n.place.includes(' · ')) topics[n.place.split(' · ')[1]] = (topics[n.place.split(' · ')[1]] || 0) + 1;
    console.log(`${slug}: ${stats.in} → ${stats.out}  (dropped: not useful ${stats.notUseful}, junk place ${stats.junkPlace}, duplicate ${stats.duplicate}; re-topiced ${stats.retopic}; reddit trimmed ${stats.redditTrimmed})`);
    console.log('   topics:', Object.entries(topics).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
    if (dry) continue;
    if (data.sources?.reddit) data.sources.reddit = { count: data.sources.reddit.count ?? null };
    const out = { ...data, nodes, nodeCount: nodes.length, cleanedAt: new Date().toISOString(), attribution: ATTRIBUTION };
    fs.writeFileSync(file, JSON.stringify(out));
    console.log(`   wrote ${(fs.statSync(file).size / 1e6).toFixed(2)} MB`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) main();
