#!/usr/bin/env node
/**
 * fetch_and_preprocess_all.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Offline knowledge-graph pre-processor for TravelScout.
 *
 * For each target city it:
 *   1. Fetches Wikivoyage, Wikitravel, Wikipedia full text
 *   2. Fetches StackExchange Travel Q&A
 *   3. Fetches Reddit posts (PullPush archive)
 *   4. Fetches OSM Overpass POIs (restaurants, museums, parks, hotels, …)
 *   5. Runs the same NLP extraction pipeline as KnowledgePanel.jsx
 *   6. Writes  public/preprocessed/<cityslug>.json
 *
 * Usage:
 *   node scripts/fetch_and_preprocess_all.js               # all built-in cities
 *   node scripts/fetch_and_preprocess_all.js london paris  # specific cities (slug or title-case)
 *   node scripts/fetch_and_preprocess_all.js --city "New York"   # single city with spaces
 *
 * Requires Node 18+ (native fetch).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dns  from 'dns';

// Fix Node 18+ fetch failed bug on Windows (IPv6 connection timeout issue)
if (dns && typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Output directory ──────────────────────────────────────────────────────────
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const OUT_DIR    = path.resolve(PUBLIC_DIR, 'preprocessed');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ── NLP data (mirrors src/data/nlp_data.json) ────────────────────────────────
const nlpDataPath = path.resolve(__dirname, '../src/data/nlp_data.json');
const nlpData = JSON.parse(fs.readFileSync(nlpDataPath, 'utf8'));

const SENTIMENT_DICTIONARY = nlpData.sentimentDictionary;
const ENTITY_COMMON_WORDS  = new Set(nlpData.entityCommonWords);
const HEURISTIC_COMMON     = new Set(nlpData.heuristicCommon);

// Extra non-place words (mirrors KnowledgePanel.jsx EXTRA_NON_PLACE_WORDS)
const EXTRA_NON_PLACE = [
  'although','however','therefore','moreover','nevertheless','nonetheless','besides',
  'furthermore','consequently','accordingly','meanwhile','otherwise','instead',
  'indeed','actually','basically','essentially','generally','typically','usually',
  'apparently','obviously','clearly','naturally','literally','simply','especially',
  'particularly','recently','finally','previously','currently','originally',
  'taxi','taxis','cab','cabs','uber','lyft','bus','buses','tube','metro','tram',
  'ferry','ferries','subway','trolley','shuttle','minibus','coach','coaches',
  'oyster','travelcard','railcard','tfl','transit',
  'princess','prince','duke','duchess','lord','lady','queen','king','sir','dame',
  'count','countess','earl','baron','baroness','sultan','emperor','empress',
  'assembly','parliament','council','committee','commission','authority','agency',
  'charity','foundation','trust','institute','society','association','federation',
  'staff','crew','team','group','crowd','locals','tourists','visitors','everyone',
  'people','pedestrians','cyclists','drivers','passengers','travellers','travelers',
  'pub','pubs','bar','bars','cafe','cafes','kiosk','stall','booth','outlet',
  'office','offices','branch','branches','depot','hub','terminal',
  'bridge','bridges','street','road','avenue','lane','alley','path','trail',
  'park','square','plaza','yard','court','close','row','gardens','terrace',
  'north','south','east','west','central','upper','lower','inner','outer','main',
  'summer','winter','spring','autumn','morning','afternoon','evening','night',
  'harry','yoko','dua','turkish','visa','damien','christopher','danish','milan','fringe',
  'karl','benjamin','elizabeth','holiday','suvarnabhumi','airlines','passport','passports',
  'rental','rentals','flight','flights','ticket','tickets','fare','fares','insurance',
  'hotel','hotels','accommodation','accommodations','stay','stays','trip','trips',
  'booking','bookings','itinerary','itineraries',
];
EXTRA_NON_PLACE.forEach(w => { ENTITY_COMMON_WORDS.add(w); HEURISTIC_COMMON.add(w); });

// ── Naive Bayes classifier (mirrors KnowledgePanel.jsx) ──────────────────────
class NaiveBayesClassifier {
  constructor() {
    this.vocab = new Set();
    this.classDocCounts = {};
    this.classWordCounts = {};
    this.wordCountsInClass = {};
    this.totalDocs = 0;
  }
  tokenize(text) {
    return text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/)
      .filter(w => w.length > 3 && !ENTITY_COMMON_WORDS.has(w));
  }
  train(doc, cls) {
    const words = this.tokenize(doc);
    this.totalDocs++;
    this.classDocCounts[cls] = (this.classDocCounts[cls] || 0) + 1;
    this.classWordCounts[cls] = (this.classWordCounts[cls] || 0) + words.length;
    if (!this.wordCountsInClass[cls]) this.wordCountsInClass[cls] = {};
    words.forEach(w => {
      this.vocab.add(w);
      this.wordCountsInClass[cls][w] = (this.wordCountsInClass[cls][w] || 0) + 1;
    });
  }
  classify(doc) {
    const words = this.tokenize(doc);
    const classes = Object.keys(this.classDocCounts);
    if (!classes.length) return 'General';
    let best = null, bestScore = -Infinity;
    classes.forEach(cls => {
      let score = Math.log(this.classDocCounts[cls] / this.totalDocs);
      const total = this.classWordCounts[cls];
      const vocab  = this.vocab.size;
      words.forEach(w => {
        score += Math.log(((this.wordCountsInClass[cls][w] || 0) + 1) / (total + vocab));
      });
      if (score > bestScore) { bestScore = score; best = cls; }
    });
    return best || 'General';
  }
}

const mlClassifier = new NaiveBayesClassifier();
nlpData.trainingData.forEach(item => mlClassifier.train(item.text, item.class));

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, opts = {}, retries = 3, delayMs = 1200) {
  const { timeoutMs = 20000, ...fetchOpts } = opts;
  for (let i = 0; i < retries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, { ...fetchOpts, signal: ctrl.signal });
      clearTimeout(t);
      return res;
    } catch (e) {
      if (i === retries - 1) throw e;
      console.warn(`  retry ${i+1} for ${url.slice(0,70)}: ${e.message}`);
      await sleep(delayMs * (i + 1));
    }
  }
}

function cleanContentText(text) {
  if (!text) return '';
  return text
    .replace(/<listing\b[^>]*>[\s\S]*?<\/listing>/gi, ' ')
    .replace(/<listing\b[^>]*\/>/gi, ' ')
    .replace(/<listing\b[^>]*>/gi, ' ')
    .replace(/\[\[(?:Image|File|Media):[^\]]*?\]\]/gi, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[\s\S]*?\}\}/g, '')
    .replace(/\|[^[\]]*\]\]/g, '')
    .replace(/\]\]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCityName(city) {
  return city.replace(/^(Greater |City of |Municipality of |Borough of |District of )/i, '').trim();
}

function buildCityVariants(city) {
  const stripped  = normalizeCityName(city);
  const noCountry = stripped.split(',')[0].trim();
  const noParens  = noCountry.replace(/\s*\(.*\)/, '').trim();
  return [...new Set([city, stripped, noCountry, noParens].filter(Boolean))];
}

function toCitySlug(city) {
  return normalizeCityName(city).split(',')[0].trim()
    .toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_');
}

// ── Sentiment analysis (mirrors KnowledgePanel.jsx analyzeSentimentNLP) ──────
function analyzeSentiment(text) {
  const words = text.toLowerCase().split(/[^a-z]+/);
  let score = 0, matches = 0;
  words.forEach(w => {
    if (SENTIMENT_DICTIONARY[w] !== undefined) { score += SENTIMENT_DICTIONARY[w]; matches++; }
  });
  if (!matches) return { sentiment: 'neutral', intensity: 0.5 };
  const avg = score / matches;
  if (avg >  0.12) return { sentiment: 'positive', intensity: Math.min(1, 0.5 + avg) };
  if (avg < -0.12) return { sentiment: 'negative', intensity: Math.min(1, 0.5 - avg) };
  return { sentiment: 'neutral', intensity: 0.5 };
}

// ── NLP extraction (faithful port of extractKnowledgeNLP in KnowledgePanel.jsx) ─
let _nodeCounter = 0;

function extractNodes(text, city, placeNames = [], sourceType, sourceLabel, date, url) {
  const chunks = text.split(/\n+---\n+/);
  const nodes  = [];
  const entityRegex = /\b([A-Z][a-z]+(?:\s+(?:of|the|and|de|for)\s+[A-Z][a-z]+|\s+[A-Z][a-z]+)*)\b/g;
  const cleanName = n => n.toLowerCase()
    .replace(/^(the|a|an)\s+/, '')
    .replace(/\s+(station|tube station|underground station|museum|gallery|park)$/, '')
    .trim();

  chunks.forEach(chunk => {
    let curType = sourceType, curLabel = sourceLabel, curDate = date, curUrl = url;
    const hdr = chunk.trim().match(/^\[SOURCE:([^\]]+)\]/);
    let content = chunk;
    if (hdr) {
      content = chunk.slice(hdr[0].length);
      const h = hdr[1];
      const um = h.match(/url:([^\s"']+)/); if (um) curUrl = um[1];
      const dm = h.match(/(\d{4}-\d{2}-\d{2})/); if (dm) curDate = dm[1];
      if      (h.includes('reddit'))       { curType = 'reddit';       const sm = h.match(/r\/([a-zA-Z0-9_]+)/); curLabel = sm ? `r/${sm[1]}` : 'Reddit'; }
      else if (h.includes('stackexchange')) curType = 'stackexchange', curLabel = 'StackExchange';
      else if (h.includes('wikivoyage'))    curType = 'wikivoyage',    curLabel = 'Wikivoyage';
      else if (h.includes('wikitravel'))    curType = 'wikitravel',    curLabel = 'Wikitravel';
      else if (h.includes('wikipedia'))     curType = 'wikipedia',     curLabel = 'Wikipedia';
    }

    const cleaned   = content.replace(/\[\d+\]/g, '');
    const sentences = cleaned.match(/[^.!?\n]+[.!?\n]+/g) || [cleaned];

    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      const minLen  = curType === 'reddit' ? 15 : 25;
      const maxLen  = curType === 'reddit' ? 350 : 250;
      if (trimmed.length < minLen || trimmed.length > maxLen) return;

      let foundPlace = null;

      // Step 1: known POI name match (highest precision)
      for (const orig of placeNames) {
        const cn = cleanName(orig);
        if (cn.length < 2) continue;
        const mn  = cn.split(/\s+/).length === 1 ? orig.toLowerCase().trim() : cn;
        const esc = mn.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        if (new RegExp('\\b' + esc + '\\b', 'i').test(trimmed)) { foundPlace = orig; break; }
      }

      // Step 2: entity regex fallback
      if (!foundPlace) {
        let m; entityRegex.lastIndex = 0;
        while ((m = entityRegex.exec(trimmed)) !== null) {
          const ent = m[1];
          const el  = ent.toLowerCase();
          const ew  = el.split(/\s+/).filter(w => w.length > 2);
          if (ew.length < 2) { if (!placeNames.some(p => p.toLowerCase() === el)) continue; }
          if (el === city.toLowerCase()) continue;
          if (ew.some(w => ENTITY_COMMON_WORDS.has(w) || HEURISTIC_COMMON.has(w))) continue;
          foundPlace = ent; break;
        }
      }

      // Step 3: semantic category fallback
      if (!foundPlace) {
        const cb = city.split(',')[0].trim();
        if (cb.length > 2) foundPlace = `${cb} · ${mlClassifier.classify(trimmed)}`;
      }

      if (!foundPlace) return;

      // Tip-action gate (relaxed for reddit)
      const hasTip = curType === 'reddit' ||
        /should|must|avoid|recommend|book|ticket|price|fee|hour|time|scam|trap|crowd|watch|keep|always|never|free|visit|see|go|walk|travel|trip|station|line|great|good|best|love|amazing|wonderful|nice|fantastic|awesome|beautiful|perfect|delicious|tasty|worth|favorite|favourite|bad|worst|terrible|awful|expensive|overpriced|cheap|buy|eat|drink/i.test(trimmed);
      if (!hasTip) return;

      const { sentiment, intensity } = analyzeSentiment(trimmed);
      let claimType = 'evaluation';
      if (/should|must|avoid|advice|recommend|book|buy|always|never|keep/i.test(trimmed))          claimType = 'conditional';
      else if (/morning|afternoon|evening|night|early|late|hour|time|when|crowd|queue|line|wait/i.test(trimmed)) claimType = 'temporal';
      else if (/then|next|after that|walk to|direction|route|heading/i.test(trimmed))              claimType = 'sequence';

      const isVolatile = /price|fee|hour|ticket|crowd|queue|line|wait|pickpocket|scam|trap|closed|open/i.test(trimmed);

      const conditions = {};
      if (/morning/i.test(trimmed))          conditions.timeOfDay = 'morning';
      else if (/afternoon/i.test(trimmed))   conditions.timeOfDay = 'afternoon';
      else if (/evening|night/i.test(trimmed)) conditions.timeOfDay = 'evening';
      if (/summer/i.test(trimmed))           conditions.season = 'summer';
      else if (/winter/i.test(trimmed))      conditions.season = 'winter';
      else if (/spring/i.test(trimmed))      conditions.season = 'spring';
      else if (/autumn|fall/i.test(trimmed)) conditions.season = 'autumn';

      const adv = trimmed.match(/(?:should|must|avoid|recommend to|make sure to)\s+([^,.;]+)/i);

      nodes.push({
        id: `kg-pre-${curType}-${_nodeCounter++}-${Math.random().toString(36).slice(2, 6)}`,
        place: foundPlace,
        city,
        claim: trimmed,
        claimType,
        knowledge_type: isVolatile ? 'volatile' : 'stable',
        conditions,
        advice: adv ? adv[0].trim() : null,
        nextPlace: null,
        evaluation: { sentiment, intensity },
        source: { snippet: trimmed, sourceType: curType, sourceLabel: curLabel, date: curDate, url: curUrl },
        extractedAt: new Date().toISOString(),
      });
    });
  });

  // Dedup by exact claim text
  const seen = new Set();
  return nodes.filter(n => {
    const k = n.claim.toLowerCase().trim();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

// ── Source fetchers ───────────────────────────────────────────────────────────
const UA = 'TravelScout-Preprocessor/1.0 (https://github.com/AngelikiGram/TravelScout)';

async function fetchWikivoyage(city) {
  for (const name of buildCityVariants(city)) {
    try {
      const url = `https://en.wikivoyage.org/w/api.php?action=query&titles=${encodeURIComponent(name)}&prop=extracts&explaintext=true&exsectionformat=plain&format=json&origin=*`;
      const res  = await fetchWithRetry(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      const data = await res.json();
      const page = Object.values(data.query?.pages || {})[0];
      if (!page || page.missing !== undefined) continue;
      const text = page.extract || '';
      if (text.length < 200) continue;
      console.log(`  ✓ Wikivoyage: "${name}" (${text.length} chars)`);
      return { text: cleanContentText(text), title: page.title, url: `https://en.wikivoyage.org/wiki/${encodeURIComponent(page.title)}` };
    } catch (e) { console.warn(`  Wikivoyage "${name}": ${e.message}`); }
  }
  return null;
}

async function fetchWikipedia(city) {
  for (const name of buildCityVariants(city)) {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(name)}&prop=extracts&explaintext=true&format=json&origin=*`;
      const res  = await fetchWithRetry(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      const data = await res.json();
      const page = Object.values(data.query?.pages || {})[0];
      if (!page || page.missing !== undefined) continue;
      const text = page.extract || '';
      if (text.length < 100) continue;
      console.log(`  ✓ Wikipedia: "${name}" (${text.length} chars)`);
      return { text: cleanContentText(text), title: page.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}` };
    } catch (e) { console.warn(`  Wikipedia "${name}": ${e.message}`); }
  }
  return null;
}

async function fetchWikitravel(city) {
  for (const name of buildCityVariants(city)) {
    try {
      const qs  = `action=query&titles=${encodeURIComponent(name)}&prop=revisions&rvprop=content&rvslots=*&format=json&origin=*`;
      const url = `https://wikitravel.org/wiki/en/api.php?${qs}`;
      const res  = await fetchWithRetry(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      const data = await res.json();
      const page = Object.values(data.query?.pages || {})[0];
      if (!page || page.missing !== undefined) continue;
      const rev = page?.revisions?.[0];
      const wikitext = rev?.slots?.main?.['*'] || rev?.['*'] || '';
      if (wikitext.length < 100) continue;
      console.log(`  ✓ Wikitravel: "${name}" (${wikitext.length} chars)`);
      return { text: cleanContentText(wikitext), title: page.title, url: `https://wikitravel.org/en/${encodeURIComponent(page.title)}` };
    } catch (e) { console.warn(`  Wikitravel "${name}": ${e.message}`); }
  }
  return null;
}

async function fetchStackExchange(city) {
  const base = normalizeCityName(city).split(',')[0].trim();
  const stripHtml = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const tryQ = async (q, n = 20) => {
    try {
      await sleep(600); // SE has strict rate limits
      const url = `https://api.stackexchange.com/2.3/search/advanced?q=${encodeURIComponent(q)}&site=travel&sort=votes&pagesize=${n}&filter=withbody`;
      const res  = await fetchWithRetry(url, { headers: { 'Accept-Encoding': 'identity', 'User-Agent': UA } });
      if (!res.ok) { console.warn(`  StackExchange ${res.status} "${q}"`); return null; }
      const txt  = await res.text();
      let data;
      try { data = JSON.parse(txt); } catch { return null; }
      const items = (data.items || []).filter(i => i.body && i.score >= 1 && i.is_answered);
      if (!items.length) return null;
      console.log(`  ✓ StackExchange: "${q}" → ${items.length} items`);
      return {
        text: items.map(i =>
          `[SOURCE:stackexchange "${i.title}" url:${i.link} votes:${i.score} ${new Date(i.creation_date * 1000).toISOString().slice(0, 10)}]\n${cleanContentText(stripHtml(i.body))}`
        ).join('\n\n---\n\n'),
        count: items.length,
      };
    } catch (e) { console.warn(`  StackExchange "${q}": ${e.message}`); return null; }
  };
  return (await tryQ(`${base} travel tips`, 25)) || (await tryQ(base, 20));
}

// ── DuckDuckGo HTML Reddit Search Fallback ────────────────────────────────────
async function fetchRedditFromDuckDuckGo(query) {
  try {
    const qStr = `site:reddit.com ${query}`;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(qStr)}`;
    const res = await fetchWithRetry(url, { headers: { 'User-Agent': UA } }, 2, 1000);
    if (!res.ok) return [];
    const html = await res.text();
    const snippets = [];
    let match;

    // Modern DDG HTML result parsing
    const rx = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = rx.exec(html)) !== null) {
      const cleanText = cleanContentText(match[1].replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' '));
      if (cleanText.length > 30 && !snippets.includes(cleanText)) {
        snippets.push(cleanText);
      }
    }

    if (snippets.length === 0) {
      const fallbackRx = /<div class="result__snippet"[^>]*>([\s\S]*?)<\/div>/gi;
      while ((match = fallbackRx.exec(html)) !== null) {
        const cleanText = cleanContentText(match[1].replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' '));
        if (cleanText.length > 30 && !snippets.includes(cleanText)) {
          snippets.push(cleanText);
        }
      }
    }
    return snippets;
  } catch (e) {
    console.warn(`  DDG search failed for "${query}": ${e.message}`);
    return [];
  }
}

async function fetchRedditPullPush(city) {
  const base = normalizeCityName(city).split(',')[0].trim();
  const slug = base.toLowerCase().replace(/[^a-z0-9]/g, '');
  const subs = [...new Set([slug, 'travel', 'solotravel', 'backpacking', 'shoestring'])];
  const queries = [
    `${base} travel tips`, `${base} things to do`,
    `${base} itinerary`, `${base} hidden gems`, base,
  ];
  const allPosts = [];
  const BASE = 'https://api.pullpush.io';

  await Promise.allSettled(subs.flatMap(sub => queries.map(async q => {
    try {
      const url = `${BASE}/reddit/search/submission/?q=${encodeURIComponent(q)}&subreddit=${sub}&sort=score&size=75`;
      const res  = await fetchWithRetry(url, { headers: { 'User-Agent': UA } }, 2, 1500);
      if (!res.ok) return;
      const text = await res.text();
      if (text.trimStart().startsWith('<')) return;
      const data = JSON.parse(text);
      const posts = (data.data || []).filter(p =>
        p.selftext && p.selftext !== '[deleted]' && p.selftext !== '[removed]' && p.selftext.trim().length > 50
      );
      if (posts.length > 0) {
        allPosts.push(...posts);
        console.log(`  ✓ PullPush r/${sub} "${q}" → ${posts.length}`);
      }
    } catch (e) { /* silent */ }
  })));

  const today = new Date().toISOString().slice(0, 10);

  if (!allPosts.length) {
    console.log('  Reddit: no PullPush data, trying DuckDuckGo HTML fallback…');
    const ddgQueries = [`${base} travel tips`, `${base} hidden gems`, `${base} things to do`];
    const ddgSnippets = [];
    for (const dq of ddgQueries) {
      const snips = await fetchRedditFromDuckDuckGo(dq);
      ddgSnippets.push(...snips);
      if (ddgSnippets.length >= 100) break;
    }
    if (ddgSnippets.length > 0) {
      const uniqueSnips = [...new Set(ddgSnippets)];
      console.log(`  ✓ DDG Fallback: ${uniqueSnips.length} snippets`);
      return {
        text: uniqueSnips.map((s, idx) => {
          return `[SOURCE:reddit r/travel "Reddit tip #${idx + 1}" url:https://reddit.com/r/travel ${today}]\n${s}`;
        }).join('\n\n---\n\n'),
        count: uniqueSnips.length,
      };
    }
    return null;
  }

  const seen = new Set();
  const unique = allPosts
    .filter(p => { const k = p.id || p.selftext?.slice(0, 40) || ''; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    text: unique.map(p => {
      const dateStr = p.created_utc ? new Date(p.created_utc * 1000).toISOString().slice(0, 10) : today;
      const sub  = p.subreddit || 'reddit';
      const link = p.permalink ? `https://reddit.com${p.permalink}` : `https://reddit.com/r/${sub}`;
      return `[SOURCE:reddit r/${sub} "${p.title || 'Post'}" url:${link} ${dateStr}]\n${cleanContentText(p.selftext || '')}`;
    }).join('\n\n---\n\n'),
    count: unique.length,
  };
}

// ── OSM Overpass POI fetcher (matches KnowledgePanel.jsx fetchAreaPOIsOverpass) ──
async function fetchOsmPois(city) {
  const base = normalizeCityName(city).split(',')[0].trim();
  const OVERPASS_MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter',
    'https://overpass.nchc.org.tw/api/interpreter',
  ];

  // Step 1: geocode city name → bounding box via Nominatim
  let bboxStr = null;
  let centerLat = null, centerLon = null;
  try {
    const geoRes = await fetchWithRetry(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(base)}&limit=1`,
      { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } }
    );
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      if (geoData[0]) {
        centerLat = parseFloat(geoData[0].lat);
        centerLon = parseFloat(geoData[0].lon);
        const bb = geoData[0].boundingbox; // [min_lat, max_lat, min_lon, max_lon]
        if (bb) {
          const latSpan = parseFloat(bb[1]) - parseFloat(bb[0]);
          const lonSpan = parseFloat(bb[3]) - parseFloat(bb[2]);
          const MAX = 0.18; // ~20km radius cap, keeps queries fast
          if (latSpan > MAX * 2 || lonSpan > MAX * 2) {
            bboxStr = `${(centerLat - MAX).toFixed(5)},${(centerLon - MAX).toFixed(5)},${(centerLat + MAX).toFixed(5)},${(centerLon + MAX).toFixed(5)}`;
          } else {
            bboxStr = `${bb[0]},${bb[2]},${bb[1]},${bb[3]}`;
          }
        }
      }
    }
  } catch (e) { console.warn(`  Nominatim geocode: ${e.message}`); }

  if (!centerLat) { console.warn('  Overpass: could not geocode city, skipping'); return []; }
  if (!bboxStr) {
    const r = 0.12;
    bboxStr = `${(centerLat - r).toFixed(5)},${(centerLon - r).toFixed(5)},${(centerLat + r).toFixed(5)},${(centerLon + r).toFixed(5)}`;
  }

  // Step 2: Overpass query, node+way only (relations are huge and rarely needed for POI names)
  const AMENITY_TYPES = 'museum|theatre|arts_centre|library|place_of_worship|cinema|restaurant|cafe|fast_food|pub|bar';
  const LEISURE_TYPES = 'park|garden|nature_reserve|stadium|sports_centre|beach_resort';
  const query = `[out:json][timeout:55][maxsize:134217728];
(
  nw["tourism"]["name"](${bboxStr});
  nw["historic"]["name"](${bboxStr});
  nw["amenity"~"^(${AMENITY_TYPES})$"]["name"](${bboxStr});
  nw["leisure"~"^(${LEISURE_TYPES})$"]["name"](${bboxStr});
);
out center tags;`;

  for (const endpoint of OVERPASS_MIRRORS) {
    try {
      await sleep(1200);
      // Try direct body first (some mirrors prefer this), fall back to form-encoded
      const res = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: `data=${encodeURIComponent(query)}`,
        timeoutMs: 70000,
      }, 2, 3000);
      if (!res.ok) { console.warn(`  Overpass ${endpoint.split('/')[2]}: HTTP ${res.status}`); continue; }
      const data = await res.json();
      const TYPE_PRIORITY = { tourism: 1, historic: 2, amenity: 3, leisure: 4 };
      const seen = new Set();
      const pois = (data.elements || [])
        .filter(e => e.tags?.name)
        .map(e => ({
          name: e.tags.name,
          priority: TYPE_PRIORITY[Object.keys(TYPE_PRIORITY).find(k => e.tags[k])] || 5,
          type: Object.keys(TYPE_PRIORITY).find(k => e.tags[k]) || 'other',
          subtype: e.tags.tourism || e.tags.historic || e.tags.amenity || e.tags.leisure || '',
        }))
        .filter(p => { const k = p.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => a.priority - b.priority);

      console.log(`  ✓ OSM Overpass (${endpoint.split('/')[2]}): ${pois.length} unique POIs`);
      return pois;
    } catch (e) {
      console.warn(`  Overpass ${endpoint.split('/')[2]} failed: ${e.message}`);
    }
  }
  console.warn('  All Overpass mirrors failed, skipping OSM POIs');
  return [];
}

// ── Wikipedia targeted search per POI (mirrors searchAndFetchWikipedia) ────────
async function searchWikipediaForPoi(query) {
  try {
    const sRes = await fetchWithRetry(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`,
      { headers: { 'User-Agent': UA } }, 1, 800
    );
    if (!sRes.ok) return null;
    const sData = await sRes.json();
    const title = sData.query?.search?.[0]?.title;
    if (!title) return null;
    const eRes = await fetchWithRetry(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&explaintext=true&exintro=true&format=json&origin=*`,
      { headers: { 'User-Agent': UA } }, 1, 800
    );
    if (!eRes.ok) return null;
    const eData = await eRes.json();
    const page = Object.values(eData.query?.pages || {})[0];
    const text = page?.extract || '';
    if (text.length < 80) return null;
    return { text: cleanContentText(text), title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` };
  } catch { return null; }
}

// ── Reddit PullPush targeted search per POI ────────────────────────────────────
async function searchRedditForPoi(query) {
  const SUBS = ['travel', 'solotravel'];
  const allPosts = [];
  await Promise.allSettled(SUBS.map(async sub => {
    try {
      const url = `https://api.pullpush.io/reddit/search/submission/?q=${encodeURIComponent(query)}&subreddit=${sub}&sort=score&size=6`;
      const res = await fetchWithRetry(url, { headers: { 'User-Agent': UA } }, 1, 1000);
      if (!res.ok) return;
      const text = await res.text();
      if (text.trimStart().startsWith('<')) return;
      const data = JSON.parse(text);
      allPosts.push(...(data.data || []).filter(p => p.selftext && p.selftext.trim().length > 80));
    } catch { }
  }));

  // Fallback to DDG search for Reddit results if PullPush yielded nothing
  if (allPosts.length === 0) {
    const snips = await fetchRedditFromDuckDuckGo(query);
    if (snips.length > 0) {
      return snips.map((s, idx) => ({
        selftext: s,
        title: `Reddit search tip #${idx + 1}`,
        subreddit: 'travel',
        permalink: `/r/travel/search?q=${encodeURIComponent(query)}`,
        created_utc: Math.floor(Date.now() / 1000)
      }));
    }
  }

  return allPosts;
}

// ── Simple concurrency limiter ─────────────────────────────────────────────────
function pLimit(limit) {
  const queue = []; let active = 0;
  const next = () => { active--; if (queue.length > 0) { const { fn, resolve, reject } = queue.shift(); active++; fn().then(resolve, reject).finally(next); } };
  return fn => new Promise((resolve, reject) => {
    if (active < limit) { active++; fn().then(resolve, reject).finally(next); }
    else queue.push({ fn, resolve, reject });
  });
}

// ── Per-city orchestrator ─────────────────────────────────────────────────────
async function preprocessCity(cityName) {
  const slug    = toCitySlug(cityName);
  const base    = normalizeCityName(cityName).split(',')[0].trim();
  const outFile = path.resolve(OUT_DIR, `${slug}.json`);

  console.log(`\n${'═'.repeat(66)}`);
  console.log(`  ▶  ${cityName}   →  preprocessed/${slug}.json`);
  console.log(`${'═'.repeat(66)}`);

  // 1. Parallel fetch (wiki sources + SE)
  const [wvR, wpR, wtR, seR] = await Promise.allSettled([
    fetchWikivoyage(cityName),
    fetchWikipedia(cityName),
    fetchWikitravel(cityName),
    fetchStackExchange(cityName),
  ]);
  const wv = wvR.status === 'fulfilled' ? wvR.value : null;
  const wp = wpR.status === 'fulfilled' ? wpR.value : null;
  const wt = wtR.status === 'fulfilled' ? wtR.value : null;
  const se = seR.status === 'fulfilled' ? seR.value : null;

  // 2. Reddit city-level (rate-limited, separate)
  console.log('  → Reddit / PullPush (city-level)…');
  let rd = null;
  try { rd = await fetchRedditPullPush(cityName); } catch (e) { console.warn('  Reddit:', e.message); }

  // 3. OSM POIs via Nominatim geocode + bbox Overpass
  console.log('  → OSM Overpass (Nominatim + bbox)…');
  let osmPoisRaw = [];
  try { osmPoisRaw = await fetchOsmPois(cityName); } catch (e) { console.warn('  OSM:', e.message); }
  const osmPoiNames = osmPoisRaw.map(p => typeof p === 'string' ? p : p.name);

  // 4. NLP extraction, city-level sources
  console.log('  → NLP extraction (city-level)…');
  const today = new Date().toISOString().slice(0, 10);
  const allNodes = [];

  const extract = (src, type, label, url) => {
    if (!src) return;
    const ns = extractNodes(src.text, cityName, osmPoiNames, type, label, today, url || null);
    allNodes.push(...ns);
    console.log(`     ${label.padEnd(14)} → ${ns.length} nodes`);
  };

  extract(wv, 'wikivoyage',    'Wikivoyage',    wv?.url);
  extract(wt, 'wikitravel',    'Wikitravel',    wt?.url);
  extract(wp, 'wikipedia',     'Wikipedia',     wp?.url);
  extract(se, 'stackexchange', 'StackExchange', null);
  extract(rd, 'reddit',        'Reddit',        null);

  // 5. Deep-research per-POI pass (mirrors runDeepResearchPass in KnowledgePanel.jsx)
  // For each notable POI (e.g. "Musée d'Orsay"), search:
  //   - Wikipedia: "Musée d'Orsay Paris"
  //   - Reddit:    "Musée d'Orsay Paris"
  // This adds POI-specific reviews, tips, and descriptions to the knowledge graph.
  console.log(`  → Per-POI deep research (${osmPoiNames.length} OSM POIs)…`);

  // Supplement with top-mentioned POIs from pass-1 nodes (catches things Overpass missed)
  // Filter: must have ≥2 words, not be a common/transport/generic word
  const placeCounts = new Map();
  allNodes.forEach(n => {
    const p = n.place?.trim();
    if (!p || p.includes(' · ')) return;
    const words = p.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length < 2) return; // skip single-word generic entities
    if (words.some(w => ENTITY_COMMON_WORDS.has(w) || HEURISTIC_COMMON.has(w))) return;
    placeCounts.set(p, (placeCounts.get(p) || 0) + 1);
  });
  // When Overpass succeeded, only top 12 from pass-1 needed as supplement
  // When Overpass failed (0 POIs), use top 30 from pass-1 to compensate
  const pass1Limit = osmPoiNames.length > 0 ? 12 : 30;
  const pass1TopPOIs = [...placeCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, pass1Limit).map(([name]) => name);

  // Merge: Overpass notable POIs first, pass-1 fills gaps, cap at 60 to bound runtime
  const allPOIs = [...new Set([...osmPoiNames, ...pass1TopPOIs])].slice(0, 60);
  console.log(`     ${allPOIs.length} POI targets (${osmPoiNames.length} Overpass + ${pass1TopPOIs.length} pass-1 top)`);

  // Category-level overview targets
  const categoryTargets = [
    { label: `${base} Districts`,  wikiQuery: `districts neighbourhoods ${base}` },
    { label: `${base} Transport`,  wikiQuery: `transport getting around ${base}` },
    { label: `${base} Food`,       wikiQuery: `restaurants food dining ${base}` },
    { label: `${base} Culture`,    wikiQuery: `culture history museums ${base}` },
  ];

  const poiTargets = allPOIs.map(p => ({
    label: p,
    wikiQuery: `${p} ${base}`,
    redditQuery: `${p} ${base}`,
  }));

  const allTargets = [...poiTargets, ...categoryTargets];
  const limiter = pLimit(4); // 4 concurrent HTTP requests max
  let doneCount = 0;

  await Promise.allSettled(
    allTargets.map(target => limiter(async () => {
      doneCount++;
      if (doneCount % 10 === 0 || doneCount === 1)
        process.stdout.write(`     [${doneCount}/${allTargets.length}] ${target.label.slice(0,40)}…\n`);

      // Wikipedia per-POI
      try {
        await sleep(150); // polite Wikipedia rate-limit
        const wikiRes = await searchWikipediaForPoi(target.wikiQuery);
        if (wikiRes && wikiRes.text.length > 100) {
          const ns = extractNodes(wikiRes.text, cityName, osmPoiNames, 'wikipedia', `Wikipedia: ${target.label}`, today, wikiRes.url);
          if (ns.length > 0) allNodes.push(...ns);
        }
      } catch { }

      // Reddit per-POI (NLP extraction, no Ollama needed)
      try {
        await sleep(100);
        const posts = await searchRedditForPoi(target.redditQuery);
        if (posts.length > 0) {
          const text = posts.map(p => {
            const dateStr = p.created_utc ? new Date(p.created_utc * 1000).toISOString().slice(0, 10) : today;
            const sub  = p.subreddit || 'travel';
            const link = p.permalink ? `https://reddit.com${p.permalink}` : `https://reddit.com/r/${sub}`;
            return `[SOURCE:reddit r/${sub} "${p.title||'Post'}" url:${link} ${dateStr}]\n${cleanContentText(p.selftext||'')}`;
          }).join('\n\n---\n\n');
          const ns = extractNodes(text, cityName, osmPoiNames, 'reddit', `Reddit: ${target.label}`, today, null);
          if (ns.length > 0) allNodes.push(...ns);
        }
      } catch { }
    }))
  );

  // Deduplicate all nodes by claim text across all sources
  const globalSeen = new Set();
  const uniqueNodes = allNodes.filter(n => {
    const k = (n.claim || '').toLowerCase().trim();
    if (globalSeen.has(k)) return false;
    globalSeen.add(k); return true;
  });

  console.log(`\n     Per-POI deep pass: ${uniqueNodes.length - (allNodes.length - uniqueNodes.length)} net new nodes after dedup`);

  // 6. Write JSON
  const output = {
    city:        cityName,
    slug,
    generatedAt: new Date().toISOString(),
    osmPois:     osmPoiNames,
    nodeCount:   uniqueNodes.length,
    nodes:       uniqueNodes,
    sources: {
      wikivoyage:    wv ? { text: wv.text, url: wv.url, title: wv.title }    : null,
      wikitravel:    wt ? { text: wt.text, url: wt.url, title: wt.title }    : null,
      wikipedia:     wp ? { text: wp.text, url: wp.url, title: wp.title }    : null,
      stackexchange: se ? { text: se.text, count: se.count }                 : null,
      reddit:        rd ? { count: rd.count }                                 : null,
    },
  };

  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n  ✅  ${slug}.json · ${uniqueNodes.length} nodes · ${osmPoiNames.length} OSM POIs\n`);
  return output;
}

// ── City list ─────────────────────────────────────────────────────────────────
const ALL_CITIES = [
  // Europe
  'London','Paris','Rome','Barcelona','Amsterdam','Berlin','Vienna',
  'Prague','Budapest','Lisbon','Madrid','Athens','Istanbul','Dublin',
  'Copenhagen','Stockholm','Oslo','Helsinki','Warsaw','Krakow',
  'Brussels','Bruges','Zurich','Geneva','Milan','Florence','Venice',
  'Munich','Hamburg','Edinburgh','Porto','Seville','Valencia',
  'Reykjavik','Tallinn','Riga','Vilnius','Ljubljana','Dubrovnik','Split',
  // Americas
  'New York','Los Angeles','San Francisco','Chicago','Miami','New Orleans',
  'Las Vegas','Washington DC','Boston','Seattle','Toronto','Montreal',
  'Vancouver','Mexico City','Buenos Aires','Rio de Janeiro','Bogota','Lima',
  'Cartagena','Medellin','Santiago','Cusco','Cancun',
  // Asia
  'Tokyo','Kyoto','Osaka','Bangkok','Singapore','Hong Kong','Seoul',
  'Beijing','Shanghai','Taipei','Bali','Kuala Lumpur','Ho Chi Minh City',
  'Hanoi','Mumbai','Delhi','Jaipur','Dubai','Abu Dhabi','Muscat',
  'Kathmandu','Colombo','Phnom Penh','Yangon','Chiang Mai',
  // Africa & Middle East
  'Cape Town','Marrakech','Cairo','Nairobi','Tel Aviv','Amman','Beirut',
  // Oceania
  'Sydney','Melbourne','Auckland','Queenstown',
];

// ── CLI argument parsing ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
let citiesToProcess = [];

if (args.length === 0) {
  citiesToProcess = ALL_CITIES;
} else if (args[0] === '--city' && args[1]) {
  citiesToProcess = [args[1]];
} else {
  // Each positional arg is a slug ("london", "new_york") or title-case ("Paris")
  citiesToProcess = args.map(a => {
    const lower = a.toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ');
    const match = ALL_CITIES.find(c =>
      normalizeCityName(c).split(',')[0].trim().toLowerCase() === lower
    );
    return match || a.split(/[_ -]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  });
}

console.log('\n┌─────────────────────────────────────────────────────────────────┐');
console.log('│       TravelScout  ·  Offline Knowledge-Graph Preprocessor        │');
console.log('└─────────────────────────────────────────────────────────────────┘');
console.log(`  Cities  : ${citiesToProcess.length}`);
console.log(`  Output  : ${OUT_DIR}`);
console.log(`  Started : ${new Date().toLocaleString()}`);
console.log('  Tip     : pass city names as args to process only specific cities.');
console.log('            e.g.  node scripts/fetch_and_preprocess_all.js london paris\n');

// ── Main loop, sequential to respect API rate limits ─────────────────────────
(async () => {
  const ok = [], fail = [];
  for (let i = 0; i < citiesToProcess.length; i++) {
    const city = citiesToProcess[i];
    console.log(`[${i+1}/${citiesToProcess.length}] ${city}`);
    try {
      await preprocessCity(city);
      ok.push(city);
    } catch (e) {
      console.error(`✗ FAILED ${city}: ${e.message}`);
      fail.push(city);
    }
    // Pause between cities to be polite to all APIs
    if (i < citiesToProcess.length - 1) {
      process.stdout.write('  … pausing 4s … ');
      await sleep(4000);
      console.log('done');
    }
  }

  const dur = `${Math.floor((Date.now() - Date.parse(new Date())) / 60000)} min`;
  console.log('\n┌─────────────────────────────────────────────────────────────────┐');
  console.log(`│  DONE  ${ok.length} cities ✓   ${fail.length} failed   output: ${OUT_DIR.slice(-40)}`);
  if (fail.length) console.log(`│  Failed: ${fail.join(', ')}`);
  console.log('└─────────────────────────────────────────────────────────────────┘\n');
})();
