import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Brain, FileText, AlertTriangle, GitBranch, Clock, TrendingDown, Check, Plus, Trash2, Loader2, Info, X, ChevronDown, ChevronUp, Globe, MessageSquare, Star, Zap, Shield, ArrowRight, Filter, BarChart2, Wifi, BookOpen, RefreshCw, ExternalLink, Sparkles, MapPin, Utensils, Train, Landmark, ShoppingBag, Layers, ThumbsUp, ThumbsDown, Download, CheckCircle2 } from 'lucide-react';
import KnowledgeGraphView from './KnowledgeGraphView';
import KnowledgeConstellationView from './KnowledgeConstellationView';
import ExtractionProgress from './ExtractionProgress';
import KnowledgeRadarView from './KnowledgeRadarView';
import nlpData from '../../data/nlp_data.json';
import { API, HAS_DEV_PROXY, assetUrl } from '../../endpoints';

// ── Credibility model ──────────────────────────────────────────────────────────
// Returns { score, low, high } — the CI widens when fewer corroborating sources exist
function computeCredibility(node, samePlaceNodes) {
  const isVolatile = node.knowledge_type === 'volatile';
  const decayRate = isVolatile ? 0.8 : 0.18;

  const refDate = node.source?.date ? new Date(node.source.date) : new Date(node.extractedAt || Date.now());
  const ageYears = Math.max(0, (Date.now() - refDate.getTime()) / (365.25 * 24 * 3600 * 1000));
  const recency = Math.exp(-decayRate * ageYears);

  const sourceWeights = { blog: 0.8, review: 0.75, reddit: 0.7, manual: 1.0, wikivoyage: 0.85, wikipedia: 0.82, other: 0.65 };
  const srcW = sourceWeights[node.source?.sourceType] ?? 0.7;

  const corroborating = samePlaceNodes.filter(n => n.evaluation?.sentiment === node.evaluation?.sentiment);
  const corroborationBonus = Math.min(0.25, corroborating.length * 0.08);

  const score = Math.min(1, recency * srcW + corroborationBonus);
  // Uncertainty interval: fewer evidence sources → wider band (Wald-style)
  const n = samePlaceNodes.length + 1;
  const unc = Math.min(0.32, 0.38 / Math.sqrt(n));
  return { score, low: Math.max(0, score - unc), high: Math.min(1, score + unc) };
}

// ── Contradiction detector ────────────────────────────────────────────────────
function detectContradictions(nodes) {
  const byPlace = {};
  nodes.forEach(n => {
    const key = n.place?.toLowerCase();
    if (!key) return;
    if (!byPlace[key]) byPlace[key] = { place: n.place, positive: [], negative: [] };
    if (n.evaluation?.sentiment === 'positive') byPlace[key].positive.push(n);
    if (n.evaluation?.sentiment === 'negative') byPlace[key].negative.push(n);
  });
  return Object.values(byPlace)
    .filter(p => p.positive.length > 0 && p.negative.length > 0)
    .sort((a, b) => (b.positive.length + b.negative.length) - (a.positive.length + a.negative.length));
}

// ── Credibility badge with confidence interval ────────────────────────────────
function CredBar({ score, low, high }) {
  const color = score > 0.7 ? '#10b981' : score > 0.4 ? '#f59e0b' : '#ef4444';
  const label = score > 0.7 ? 'High' : score > 0.4 ? 'Med' : 'Low';
  const hasCI = low !== undefined && high !== undefined;
  const title = hasCI
    ? `Credibility: ${(score * 100).toFixed(0)}% (CI ${(low * 100).toFixed(0)}%–${(high * 100).toFixed(0)}%)`
    : `Credibility: ${(score * 100).toFixed(0)}%`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }} title={title}>
      <div style={{ width: '48px', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', position: 'relative', overflow: 'visible' }}>
        {hasCI && (
          <div style={{
            position: 'absolute', top: 0,
            left: `${low * 100}%`, width: `${(high - low) * 100}%`,
            height: '100%', background: color + '30', borderRadius: '3px',
          }} />
        )}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: `${score * 100}%`, height: '100%',
          background: color, borderRadius: '3px',
        }} />
      </div>
      <span style={{ fontSize: '0.58rem', color, fontWeight: '700' }}>{label}</span>
    </div>
  );
}

// ── Age badge ─────────────────────────────────────────────────────────────────
function AgeBadge({ node }) {
  const refDate = node.source?.date ? new Date(node.source.date) : new Date(node.extractedAt || Date.now());
  const ageYears = (Date.now() - refDate.getTime()) / (365.25 * 24 * 3600 * 1000);
  const isVolatile = node.knowledge_type === 'volatile';
  const stale = isVolatile ? ageYears > 1 : ageYears > 4;
  const label = ageYears < 0.08 ? 'This week' : ageYears < 1 ? `${Math.round(ageYears * 12)}mo ago` : `${ageYears.toFixed(1)}yr ago`;
  return (
    <span style={{ fontSize: '0.57rem', color: stale ? '#f59e0b' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
      {stale && <TrendingDown size={9} color="#f59e0b" />}{label}
    </span>
  );
}

// ── Claim type badge ──────────────────────────────────────────────────────────
const CLAIM_META = {
  temporal: { color: '#0ea5e9', icon: '⏱', label: 'Timing' },
  conditional: { color: '#8b5cf6', icon: '↔', label: 'Advice' },
  evaluation: { color: '#f59e0b', icon: '★', label: 'Opinion' },
  sequence: { color: '#10b981', icon: '→', label: 'Sequence' },
};

function ClaimBadge({ type }) {
  const m = CLAIM_META[type] || { color: '#6b7280', icon: '?', label: type };
  return (
    <span style={{ fontSize: '0.57rem', padding: '1px 6px', borderRadius: '8px', background: m.color + '20', border: `1px solid ${m.color}40`, color: m.color, fontWeight: '700' }}>
      {m.icon} {m.label}
    </span>
  );
}

// ── Source badge ───────────────────────────────────────────────────────────────
const getGroupingCategory = (node) => {
  const p = (node.place || '').toLowerCase();
  if (p.includes('safety') || p.includes('health')) return 'Safety & Health';
  if (p.includes('food') || p.includes('drink')) return 'Food & Drink';
  if (p.includes('transport') || p.includes('accommodation')) return 'Transport & Accommodation';
  if (p.includes('culture') || p.includes('history')) return 'Culture & History';
  if (p.includes('shopping') || p.includes('districts')) return 'Shopping & Districts';
  if (p.includes('tips') || p.includes('climate')) return 'Travel Tips & Climate';
  return 'Miscellaneous';
};

const getCategoryIcon = (category) => {
  if (category === 'Safety & Health') return Shield;
  if (category === 'Food & Drink') return Utensils;
  if (category === 'Transport & Accommodation') return Train;
  if (category === 'Culture & History') return Landmark;
  if (category === 'Shopping & Districts') return ShoppingBag;
  if (category === 'Travel Tips & Climate') return Sparkles;
  return Layers;
};

// ── Source badge ───────────────────────────────────────────────────────────────
const SOURCE_META = {
  wikivoyage: { color: '#0ea5e9', icon: '🗺', label: 'Wikivoyage' },
  wikitravel: { color: '#06b6d4', icon: '🧭', label: 'Wikitravel' },
  wikipedia: { color: '#6b7280', icon: '📖', label: 'Wikipedia' },
  reddit: { color: '#f97316', icon: '💬', label: 'Reddit' },
  stackexchange: { color: '#f59e0b', icon: '🏷', label: 'StackExchange' },
  blog: { color: '#8b5cf6', icon: '✍', label: 'Blog' },
  review: { color: '#ec4899', icon: '★', label: 'Review' },
  manual: { color: '#10b981', icon: '📝', label: 'Manual' },
  other: { color: '#6b7280', icon: '?', label: 'Other' },
};

function SourceBadge({ sourceType }) {
  const m = SOURCE_META[sourceType] || SOURCE_META.other;
  return (
    <span style={{ fontSize: '0.57rem', padding: '1px 5px', borderRadius: '6px', background: m.color + '18', border: `1px solid ${m.color}30`, color: m.color, fontWeight: '600' }}>
      {m.icon} {m.label}
    </span>
  );
}

// ── Module-level constants — loaded from src/data/nlp_data.json ───────────────
// To update these word lists run:  python scripts/train_nlp.py
const ENTITY_COMMON_WORDS = new Set(nlpData.entityCommonWords);
const HEURISTIC_COMMON = new Set(nlpData.heuristicCommon);

// ── Extra non-place words not caught by the NLP training corpus ───────────────
// These are injected into both ENTITY_COMMON_WORDS and HEURISTIC_COMMON at
// runtime so neither the NLP entity regex nor isLocationNode passes them through.
const EXTRA_NON_PLACE_WORDS = [
  // Conjunctions / connectives — never place names
  'although', 'however', 'therefore', 'moreover', 'nevertheless', 'nonetheless', 'besides',
  'furthermore', 'consequently', 'accordingly', 'meanwhile', 'otherwise', 'instead',
  'indeed', 'actually', 'basically', 'essentially', 'generally', 'typically', 'usually',
  'apparently', 'obviously', 'clearly', 'naturally', 'literally', 'simply', 'especially',
  'particularly', 'recently', 'finally', 'previously', 'currently', 'originally',
  // Transport modes / items (not venues)
  'taxi', 'taxis', 'cab', 'cabs', 'uber', 'lyft', 'bus', 'buses', 'tube', 'metro', 'tram',
  'ferry', 'ferries', 'subway', 'trolley', 'shuttle', 'minibus', 'coach', 'coaches',
  'oyster', 'travelcard', 'railcard', 'tfl', 'transit',
  // Titles without a proper name following
  'princess', 'prince', 'duke', 'duchess', 'lord', 'lady', 'queen', 'king', 'sir', 'dame',
  'count', 'countess', 'earl', 'baron', 'baroness', 'sultan', 'emperor', 'empress',
  // Generic standalone nouns frequently mis-extracted
  'assembly', 'parliament', 'council', 'committee', 'commission', 'authority', 'agency',
  'charity', 'foundation', 'trust', 'institute', 'society', 'association', 'federation',
  'staff', 'crew', 'team', 'group', 'crowd', 'locals', 'tourists', 'visitors', 'everyone',
  'people', 'pedestrians', 'cyclists', 'drivers', 'passengers', 'travellers', 'travelers',
  // Generic place words that need a qualifier to be meaningful
  'pub', 'pubs', 'bar', 'bars', 'cafe', 'cafes', 'kiosk', 'stall', 'booth', 'outlet',
  'office', 'offices', 'branch', 'branches', 'branch', 'depot', 'hub', 'terminal',
  'bridge', 'bridges', 'street', 'road', 'avenue', 'lane', 'alley', 'path', 'trail',
  'park', 'square', 'plaza', 'yard', 'court', 'close', 'row', 'gardens', 'terrace',
  // Directions / generic modifiers
  'north', 'south', 'east', 'west', 'central', 'upper', 'lower', 'inner', 'outer', 'main',
  // Seasons / time (sometimes capitalised mid-sentence)
  'summer', 'winter', 'spring', 'autumn', 'morning', 'afternoon', 'evening', 'night',
  // Famous people / non-place concepts mis-extracted by the LLM
  'harry', 'yoko', 'dua', 'turkish', 'visa', 'damien', 'christopher', 'danish', 'milan', 'fringe',
  'karl', 'benjamin', 'elizabeth', 'holiday', 'suvarnabhumi', 'airlines', 'passport', 'passports',
  'rental', 'rentals', 'flight', 'flights', 'ticket', 'tickets', 'fare', 'fares', 'insurance',
  'hotel', 'hotels', 'accommodation', 'accommodations', 'stay', 'stays', 'trip', 'trips',
  'booking', 'bookings', 'itinerary', 'itineraries'
];
EXTRA_NON_PLACE_WORDS.forEach(w => {
  ENTITY_COMMON_WORDS.add(w);
  HEURISTIC_COMMON.add(w);
});

// Naive Bayes class names — nodes whose `place` matches these are Topics, not Locations
const NLP_CATEGORY_NAMES = new Set(
  nlpData.trainingData.map(d => d.class.toLowerCase())
);

// Naive Bayes Machine Learning Classifier for category categorization
class NaiveBayesClassifier {
  constructor() {
    this.vocab = new Set();
    this.classDocCounts = {};
    this.classWordCounts = {};
    this.wordCountsInClass = {};
    this.totalDocs = 0;
  }

  train(doc, className) {
    const words = this.tokenize(doc);
    this.totalDocs++;
    this.classDocCounts[className] = (this.classDocCounts[className] || 0) + 1;
    this.classWordCounts[className] = (this.classWordCounts[className] || 0) + words.length;

    if (!this.wordCountsInClass[className]) {
      this.wordCountsInClass[className] = {};
    }

    words.forEach(word => {
      this.vocab.add(word);
      this.wordCountsInClass[className][word] = (this.wordCountsInClass[className][word] || 0) + 1;
    });
  }

  tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !ENTITY_COMMON_WORDS.has(w));
  }

  classify(doc) {
    const words = this.tokenize(doc);
    let bestClass = null;
    let bestScore = -Infinity;

    const classes = Object.keys(this.classDocCounts);
    if (classes.length === 0) return 'General';

    classes.forEach(className => {
      let score = Math.log(this.classDocCounts[className] / this.totalDocs);
      const totalWordsInClass = this.classWordCounts[className];
      const vocabSize = this.vocab.size;

      words.forEach(word => {
        const count = (this.wordCountsInClass[className][word] || 0) + 1;
        score += Math.log(count / (totalWordsInClass + vocabSize));
      });

      if (score > bestScore) {
        bestScore = score;
        bestClass = className;
      }
    });

    return bestClass || 'General';
  }
}

const mlClassifier = new NaiveBayesClassifier();
// Training data loaded from src/data/nlp_data.json — update with: python scripts/train_nlp.py
nlpData.trainingData.forEach(item => mlClassifier.train(item.text, item.class));

// Assigns a semantic category title from claim content using Naive Bayes classifier
function assignSemanticCategory(claim, cityBase) {
  const cat = mlClassifier.classify(claim);
  return `${cityBase} · ${cat}`;
}

// Returns true when a node's place is a real named location (not a semantic topic category)
function isLocationNode(node) {
  const p = (node.place || '').trim();
  if (!p || p.length < 2) return false;
  const pLower = p.toLowerCase();
  if (p.includes(' · ')) return false;              // semantic category from assignSemanticCategory
  if (NLP_CATEGORY_NAMES.has(pLower)) return false; // bare category name (Climate, Shopping…)
  if (HEURISTIC_COMMON.has(pLower)) return false;   // generic word (High, District…)
  if (ENTITY_COMMON_WORDS.has(pLower)) return false;
  // Check first word — catches "Snow in London", "British Empire" etc. from old cached nodes
  const firstWord = pLower.split(/\s+/)[0];
  if (HEURISTIC_COMMON.has(firstWord) || ENTITY_COMMON_WORDS.has(firstWord)) return false;
  return true;
}

// ── Clean text helper ──────────────────────────────────────────────────────────
function cleanContentText(text) {
  if (!text) return '';
  return text
    // Wikivoyage <listing ...> tags (with or without body)
    .replace(/<listing\b[^>]*>[\s\S]*?<\/listing>/gi, ' ')
    .replace(/<listing\b[^>]*\/>/gi, ' ')
    .replace(/<listing\b[^>]*>/gi, ' ')
    // Wiki image / file embeds — remove entirely
    .replace(/\[\[(?:Image|File|Media):[^\]]*?\]\]/gi, '')
    // Wiki links with display text [[target|label]] → label
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    // Simple wiki links [[text]] → text
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    // Wiki templates {{...}} — remove
    .replace(/\{\{[\s\S]*?\}\}/g, '')
    // Leftover wiki markup fragments like "|20px]]" or "alt=... ]]"
    .replace(/\|[^[\]]*\]\]/g, '')
    .replace(/\]\]/g, '')
    // All remaining HTML tags
    .replace(/<[^>]+>/g, ' ')
    // URLs
    .replace(/https?:\/\/[^\s]+/g, '')
    // HTML entities
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── DuckDuckGo HTML Reddit Search Fallback (fixed regex for modern DDG HTML) ──
async function fetchRedditFromDuckDuckGo(query) {
  if (!HAS_DEV_PROXY) return [];
  try {
    const qStr = `site:reddit.com ${query} travel tips`;
    const url = `/ddg-proxy/html/?q=${encodeURIComponent(qStr)}&kl=en-us`;
    const res = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(7000) });
    if (!res.ok) { console.log('DDG not ok:', res.status); return []; }
    const html = await res.text();
    const snippets = [];
    
    // Modern DDG HTML result parsing
    const rx = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = rx.exec(html)) !== null) {
      const cleanText = cleanContentText(match[1].replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' '));
      if (cleanText.length > 30 && !snippets.includes(cleanText)) {
        snippets.push(cleanText);
      }
    }
    
    // Fallback parsing for other styles
    if (snippets.length === 0) {
      const fallbackRx = /<div class="result__snippet"[^>]*>([\s\S]*?)<\/div>/gi;
      while ((match = fallbackRx.exec(html)) !== null) {
        const cleanText = cleanContentText(match[1].replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' '));
        if (cleanText.length > 30 && !snippets.includes(cleanText)) {
          snippets.push(cleanText);
        }
      }
    }
    
    console.log(`DDG: ${snippets.length} snippets for: ${qStr.slice(0, 60)}`);
    return snippets;
  } catch (e) {
    console.error('DDG search error:', e.message);
    return [];
  }
}

// ── Subreddit discovery via DuckDuckGo ────────────────────────────────────────
// Searches site:reddit.com/r/ for the city and extracts subreddit names from result URLs.
// Finds city/country-specific subs (r/JapanTravel, r/london, r/Netherlands) that generic
// hardcoded lists miss entirely.
async function discoverCitySubreddits(cityName) {
  if (!HAS_DEV_PROXY) return [];
  const EXCLUDE = new Set(['wiki', 'search', 'comments', 'user', 'all', 'popular', 'submit', 'message', 'login', 'register', 'help', 'about', 'r', 'new', 'hot', 'top', 'controversial']);
  try {
    const qStr = `site:reddit.com/r/ "${cityName}" travel`;
    const url = `/ddg-proxy/html/?q=${encodeURIComponent(qStr)}&kl=en-us`;
    const res = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const html = await res.text();
    const rx = /reddit\.com\/r\/([a-zA-Z0-9_]{2,30})/gi;
    const found = new Set();
    let m;
    while ((m = rx.exec(html)) !== null) {
      const sub = m[1].toLowerCase();
      if (!EXCLUDE.has(sub)) found.add(sub);
    }
    const subs = [...found].slice(0, 8);
    console.log(`[SubredditDiscover] "${cityName}" →`, subs);
    return subs;
  } catch (e) {
    console.log('[SubredditDiscover]', e.message);
    return [];
  }
}

// ── PullPush.io — open Reddit archive, no auth required ────────────────────────
// Tries direct CORS request first (PullPush allows cross-origin), then Vite proxy fallback
async function fetchRedditViaPullPush(cityName) {
  const results = [];
  const PULLPUSH_BASE = 'https://api.pullpush.io';
  const PROXY_BASE = '/pullpush-proxy';
  const citySlug = cityName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const DEFAULT_SUBS = ['travel', 'solotravel', 'backpacking'];
  // PullPush rate-limits bursts (HTTP 429). On the hosted site we send fewer queries, one at a time.
  const GENERIC_QUERIES = HAS_DEV_PROXY ? [`${cityName} travel tips`, `${cityName} itinerary`, `${cityName}`] : [cityName];
  // City-specific subreddit (r/london, r/paris, etc.) gets broader queries
  const CITY_QUERIES = HAS_DEV_PROXY ? [`${cityName} travel`, `${cityName} tips`, `visiting ${cityName}`, cityName] : [`${cityName} tips`, cityName];

  const fetchSubs = async (subs, queries, baseUrl, size = 50) => {
    const jobs = subs.flatMap(sub => queries.map(q => ({ sub, q })));
    const runJob = async ({ sub, q }) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const url = `${baseUrl}/reddit/search/submission/?q=${encodeURIComponent(q)}&subreddit=${sub}&sort=score&size=${size}`;
          const res = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(10000) });
          if (res.status === 429) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
          if (!res.ok) { console.log(`[PullPush] ${res.status} for sub=${sub} q="${q}"`); return; }
          const text = await res.text();
          if (text.trimStart().startsWith('<')) { console.log(`[PullPush] HTML response — blocked`); return; }
          const data = JSON.parse(text);
          const posts = (data.data || []).filter(p =>
            p.selftext && p.selftext !== '[deleted]' && p.selftext !== '[removed]' && p.selftext.trim().length > 50
          );
          console.log(`[PullPush] r/${sub} "${q}" → ${posts.length} posts`);
          results.push(...posts);
          return;
        } catch (e) { console.log(`[PullPush] Error r/${sub} "${q}": ${e.message}`); return; }
      }
      console.log(`[PullPush] still rate-limited for r/${sub} "${q}" — skipped`);
    };
    if (HAS_DEV_PROXY) await Promise.allSettled(jobs.map(runJob));
    else for (const job of jobs) await runJob(job);
  };

  // Phase 1: generic travel subs + city subreddit discovery in parallel
  const [, discoveryResult] = await Promise.allSettled([
    fetchSubs(DEFAULT_SUBS, GENERIC_QUERIES, PULLPUSH_BASE, 50),
    discoverCitySubreddits(cityName),
  ]);

  // Phase 2: city-specific subreddit (r/london) with wider queries — sequential to avoid rate limits
  if (citySlug) {
    await fetchSubs([citySlug], CITY_QUERIES, PULLPUSH_BASE, 100);
  }

  // Phase 3: any other discovered subs (r/VisitingLondon etc.)
  const discovered = discoveryResult.status === 'fulfilled' ? discoveryResult.value : [];
  const extraSubs = discovered.filter(s => !DEFAULT_SUBS.includes(s) && s !== citySlug);
  if (extraSubs.length > 0) {
    console.log(`[PullPush] Fetching ${extraSubs.length} discovered subs: ${extraSubs.join(', ')}`);
    await fetchSubs(extraSubs, GENERIC_QUERIES, PULLPUSH_BASE, 50);
  }

  // If direct failed entirely, retry via Vite proxy
  if (results.length === 0 && HAS_DEV_PROXY) {
    console.log('[PullPush] Direct failed, trying Vite proxy...');
    await fetchSubs(DEFAULT_SUBS, GENERIC_QUERIES, PROXY_BASE, 50);
  }

  return results;
}

// ── Sentiment Dictionary — loaded from src/data/nlp_data.json ─────────────────
const SENTIMENT_DICTIONARY = nlpData.sentimentDictionary;

function analyzeSentimentNLP(text) {
  const words = text.toLowerCase().split(/[^a-z]+/);
  let score = 0;
  let matches = 0;
  words.forEach(w => {
    if (SENTIMENT_DICTIONARY[w] !== undefined) {
      score += SENTIMENT_DICTIONARY[w];
      matches++;
    }
  });

  if (matches === 0) return { sentiment: "neutral", intensity: 0.5 };
  const avg = score / matches;
  if (avg > 0.12) return { sentiment: "positive", intensity: Math.min(1.0, 0.5 + avg) };
  if (avg < -0.12) return { sentiment: "negative", intensity: Math.min(1.0, 0.5 - avg) };
  return { sentiment: "neutral", intensity: 0.5 };
}

const cleanNameForMatching = (name) => {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/^(the|a|an)\s+/g, '')
    .replace(/\s+(station|tube station|underground station|museum|gallery|park)$/g, '')
    .trim();
};

function extractKnowledgeNLP(text, city, placeNames = [], sourceType, sourceLabel, date, url) {
  const chunks = text.split(/\n+---\n+/);
  const nodes = [];
  let nodeCount = 0;

  // "in" and "at" excluded: they create false compound names like "Snow in London", "Market at Bridge"
  const entityRegex = /\b([A-Z][a-z]+(?:\s+(?:of|the|and|de|for)\s+[A-Z][a-z]+|\s+[A-Z][a-z]+)*)\b/g;

  chunks.forEach(chunk => {
    let currentSourceType = sourceType;
    let currentSourceLabel = sourceLabel;
    let currentDate = date;
    let currentUrl = url;

    const headerMatch = chunk.trim().match(/^\[SOURCE:([^\]]+)\]/);
    let contentToProcess = chunk;
    if (headerMatch) {
      const header = headerMatch[1];
      contentToProcess = chunk.slice(headerMatch[0].length);

      const urlMatch = header.match(/url:([^\s"']+)/);
      if (urlMatch) {
        currentUrl = urlMatch[1];
      }

      const dateMatch = header.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        currentDate = dateMatch[1];
      }

      if (header.includes('reddit')) {
        currentSourceType = 'reddit';
        const subMatch = header.match(/r\/([a-zA-Z0-9_]+)/);
        currentSourceLabel = subMatch ? `r/${subMatch[1]}` : 'Reddit';
      } else if (header.includes('stackexchange')) {
        currentSourceType = 'stackexchange';
        currentSourceLabel = 'StackExchange';
      } else if (header.includes('wikivoyage')) {
        currentSourceType = 'wikivoyage';
        currentSourceLabel = 'Wikivoyage';
      } else if (header.includes('wikitravel')) {
        currentSourceType = 'wikitravel';
        currentSourceLabel = 'Wikitravel';
      } else if (header.includes('wikipedia')) {
        currentSourceType = 'wikipedia';
        currentSourceLabel = 'Wikipedia';
      }
    }

    const cleanedText = contentToProcess.replace(/\[\d+\]/g, '');
    const sentences = cleanedText.match(/[^.!?\n]+[.!?\n]+/g) || [cleanedText];

    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      const minLength = currentSourceType === 'reddit' ? 15 : 25;
      const maxLength = currentSourceType === 'reddit' ? 350 : 250;
      if (trimmed.length < minLength || trimmed.length > maxLength) return;

      let foundPlace = null;

      // Step 1: Match against known trip place names (highest precision) using clean name mapping
      for (const originalName of placeNames) {
        const cleanName = cleanNameForMatching(originalName);
        if (cleanName.length > 2) {
          // Single-word clean names (e.g. "exchange" from "The Exchange") are too generic
          // — require the full name including article so "exchange students" doesn't match.
          const matchName = cleanName.split(/\s+/).length === 1
            ? originalName.toLowerCase().trim()
            : cleanName;
          const escaped = matchName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp('\\b' + escaped + '\\b', 'i');
          if (regex.test(trimmed)) {
            foundPlace = originalName;
            break;
          }
        }
      }

      // Step 2: Multi-word entity fallback — or single-word if it's a known POI
      if (!foundPlace) {
        let match;
        entityRegex.lastIndex = 0;
        while ((match = entityRegex.exec(trimmed)) !== null) {
          const ent = match[1];
          const entLower = ent.toLowerCase();
          const entWords = entLower.split(/\s+/).filter(w => w.length > 2);
          // Allow single-word entities only if they're a known POI (Louvre, Tate, Pantheon…)
          if (entWords.length < 2) {
            const isKnownPOI = placeNames.some(p => p.toLowerCase() === entLower);
            if (!isKnownPOI) continue;
          }
          if (entLower === city.toLowerCase()) continue;
          // Reject if any word is a known non-place word (catches "Oyster Card", "Assembly Hall", etc.)
          if (entWords.some(w => ENTITY_COMMON_WORDS.has(w) || HEURISTIC_COMMON.has(w))) continue;
          foundPlace = ent;
          break;
        }
      }

      // Step 3: Semantic category fallback — all travel source text is about the city,
      // so unmatched claims get a meaningful category title based on content keywords
      if (!foundPlace) {
        const cityBase = city.split(',')[0].trim();
        if (cityBase.length > 2) {
          foundPlace = assignSemanticCategory(trimmed, cityBase);
        }
      }

      if (!foundPlace) return;

      // Relax action-verb matching for Reddit because comments are casual
      const hasTipAction = currentSourceType === 'reddit' || /should|must|avoid|recommend|book|ticket|price|fee|hour|time|scam|trap|crowd|watch|keep|always|never|free|visit|see|go|walk|travel|trip|station|line|great|good|best|love|amazing|wonderful|nice|fantastic|awesome|beautiful|perfect|delicious|tasty|worth|favorite|favourite|bad|worst|terrible|awful|expensive|overpriced|cheap|buy|eat|drink/i.test(trimmed);
      if (!hasTipAction) return;

      const { sentiment, intensity } = analyzeSentimentNLP(trimmed);

      let claimType = "evaluation";
      if (/should|must|avoid|advice|recommend|book|buy|always|never|keep/i.test(trimmed)) {
        claimType = "conditional";
      } else if (/morning|afternoon|evening|night|early|late|hour|time|when|crowd|queue|line|wait/i.test(trimmed)) {
        claimType = "temporal";
      } else if (/then|next|after that|walk to|direction|route|heading/i.test(trimmed)) {
        claimType = "sequence";
      }

      const isVolatile = /price|fee|hour|ticket|crowd|queue|line|wait|pickpocket|scam|trap|closed|open/i.test(trimmed);
      const knowledge_type = isVolatile ? "volatile" : "stable";

      const conditions = {};
      if (/morning/i.test(trimmed)) conditions.timeOfDay = "morning";
      else if (/afternoon/i.test(trimmed)) conditions.timeOfDay = "afternoon";
      else if (/evening|night/i.test(trimmed)) conditions.timeOfDay = "evening";

      if (/summer/i.test(trimmed)) conditions.season = "summer";
      else if (/winter/i.test(trimmed)) conditions.season = "winter";
      else if (/spring/i.test(trimmed)) conditions.season = "spring";
      else if (/autumn|fall/i.test(trimmed)) conditions.season = "autumn";

      let advice = null;
      const adviceMatch = trimmed.match(/(?:should|must|avoid|recommend to|make sure to)\s+([^,.;]+)/i);
      if (adviceMatch) {
        advice = adviceMatch[0].trim();
      }

      nodes.push({
        id: `kg-${Date.now()}-${currentSourceType}-${nodeCount++}-${Math.random().toString(36).slice(2, 6)}`,
        place: foundPlace,
        city: city,
        claim: trimmed,
        claimType,
        knowledge_type,
        conditions,
        advice,
        nextPlace: null,
        evaluation: { sentiment, intensity },
        source: {
          snippet: trimmed,
          sourceType: currentSourceType,
          sourceLabel: currentSourceLabel,
          date: currentDate,
          url: currentUrl
        },
        extractedAt: new Date().toISOString()
      });
    });
  });

  // Deduplicate by exact claim text within this extraction run
  const seenClaims = new Set();
  return nodes.filter(n => {
    const key = n.claim.toLowerCase().trim();
    if (seenClaims.has(key)) return false;
    seenClaims.add(key);
    return true;
  });
}

// ── Online fetch helpers ───────────────────────────────────────────────────────
function normalizeCityName(city) {
  return city
    .replace(/^(Greater |City of |Municipality of |Borough of |District of )/i, '')
    .trim();
}

// Returns multiple name variants so every fetcher tries "Greater London", "London", etc.
function buildCityVariants(city, parentCity = null) {
  const stripped = normalizeCityName(city);
  const noCountry = stripped.split(',')[0].trim();
  const noParens = noCountry.replace(/\s*\(.*\)/, '').trim();
  const list = [city, stripped, noCountry, noParens];
  if (parentCity) {
    const parentStripped = normalizeCityName(parentCity);
    const parentNoCountry = parentStripped.split(',')[0].trim();
    list.push(parentCity, parentStripped, parentNoCountry);
  }
  return [...new Set(list.filter(Boolean))];
}

async function fetchWikivoyageWithFallback(city, parentCity = null) {
  const tryNames = buildCityVariants(city, parentCity);
  // Try parallel requests to speed up the process instead of sequential loops
  const results = await Promise.allSettled(tryNames.map(async name => {
    const url = `${API.wikivoyage}/w/api.php?action=query&titles=${encodeURIComponent(name)}&prop=extracts&explaintext=true&exsectionformat=plain&format=json&origin=*`;
    const res = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('Bad response');
    const textData = await res.text();
    const data = JSON.parse(textData);
    const pages = data.query?.pages || {};
    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) throw new Error('Missing page');
    const text = page.extract || '';
    if (text.length < 100) throw new Error('Too short');
    return { text: cleanContentText(text), title: page.title, url: `https://en.wikivoyage.org/wiki/${encodeURIComponent(page.title)}` };
  }));
  const success = results.find(r => r.status === 'fulfilled');
  return success ? success.value : null;
}

async function fetchWikipediaWithFallback(city, parentCity = null) {
  const tryNames = buildCityVariants(city, parentCity);
  // Try parallel requests to speed up the process
  const results = await Promise.allSettled(tryNames.map(async name => {
    const url = `${API.wikipedia}/w/api.php?action=query&titles=${encodeURIComponent(name)}&prop=extracts&explaintext=true&format=json&origin=*`;
    const res = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('Bad response');
    const textData = await res.text();
    const data = JSON.parse(textData);
    const pages = data.query?.pages || {};
    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) throw new Error('Missing page');
    const text = page.extract || '';
    if (text.length < 50) throw new Error('Too short');
    return { text: cleanContentText(text), title: page.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}` };
  }));
  const success = results.find(r => r.status === 'fulfilled');
  return success ? success.value : null;
}

async function fetchReddit(city, placeNames = [], parentCity = null) {
  const stripped = normalizeCityName(city);
  const noCountry = stripped.split(',')[0].trim();
  const citySlug = noCountry.toLowerCase().replace(/[^a-z0-9]/g, '');

  const allPosts = [];

  // Hosted site: Reddit's API and DuckDuckGo block browser requests — use the PullPush archive only.
  if (!HAS_DEV_PROXY) {
    const posts = await fetchRedditViaPullPush(noCountry).catch(() => []);
    allPosts.push(...posts);
  }

  // ── api.reddit.com via Vite proxy (PRIMARY — confirmed working) ────────────
  // api.reddit.com returns JSON directly without CORS blocks.
  console.log('[Reddit] Fetching via api.reddit.com proxy...');
  const TRAVEL_SUBS = [...new Set([citySlug, 'travel', 'solotravel', 'backpacking', 'shoestring'].filter(Boolean))];
  const QUERIES = [`${noCountry} travel tips`, `${noCountry} itinerary`, `${noCountry} things to do`, noCountry];

  // If direct API calls are blocked by Reddit's security system, we also query DuckDuckGo with multiple parallel queries
  // so we have a guaranteed fallback that fetches a large volume of posts without triggering blocks.
  const ddgQueries = [
    `${noCountry} travel tips`,
    `${noCountry} itinerary`,
    `${noCountry} hidden gems`,
    `${noCountry} things to do`,
    `${noCountry} restaurants cafes food`,
    `best places in ${noCountry}`
  ];
  let ddgPromise = !HAS_DEV_PROXY ? Promise.resolve() : Promise.allSettled(
    ddgQueries.map(async (dq, qIdx) => {
      try {
        const snippets = await fetchRedditFromDuckDuckGo(dq);
        if (snippets.length > 0) {
          const posts = snippets.map((s, idx) => ({
            id: `ddg-reddit-${qIdx}-${idx}`,
            selftext: s,
            title: `Reddit travel tip: ${dq} #${idx + 1}`,
            subreddit: 'travel',
            permalink: `/r/travel/search?q=${encodeURIComponent(dq)}`,
            created_utc: Math.floor(Date.now() / 1000)
          }));
          allPosts.push(...posts);
        }
      } catch (e) {
        console.log(`[Reddit] DDG query "${dq}" failed:`, e.message);
      }
    })
  );

  if (HAS_DEV_PROXY) await Promise.allSettled([
    ddgPromise,
    ...TRAVEL_SUBS.flatMap(sub => QUERIES.map(async q => {
      try {
        const qs = `q=${encodeURIComponent(`${q} subreddit:${sub}`)}&sort=top&t=all&limit=100`;
        const res = await fetch(`/reddit-proxy/search.json?${qs}`, {
          headers: { Accept: 'application/json' },
          credentials: 'omit',
          signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) { console.log(`[Reddit] search for sub=${sub} q="${q}" → HTTP ${res.status}`); return; }
        const text = await res.text();
        if (text.trimStart().startsWith('<')) { console.log(`[Reddit] sub=${sub} q="${q}" → HTML (blocked)`); return; }
        const data = JSON.parse(text);
        const posts = (data.data?.children || []).map(c => c.data)
          .filter(p => !p.over_18 && p.selftext && p.selftext !== '[deleted]' && p.selftext !== '[removed]' && p.selftext.trim().length > 50);
        if (posts.length > 0) { allPosts.push(...posts); console.log(`[Reddit] sub=${sub} "${q}" → ${posts.length} posts ✓`); }
      } catch (e) { console.log(`[Reddit] search failed: ${e.message}`); }
    }))
  ]);

  // ── PullPush.io (fallback — often down) ───────────────────────────────────
  if (allPosts.length === 0 && HAS_DEV_PROXY) {
    console.log('[Reddit] api.reddit.com returned 0, trying PullPush fallback...');
    await fetchRedditViaPullPush(noCountry).then(posts => {
      if (posts.length > 0) { allPosts.push(...posts); console.log(`[Reddit] PullPush → ${posts.length} posts`); }
    }).catch(e => console.log('[Reddit] PullPush error:', e.message));
  }

  // ── Deduplicate ───────────────────────────────────────────────────────────
  const seen = new Set();
  const unique = allPosts.filter(p => {
    const key = p.id || p.selftext?.slice(0, 40) || '';
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => (b.score || 0) - (a.score || 0));

  // ── DuckDuckGo HTML as last resort ───────────────────────────────────────
  if (unique.length === 0) {
    console.log('[Reddit] All APIs failed — trying DuckDuckGo HTML fallback...');
    const ddgSnippets = await fetchRedditFromDuckDuckGo(noCountry);
    if (ddgSnippets.length > 0) {
      const combined = ddgSnippets.map((s, idx) =>
        `[SOURCE:reddit search_result_${idx + 1}]\n${s}`
      ).join('\n\n---\n\n');
      console.log(`[Reddit] DDG → ${ddgSnippets.length} snippets`);
      return { text: combined, count: ddgSnippets.length };
    }
    console.log('[Reddit] No data from any source.');
    return null;
  }

  console.log(`[Reddit] Total unique posts: ${unique.length}`);
  const combined = unique.map(p => {
    const cleanedText = cleanContentText(p.selftext || '');
    const dateStr = p.created_utc ? new Date(p.created_utc * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const sub = p.subreddit || 'reddit';
    const title = p.title || 'Post';
    const link = p.permalink ? `https://reddit.com${p.permalink}` : `https://reddit.com/r/${sub}`;
    return `[SOURCE:reddit r/${sub} "${title}" url:${link} ${dateStr}]\n${cleanedText}`;
  }).join('\n\n---\n\n');
  return { text: combined, count: unique.length };
}


async function fetchWikitravel(city, parentCity = null) {
  if (!HAS_DEV_PROXY) return null;
  const tryNames = buildCityVariants(city, parentCity);
  const results = await Promise.allSettled(tryNames.map(async name => {
    // rvslots=* required for MediaWiki 1.32+ slot-based content model
    const qs = `action=query&titles=${encodeURIComponent(name)}&prop=revisions&rvprop=content&rvslots=*&format=json&origin=*`;
    const res = await fetch(`/wikitravel-proxy/wiki/en/api.php?${qs}`, { credentials: 'omit', signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const pages = data.query?.pages || {};
    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) throw new Error('Missing page');
    const revision = page?.revisions?.[0];
    // Support both old format (revision['*']) and new slot format (revision.slots.main['*'])
    const wikitext = revision?.slots?.main?.['*'] || revision?.['*'] || '';
    if (wikitext.length < 100) throw new Error('Too short');
    return { text: cleanContentText(wikitext), title: page.title, url: `https://wikitravel.org/en/${encodeURIComponent(page.title)}` };
  }));
  const success = results.find(r => r.status === 'fulfilled');
  return success ? success.value : null;
}

async function fetchStackExchangeTravel(city, parentCity = null) {
  const baseName = normalizeCityName(city);
  const stripHtml = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const tryQuery = async (queryTerm, pagesize = 8) => {
    const url = `${API.stackexchange}/2.3/search/advanced?q=${encodeURIComponent(queryTerm)}&site=travel&sort=votes&pagesize=${pagesize}&filter=withbody`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      credentials: 'omit',
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) { console.log(`[StackExchange] HTTP ${res.status} for "${queryTerm}"`); return null; }
    let textData;
    try { textData = await res.text(); } catch (e) { console.log('[StackExchange] Response read error:', e.message); return null; }
    let data;
    try { data = JSON.parse(textData); } catch (e) { console.log('[StackExchange] JSON parse error (likely gzip):', e.message, '| text preview:', textData.slice(0, 30)); return null; }
    const items = (data.items || []).filter(i => i.body && i.score >= 1 && i.is_answered);
    console.log(`[StackExchange] "${queryTerm}" => ${items.length} items`);
    if (items.length === 0) return null;
    const combined = items.map(i =>
      `[SOURCE:stackexchange "${i.title}" url:${i.link} votes:${i.score} ${new Date(i.creation_date * 1000).toISOString().slice(0, 10)}]\n${cleanContentText(stripHtml(i.body))}`
    ).join('\n\n---\n\n');
    return { text: combined, count: items.length };
  };
  try {
    const queryTerm = parentCity ? `${baseName} OR ${normalizeCityName(parentCity)}` : baseName;
    return (await tryQuery(queryTerm, 20)) || (await tryQuery(baseName, 15));
  } catch (e) {
    console.log('[StackExchange] Unexpected error:', e.message);
    return null;
  }
}


// ── Place Bubbles visualization ───────────────────────────────────────────────
function PlaceCard({ place, expanded, onToggle, onClaimClick }) {
  const pos = place.nodes.filter(n => n.evaluation?.sentiment === 'positive').length;
  const neg = place.nodes.filter(n => n.evaluation?.sentiment === 'negative').length;
  const neu = place.nodes.length - pos - neg;
  const posRatio = place.nodes.length > 0 ? pos / place.nodes.length : 0.5;
  const isExpanded = expanded === place.name;
  
  // Synchronized color scheme
  const isContested = pos > 0 && neg > 0;
  const accentColor = isContested ? '#fb923c' : (posRatio > 0.6 ? '#10b981' : (posRatio < 0.3 ? '#ef4444' : '#38bdf8'));
  const bgColor = isContested ? 'rgba(251,146,60,0.07)' : (posRatio > 0.6 ? 'rgba(16,185,129,0.07)' : (posRatio < 0.3 ? 'rgba(239,68,68,0.07)' : 'rgba(56,189,248,0.07)'));
  const glowColor = isContested ? 'rgba(251,146,60,0.15)' : (posRatio > 0.6 ? 'rgba(16,185,129,0.15)' : (posRatio < 0.3 ? 'rgba(239,68,68,0.15)' : 'rgba(56,189,248,0.15)'));
  
  const displayName = place.isCategory ? place.name.split(' · ')[1] || place.name : place.name;

  return (
    <div onClick={() => onToggle(place.name)}
      style={{ background: bgColor, border: `1px solid ${accentColor}28`, borderRadius: '11px', padding: '10px', cursor: 'pointer', transition: 'box-shadow 0.15s', boxShadow: isExpanded ? `0 0 14px ${glowColor}, 0 0 0 1px ${accentColor}30` : 'none' }}>
      <div style={{ fontSize: '0.73rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px', lineHeight: 1.3 }}>{displayName}</div>
      <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex', marginBottom: '8px' }}>
        {pos > 0 && <div style={{ flex: pos, background: '#10b981' }} />}
        {neu > 0 && <div style={{ flex: neu, background: '#38bdf8' }} />}
        {neg > 0 && <div style={{ flex: neg, background: '#ef4444' }} />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
        {place.nodes.slice(0, isExpanded ? 99 : 3).map((n, i) => {
          const claimColor = n.evaluation?.sentiment === 'positive' ? '#10b981' : n.evaluation?.sentiment === 'negative' ? '#ef4444' : '#94a3b8';
          const icon = n.evaluation?.sentiment === 'positive' ? '✓' : n.evaluation?.sentiment === 'negative' ? '⚠' : '·';
          return (
            <div key={n.id || i} onClick={e => { e.stopPropagation(); onClaimClick(n); }}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
              <div style={{ fontSize: '0.61rem', color: claimColor, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: isExpanded ? 99 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>
                {icon} {n.claim}
              </div>
              {n.source?.url && (
                <span onClick={e => { e.stopPropagation(); window.open(n.source.url, '_blank'); }}
                  style={{ fontSize: '0.55rem', color: '#38bdf8', cursor: 'pointer', background: 'rgba(56,189,248,0.12)', padding: '0 3px', borderRadius: '4px', flexShrink: 0 }}>
                  🔗
                </span>
              )}
            </div>
          );
        })}
        {!isExpanded && place.nodes.length > 3 && (
          <div style={{ fontSize: '0.58rem', color: accentColor, fontWeight: '600' }}>+{place.nodes.length - 3} more…</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.58rem', color: accentColor, fontWeight: '700' }}>{place.nodes.length} claim{place.nodes.length !== 1 ? 's' : ''}</span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {place.novelty > 0.5 && (
            <span title={`Insider score: ${(place.novelty * 100).toFixed(0)}% — nuanced, multi-source, contested`}
              style={{ fontSize: '0.5rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '6px', padding: '0 4px' }}>
              <Sparkles size={7} color="#f59e0b" /> Insider
            </span>
          )}
          <div style={{ display: 'flex', gap: '2px', fontSize: '0.7rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {[...place.sources].map(src => <span key={src} title={SOURCE_META[src]?.label || src}>{SOURCE_META[src]?.icon || '?'}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceBubblesView({ nodes, triggerPlaceInfo, tripData, cityNamesSet, allCityNames }) {
  const [expanded, setExpanded] = useState(null);
  const [showCategories, setShowCategories] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortBy, setSortBy] = useState('claims'); // 'claims' | 'name' | 'novelty'

  const handleClaimClick = useCallback((n) => {
    if (n.source?.url) window.open(n.source.url, '_blank');
    if (!triggerPlaceInfo) return;
    const all = (tripData?.locations || []).flatMap(loc => [...(loc.places || []), ...(loc.recommendations || [])]);
    const found = all.find(pl => pl.name.toLowerCase() === n.place?.toLowerCase());
    triggerPlaceInfo(found || { name: n.place || 'Unknown', type: 'custom', coords: tripData?.locations?.[0]?.coords || [51.5074, -0.1278] });
  }, [triggerPlaceInfo, tripData]);

  // Helper to classify places by keyword frequency
  const getCategory = (nodes) => {
    const text = nodes.map(n => (n.claim || '').toLowerCase()).join(' ');
    if (/\b(food|eat|eating|drink|restaurant|cafe|coffee|beer|wine|cuisine|lunch|dinner|breakfast|pub|bar)\b/i.test(text)) return 'Food & Drink';
    if (/\b(transport|metro|bus|train|taxi|cab|airport|flight|station|tram|subway|tube|travel|passenger|passengers|commute|commuter|commuters|fare|fares|oyster|travelcard|capping|cap|caps|peak|off-peak|journey|journeys|line|lines|rail|railway|railways)\b/i.test(text)) return 'Transport';
    if (/\b(safe|safety|danger|scam|pickpocket|hospital|emergency|avoid|crime|theft|caution|beware)\b/i.test(text)) return 'Safety';
    if (/\b(museum|history|historical|art|gallery|festival|landmark|palace|castle|abbey|church|cathedral|monument)\b/i.test(text)) return 'Culture';
    if (/\b(shop|shopping|buy|souvenir|store|mall|price|market)\b/i.test(text)) return 'Shopping';
    if (/\b(hotel|hostel|stay|accommodation|airbnb|room|booking)\b/i.test(text)) return 'Accommodation';
    return 'Culture';
  };

  const { specificPlaces, categoryPlaces } = useMemo(() => {
    const map = {};
    nodes.forEach(n => {
      if (!n.place) return;
      const pName = n.place.trim();
      const pLower = pName.toLowerCase();
      if (cityNamesSet?.has(pLower)) return;
      if (pLower === 'general' || pLower === 'unknown') return;
      const isCategory = pName.includes(' · ');
      const key = pLower;
      if (!map[key]) map[key] = { name: pName, isCategory, nodes: [], sources: new Set() };
      map[key].nodes.push(n);
      if (n.source?.sourceType) map[key].sources.add(n.source.sourceType);
    });
    const maxNodeCount = Math.max(...Object.values(map).map(v => v.nodes.length), 1);
    // Compute novelty
    Object.values(map).forEach(v => {
      const total = v.nodes.length;
      const pos = v.nodes.filter(n => n.evaluation?.sentiment === 'positive').length;
      const neg = v.nodes.filter(n => n.evaluation?.sentiment === 'negative').length;
      const conflictRatio = total >= 2 ? Math.min(pos, neg) / total : 0;
      const sourceVariety = Math.min(1, v.sources.size / 4);
      const rarity = 1 - total / maxNodeCount;
      v.novelty = conflictRatio * 0.4 + sourceVariety * 0.35 + rarity * 0.25;
      v.category = v.isCategory ? (v.name.split(' · ')[1] || 'Culture') : getCategory(v.nodes);
    });
    const all = Object.values(map).sort((a, b) => b.nodes.length - a.nodes.length);
    return {
      specificPlaces: all.filter(p => !p.isCategory),
      categoryPlaces: all.filter(p => p.isCategory),
    };
  }, [nodes, cityNamesSet]);

  const processList = useCallback((list) => {
    let processed = list;
    if (search.trim()) {
      const q = search.toLowerCase();
      processed = processed.filter(p => p.name.toLowerCase().includes(q) || p.nodes.some(n => n.claim?.toLowerCase().includes(q)));
    }
    if (filterCategory !== 'All') {
      processed = processed.filter(p => p.category === filterCategory);
    }
    processed = [...processed];
    if (sortBy === 'name') {
      processed.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'novelty') {
      processed.sort((a, b) => b.novelty - a.novelty);
    } else {
      processed.sort((a, b) => b.nodes.length - a.nodes.length);
    }
    return processed;
  }, [search, filterCategory, sortBy]);

  const filteredSpecific = useMemo(() => processList(specificPlaces), [specificPlaces, processList]);
  const filteredCategory = useMemo(() => processList(categoryPlaces), [categoryPlaces, processList]);

  const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: '7px' };

  const CATEGORY_TAGS = [
    { name: 'All', color: '#888' },
    { name: 'Culture', color: '#8b5cf6' },
    { name: 'Transport', color: '#0ea5e9' },
    { name: 'Food & Drink', color: '#f97316' },
    { name: 'Safety', color: '#ef4444' },
    { name: 'Shopping', color: '#ec4899' },
    { name: 'Accommodation', color: '#06b6d4' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'Inter,sans-serif' }}>
      
      {/* Search and Filters panel */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        {/* Search & Sort Row */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search place name or keyword…"
            style={{
              flex: 1, minWidth: '180px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', padding: '5px 10px', fontSize: '0.68rem', color: '#fff', outline: 'none'
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>Sort by:</span>
            {[['claims', 'Claims'], ['name', 'Alphabetical'], ['novelty', 'Insider']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                style={{
                  background: sortBy === key ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${sortBy === key ? '#8b5cf6' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '6px', padding: '3px 8px', fontSize: '0.62rem', color: sortBy === key ? '#c4b5fd' : '#aaa',
                  cursor: 'pointer', fontFamily: 'Inter,sans-serif'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginRight: '4px' }}>Topic:</span>
          {CATEGORY_TAGS.map(c => {
            const isActive = filterCategory === c.name;
            return (
              <button
                key={c.name}
                onClick={() => setFilterCategory(c.name)}
                style={{
                  background: isActive ? `${c.color}22` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? c.color : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '12px', padding: '2px 8px', fontSize: '0.6rem',
                  color: isActive ? '#fff' : '#888', cursor: 'pointer',
                  fontFamily: 'Inter,sans-serif', transition: 'all 0.15s'
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Specific places */}
      {filteredSpecific.length > 0 && (
        <div>
          <div style={{ fontSize: '0.62rem', color: '#38bdf8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <MapPin size={10} /> Specific Places ({filteredSpecific.length})
          </div>
          <div style={gridStyle}>
            {filteredSpecific.map(p => <PlaceCard key={p.name} place={p} expanded={expanded} onToggle={n => setExpanded(expanded === n ? null : n)} onClaimClick={handleClaimClick} />)}
          </div>
        </div>
      )}

      {/* Category insights — collapsible */}
      {filteredCategory.length > 0 && (
        <div>
          <button onClick={() => setShowCategories(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '8px' }}>
            <span style={{ fontSize: '0.62rem', color: '#8b5cf6', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              General Insights ({filteredCategory.length} topics)
            </span>
            {showCategories ? <ChevronUp size={11} style={{ color: '#8b5cf6' }} /> : <ChevronDown size={11} style={{ color: '#8b5cf6' }} />}
          </button>
          {showCategories && (
            <div style={gridStyle}>
              {filteredCategory.map(p => <PlaceCard key={p.name} place={p} expanded={expanded} onToggle={n => setExpanded(expanded === n ? null : n)} onClaimClick={handleClaimClick} />)}
            </div>
          )}
        </div>
      )}

      {filteredSpecific.length === 0 && filteredCategory.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.72rem', padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
          No places found matching the filters.
        </div>
      )}
    </div>
  );
}

// ── Wikidata Entity Linking ───────────────────────────────────────────────────
// Replaces the LLM place-name refinement step with deterministic KG grounding.
// For each unique place name, queries the Wikidata search API and returns the
// best-matching entity with its canonical name, Q-ID, coordinates, and type.
const WD_CACHE = new Map(); // session-level cache to avoid repeat lookups

async function wikidataSearch(placeName, cityHint = '') {
  const query = cityHint ? `${placeName} ${cityHint}` : placeName;
  const cacheKey = query.toLowerCase();
  if (WD_CACHE.has(cacheKey)) return WD_CACHE.get(cacheKey);

  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&limit=3&type=item&format=json&origin=*`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const hits = (data.search || []).filter(h =>
      // Accept geographical entities: check description for place-related keywords
      h.description && /place|city|town|village|district|museum|landmark|restaurant|park|station|street|market|church|temple|castle|island|mountain|beach|port|airport|neighborhood|quarter|area|site/i.test(h.description)
    );
    const best = hits[0] || data.search?.[0] || null;
    const result = best ? {
      wikidataId: best.id,
      canonicalName: best.label,
      description: best.description || '',
      wikidataUrl: `https://www.wikidata.org/wiki/${best.id}`,
    } : null;
    WD_CACHE.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

// Fetch coordinates from a Wikidata Q-ID (P625 = coordinate location)
async function wikidataCoords(qid) {
  if (!qid) return null;
  const url = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${qid}&property=P625&format=json&origin=*`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const claims = data.claims?.P625;
    if (!claims?.length) return null;
    const val = claims[0].mainsnak?.datavalue?.value;
    if (val?.latitude && val?.longitude) return [val.latitude, val.longitude];
  } catch { }
  return null;
}

// Main Wikidata resolution pass — enriches nodes in-place and returns updated array.
// Each node gets: wikidata_id, canonical_name (corrected), wikidata_description, coords (if missing)
const WIKIDATA_CACHE = new Map();
async function resolveWithWikidata(nodes, city = '', onProgress = null) {
  const uniquePlaces = [...new Set(nodes.map(n => n.place).filter(Boolean))];
  const cityBase = city.split(',')[0].trim();

  // Lookup table: raw place name → Wikidata entity.
  // Topic labels like "Paris · Shopping" are categories, not places — skip them.
  // Lookups run 6 at a time and are cached for the session (this used to take ~80 s per city).
  const entityMap = {};
  const lookups = uniquePlaces.filter(name => !name.includes(' · '));
  let done = 0, next = 0;
  const worker = async () => {
    while (next < lookups.length) {
      const name = lookups[next++];
      const key = `${cityBase}::${name}`;
      let entity = WIKIDATA_CACHE.get(key);
      if (entity === undefined) {
        entity = await wikidataSearch(name, cityBase).catch(() => null);
        WIKIDATA_CACHE.set(key, entity || null);
      }
      if (entity) {
        entityMap[name] = entity;
        if (!entity.coords) {
          wikidataCoords(entity.wikidataId).then(coords => { if (coords) entity.coords = coords; }).catch(() => { });
        }
      }
      done++;
      if (onProgress) onProgress(done, lookups.length, name);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, lookups.length) }, worker));

  // Annotate every node with its Wikidata match; correct place name if match is high-confidence
  return nodes.map(n => {
    const entity = entityMap[n.place];
    if (!entity) return n;
    const canonicalDiffers = entity.canonicalName && entity.canonicalName.toLowerCase() !== (n.place || '').toLowerCase();
    return {
      ...n,
      place: canonicalDiffers ? entity.canonicalName : n.place,
      wikidata_id: entity.wikidataId,
      wikidata_description: entity.description,
      wikidata_url: entity.wikidataUrl,
      // Attach resolved coords to node for later map use
      ...(entity.coords && !n.coords ? { coords: entity.coords } : {}),
    };
  });
}

// ── LLM Place Refinement Helper ──────────────────────────────────────────────
async function refinePlacesWithLLM(nodes, ollamaEndpoint, ollamaModel, knownPlaces = [], city = '') {
  const uniquePlaces = [...new Set(nodes.map(n => n.place).filter(Boolean))];
  if (uniquePlaces.length === 0) return nodes;

  const cityBase = city.split(',')[0].trim() || 'General';

  // Build one sample claim per place so we can categorize bad names by content
  const placeClaimSample = {};
  nodes.forEach(n => {
    if (n.place && !placeClaimSample[n.place]) placeClaimSample[n.place] = n.claim || '';
  });

  let mapping = {};

  try {
    const knownList = knownPlaces.length > 0
      ? knownPlaces.slice(0, 30).map((p, i) => `${i + 1}. "${p}"`).join('\n')
      : '(none provided)';
    const categories = `"${cityBase} · History", "${cityBase} · Transport", "${cityBase} · Climate", "${cityBase} · Safety", "${cityBase} · Food & Drink", "${cityBase} · Culture", "${cityBase} · Shopping", "${cityBase} · Districts", "${cityBase} · Travel Tips", "${cityBase} · General"`;
    const prompt = `You are a travel location classifier for ${cityBase}.

Known trip places:
${knownList}

For each extracted name + claim snippet below:
- If it matches a known trip place → use that exact known name
- If it is a real venue / landmark / attraction → clean and standardize the name
- If it is a generic word / adjective / non-place → pick the most fitting category from: ${categories}

Entries (name | sample claim):
${uniquePlaces.slice(0, 40).map((p, i) => `${i + 1}. "${p}" | ${(placeClaimSample[p] || '').slice(0, 80)}`).join('\n')}

Respond ONLY with a JSON object: {"raw name": "Clean Name or Category"}`;

    const res = await fetch(`${ollamaEndpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ollamaModel, prompt, stream: false, format: 'json' }),
      signal: AbortSignal.timeout(10000)
    });

    if (res.ok) {
      const data = await res.json();
      mapping = JSON.parse(data.response);
    }
  } catch (e) {
    console.log('Ollama place refine unavailable, using heuristics:', e.message);
  }

  // Heuristic fallback for any places not mapped by LLM
  uniquePlaces.forEach(p => {
    if (mapping[p]) return;
    const pLower = p.toLowerCase().trim();
    const words = pLower.split(/\s+/).filter(w => w.length > 2);
    // A single short/common word is clearly a bad extraction — categorize by claim content
    const isBadName = words.length <= 1 && (
      ENTITY_COMMON_WORDS.has(pLower) ||
      HEURISTIC_COMMON.has(pLower) ||
      pLower.length <= 3 ||       // short: "Aug", "As", "For", "The"
      /^\d+$/.test(pLower) ||     // pure number
      /^[a-z]{2}$/.test(pLower)   // two-letter code
    );
    if (isBadName || (words.length > 0 && words.every(w => HEURISTIC_COMMON.has(w)))) {
      mapping[p] = assignSemanticCategory(placeClaimSample[p] || '', cityBase);
    } else {
      let cleaned = p.replace(/^[^\w\s]+|[^\w\s]+$/g, '').trim();
      cleaned = cleaned.split(/\s+/).map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
      mapping[p] = cleaned
        .replace(/\s+(?:tube |underground )?station$/i, ' Station')
        .replace(/\s+(?:museum|gallery)$/i, ' Museum')
        .replace(/\s+park$/i, ' Park')
        .replace(/\s+market$/i, ' Market');
    }
  });

  return nodes.map(n => {
    const clean = mapping[n.place];
    return clean ? { ...n, place: clean } : n;
  });
}

// ── Reclassify topic nodes via Ollama ────────────────────────────────────────
// After refinePlacesWithLLM has cleaned real place names, this dedicated pass
// focuses ONLY on nodes that got a Naive-Bayes "City · Category" label and
// asks Ollama to verify / correct the category using the actual claim text.
const TOPIC_CLASSES = [
  'Climate', 'History', 'Transport', 'Food & Drink', 'Safety & Health',
  'Culture', 'Accommodation', 'Shopping', 'Districts', 'Travel Tips'
];
async function reclassifyTopicNodesWithLLM(nodes, cityBase, ollamaEndpoint, ollamaModel, onProgress = null) {
  if (!ollamaEndpoint || !cityBase) return nodes;
  const topicIdxs = nodes.reduce((acc, n, i) => {
    if (n.place?.includes(' · ')) acc.push(i); return acc;
  }, []);
  if (topicIdxs.length === 0) return nodes;

  const claimKey = claim => (claim || '').toLowerCase().slice(0, 100);
  const uniqueMap = {};
  topicIdxs.forEach(i => {
    const k = claimKey(nodes[i].claim);
    if (!(k in uniqueMap)) uniqueMap[k] = i;
  });

  // Cap: only reclassify top 300 unique claims — rest keep their NLP label
  const MAX_CLASSIFY = 300;
  const uniqueItems = Object.entries(uniqueMap).slice(0, MAX_CLASSIFY);
  const keyToClass = {};

  const BATCH = 20;
  const batches = [];
  for (let b = 0; b < uniqueItems.length; b += BATCH) batches.push(uniqueItems.slice(b, b + BATCH));

  let done = 0;
  const processBatch = async (slice) => {
    const numbered = slice.map(([, idx], j) =>
      `${j + 1}. ${(nodes[idx].claim || '').slice(0, 180)}`
    ).join('\n');
    const prompt =
      `Travel content classifier. Classify each sentence into one category.
Categories: ${TOPIC_CLASSES.join(', ')}

${numbered}

Reply ONLY with a JSON array of category strings, one per item. Example: ["Culture","Transport"]`;
    try {
      const res = await fetch(`${ollamaEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ollamaModel, prompt, stream: false, options: { temperature: 0.05, num_predict: 150 } }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;
      const data = await res.json();
      const arrMatch = (data.response || '').match(/\[[\s\S]*?\]/);
      if (!arrMatch) return;
      const cats = JSON.parse(arrMatch[0]);
      slice.forEach(([key], j) => {
        const cat = cats[j];
        if (typeof cat !== 'string') return;
        const matched = TOPIC_CLASSES.find(c => c.toLowerCase() === cat.trim().toLowerCase())
          || TOPIC_CLASSES.find(c => cat.toLowerCase().includes(c.toLowerCase()));
        if (matched) keyToClass[key] = matched;
      });
    } catch (e) {
      console.log('[TopicClassifier] batch error:', e.message);
    }
    done += slice.length;
    if (onProgress) onProgress(done, uniqueItems.length);
  };

  // 3 concurrent batches at a time
  const CONCURRENCY = 3;
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    await Promise.allSettled(batches.slice(i, i + CONCURRENCY).map(processBatch));
  }

  return nodes.map(n => {
    if (!n.place?.includes(' · ')) return n;
    const newClass = keyToClass[claimKey(n.claim)];
    if (!newClass) return n;
    return { ...n, place: `${cityBase} · ${newClass}` };
  });
}

// ── Overpass API — fetch all notable POIs in an area ─────────────────────────
// Uses the Wikidata tag as a notability filter: only returns POIs that have a
// linked Wikidata entry (museums, landmarks, famous restaurants, parks, etc.).
// Falls back to geocoding the city name if no coordinates are provided.
async function fetchAreaPOIsOverpass(city, lat, lon) {
  let centerLat = lat || null;
  let centerLon = lon || null;
  let bboxStr = null;

  // Geocode city name → bounding box if no coordinates given
  if (!centerLat || !centerLon) {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`,
        { headers: { 'Accept-Language': 'en' }, signal: AbortSignal.timeout(6000) }
      );
      if (r.ok) {
        const d = await r.json();
        if (d[0]) {
          centerLat = parseFloat(d[0].lat);
          centerLon = parseFloat(d[0].lon);
          const bb = d[0].boundingbox; // [min_lat, max_lat, min_lon, max_lon]
          if (bb) {
            // Clamp oversized bounding boxes (e.g. country-level results) to ~25km radius
            const latSpan = parseFloat(bb[1]) - parseFloat(bb[0]);
            const lonSpan = parseFloat(bb[3]) - parseFloat(bb[2]);
            const MAX = 0.5;
            if (latSpan > MAX * 2 || lonSpan > MAX * 2) {
              bboxStr = `${(centerLat - MAX).toFixed(5)},${(centerLon - MAX).toFixed(5)},${(centerLat + MAX).toFixed(5)},${(centerLon + MAX).toFixed(5)}`;
            } else {
              bboxStr = `${bb[0]},${bb[2]},${bb[1]},${bb[3]}`; // south,west,north,east
            }
          }
        }
      }
    } catch (e) { console.log('[OverpassPOI] geocode:', e.message); }
  }

  if (!centerLat || !centerLon) return [];
  if (!bboxStr) {
    const r = 0.12; // ~12km
    bboxStr = `${(centerLat - r).toFixed(5)},${(centerLon - r).toFixed(5)},${(centerLat + r).toFixed(5)},${(centerLon + r).toFixed(5)}`;
  }

  // Query Overpass for Wikidata-tagged POIs only (ensures notability)
  // tourism + historic: all named POIs, no notability filter
  // amenity: type-filtered to travel-relevant venues (theatres, museums, universities, etc.)
  //   — not every restaurant/café or we'd get tens of thousands for large cities
  // leisure: parks, gardens, stadiums, nature reserves
  const AMENITY_TYPES = 'museum|theatre|arts_centre|library|university|college|place_of_worship|cinema|nightclub|casino|marketplace|community_centre|social_centre|events_venue|conference_centre|restaurant|cafe|fast_food|pub|bar';
  const LEISURE_TYPES = 'park|garden|nature_reserve|stadium|sports_centre|marina|golf_course|water_park|theme_park|beach_resort';
  const query = `[out:json][timeout:60];
(
  node["tourism"]["name"](${bboxStr});
  way["tourism"]["name"](${bboxStr});
  relation["tourism"]["name"](${bboxStr});
  node["historic"]["name"](${bboxStr});
  way["historic"]["name"](${bboxStr});
  relation["historic"]["name"](${bboxStr});
  node["amenity"~"^(${AMENITY_TYPES})$"]["name"](${bboxStr});
  way["amenity"~"^(${AMENITY_TYPES})$"]["name"](${bboxStr});
  node["leisure"~"^(${LEISURE_TYPES})$"]["name"](${bboxStr});
  way["leisure"~"^(${LEISURE_TYPES})$"]["name"](${bboxStr});
  relation["leisure"~"^(${LEISURE_TYPES})$"]["name"](${bboxStr});
);
out center;`;

  try {
    const res = await fetch(`${API.overpass}/api/interpreter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) { console.log('[OverpassPOI] HTTP', res.status); return []; }
    const data = await res.json();
    const TYPE_PRIORITY = { tourism: 1, historic: 2, amenity: 3, leisure: 4 };
    const seen = new Set();
    const pois = (data.elements || [])
      .filter(e => e.tags?.name)
      .map(e => ({
        name: e.tags.name,
        priority: TYPE_PRIORITY[Object.keys(TYPE_PRIORITY).find(k => e.tags[k])] || 5,
      }))
      .filter(p => { const k = p.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => a.priority - b.priority)
      .map(p => p.name);
    console.log(`[OverpassPOI] ${pois.length} POIs for "${city}":`, pois.slice(0, 10).join(', ') + (pois.length > 10 ? '…' : ''));
    return pois;
  } catch (e) {
    console.log('[OverpassPOI] query error:', e.message);
    return [];
  }
}

// ── Wikipedia targeted search (for second-pass deep research) ────────────────
async function searchAndFetchWikipedia(query) {
  try {
    const sRes = await fetch(
      `${API.wikipedia}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!sRes.ok) return null;
    const sData = await sRes.json();
    const title = sData.query?.search?.[0]?.title;
    if (!title) return null;
    const eRes = await fetch(
      `${API.wikipedia}/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&explaintext=true&format=json&origin=*`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!eRes.ok) return null;
    const eData = await eRes.json();
    const page = Object.values(eData.query?.pages || {})[0];
    const text = page?.extract || '';
    if (text.length < 100) return null;
    return { text: cleanContentText(text), title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` };
  } catch { return null; }
}

// ── Reddit targeted search (PullPush, for individual POIs) ───────────────────
async function searchRedditForTopic(query) {
  const SUBS = ['travel', 'solotravel'];
  const fetchPosts = async (base) => {
    const posts = [];
    await Promise.allSettled(SUBS.map(async sub => {
      try {
        const url = `${base}/reddit/search/submission/?q=${encodeURIComponent(query)}&subreddit=${sub}&sort=score&size=6`;
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) return;
        const text = await res.text();
        if (text.trimStart().startsWith('<')) return;
        const data = JSON.parse(text);
        posts.push(...(data.data || []).filter(p => p.selftext && p.selftext.trim().length > 80));
      } catch { }
    }));
    return posts;
  };
  const direct = await fetchPosts('https://api.pullpush.io');
  return direct.length > 0 || !HAS_DEV_PROXY ? direct : fetchPosts('/pullpush-proxy');
}

// ── Deep research second pass ─────────────────────────────────────────────────
// Fetches a comprehensive list of all notable POIs in the region from OpenStreetMap
// (Wikidata-tagged → only well-known places), then fires targeted Wikipedia + Reddit
// searches for each one (e.g. "British Museum London", "Shoreditch London").
// Also runs 4 category-level overview searches (districts, transport, food, culture).
async function runDeepResearchPass(nodes, city, localPlaceNames, lat, lon, ollamaEndpoint, ollamaModel, setFetchStatus, ollamaAvailable = false) {
  const cityBase = city.split(',')[0].trim();
  const today = new Date().toISOString().slice(0, 10);

  // 1. Fetch all notable area POIs from Overpass (primary source)
  setFetchStatus('🗺️ Fetching region POIs from OpenStreetMap…');
  const areaPOIs = await fetchAreaPOIsOverpass(cityBase, lat, lon);

  // 2. Supplement with top-mentioned POIs from pass 1 (catches things Overpass might miss)
  const placeCounts = new Map();
  nodes.forEach(n => {
    if (!isLocationNode(n)) return;
    const p = n.place?.trim();
    if (p) placeCounts.set(p, (placeCounts.get(p) || 0) + 1);
  });
  const passOnePOIs = [...placeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([place]) => place);

  // Merge: Overpass notable POIs first, pass-1 fills any gaps (cap at 20 to bound LLM work)
  const allPOIs = [...new Set([...areaPOIs, ...passOnePOIs])].slice(0, 20);
  console.log(`[DeepResearch] ${allPOIs.length} POI targets (${areaPOIs.length} from Overpass + ${passOnePOIs.length} from pass-1)`);

  // 3. Category-level overviews
  const categoryTargets = [
    { label: 'Districts', wikiQuery: `districts neighbourhoods ${cityBase}` },
    { label: 'Transport', wikiQuery: `transport getting around ${cityBase}` },
    { label: 'Food & Drink', wikiQuery: `restaurants food dining ${cityBase}` },
    { label: 'Culture', wikiQuery: `culture history museums ${cityBase}` },
  ];

  const poiTargets = allPOIs.map(p => ({
    label: p,
    wikiQuery: `${p} ${cityBase}`,
    redditQuery: `${p} ${cityBase}`,
  }));

  const allTargets = [...poiTargets, ...categoryTargets];
  const allNewNodes = [];
  let done = 0;
  // Separate limiter for Ollama chunk calls only — NOT used to gate outer target concurrency.
  // If the same limiter gated both, outer tasks would hold all slots while waiting for inner
  // chunk calls that can never start → deadlock.
  const deepChunkLimit = pLimit(4);

  // HTTP fetches (Wikipedia, Reddit) run fully in parallel — they're fast and don't touch Ollama.
  // Only the Ollama extraction step is serialised through deepChunkLimit.
  await Promise.allSettled(
    allTargets.map(async (target) => {
      const n = ++done;
      setFetchStatus(`🔍 Researching: ${target.label} (${n}/${allTargets.length})…`);

      // Wikipedia search for this specific target
      const wikiResult = await searchAndFetchWikipedia(target.wikiQuery);
      if (wikiResult) {
        console.log(`[DeepResearch] Wikipedia: "${target.label}" → ${wikiResult.text.length} chars`);
        const extracted = ollamaAvailable
          ? await extractKnowledgeWithLLM(wikiResult.text, city, localPlaceNames, ollamaEndpoint, ollamaModel, 'wikipedia', `Wikipedia: ${target.label}`, today, wikiResult.url, deepChunkLimit)
          : extractKnowledgeNLP(wikiResult.text, city, localPlaceNames, 'wikipedia', `Wikipedia: ${target.label}`, today, wikiResult.url);
        allNewNodes.push(...extracted);
      }

      // Reddit search for POIs (LLM only — NLP on individual POI posts is too noisy)
      if (target.redditQuery && ollamaAvailable) {
        const posts = await searchRedditForTopic(target.redditQuery);
        if (posts.length > 0) {
          const text = posts
            .map(p => `[SOURCE:reddit r/${p.subreddit || 'travel'} "${p.title || ''}" url:${p.permalink ? `https://reddit.com${p.permalink}` : ''} ${p.created_utc ? new Date(p.created_utc * 1000).toISOString().slice(0, 10) : today}]\n${cleanContentText(p.selftext || '')}`)
            .join('\n\n---\n\n');
          console.log(`[DeepResearch] Reddit: "${target.label}" → ${posts.length} posts`);
          const extracted = await extractKnowledgeWithLLM(text, city, localPlaceNames, ollamaEndpoint, ollamaModel, 'reddit', `Reddit: ${target.label}`, today, '', deepChunkLimit);
          allNewNodes.push(...extracted);
        }
      }
    })
  );

  console.log(`[DeepResearch] Second pass added ${allNewNodes.length} raw nodes from ${allTargets.length} targets`);
  return allNewNodes;
}

// ── Quick check whether Ollama is reachable ───────────────────────────────────
const _ollamaCache = new Map(); // endpoint → { ok, ts }
async function checkOllamaAvailable(endpoint) {
  const cached = _ollamaCache.get(endpoint);
  if (cached && Date.now() - cached.ts < 30000) return cached.ok; // 30s cache
  try {
    const res = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(2000) });
    const ok = res.ok;
    _ollamaCache.set(endpoint, { ok, ts: Date.now() });
    return ok;
  } catch {
    _ollamaCache.set(endpoint, { ok: false, ts: Date.now() });
    return false;
  }
}

// A simple semaphore / concurrency limiter
const pLimit = (limit) => {
  const queue = [];
  let active = 0;
  const next = () => {
    active--;
    if (queue.length > 0) {
      const { fn, resolve, reject } = queue.shift();
      active++;
      fn().then(resolve, reject).finally(next);
    }
  };
  return (fn) => new Promise((resolve, reject) => {
    if (active < limit) {
      active++;
      fn().then(resolve, reject).finally(next);
    } else {
      queue.push({ fn, resolve, reject });
    }
  });
};

// Pre-filters text to only keep paragraphs containing city, known places, or general travel/description
function preFilterText(text, placeNames, city) {
  const cityBase = city.split(',')[0].trim().toLowerCase();
  const placesLower = placeNames.map(p => p.toLowerCase());

  // Split into lines/paragraphs
  const lines = text.split(/\n/);
  const relevant = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 30) continue; // Skip headers/short metadata

    // Filter out known wiki/voyage boilerplate & noise
    if (/consider printing them all/i.test(trimmed)) continue;
    if (/district and borough articles/i.test(trimmed)) continue;
    if (/copyright/i.test(trimmed) || /all rights reserved/i.test(trimmed)) continue;
    if (/wikimedia/i.test(trimmed) || /wikipedia/i.test(trimmed)) continue;
    if (/external links|see also|further reading|bibliography/i.test(trimmed)) continue;
    if (/^Category:/i.test(trimmed)) continue;

    // Filter out demographics/history lists that contain no city/places
    const lower = trimmed.toLowerCase();
    const isHistoryOrGeoFluff = /population of|million inhabitants|square kilometres|km²|founded in|sq mi|demographics|climate of|geography of/i.test(lower);
    const mentionsCityOrPlace = lower.includes(cityBase) || placesLower.some(p => p && lower.includes(p));

    if (isHistoryOrGeoFluff && !mentionsCityOrPlace) {
      continue;
    }

    relevant.push(trimmed);
  }

  return relevant.join('\n\n');
}

// ── LLM-first knowledge extraction (uses Ollama) ──────────────────────────────
// Processes text in parallel chunk batches — eliminates truncated NLP tokens.
// onSegDone(doneCount) is called after each segment completes so callers can show progress.
async function extractKnowledgeWithLLM(text, city, placeNames, ollamaEndpoint, ollamaModel, sourceType, sourceLabel, date, url, limit, onSegDone = null) {
  const cityBase = city.split(',')[0].trim();
  const knownPlacesStr = placeNames.length > 0
    ? `Known trip places (use exact names): ${placeNames.slice(0, 25).join(', ')}`
    : '';
  const categories = [
    `${cityBase} · Safety & Health`, `${cityBase} · Transport`, `${cityBase} · Food & Drink`,
    `${cityBase} · Culture & History`, `${cityBase} · Shopping`, `${cityBase} · Districts`,
    `${cityBase} · Travel Tips`, `${cityBase} · Accommodation`, `${cityBase} · General`
  ].join(', ');

  const CHUNK_SIZE = 5000;  // larger chunks = fewer LLM calls
  const MAX_SEGS = 10;      // cap per source — prevents runaway on large articles
  const CONCURRENCY = 4;    // parallel Ollama requests

  // Split text on SOURCE headers so each chunk retains source metadata
  const rawChunks = text.split(/\n\n---\n\n/);
  let nodeCount = 0;

  // Build list of all (segment, metadata) pairs first
  const segmentJobs = [];
  for (const rawChunk of rawChunks) {
    if (!rawChunk.trim()) continue;

    // Parse optional [SOURCE:...] header
    let chunkSourceType = sourceType, chunkSourceLabel = sourceLabel, chunkDate = date, chunkUrl = url;
    const headerMatch = rawChunk.match(/^\[SOURCE:([^\]]+)\]/);
    let textBody = rawChunk;
    if (headerMatch) {
      const h = headerMatch[1];
      textBody = rawChunk.slice(headerMatch[0].length).trim();
      const urlMatch = h.match(/url:([^\s"']+)/); if (urlMatch) chunkUrl = urlMatch[1];
      const dateMatch = h.match(/(\d{4}-\d{2}-\d{2})/); if (dateMatch) chunkDate = dateMatch[1];
      if (h.includes('reddit')) { chunkSourceType = 'reddit'; const sm = h.match(/r\/([a-zA-Z0-9_]+)/); chunkSourceLabel = sm ? `r/${sm[1]}` : 'Reddit'; }
      else if (h.includes('stackexchange')) { chunkSourceType = 'stackexchange'; chunkSourceLabel = 'StackExchange'; }
      else if (h.includes('wikivoyage')) { chunkSourceType = 'wikivoyage'; chunkSourceLabel = 'Wikivoyage'; }
      else if (h.includes('wikitravel')) { chunkSourceType = 'wikitravel'; chunkSourceLabel = 'Wikitravel'; }
      else if (h.includes('wikipedia')) { chunkSourceType = 'wikipedia'; chunkSourceLabel = 'Wikipedia'; }
    }
    if (textBody.length < 40) continue;

    // Pre-filter the text body to keep only relevant lines
    const filteredBody = preFilterText(textBody, placeNames, city);
    const bodyToProcess = filteredBody.length > 50 ? filteredBody : textBody;

    // Break into CHUNK_SIZE segments at sentence boundaries
    if (bodyToProcess.length <= CHUNK_SIZE + 200) {
      segmentJobs.push({ segment: bodyToProcess, chunkSourceType, chunkSourceLabel, chunkDate, chunkUrl });
    } else {
      const sentences = bodyToProcess.match(/[^.!?\n]+[.!?\n]+/g) || [bodyToProcess];
      let seg = '';
      for (const s of sentences) {
        if (seg.length + s.length > CHUNK_SIZE) {
          if (seg.trim()) segmentJobs.push({ segment: seg.trim(), chunkSourceType, chunkSourceLabel, chunkDate, chunkUrl });
          seg = '';
        }
        seg += ' ' + s;
      }
      if (seg.trim()) segmentJobs.push({ segment: seg.trim(), chunkSourceType, chunkSourceLabel, chunkDate, chunkUrl });
    }
  }

  if (segmentJobs.length === 0) return [];

  // Merge consecutive small same-source segments to cut LLM calls (esp. Reddit)
  const mergedJobs = [];
  let pending = null;
  for (const job of segmentJobs) {
    if (!pending) { pending = { ...job }; continue; }
    const sameSource = pending.chunkSourceType === job.chunkSourceType && pending.chunkUrl === job.chunkUrl;
    if (sameSource && pending.segment.length + job.segment.length + 2 < CHUNK_SIZE) {
      pending.segment += '\n\n' + job.segment;
    } else {
      mergedJobs.push(pending);
      pending = { ...job };
    }
  }
  if (pending) mergedJobs.push(pending);

  // Cap to MAX_SEGS — extra segments yield diminishing returns and can hang the UI
  const cappedJobs = mergedJobs.slice(0, MAX_SEGS);
  console.log(`[LLM] ${sourceLabel}: ${segmentJobs.length} raw → ${mergedJobs.length} merged → ${cappedJobs.length} capped segments`);

  // ── Process all segments in parallel batches ──────────────────────────────
  const allNodes = [];
  const processSegment = async ({ segment, chunkSourceType, chunkSourceLabel, chunkDate, chunkUrl }) => {
    const prompt = `You are a travel knowledge extractor for ${cityBase}.
${knownPlacesStr}

TEXT:
${segment}

Extract every actionable travel tip, observation, or fact. For each one:
- "place": FULL place name (e.g. "Piccadilly Circus" NOT "Piccadilly" or "Illy"; "Brixton Market" NOT "Brix"). If no specific real place, assign a category: ${categories}
- "claim": the tip sentence (25-220 chars)
- "sentiment": "positive", "negative", or "neutral"
- "claimType": "evaluation", "conditional", or "temporal"

Rules: only travel-relevant tips; never truncate place names; never invent places. ONLY extract places located in or directly associated with ${cityBase}. Do NOT extract airports, landmarks, or places of other cities. Do NOT extract vague, non-actionable, or purely meta statements (e.g. "consider printing them all", "The land to the east was flat...", "Initial Thoughts"). Only extract specific, concrete facts or tips.
Respond ONLY with a valid JSON array: [{"place":"...","claim":"...","sentiment":"...","claimType":"..."}]`;

    try {
      const res = await limit(() => fetch(`${ollamaEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ollamaModel, prompt, stream: false, options: { num_predict: 500, temperature: 0.2 } }),
        signal: AbortSignal.timeout(16000)
      }));
      if (!res.ok) { console.log('[LLM] Non-ok:', res.status); return; }
      const data = await res.json();
      let responseText = (data.response || '').trim()
        .replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
      const extracted = JSON.parse(responseText);
      if (!Array.isArray(extracted)) return;

      extracted.forEach(item => {
        let place = (item.place || '').trim();
        const claim = (item.claim || '').trim();
        if (!place || !claim || claim.length < 20 || claim.length > 280) return;

        // Clean and validate place name — reclassify clear non-place extractions
        const placeLower = place.toLowerCase();
        const placeWords = placeLower.split(/\s+/);
        const firstWord = placeWords[0];

        // Reuse the module-level non-place set (includes EXTRA_NON_PLACE_WORDS)
        const isNonsense =
          ENTITY_COMMON_WORDS.has(placeLower) ||
          HEURISTIC_COMMON.has(placeLower) ||
          // First word is a known non-place indicator (catches "Although X", "Oyster Card", etc.)
          EXTRA_NON_PLACE_WORDS.includes(firstWord) ||
          // Any word in a multi-word place is a strong non-place signal
          (placeWords.length > 1 && placeWords.some(w => [
            'although', 'however', 'therefore', 'oyster', 'travelcard', 'taxi', 'cabs',
            'assembly', 'parliament', 'committee', 'council', 'princess', 'prince',
          ].includes(w)));

        if (place.split(/\s+/).length === 1) {
          const isKnownPlace = placeNames.some(p => p.toLowerCase() === placeLower);
          if (isNonsense || !isKnownPlace) {
            place = assignSemanticCategory(claim, cityBase);
          }
        } else if (isNonsense) {
          place = assignSemanticCategory(claim, cityBase);
        }

        const sentiment = ['positive', 'negative', 'neutral'].includes(item.sentiment) ? item.sentiment : 'neutral';
        const claimType = ['evaluation', 'conditional', 'temporal', 'sequence'].includes(item.claimType) ? item.claimType : 'evaluation';
        allNodes.push({
          id: `kg-${Date.now()}-${chunkSourceType}-${nodeCount++}-${Math.random().toString(36).slice(2, 6)}`,
          place, city, claim, claimType,
          knowledge_type: /price|fee|hour|ticket|crowd|queue|wait|scam|closed|open/i.test(claim) ? 'volatile' : 'stable',
          conditions: {},
          advice: /should|must|avoid|recommend|make sure/i.test(claim) ? claim.slice(0, 80) : null,
          nextPlace: null,
          evaluation: { sentiment, intensity: sentiment !== 'neutral' ? 0.7 : 0.5 },
          source: { snippet: claim, sourceType: chunkSourceType, sourceLabel: chunkSourceLabel, date: chunkDate, url: chunkUrl },
          extractedAt: new Date().toISOString()
        });
      });
    } catch (e) { console.log('[LLM] Segment error:', e.message); }
    if (onSegDone) onSegDone();
  };

  // Run all segments concurrently under the concurrency limit
  await Promise.allSettled(cappedJobs.map(processSegment));

  // Deduplicate by claim text
  const seen = new Set();
  return allNodes.filter(n => {
    const k = n.claim.toLowerCase().trim().slice(0, 120);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}






export default function KnowledgePanel({ tripData, setTripData, triggerPlaceInfo, activeCity }) {
  const [tab, setTab] = useState('ingest');
  const [ingestText, setIngestText] = useState('');
  const [sourceType, setSourceType] = useState('blog');
  const [sourceDate, setSourceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState('');
  const [filterSentiment, setFilterSentiment] = useState('all');
  const [filterPlace, setFilterPlace] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [ollamaEndpoint] = useState(() => localStorage.getItem('ollama_endpoint') || 'http://localhost:11434');
  const [ollamaModel] = useState(() => localStorage.getItem('ollama_model') || 'llama3.1');
  const [visualMode, setVisualMode] = useState('constellation');
  const [credibilityThreshold, setCredibilityThreshold] = useState(0.3);
  const [refining, setRefining] = useState(false);
  const [refineMsg, setRefineMsg] = useState('');
  const [mapOverlayActive, setMapOverlayActive] = useState(false);
  const [areaFilter, setAreaFilter] = useState('all');
  const [expandedSections, setExpandedSections] = useState({
    'Safety & Health': true,
    'Food & Drink': true,
    'Transport & Accommodation': true,
    'Culture & History': false,
    'Shopping & Districts': false,
    'Travel Tips & Climate': false,
    'Miscellaneous': false
  });

  const placesInRequiredAreaSet = useMemo(() => {
    const set = new Set();
    (tripData?.locations || []).forEach(loc => {
      (loc.places || []).forEach(p => set.add(p.name.toLowerCase().trim()));
      (loc.recommendations || []).forEach(p => set.add(p.name.toLowerCase().trim()));
    });
    return set;
  }, [tripData]);

  const placeLookup = useMemo(() => {
    const map = new Map();
    (tripData?.locations || []).forEach(loc => {
      [...(loc.places || []), ...(loc.recommendations || [])].forEach(p => map.set(p.name.toLowerCase(), p));
    });
    return map;
  }, [tripData]);

  // Online fetch state
  const [fetchCity, setFetchCity] = useState('');
  const [fetchMode, setFetchMode] = useState('name'); // 'name' or 'coords'
  const [radiusKm, setRadiusKm] = useState(5); // default radius 5km
  const [customCoords, setCustomCoords] = useState(null); // GPS coordinates override
  const [fetchSources, setFetchSources] = useState({ wikivoyage: true, wikitravel: HAS_DEV_PROXY, reddit: true, stackexchange: true, wikipedia: true });
  const [fetching, setFetching] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('');
  const [fetchedPreviews, setFetchedPreviews] = useState([]); // { sourceType, label, status, charCount, posts, url, title }
  const [showFetchPanel, setShowFetchPanel] = useState(true);
  const [showManualPaste, setShowManualPaste] = useState(false);

  // Conflict resolutions — stored per trip so user's adjudications persist
  const [resolutions, setResolutions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kg_conflict_resolutions') || '{}'); } catch { return {}; }
  });

  const kg = tripData.knowledgeGraph || { nodes: [], edges: [] };
  const rawNodes = useMemo(() => {
    const seenIds = new Set();
    return (kg.nodes || []).filter(n => {
      if (!n || !n.id) return false;
      if (seenIds.has(n.id)) return false;
      seenIds.add(n.id);
      return true;
    });
  }, [kg.nodes]);

  // Pre-fill city from activeCity or active trip location
  const cityHint = activeCity?.name?.split(',')[0] || tripData.locations?.[0]?.name?.split(',')[0] || '';
  useEffect(() => {
    if (cityHint) setFetchCity(cityHint);
  }, [cityHint]);

  const allCityNames = useMemo(() => {
    return [
      ...(tripData.locations || []).map(l => l.name.split(',')[0]),
      fetchCity,
      cityHint
    ].filter(Boolean);
  }, [tripData.locations, fetchCity, cityHint]);

  const cityNamesSet = useMemo(() => {
    return new Set(allCityNames.map(name => name.toLowerCase().trim()));
  }, [allCityNames]);

  const handleRefinePlaces = useCallback(async () => {
    if (rawNodes.length === 0) return;
    setRefining(true);
    setRefineMsg('Refining place names...');
    try {
      const refined = await refinePlacesWithLLM(rawNodes, ollamaEndpoint, ollamaModel);
      setTripData(prev => ({
        ...prev,
        knowledgeGraph: {
          ...prev.knowledgeGraph,
          nodes: refined
        }
      }));
      setRefineMsg('✓ Place names refined successfully!');
      setTimeout(() => setRefineMsg(''), 4000);
    } catch (e) {
      setRefineMsg(`Error: ${e.message}`);
    } finally {
      setRefining(false);
    }
  }, [rawNodes, ollamaEndpoint, ollamaModel, setTripData]);

  const [wikidataMsg, setWikidataMsg] = useState('');
  const [wikidataRunning, setWikidataRunning] = useState(false);

  const handleWikidataLink = useCallback(async () => {
    if (rawNodes.length === 0 || wikidataRunning) return;
    setWikidataRunning(true);
    const city = fetchCity || cityHint || '';
    const unique = new Set(rawNodes.map(n => n.place).filter(Boolean)).size;
    setWikidataMsg(`Linking ${unique} places to Wikidata…`);
    try {
      const enriched = await resolveWithWikidata(rawNodes, city, (done, total, name) => {
        setWikidataMsg(`Wikidata: ${done}/${total} — ${name}`);
      });
      const linked = enriched.filter(n => n.wikidata_id).length;
      setTripData(prev => ({
        ...prev,
        knowledgeGraph: { ...prev.knowledgeGraph, nodes: enriched },
      }));
      setWikidataMsg(`✓ Linked ${linked}/${unique} places to Wikidata KG`);
      setTimeout(() => setWikidataMsg(''), 5000);
    } catch (e) {
      setWikidataMsg(`Error: ${e.message}`);
    } finally {
      setWikidataRunning(false);
    }
  }, [rawNodes, fetchCity, cityHint, setTripData, wikidataRunning]);

  const toggleMapOverlay = useCallback(() => {
    const nextVal = !mapOverlayActive;
    setMapOverlayActive(nextVal);
    window.dispatchEvent(new CustomEvent('toggle-knowledge-overlay', { detail: nextVal }));
  }, [mapOverlayActive]);

  useEffect(() => {
    // Listen to Map changes to keep state in sync
    const handleSync = (e) => {
      setMapOverlayActive(e.detail);
    };
    window.addEventListener('toggle-knowledge-overlay-sync', handleSync);
    return () => window.removeEventListener('toggle-knowledge-overlay-sync', handleSync);
  }, []);

  const handleClaimClick = useCallback((n) => {
    if (n.source?.url) window.open(n.source.url, '_blank');
    if (!triggerPlaceInfo) return;
    const found = placeLookup.get((n.place || '').toLowerCase());
    triggerPlaceInfo(found || {
      name: n.place || 'Unknown Place',
      type: 'custom',
      coords: tripData?.locations?.[0]?.coords || [51.5074, -0.1278],
      extract: `Extracted from knowledge base. Claim: "${n.claim}"`,
    });
  }, [triggerPlaceInfo, tripData, placeLookup]);

  // Compute credibility for all nodes — O(n) via pre-grouped place map
  const nodes = useMemo(() => {
    const byPlace = new Map();
    rawNodes.forEach(n => {
      const k = (n.place || '').toLowerCase();
      if (!byPlace.has(k)) byPlace.set(k, []);
      byPlace.get(k).push(n);
    });
    return rawNodes.map(n => {
      const others = (byPlace.get((n.place || '').toLowerCase()) || []).filter(x => x.id !== n.id);
      const { score, low, high } = computeCredibility(n, others);
      return { ...n, credibility: score, credLow: low, credHigh: high };
    });
  }, [rawNodes]);

  // Filter nodes that pass the credibility threshold
  const credibleNodes = useMemo(() =>
    nodes.filter(n => n.credibility >= credibilityThreshold),
    [nodes, credibilityThreshold]
  );

  const edges = kg.edges || [];
  const contradictions = useMemo(() => detectContradictions(credibleNodes), [credibleNodes]);

  // Pre-cache isLocationNode results — avoids re-running regex/Set checks per filter change
  const locationNodeIds = useMemo(() => {
    const s = new Set();
    credibleNodes.forEach(n => { if (isLocationNode(n)) s.add(n.id); });
    return s;
  }, [credibleNodes]);

  // Memoize lowercased filterPlace so each node doesn't call toLowerCase() per render
  const filterPlaceLower = useMemo(() => filterPlace.toLowerCase(), [filterPlace]);

  // Filtered nodes for Graph tab
  const filteredNodes = useMemo(() => {
    return credibleNodes.filter(n => {
      if (areaFilter !== 'all') {
        const isLocation = locationNodeIds.has(n.id);
        if (areaFilter === 'inside' ? !isLocation : isLocation) return false;
      }
      if (filterSentiment !== 'all' && n.evaluation?.sentiment !== filterSentiment) return false;
      if (filterType !== 'all' && n.claimType !== filterType) return false;
      if (filterPlaceLower && !n.place?.toLowerCase().includes(filterPlaceLower) && !n.claim?.toLowerCase().includes(filterPlaceLower)) return false;
      return true;
    }).sort((a, b) => (b.credibility || 0) - (a.credibility || 0));
  }, [credibleNodes, filterSentiment, filterType, filterPlaceLower, areaFilter, locationNodeIds]);

  const visualNodes = useMemo(() => {
    if (areaFilter === 'all') return credibleNodes;
    return credibleNodes.filter(n =>
      areaFilter === 'inside' ? locationNodeIds.has(n.id) : !locationNodeIds.has(n.id)
    );
  }, [credibleNodes, areaFilter, locationNodeIds]);

  // Unique places for stats
  const uniquePlaces = useMemo(() => new Set(credibleNodes.map(n => n.place?.toLowerCase())), [credibleNodes]);
  const sequenceEdges = useMemo(() => {
    const edgeMap = {};
    credibleNodes.filter(n => n.claimType === 'sequence' && n.nextPlace).forEach(n => {
      const key = `${n.place?.toLowerCase()}→${n.nextPlace?.toLowerCase()}`;
      if (!edgeMap[key]) edgeMap[key] = { from: n.place, to: n.nextPlace, count: 0, nodes: [] };
      edgeMap[key].count++;
      edgeMap[key].nodes.push(n);
    });
    return Object.values(edgeMap).sort((a, b) => b.count - a.count);
  }, [credibleNodes]);

  const saveKG = useCallback((newNodes, newEdges) => {
    setTripData(prev => ({
      ...prev,
      knowledgeGraph: {
        nodes: newNodes ?? rawNodes,
        edges: newEdges ?? edges,
        lastUpdated: new Date().toISOString(),
      }
    }));
  }, [setTripData, rawNodes, edges]);

  const deleteNode = useCallback((id) => {
    saveKG(rawNodes.filter(n => n.id !== id));
  }, [rawNodes, saveKG]);

  const resolveConflict = useCallback((place, verdict) => {
    setResolutions(prev => {
      const next = { ...prev, [place.toLowerCase()]: { verdict, resolvedAt: new Date().toISOString() } };
      localStorage.setItem('kg_conflict_resolutions', JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Native Client-Side Knowledge Extraction Engine ────────────────────────
  const handleExtract = useCallback(async (textOverride, sourceTypeOverride, perSourceMeta) => {
    const text = textOverride ?? ingestText;
    const sType = sourceTypeOverride ?? sourceType;
    if (!text?.trim()) return;

    setExtracting(true);
    setExtractMsg('Extracting knowledge with client-side NLP engine…');

    const resolvedCity = fetchCity || cityHint || 'Unknown';

    // Collect place names from active city context to match
    const activeCity = tripData.locations?.[0];
    const placeNames = [
      ...(activeCity?.places || []),
      ...(activeCity?.recommendations || []),
    ].map(p => p.name).filter(Boolean);

    // Short processing delay for native feel
    await new Promise(r => setTimeout(r, 400));

    try {
      const extracted = extractKnowledgeNLP(
        text,
        resolvedCity,
        placeNames,
        perSourceMeta?.sourceType ?? sType,
        perSourceMeta?.label ?? SOURCE_META[sType]?.label ?? 'Other',
        perSourceMeta?.date ?? sourceDate,
        perSourceMeta?.url ?? null
      );

      if (extracted.length === 0) {
        throw new Error('No travel tips or places recognized. Try a text containing specific venue names and advice keywords (e.g. should, avoid, crowded).');
      }

      const merged = [...rawNodes, ...extracted];
      const seenMerge = new Set();
      const deduped = merged.filter(n => {
        const k = (n.place || '').toLowerCase() + '::' + (n.claim || '').toLowerCase().slice(0, 120);
        if (seenMerge.has(k)) return false;
        seenMerge.add(k);
        return true;
      });
      saveKG(deduped);
      setExtractMsg(`✓ Extracted ${extracted.length} knowledge node${extracted.length > 1 ? 's' : ''}`);
      if (!textOverride) { setIngestText(''); }
      setTab('graph');
    } catch (e) {
      setExtractMsg(`Error: ${e.message}`);
    } finally {
      setExtracting(false);
    }
  }, [ingestText, sourceType, sourceDate, fetchCity, cityHint, tripData, rawNodes, saveKG]);

  // ── Online Fetch & Extract ────────────────────────────────────────────────
  // Fetches ALL sources in parallel, processes with client-side NLP engine.
  const handleFetchOnline = useCallback(async () => {
    let city = '';
    let lat = null;
    let lon = null;
    let localPlaceNames = [];

    // Clear graphs from previous run
    saveKG([], []);
    setFetching(true);
    setFetchStatus('Resolving location details…');

    const activeCity = tripData.locations?.[0];
    const tripPlaceNames = [
      ...(activeCity?.places || []),
      ...(activeCity?.recommendations || []),
    ].map(p => p.name).filter(Boolean);
    localPlaceNames = [...tripPlaceNames];

    if (fetchMode === 'name') {
      if (!fetchCity.trim()) {
        setFetching(false);
        return;
      }
      city = fetchCity.trim();
      // Geocode the searched city name to resolve coordinates so fetchAreaPOIsOverpass works
      setFetchStatus(`Geocoding "${city}" to resolve coordinates…`);
      try {
        const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`;
        const geoRes = await fetch(geoUrl, { headers: { 'Accept-Language': 'en' } });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData && geoData[0]) {
            lat = parseFloat(geoData[0].lat);
            lon = parseFloat(geoData[0].lon);
            console.log(`Geocoded searched city to coords: [${lat}, ${lon}]`);
          }
        }
      } catch (e) {
        console.log('Error geocoding searched city:', e.message);
      }
    } else {
      // Coordinate search mode
      const coords = customCoords || activeCity?.coords;
      if (coords && coords[0] && coords[1]) {
        lat = coords[0];
        lon = coords[1];

        // 1. Reverse geocode to resolve city name for fetching sources
        setFetchStatus('Reverse geocoding coordinates to resolve city...');
        try {
          const revUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
          const revRes = await fetch(revUrl, { headers: { 'Accept-Language': 'en' } });
          if (revRes.ok) {
            const revData = await revRes.json();
            city = revData.address.city || revData.address.town || revData.address.municipality || revData.address.village || revData.address.county || '';
            console.log(`Resolved coordinate to city: ${city}`);
          }
        } catch (e) {
          console.log('Error reverse geocoding:', e.message);
        }

        if (!city) {
          city = cityHint || 'Unknown';
        }

        // 2. Fetch points of interest (attractions) in the radius
        setFetchStatus(`Finding POIs within ${radiusKm}km radius…`);
        try {
          const dLat = radiusKm / 111.0;
          const dLon = radiusKm / (111.0 * Math.cos(lat * Math.PI / 180));
          const minLat = lat - dLat;
          const maxLat = lat + dLat;
          const minLon = lon - dLon;
          const maxLon = lon + dLon;

          const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=tourism&viewbox=${minLon},${minLat},${maxLon},${maxLat}&bounded=1&limit=30`;
          const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
          if (searchRes.ok) {
            const poiData = await searchRes.json();
            const poiNames = poiData.map(item => item.display_name.split(',')[0]).filter(Boolean);
            if (poiNames.length > 0) {
              console.log(`Found POIs in radius:`, poiNames);
              localPlaceNames = [...new Set([...localPlaceNames, ...poiNames])];
            }
          }
        } catch (e) {
          console.log('Error searching POIs in radius:', e.message);
        }
      } else {
        setFetchStatus('Error: No active location coordinates found.');
        setFetching(false);
        return;
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const SOURCE_LABELS = { wikivoyage: 'Wikivoyage', wikitravel: 'Wikitravel', wikipedia: 'Wikipedia', reddit: 'Reddit', stackexchange: 'StackExchange Travel' };
    const checkedSources = Object.entries(fetchSources).filter(([, v]) => v).map(([k]) => k);
    setFetchedPreviews(checkedSources.map(key => ({ sourceType: key, label: SOURCE_LABELS[key] || key, status: 'fetching' })));

    let parentCityName = null;
    try {
      const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1&addressdetails=1`;
      const geoRes = await fetch(geoUrl, { headers: { 'Accept-Language': 'en' }, signal: AbortSignal.timeout(3000) });
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData && geoData[0]) {
          const address = geoData[0].address;
          parentCityName = address.city || address.town || address.municipality || address.county;
          if (parentCityName === city) parentCityName = null;
          console.log(`Resolved location: ${city}, parent: ${parentCityName || 'none'}`);
        }
      }
    } catch (e) {
      console.log('Error resolving location parent:', e.message);
    }

    const fetchers = {
      wikivoyage: () => fetchWikivoyageWithFallback(city, parentCityName).then(r => r && r.text.length > 100 ? { text: r.text, url: r.url, title: r.title } : null),
      wikitravel: () => fetchWikitravel(city, parentCityName).then(r => r ? { text: r.text, url: r.url, title: r.title } : null),
      wikipedia: () => fetchWikipediaWithFallback(city, parentCityName).then(r => r && r.text.length > 50 ? { text: r.text, url: r.url, title: r.title } : null),
      reddit: () => fetchReddit(city, localPlaceNames, parentCityName).then(r => r ? { ...r } : null),
      stackexchange: () => fetchStackExchangeTravel(city, parentCityName).then(r => r ? { ...r } : null),
    };

    // Run Overpass POI fetch in parallel with all source fetches (saves 5-10s)
    setFetchStatus('Fetching sources + area POIs in parallel…');

    const [overpassSettled, ...results] = await Promise.allSettled([
      fetchAreaPOIsOverpass(city.split(',')[0].trim(), lat, lon),
      ...checkedSources.map(async key => {
        const r = await (fetchers[key]?.() ?? Promise.resolve(null));
        setFetchedPreviews(p => p.map(x => x.sourceType === key
          ? (r && r.text ? { ...x, status: 'ok', charCount: r.text.length, posts: r.count, url: r.url, title: r.title } : { ...x, status: 'none', title: 'Nothing found' })
          : x));
        return r;
      })
    ]);

    const overpassPOIs = overpassSettled.status === 'fulfilled' ? (overpassSettled.value || []) : [];
    if (overpassPOIs.length > 0) {
      localPlaceNames = [...new Set([...localPlaceNames, ...overpassPOIs])];
      console.log(`[POI] ${overpassPOIs.length} Overpass POIs (total: ${localPlaceNames.length})`);
    }

    const successResults = [];
    results.forEach((res, i) => {
      const key = checkedSources[i];
      const r = res.status === 'fulfilled' ? res.value : null;
      if (r && r.text) {
        const entry = { sourceType: key, label: SOURCE_LABELS[key], date: today, text: r.text, charCount: r.text.length, posts: r.count, url: r.url, title: r.title, status: 'ok' };
        successResults.push(entry);
        setFetchedPreviews(p => p.map(x => x.sourceType === key ? entry : x));
      } else {
        setFetchedPreviews(p => p.map(x => x.sourceType === key ? { ...x, status: res.status === 'rejected' ? 'error' : 'none', title: res.status === 'rejected' ? 'Error' : 'Nothing found' } : x));
      }
    });

    setFetching(false);

    if (successResults.length === 0) {
      setFetchStatus('No content found from any source. Try a different city name.');
      return;
    }

    setExtracting(true);
    successResults.forEach(src => {
      setFetchedPreviews(p => p.map(x => x.sourceType === src.sourceType ? { ...x, status: 'extracting' } : x));
    });

    try {
      const allNewNodes = [];

      // ── Pass 1: NLP extraction — always runs first, instant ───────────────
      // With the full Overpass POI list now in localPlaceNames, NLP does exact
      // string matching against every known place in the region rather than
      // relying on capitalisation patterns alone.
      setFetchStatus('🔢 Extracting with NLP engine…');
      successResults.forEach(src => {
        const extracted = extractKnowledgeNLP(
          src.text, city, localPlaceNames, src.sourceType, src.label, today, src.url
        );
        allNewNodes.push(...extracted);
        setFetchedPreviews(p => p.map(x => x.sourceType === src.sourceType
          ? { ...x, status: 'extracted', nodeCount: extracted.length }
          : x));
        console.log(`[NLP] ${src.label}: ${extracted.length} nodes`);
      });

      // Show NLP results immediately so the user sees something fast
      if (allNewNodes.length > 0) {
        const initialMerged = [...rawNodes, ...allNewNodes];
        const initialSeen = new Set();
        saveKG(initialMerged.filter(n => {
          const k = (n.place || '').toLowerCase() + '::' + (n.claim || '').toLowerCase().slice(0, 120);
          if (initialSeen.has(k)) return false; initialSeen.add(k); return true;
        }));
      }

      // ── Pass 2: LLM enrichment — optional, runs on top of NLP ────────────
      // Ollama re-extracts from each source and merges in additional nodes that
      // rule-based NLP missed. Does NOT replace NLP results — adds to them.
      const ollamaAvailable = await checkOllamaAvailable(ollamaEndpoint);
      if (ollamaAvailable) {
        const limit = pLimit(5);

        // Shared segment counter so the status updates while LLM runs
        let llmSegsDone = 0;
        const onSegDone = () => {
          llmSegsDone++;
          setFetchStatus(`🤖 AI Enrich (${ollamaModel}) — ${llmSegsDone} segment${llmSegsDone > 1 ? 's' : ''} done…`);
        };
        setFetchStatus(`🤖 AI Enrich (${ollamaModel}) — starting…`);

        // 90-second hard timeout on the whole LLM enrichment phase.
        // If Ollama is slow/hanging, we proceed with what we have rather than blocking forever.
        const LLM_PHASE_MS = 90000;
        const phaseTimeout = new Promise(resolve => setTimeout(() => resolve('__timeout__'), LLM_PHASE_MS));

        await Promise.race([
          Promise.allSettled(successResults.map(async (src) => {
            const llmExtracted = await extractKnowledgeWithLLM(
              src.text, city, localPlaceNames, ollamaEndpoint, ollamaModel,
              src.sourceType, src.label, today, src.url, limit, onSegDone
            );
            if (llmExtracted.length > 0) {
              allNewNodes.push(...llmExtracted);
              setTripData(prev => {
                const current = prev.knowledgeGraph?.nodes || [];
                const merged = [...current, ...llmExtracted];
                const seen = new Set();
                const deduped = merged.filter(n => {
                  const k = (n.place || '').toLowerCase() + '::' + (n.claim || '').toLowerCase().slice(0, 120);
                  if (seen.has(k)) return false; seen.add(k); return true;
                });
                return { ...prev, knowledgeGraph: { ...prev.knowledgeGraph, nodes: deduped, lastUpdated: new Date().toISOString() } };
              });
            }
            console.log(`[LLM] ${src.label}: ${llmExtracted.length} additional nodes`);
          })),
          phaseTimeout,
        ]).then(result => {
          if (result === '__timeout__') {
            console.warn('[LLM] Enrichment phase timed out after 90s — proceeding with NLP results');
            setFetchStatus('⚠️ AI Enrich timed out — continuing with NLP results');
          }
        });

        if (allNewNodes.length > 0) {
          // Always run Wikidata entity linking first (no Ollama required)
          setFetchStatus('🔗 Linking places to Wikidata knowledge graph…');
          const wikidataLinked = await resolveWithWikidata(allNewNodes, city,
            (done, total) => setFetchStatus(`🔗 Wikidata: ${done}/${total} places linked`));
          allNewNodes.length = 0;
          allNewNodes.push(...wikidataLinked);

          // Then optionally run LLM refinement + topic reclassification on top
          setFetchStatus('🤖 Refining place names with AI…');
          const refined = await refinePlacesWithLLM(allNewNodes, ollamaEndpoint, ollamaModel, localPlaceNames, city);
          setFetchStatus('🤖 Classifying topics with AI… (0%)');
          const reclassified = await reclassifyTopicNodesWithLLM(refined, city.split(',')[0].trim(), ollamaEndpoint, ollamaModel,
            (done, total) => setFetchStatus(`🤖 Classifying topics… ${Math.round(done / total * 100)}% (${done}/${total})`));
          allNewNodes.length = 0;
          allNewNodes.push(...reclassified);
        }
      } else {
        // No Ollama — still run Wikidata linking (deterministic, no local model needed)
        if (allNewNodes.length > 0) {
          setFetchStatus('🔗 Linking places to Wikidata knowledge graph…');
          const wikidataLinked = await resolveWithWikidata(allNewNodes, city,
            (done, total) => setFetchStatus(`🔗 Wikidata: ${done}/${total} places linked`));
          allNewNodes.length = 0;
          allNewNodes.push(...wikidataLinked);
        }
      }

      // ── Pass 3: Deep research — targeted per-POI searches (Ollama only) ────
      if (allNewNodes.length > 0 && ollamaAvailable) {
        const deepNodes = await runDeepResearchPass(allNewNodes, city, localPlaceNames, lat, lon, ollamaEndpoint, ollamaModel, setFetchStatus, true);
        if (deepNodes.length > 0) {
          const deepReclassified = await reclassifyTopicNodesWithLLM(deepNodes, city.split(',')[0].trim(), ollamaEndpoint, ollamaModel,
            (done, total) => setFetchStatus(`🔍 Classifying deep topics… ${Math.round(done / total * 100)}%`));
          allNewNodes.push(...deepReclassified);
        }
      }

      // Final dedup + save
      const merged = [...rawNodes, ...allNewNodes];
      const seen = new Set();
      saveKG(merged.filter(n => {
        const k = (n.place || '').toLowerCase() + '::' + (n.claim || '').toLowerCase().slice(0, 120);
        if (seen.has(k)) return false; seen.add(k); return true;
      }));

      if (allNewNodes.length === 0) {
        throw new Error('No travel tips recognized. Try a different city name.');
      }

      setFetchStatus(`✓ Extracted ${allNewNodes.length} node${allNewNodes.length !== 1 ? 's' : ''} from ${successResults.length} source${successResults.length !== 1 ? 's' : ''}`);
      setTab('graph');
    } catch (e) {
      setFetchStatus(`Extraction error: ${e.message}`);
      successResults.forEach(src => {
        setFetchedPreviews(p => p.map(x => x.sourceType === src.sourceType ? { ...x, status: 'extract_error', extractError: e.message } : x));
      });
    } finally {
      setExtracting(false);
    }
  }, [fetchCity, fetchSources, cityHint, rawNodes, saveKG, tripData, fetchMode, radiusKm, customCoords]);

  // ── Stats bar ─────────────────────────────────────────────────────────────
  const statsBar = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '14px' }}>
      {[
        { label: 'Nodes', val: nodes.length, color: '#8b5cf6' },
        { label: 'Places', val: uniquePlaces.size, color: '#3b82f6' },
        { label: 'Sequences', val: sequenceEdges.length, color: '#10b981' },
        { label: 'Conflicts', val: contradictions.length, color: contradictions.length > 0 ? '#ef4444' : 'var(--text-secondary)' },
      ].map(s => (
        <div key={s.label} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: s.color }}>{s.val}</div>
          <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
        </div>
      ))}
    </div>
  );

  // ── Research export helpers ───────────────────────────────────────────────
  const exportConflictData = useCallback(() => {
    const city = fetchCity || cityHint || 'city';
    const data = {
      city,
      exportedAt: new Date().toISOString(),
      total_nodes: nodes.length,
      contested_places: contradictions.map(c => {
        const posW = c.positive.reduce((s, n) => s + (n.credibility || 0.5), 0);
        const negW = c.negative.reduce((s, n) => s + (n.credibility || 0.5), 0);
        const total = posW + negW;
        return {
          place: c.place,
          positive_count: c.positive.length,
          negative_count: c.negative.length,
          total_claims: c.positive.length + c.negative.length,
          conflict_ratio: c.positive.length > 0 && c.negative.length > 0
            ? +(Math.min(c.positive.length, c.negative.length) / (c.positive.length + c.negative.length)).toFixed(3)
            : 0,
          credibility_weighted_pos_ratio: total > 0 ? +(posW / total).toFixed(3) : 0.5,
          resolution: resolutions[c.place.toLowerCase()]?.verdict || null,
          positive_claims: c.positive.map(n => ({ claim: n.claim, source: n.source?.sourceType, date: n.source?.date, credibility: +(n.credibility || 0).toFixed(3) })),
          negative_claims: c.negative.map(n => ({ claim: n.claim, source: n.source?.sourceType, date: n.source?.date, credibility: +(n.credibility || 0).toFixed(3) })),
        };
      }),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `conflicts_${city.replace(/[\s,]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }, [contradictions, resolutions, nodes.length, fetchCity, cityHint]);

  const exportKnowledgeGraph = useCallback(() => {
    const city = fetchCity || cityHint || 'city';
    const data = {
      city,
      exportedAt: new Date().toISOString(),
      total_claims: nodes.length,
      sources: [...new Set(nodes.map(n => n.source?.sourceType).filter(Boolean))],
      nodes: nodes.map(n => ({
        place: n.place,
        claim: n.claim,
        claimType: n.claimType,
        knowledge_type: n.knowledge_type,
        sentiment: n.evaluation?.sentiment,
        credibility: +(n.credibility || 0).toFixed(3),
        sourceType: n.source?.sourceType,
        date: n.source?.date,
        url: n.source?.url || null,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kg_${city.replace(/[\s,]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }, [nodes, fetchCity, cityHint]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '2rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Brain size={16} style={{ color: '#8b5cf6' }} />
        <div>
          <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>Knowledge Graph</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>Extract · verify · reason over travel knowledge</div>
        </div>
      </div>

      {/* Tab strip */}
      <div style={{ display: 'flex', borderRadius: '9px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        {[
          ['ingest', 'Ingest', FileText],
          ['graph', 'Claims', BarChart2],
          ['visual', 'Visual', GitBranch],
          ['conflicts', 'Conflicts', AlertTriangle],
        ].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', fontSize: '0.62rem', padding: '6px 0', background: tab === id ? 'rgba(139,92,246,0.2)' : 'transparent', color: tab === id ? '#c084fc' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontWeight: tab === id ? '700' : '400', borderRight: id !== 'conflicts' ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <Icon size={10} />{label}
            {id === 'conflicts' && contradictions.length > 0 && (
              <span style={{ fontSize: '0.55rem', background: '#ef4444', color: '#fff', borderRadius: '8px', padding: '0 4px', fontWeight: '800', minWidth: '14px', textAlign: 'center' }}>{contradictions.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── INGEST TAB ── */}
      {tab === 'ingest' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* ── OFFLINE PREPROCESSED KNOWLEDGE GRAPH SECTION ── */}
          {(() => {
            const cleanTarget = (fetchCity || cityHint || '').toLowerCase().replace(/^(greater|inner|outer)\s+/i, '').replace(/\s+(region|city|greater|area)$/i, '').trim();
            const PREPROCESSED_MAP = {
              'amsterdam': 'amsterdam',
              'barcelona': 'barcelona',
              'edinburgh': 'edinburgh',
              'kyoto': 'kyoto',
              'london': 'london',
              'new york': 'new_york',
              'new york city': 'new_york',
              'nyc': 'new_york',
              'paris': 'paris',
              'prague': 'prague',
              'rome': 'rome',
              'sydney': 'sydney',
              'tokyo': 'tokyo',
              'zurich': 'zurich',
              'zürich': 'zurich'
            };
            const matchedKey = PREPROCESSED_MAP[cleanTarget];
            if (!matchedKey) return null;

            return (
              <div style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.07),rgba(59,130,246,0.07))', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Brain size={16} style={{ color: '#10b981' }} />
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)' }}>Offline Preprocessed KG Available</span>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>Load ready-made knowledge for {cleanTarget} bundled with the app — no internet needed</div>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setExtracting(true);
                    setFetchStatus('Loading preprocessed offline cache...');
                    try {
                      const res = await fetch(assetUrl(`preprocessed/${matchedKey}.json`));
                      if (!res.ok) throw new Error('Preprocessed data file not found');
                      const data = await res.json();
                      const today = new Date().toISOString().slice(0, 10);
                      const SOURCE_LABELS = { wikivoyage: 'Wikivoyage', wikitravel: 'Wikitravel', wikipedia: 'Wikipedia', reddit: 'Reddit', stackexchange: 'StackExchange Travel' };
                      const allNew = [];
                      // Newer files: one ready-made `nodes` list (london, paris, rome, edinburgh, zurich)
                      if (Array.isArray(data.nodes)) {
                        data.nodes.forEach((n, idx) => {
                          const src = n.source || {};
                          allNew.push({ ...n, id: `offline-${matchedKey}-${idx}`, source: { ...src, label: src.label || src.sourceLabel || SOURCE_LABELS[src.sourceType] || src.sourceType } });
                        });
                      }
                      // Older files: nodes grouped per source
                      Object.entries(data).forEach(([srcKey, srcData]) => {
                        if (srcData && Array.isArray(srcData.nodes)) {
                          const label = SOURCE_LABELS[srcKey] || srcKey;
                          const url = srcData.url || null;
                          srcData.nodes.forEach((n, idx) => {
                            allNew.push({
                              id: `offline-${srcKey}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
                              place: n.place,
                              claim: n.claim,
                              claimType: n.claimType || 'evaluation',
                              knowledge_type: n.knowledge_type || 'stable',
                              evaluation: { sentiment: n.sentiment || 'neutral', intensity: n.intensity || 0.5 },
                              advice: n.advice || null,
                              conditions: n.conditions || {},
                              source: { sourceType: srcKey, label, date: today, url }
                            });
                          });
                        }
                      });
                      
                      const merged = [...rawNodes, ...allNew];
                      const seen = new Set();
                      const deduped = merged.filter(n => {
                        const k = (n.place || '').toLowerCase() + '::' + (n.claim || '').toLowerCase().slice(0, 120);
                        if (seen.has(k)) return false;
                        seen.add(k);
                        return true;
                      });
                      
                      saveKG(deduped);
                      setFetchStatus(`✓ Loaded ${allNew.length} preprocessed offline nodes!`);
                      setTab('graph');
                    } catch (e) {
                      setFetchStatus(`Error loading offline cache: ${e.message}`);
                    } finally {
                      setExtracting(false);
                    }
                  }}
                  style={{ width: '100%', padding: '8px', fontSize: '0.78rem', fontWeight: '700', background: '#10b981', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <RefreshCw size={12} /> Load Offline Preprocessed Graph ({cleanTarget})
                </button>
              </div>
            );
          })()}

          {/* ── ONLINE FETCH SECTION ── */}
          <div style={{ background: 'linear-gradient(135deg,rgba(14,165,233,0.07),rgba(139,92,246,0.07))', border: '1px solid rgba(14,165,233,0.25)', borderRadius: '12px', overflow: 'hidden' }}>
            <button
              onClick={() => setShowFetchPanel(p => !p)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Wifi size={13} style={{ color: '#0ea5e9' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: '700' }}>Fetch from Online</span>
                <span style={{ fontSize: '0.6rem', color: '#0ea5e9', background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)', padding: '1px 6px', borderRadius: '8px', fontWeight: '600' }}>{HAS_DEV_PROXY ? 'Wikivoyage · Wikitravel · Reddit · StackExchange · Wikipedia' : 'Wikivoyage · Reddit · StackExchange · Wikipedia'}</span>
              </div>
              {showFetchPanel ? <ChevronUp size={13} style={{ opacity: 0.5 }} /> : <ChevronDown size={13} style={{ opacity: 0.5 }} />}
            </button>

            {showFetchPanel && (
              <div style={{ padding: '0 13px 13px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* Search Mode Selector */}
                <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                  <button
                    onClick={() => setFetchMode('name')}
                    style={{
                      flex: 1, padding: '6px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700',
                      background: fetchMode === 'name' ? 'rgba(14,165,233,0.15)' : 'rgba(0,0,0,0.2)',
                      border: `1px solid ${fetchMode === 'name' ? '#0ea5e9' : 'rgba(255,255,255,0.1)'}`,
                      color: fetchMode === 'name' ? '#0ea5e9' : 'var(--text-secondary)', cursor: 'pointer'
                    }}
                  >
                    City Name
                  </button>
                  <button
                    onClick={() => setFetchMode('coords')}
                    style={{
                      flex: 1, padding: '6px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700',
                      background: fetchMode === 'coords' ? 'rgba(14,165,233,0.15)' : 'rgba(0,0,0,0.2)',
                      border: `1px solid ${fetchMode === 'coords' ? '#0ea5e9' : 'rgba(255,255,255,0.1)'}`,
                      color: fetchMode === 'coords' ? '#0ea5e9' : 'var(--text-secondary)', cursor: 'pointer'
                    }}
                  >
                    Around Coordinates
                  </button>
                </div>

                {/* Inputs based on Search Mode */}
                {fetchMode === 'name' ? (
                  <div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>City / Destination</div>
                    <input
                      type="text"
                      placeholder="e.g. Barcelona, Prague, Kyoto…"
                      value={fetchCity}
                      onChange={e => setFetchCity(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleFetchOnline()}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.25)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '7px', fontSize: '0.82rem', padding: '7px 10px' }}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Search Coordinates</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '7px', fontSize: '0.82rem', padding: '7px 10px', color: 'var(--text-primary)' }}>
                          {customCoords
                            ? `${customCoords[0].toFixed(4)}, ${customCoords[1].toFixed(4)}`
                            : (tripData.locations?.[0]?.coords
                              ? `${tripData.locations[0].coords[0].toFixed(4)}, ${tripData.locations[0].coords[1].toFixed(4)}`
                              : 'No coords (using GPS/hint)'
                            )
                          }
                        </div>
                        <button
                          onClick={() => {
                            navigator.geolocation.getCurrentPosition(
                              (pos) => {
                                const lat = pos.coords.latitude;
                                const lon = pos.coords.longitude;
                                setCustomCoords([lat, lon]);
                                setFetchStatus(`GPS coordinates retrieved: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
                              },
                              (err) => {
                                alert(`GPS failed: ${err.message}`);
                              }
                            );
                          }}
                          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '7px', padding: '0 10px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600' }}
                        >
                          GPS
                        </button>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <span>Search Radius</span>
                        <span style={{ color: '#0ea5e9', fontWeight: '700' }}>{radiusKm} km</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={radiusKm}
                        onChange={e => setRadiusKm(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: '#0ea5e9' }}
                      />
                    </div>
                  </div>
                )}

                {/* Source checkboxes — compact pill row */}
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sources to fetch</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      { key: 'wikivoyage', icon: '🗺', label: 'Wikivoyage', color: '#0ea5e9', desc: 'Encyclopedic travel guides, human-curated' },
                      { key: 'wikitravel', icon: '🧭', label: 'Wikitravel', color: '#06b6d4', desc: 'Community travel wiki, budget-focused content' },
                      { key: 'reddit', icon: '💬', label: 'Reddit', color: '#f97316', desc: 'r/travel · r/solotravel · r/backpacking · r/travelhacks · city subreddit · up to 100 posts per query' },
                      { key: 'stackexchange', icon: '🏷', label: 'StackExchange', color: '#f59e0b', desc: 'Voted travel Q&A from Travel StackExchange' },
                      { key: 'wikipedia', icon: '📖', label: 'Wikipedia', color: '#94a3b8', desc: 'Factual/historical context' },
                    ].filter(src => HAS_DEV_PROXY || src.key !== 'wikitravel').map(src => (
                      <label key={src.key}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                          background: fetchSources[src.key] ? `${src.color}18` : 'rgba(0,0,0,0.2)',
                          border: `1px solid ${fetchSources[src.key] ? src.color + '55' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: '20px', padding: '5px 11px', transition: 'all 0.15s',
                          userSelect: 'none'
                        }}>
                        <input
                          type="checkbox"
                          checked={fetchSources[src.key]}
                          onChange={e => setFetchSources(prev => ({ ...prev, [src.key]: e.target.checked }))}
                          style={{ display: 'none' }}
                        />
                        <span style={{ fontSize: '0.78rem' }}>{src.icon}</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: '600', color: fetchSources[src.key] ? src.color : 'var(--text-secondary)' }}>{src.label}</span>
                        {fetchSources[src.key] && <Check size={10} style={{ color: src.color }} />}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Fetch button */}
                <button
                  onClick={handleFetchOnline}
                  disabled={fetching || extracting || (fetchMode === 'name' && !fetchCity.trim()) || !Object.values(fetchSources).some(Boolean)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '0.65rem', fontSize: '0.82rem', fontWeight: '700', background: 'linear-gradient(135deg,#0ea5e9,#8b5cf6)', border: 'none', borderRadius: '8px', color: 'white', cursor: (fetching || extracting) ? 'not-allowed' : 'pointer', opacity: (fetching || extracting || (fetchMode === 'name' && !fetchCity.trim())) ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                  {fetching ? <><Loader2 size={13} className="spin" /> {fetchStatus || 'Fetching…'}</> :
                    extracting ? <><Loader2 size={13} className="spin" /> Extracting… </> :
                      <><Wifi size={13} /> Fetch & Extract Knowledge</>}
                </button>

                {/* Animated extraction progress — shown while running */}
                {(fetching || extracting) && (
                  <ExtractionProgress
                    fetching={fetching}
                    extracting={extracting}
                    fetchStatus={fetchStatus}
                    nodeCount={nodes.length}
                    fetchedPreviews={fetchedPreviews}
                  />
                )}

                {/* Fetched source summary — shown after completion */}
                {!fetching && !extracting && fetchedPreviews.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fetched sources</div>
                    {fetchedPreviews.map((src, i) => {
                      const isOk = src.status === 'ok' || src.status === 'extracting' || src.status === 'extracted';
                      const statusColor = src.status === 'extracted' ? '#10b981' : src.status === 'extracting' ? '#a78bfa' : src.status === 'ok' ? '#6b7280' : src.status === 'none' ? '#f59e0b' : src.status === 'error' || src.status === 'extract_error' ? '#ef4444' : '#6b7280';
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${isOk ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '7px', padding: '6px 10px' }}>
                          <SourceBadge sourceType={src.sourceType} />
                          <div style={{ flex: 1, fontSize: '0.68rem', color: 'var(--text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {src.title || src.label}
                            {src.charCount > 0 && <span> · <span style={{ color: 'var(--text-primary)' }}>{src.charCount?.toLocaleString()} chars</span></span>}
                            {src.posts && <span> · {src.posts} posts</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                            {src.status === 'extracted' && <><span style={{ fontSize: '0.65rem', color: '#10b981' }}>✓</span>{src.nodeCount > 0 && <span style={{ fontSize: '0.6rem', color: '#34d399', background: 'rgba(16,185,129,0.12)', padding: '0 5px', borderRadius: '6px', fontWeight: '700' }}>+{src.nodeCount} nodes</span>}</>}
                            {src.status === 'extract_error' && <span style={{ fontSize: '0.6rem', color: '#f87171' }}>✗ {src.extractError}</span>}
                            {(src.status === 'ok' || src.status === 'none' || src.status === 'error') && <span style={{ fontSize: '0.65rem', color: statusColor, fontWeight: '700' }}>{src.status === 'ok' ? '✓' : src.status === 'none' ? '—' : '✗'}</span>}
                          </div>
                          {src.url && isOk && (
                            <a href={src.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', opacity: 0.5, flexShrink: 0 }}>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Final status */}
                {fetchStatus && !fetching && !extracting && (
                  <div style={{ fontSize: '0.7rem', color: fetchStatus.startsWith('✓') ? '#34d399' : 'var(--text-secondary)' }}>
                    {fetchStatus}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manual paste — collapsed by default */}
          <button
            onClick={() => setShowManualPaste(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.7rem', width: '100%' }}>
            <FileText size={11} />
            <span>Paste text manually</span>
            {showManualPaste ? <ChevronUp size={11} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={11} style={{ marginLeft: 'auto' }} />}
          </button>

          {showManualPaste && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Source metadata row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Source type</div>
                  <select value={sourceType} onChange={e => setSourceType(e.target.value)}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', fontSize: '0.74rem', padding: '5px 8px' }}>
                    <option value="blog">Blog post</option>
                    <option value="review">Review (e.g. TripAdvisor)</option>
                    <option value="reddit">Reddit / forum</option>
                    <option value="manual">Personal note</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Source date</div>
                  <input type="date" value={sourceDate} onChange={e => setSourceDate(e.target.value)}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', fontSize: '0.74rem', padding: '5px 8px' }} />
                </div>
              </div>
              <textarea
                placeholder={"Paste blog post, TripAdvisor review, Reddit trip report…"}
                value={ingestText}
                onChange={e => setIngestText(e.target.value)}
                rows={7}
                style={{ resize: 'vertical', width: '100%', background: 'rgba(0,0,0,0.25)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.78rem', padding: '10px', fontFamily: 'inherit', lineHeight: 1.6 }}
              />
              <button className="btn-primary" onClick={() => handleExtract()} disabled={extracting || !ingestText.trim()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0.6rem', fontSize: '0.82rem', fontWeight: '700', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', opacity: (!ingestText.trim() || extracting) ? 0.5 : 1 }}>
                {extracting ? <><Loader2 size={13} className="spin" /> Extracting… </> : <><Brain size={13} /> Extract Knowledge</>}
              </button>
              {extractMsg && (
                <div style={{ fontSize: '0.72rem', padding: '6px 10px', borderRadius: '7px', background: extractMsg.startsWith('✓') ? 'rgba(16,185,129,0.12)' : extractMsg.startsWith('Error') ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${extractMsg.startsWith('✓') ? 'rgba(16,185,129,0.3)' : extractMsg.startsWith('Error') ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`, color: extractMsg.startsWith('✓') ? '#34d399' : extractMsg.startsWith('Error') ? '#fca5a5' : 'var(--text-secondary)' }}>
                  {extractMsg}
                </div>
              )}

              {nodes.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current graph</div>
                  {statsBar}
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {/* ── GRAPH TAB ── */}
      {tab === 'graph' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {nodes.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', fontSize: '0.78rem' }}>
              <Brain size={28} style={{ opacity: 0.3, marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
              No knowledge extracted yet. Use <strong>Fetch Online</strong> or <strong>Ingest</strong> tab.
            </div>
          ) : (
            <>
              {statsBar}

              {/* Dynamic Credibility Slider Filter */}
              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '9px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.67rem', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Credibility Threshold Filter</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: credibilityThreshold > 0.7 ? '#10b981' : credibilityThreshold > 0.4 ? '#f59e0b' : '#c084fc' }}>
                    {(credibilityThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={credibilityThreshold * 100}
                  onChange={e => setCredibilityThreshold(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: '#8b5cf6', cursor: 'pointer', height: '18px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: 'var(--text-secondary)' }}>
                  <span>0% (Show All)</span>
                  <span>50% (Medium)</span>
                  <span>80% (High)</span>
                </div>
              </div>

              {/* Sequence map */}
              {sequenceEdges.length > 0 && (
                <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '10px 12px', marginBottom: '4px' }}>
                  <div style={{ fontSize: '0.63rem', fontWeight: '700', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <GitBranch size={11} /> Sequence patterns
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {sequenceEdges.slice(0, 5).map((e, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem' }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{e.from}</span>
                        <ArrowRight size={11} style={{ color: '#34d399', flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{e.to}</span>
                        {e.count > 1 && <span style={{ fontSize: '0.57rem', color: '#34d399', background: 'rgba(16,185,129,0.12)', padding: '1px 5px', borderRadius: '6px' }}>×{e.count}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Area Sub-tabs */}
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px' }}>
                <button onClick={() => setAreaFilter('all')} style={{ flex: 1, fontSize: '0.68rem', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', background: areaFilter === 'all' ? 'rgba(20,184,166,0.15)' : 'transparent', border: 'none', color: areaFilter === 'all' ? '#2dd4bf' : 'var(--text-secondary)', fontWeight: areaFilter === 'all' ? '700' : '400', transition: 'all 0.15s' }}>
                  All Insights ({credibleNodes.length})
                </button>
                <button onClick={() => setAreaFilter('inside')} style={{ flex: 1, fontSize: '0.68rem', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', background: areaFilter === 'inside' ? 'rgba(20,184,166,0.15)' : 'transparent', border: 'none', color: areaFilter === 'inside' ? '#2dd4bf' : 'var(--text-secondary)', fontWeight: areaFilter === 'inside' ? '700' : '400', transition: 'all 0.15s' }}
                  title="Claims about specific named places">
                  Named Places ({locationNodeIds.size})
                </button>
                <button onClick={() => setAreaFilter('others')} style={{ flex: 1, fontSize: '0.68rem', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', background: areaFilter === 'others' ? 'rgba(20,184,166,0.15)' : 'transparent', border: 'none', color: areaFilter === 'others' ? '#2dd4bf' : 'var(--text-secondary)', fontWeight: areaFilter === 'others' ? '700' : '400', transition: 'all 0.15s' }}
                  title="General topic/category claims">
                  General Tips ({credibleNodes.length - locationNodeIds.size})
                </button>
              </div>
              {/* Filters */}
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                <input type="text" placeholder="Search places or statements…" aria-label="Search places or statements" value={filterPlace} onChange={e => setFilterPlace(e.target.value)}
                  style={{ flex: 1, minWidth: '100px', background: 'rgba(0,0,0,0.25)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.69rem', padding: '4px 8px' }} />
                <select value={filterSentiment} onChange={e => setFilterSentiment(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.69rem', padding: '4px 6px' }}>
                  <option value="all">All sentiments</option>
                  <option value="positive">Positive</option>
                  <option value="negative">Negative</option>
                  <option value="neutral">Neutral</option>
                </select>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.69rem', padding: '4px 6px' }}>
                  <option value="all">All types</option>
                  <option value="temporal">Timing</option>
                  <option value="conditional">Advice</option>
                  <option value="evaluation">Opinion</option>
                  <option value="sequence">Sequence</option>
                </select>
                {(filterPlace || filterSentiment !== 'all' || filterType !== 'all') && (
                  <button onClick={() => { setFilterPlace(''); setFilterSentiment('all'); setFilterType('all'); }}
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', borderRadius: '6px', fontSize: '0.69rem', padding: '4px 8px', cursor: 'pointer' }}>
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Node list */}
              {(() => {
                const renderNode = (node) => {
                  const sentColor = node.evaluation?.sentiment === 'positive' ? '#818cf8' : node.evaluation?.sentiment === 'negative' ? '#fb923c' : '#94a3b8';
                  const isExpanded = expandedId === node.id;
                  return (
                    <div key={node.id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '9px', overflow: 'hidden' }}>
                      <div style={{ padding: '9px 11px', cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : node.id)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px', flexWrap: 'wrap' }}>
                              <span
                                onClick={(e) => { e.stopPropagation(); handleClaimClick(node); }}
                                style={{ fontSize: '0.75rem', fontWeight: '700', color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline' }}
                                title="Click to center map and view place details"
                              >
                                {node.place}
                              </span>
                              <ClaimBadge type={node.claimType} />
                              <span style={{ fontSize: '0.57rem', padding: '1px 5px', borderRadius: '6px', background: node.knowledge_type === 'volatile' ? 'rgba(249,115,22,0.15)' : 'rgba(99,102,241,0.15)', color: node.knowledge_type === 'volatile' ? '#fb923c' : '#a5b4fc', fontWeight: '600' }}>
                                {node.knowledge_type === 'volatile' ? <><Zap size={8} /> volatile</> : <><Shield size={8} /> stable</>}
                              </span>
                              {node.source?.sourceType && <SourceBadge sourceType={node.source.sourceType} />}
                              {node.source?.url && (
                                <span
                                  onClick={(e) => { e.stopPropagation(); window.open(node.source.url, '_blank'); }}
                                  style={{ fontSize: '0.57rem', padding: '1px 5px', borderRadius: '6px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                                  title="View original post/source"
                                >
                                  <ExternalLink size={8} /> Post Link
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: sentColor, lineHeight: 1.4 }}>{node.claim}</div>
                            {node.advice && <div style={{ fontSize: '0.68rem', color: '#c084fc', marginTop: '2px' }}>→ {node.advice}</div>}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                            <CredBar score={node.credibility} low={node.credLow} high={node.credHigh} />
                            <AgeBadge node={node} />
                            {isExpanded ? <ChevronUp size={11} style={{ opacity: 0.4 }} /> : <ChevronDown size={11} style={{ opacity: 0.4 }} />}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '8px 11px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)' }}>
                          {node.source?.snippet && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontStyle: 'italic', borderLeft: '3px solid rgba(139,92,246,0.4)', paddingLeft: '8px', marginBottom: '8px', lineHeight: 1.5 }}>
                              "{node.source.snippet}"
                            </div>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.63rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            <span>Source: <strong style={{ color: 'var(--text-primary)' }}>{node.source?.sourceType || 'unknown'}</strong></span>
                            {node.source?.date && <span>Written: <strong style={{ color: 'var(--text-primary)' }}>{node.source.date}</strong></span>}
                            {node.source?.authorProfile && <span>Traveler: <strong style={{ color: 'var(--text-primary)' }}>{node.source.authorProfile}</strong></span>}
                            <span>Credibility: <strong style={{ color: node.credibility > 0.7 ? '#818cf8' : node.credibility > 0.4 ? '#f59e0b' : '#fb923c' }}>{(node.credibility * 100).toFixed(0)}%</strong></span>
                            {node.source?.url && (
                              <a href={node.source.url} target="_blank" rel="noreferrer" style={{ color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <ExternalLink size={9} /> Source
                              </a>
                            )}
                          </div>
                          {Object.keys(node.conditions || {}).length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                              {Object.entries(node.conditions).map(([k, v]) => v && (
                                <span key={k} style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                                  {k}: {v}
                                </span>
                              ))}
                            </div>
                          )}
                          <button onClick={() => deleteNode(node.id)}
                            style={{ fontSize: '0.62rem', padding: '2px 8px', borderRadius: '5px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Trash2 size={9} /> Remove
                          </button>
                        </div>
                      )}
                    </div>
                  );
                };

                const groups = {
                  'Safety & Health': [],
                  'Food & Drink': [],
                  'Transport & Accommodation': [],
                  'Culture & History': [],
                  'Shopping & Districts': [],
                  'Travel Tips & Climate': [],
                  'Miscellaneous': []
                };
                filteredNodes.forEach(node => {
                  const cat = getGroupingCategory(node);
                  groups[cat].push(node);
                });

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {areaFilter === 'inside' ? (
                      <>
                        {filteredNodes.map(node => renderNode(node))}
                        {filteredNodes.length === 0 && (
                          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.72rem', padding: '1.5rem' }}>No nodes match the current filters.</div>
                        )}
                      </>
                    ) : (
                      <>
                        {Object.entries(groups).map(([category, catNodes]) => {
                          if (catNodes.length === 0) return null;
                          const IconComponent = getCategoryIcon(category);
                          const isSecExpanded = !!expandedSections[category];
                          return (
                            <div key={category} style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '9px', overflow: 'hidden' }}>
                              <button
                                onClick={() => setExpandedSections(prev => ({ ...prev, [category]: !prev[category] }))}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  background: 'rgba(255,255,255,0.02)',
                                  border: 'none',
                                  color: 'var(--text-primary)',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <IconComponent size={14} style={{ color: '#818cf8' }} />
                                  <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>{category}</span>
                                  <span style={{ fontSize: '0.62rem', background: 'rgba(129,140,248,0.15)', color: '#a5b4fc', padding: '1px 5px', borderRadius: '8px', fontWeight: '600' }}>{catNodes.length}</span>
                                </div>
                                {isSecExpanded ? <ChevronUp size={13} style={{ opacity: 0.5 }} /> : <ChevronDown size={13} style={{ opacity: 0.5 }} />}
                              </button>

                              {isSecExpanded && (
                                <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                  {catNodes.map(node => renderNode(node))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {filteredNodes.length === 0 && (
                          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.72rem', padding: '1.5rem' }}>No nodes match the current filters.</div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}


      {/* ── VISUAL GRAPH TAB ── */}
      {tab === 'visual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {nodes.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', fontSize: '0.78rem' }}>
              <Brain size={28} style={{ opacity: 0.3, marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
              No knowledge extracted yet. Use <strong>Fetch Online</strong> or <strong>Ingest</strong> tab.
            </div>
          ) : (
            <>
              {statsBar}

              {/* Area Sub-tabs */}
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px' }}>
                <button onClick={() => setAreaFilter('all')} style={{ flex: 1, fontSize: '0.68rem', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', background: areaFilter === 'all' ? 'rgba(20,184,166,0.15)' : 'transparent', border: 'none', color: areaFilter === 'all' ? '#2dd4bf' : 'var(--text-secondary)', fontWeight: areaFilter === 'all' ? '700' : '400', transition: 'all 0.15s' }}>
                  All Insights ({credibleNodes.length})
                </button>
                <button onClick={() => setAreaFilter('inside')} style={{ flex: 1, fontSize: '0.68rem', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', background: areaFilter === 'inside' ? 'rgba(20,184,166,0.15)' : 'transparent', border: 'none', color: areaFilter === 'inside' ? '#2dd4bf' : 'var(--text-secondary)', fontWeight: areaFilter === 'inside' ? '700' : '400', transition: 'all 0.15s' }}
                  title="Claims about specific named places (museums, restaurants, landmarks)">
                  Named Places ({locationNodeIds.size})
                </button>
                <button onClick={() => setAreaFilter('others')} style={{ flex: 1, fontSize: '0.68rem', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', background: areaFilter === 'others' ? 'rgba(20,184,166,0.15)' : 'transparent', border: 'none', color: areaFilter === 'others' ? '#2dd4bf' : 'var(--text-secondary)', fontWeight: areaFilter === 'others' ? '700' : '400', transition: 'all 0.15s' }}
                  title="General topic/category claims (safety tips, weather, transport overview)">
                  General Tips ({credibleNodes.length - locationNodeIds.size})
                </button>
              </div>
              {areaFilter !== 'all' && visualMode === 'radar' && (
                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', marginTop: '-4px', marginBottom: '4px', paddingLeft: '2px' }}>
                  Radar shows topic coverage of {areaFilter === 'inside' ? 'named-place' : 'general-tip'} claims only
                </div>
              )}

              {/* Controls and View Mode Toggle */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { id: 'constellation', label: 'Constellation', icon: Sparkles },
                    { id: 'radar', label: 'Radar', icon: Filter },
                    { id: 'bubbles', label: 'Bubbles', icon: BarChart2 },
                    { id: 'graph', label: 'Force Graph', icon: GitBranch },
                  ].map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setVisualMode(id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', padding: '5px 11px', borderRadius: '8px', background: visualMode === id ? 'rgba(139,92,246,0.18)' : 'rgba(0,0,0,0.2)', border: `1px solid ${visualMode === id ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`, color: visualMode === id ? '#c084fc' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: visualMode === id ? '700' : '400', transition: 'all 0.15s' }}>
                      <Icon size={11} />{label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={toggleMapOverlay}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.68rem',
                    padding: '5px 11px',
                    borderRadius: '8px',
                    background: mapOverlayActive ? 'rgba(20,184,166,0.18)' : 'rgba(0,0,0,0.2)',
                    border: `1px solid ${mapOverlayActive ? 'rgba(20,184,166,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    color: mapOverlayActive ? '#2dd4bf' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: mapOverlayActive ? '700' : '400',
                    transition: 'all 0.15s'
                  }}
                  title="Toggle geographic view of claims & sequence arrows directly on the map"
                >
                  <MapPin size={11} style={{ color: mapOverlayActive ? '#14b8a6' : 'inherit' }} />
                  <span>{mapOverlayActive ? "Show on Map" : "Show on Map"}</span>
                </button>

                {/* Wikidata entity linking button */}
                <button
                  onClick={handleWikidataLink}
                  disabled={wikidataRunning || rawNodes.length === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    fontSize: '0.68rem', padding: '5px 11px', borderRadius: '8px',
                    background: wikidataRunning ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.12)',
                    border: '1px solid rgba(99,102,241,0.35)',
                    color: wikidataRunning ? '#a5b4fc' : '#818cf8',
                    cursor: wikidataRunning || rawNodes.length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: '600', transition: 'all 0.15s',
                    opacity: rawNodes.length === 0 ? 0.4 : 1,
                  }}
                  title="Resolve place names against Wikidata knowledge graph — enriches nodes with canonical entity IDs and coordinates"
                >
                  {wikidataRunning
                    ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Globe size={11} />}
                  <span>{wikidataRunning ? 'Linking…' : 'Link Wikidata'}</span>
                </button>
              </div>

              {/* Wikidata status message */}
              {wikidataMsg && (
                <div style={{ fontSize: '0.65rem', color: wikidataMsg.startsWith('✓') ? '#10b981' : wikidataMsg.startsWith('Error') ? '#ef4444' : '#a5b4fc', padding: '4px 6px', background: 'rgba(99,102,241,0.07)', borderRadius: '6px', marginTop: '-2px' }}>
                  {wikidataMsg}
                </div>
              )}

              {visualMode === 'constellation' ? (
                <KnowledgeConstellationView nodes={visualNodes} triggerPlaceInfo={triggerPlaceInfo} tripData={tripData} city={fetchCity || cityHint || ''} cityNamesSet={cityNamesSet} />
              ) : visualMode === 'radar' ? (
                <KnowledgeRadarView nodes={visualNodes} />
              ) : visualMode === 'bubbles' ? (
                <PlaceBubblesView nodes={visualNodes} triggerPlaceInfo={triggerPlaceInfo} tripData={tripData} cityNamesSet={cityNamesSet} allCityNames={allCityNames} />
              ) : (
                <KnowledgeGraphView claims={visualNodes} city={fetchCity || cityHint || 'Destination'} triggerPlaceInfo={triggerPlaceInfo} tripData={tripData} />
              )}
            </>
          )}
        </div>
      )}

      {/* ── CONFLICTS TAB ── */}
      {tab === 'conflicts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {contradictions.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', fontSize: '0.78rem' }}>
              <Check size={24} style={{ color: '#10b981', marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
              No contradictions detected across {nodes.length} nodes.
            </div>
          ) : (
            <>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {contradictions.length} place{contradictions.length > 1 ? 's have' : ' has'} conflicting evaluations. Use the resolver to adjudicate — your decisions persist for this session.
              </div>
              {Object.values(resolutions).length > 0 && (
                <div style={{ fontSize: '0.6rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CheckCircle2 size={10} /> {Object.values(resolutions).length} conflict{Object.values(resolutions).length > 1 ? 's' : ''} resolved
                </div>
              )}
              {/* Research export row */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={exportConflictData}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '7px', borderRadius: '7px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: '#fca5a5', cursor: 'pointer', fontSize: '0.65rem', fontWeight: '700', fontFamily: 'inherit' }}
                  title="Export contested places JSON for validate_conflicts.py (Approach A)">
                  <Download size={11} /> Export conflicts
                </button>
                <button onClick={exportKnowledgeGraph}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '7px', borderRadius: '7px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.22)', color: '#c084fc', cursor: 'pointer', fontSize: '0.65rem', fontWeight: '700', fontFamily: 'inherit' }}
                  title="Export full KG JSON for validate_novelty.py (Approach B)">
                  <Download size={11} /> Export KG
                </button>
              </div>

              {contradictions.map((c, i) => {
                const posWeight = c.positive.reduce((s, n) => s + (n.credibility || 0.5), 0);
                const negWeight = c.negative.reduce((s, n) => s + (n.credibility || 0.5), 0);
                const total = posWeight + negWeight;
                const posRatio = total > 0 ? posWeight / total : 0.5;
                const verdict = posRatio > 0.65 ? 'Mostly positive' : posRatio < 0.35 ? 'Mostly negative' : 'Genuinely mixed';
                const verdictColor = posRatio > 0.65 ? '#10b981' : posRatio < 0.35 ? '#ef4444' : '#f59e0b';
                const resolution = resolutions[c.place.toLowerCase()];

                return (
                  <div key={i} style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${resolution ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`, borderRadius: '10px', overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ padding: '10px 13px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>{c.place}</span>
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                          {resolution ? (
                            <>
                              <span style={{ fontSize: '0.6rem', fontWeight: '700', color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '2px 7px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <CheckCircle2 size={9} /> {resolution.verdict === 'trust_positive' ? 'Trusted positive' : resolution.verdict === 'trust_negative' ? 'Trusted negative' : 'Context-dependent'}
                              </span>
                              <button onClick={() => resolveConflict(c.place, null)}
                                style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 3px' }}>Re-open</button>
                            </>
                          ) : (
                            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: verdictColor, background: verdictColor + '18', padding: '2px 8px', borderRadius: '8px' }}>{verdict}</span>
                          )}
                        </div>
                      </div>

                      {/* Evidence bar */}
                      <div style={{ height: '5px', borderRadius: '3px', overflow: 'hidden', display: 'flex', marginBottom: '6px' }}>
                        <div style={{ width: `${posRatio * 100}%`, background: '#10b981', transition: 'width 0.3s' }} />
                        <div style={{ flex: 1, background: '#ef4444' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        <span style={{ color: '#10b981' }}>{c.positive.length} positive · w={posWeight.toFixed(1)}</span>
                        <span style={{ color: '#ef4444' }}>{c.negative.length} negative · w={negWeight.toFixed(1)}</span>
                      </div>
                    </div>

                    {/* Side-by-side claims */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      {[
                        { list: c.positive.slice(0, 3), label: '✓ Positive', color: '#10b981', bg: 'rgba(16,185,129,0.04)' },
                        { list: c.negative.slice(0, 3), label: '✗ Negative', color: '#ef4444', bg: 'rgba(239,68,68,0.04)' },
                      ].map(({ list, label, color, bg }, si) => (
                        <div key={label} style={{ background: bg, padding: '8px 10px', borderLeft: si === 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                          <div style={{ fontSize: '0.57rem', color, fontWeight: '700', marginBottom: '6px', letterSpacing: '0.03em' }}>{label}</div>
                          {list.map((n, j) => (
                            <div key={j} style={{ marginBottom: '5px', borderLeft: `2px solid ${color}35`, paddingLeft: '6px' }}>
                              <div style={{ fontSize: '0.63rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>{n.claim}</div>
                              <div style={{ display: 'flex', gap: '5px', marginTop: '2px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.53rem', color: 'rgba(255,255,255,0.28)' }}>{n.source?.date}</span>
                                <SourceBadge sourceType={n.source?.sourceType} />
                                <span style={{ fontSize: '0.53rem', color: 'rgba(255,255,255,0.25)' }}>{(n.credibility * 100).toFixed(0)}% cred</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    {/* Resolver buttons */}
                    {!resolution && (
                      <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '5px' }}>
                        <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.28)', alignSelf: 'center', marginRight: '3px' }}>Adjudicate:</div>
                        <button onClick={() => resolveConflict(c.place, 'trust_positive')}
                          style={{ flex: 1, padding: '5px 6px', borderRadius: '6px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', cursor: 'pointer', fontSize: '0.6rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                          <ThumbsUp size={9} /> Trust positive
                        </button>
                        <button onClick={() => resolveConflict(c.place, 'trust_negative')}
                          style={{ flex: 1, padding: '5px 6px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)', color: '#fca5a5', cursor: 'pointer', fontSize: '0.6rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                          <ThumbsDown size={9} /> Trust negative
                        </button>
                        <button onClick={() => resolveConflict(c.place, 'both_valid')}
                          style={{ flex: 1, padding: '5px 6px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.28)', color: '#fbbf24', cursor: 'pointer', fontSize: '0.6rem', fontWeight: '700' }}>
                          Context-dep.
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

    </div>
  );
}
