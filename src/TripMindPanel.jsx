import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { searchNominatim } from './api.js';
import { ollamaChatUrl } from './endpoints';
import { BROWSER_MODELS, DEFAULT_BROWSER_MODEL, hasWebGPU, browserChatFetch, isBrowserModelLoaded } from './ai/browserLLM';
import { Loader2, X, Sparkles, ChevronDown, ChevronUp, RotateCcw, Download, Settings, Plus, Pencil, Trash2, AlertTriangle, Calendar, CreditCard, Backpack, Lightbulb, BrainCircuit, Check, MapPin, ListChecks, GripVertical, User, Heart, Gem, Users, Briefcase, Activity, Zap, Coffee, Crown, Accessibility, Camera, TreePine, Leaf, Landmark, Utensils, Tent, Moon, Layers, Gamepad2, BookOpen, Compass, Martini } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   FEW-SHOT EXAMPLE LIBRARY
   Gold-standard itinerary fragments per traveler archetype.
   Injected into the system prompt so the LLM learns style, not just rules.
   Indexed by profile key: "{groupType}/{style}/{pace}"
───────────────────────────────────────────────────────────────────────────── */
const FEW_SHOT_LIBRARY = {
  'couple/cultural/moderate': {
    label: 'Couple · Cultural · Moderate',
    example: {
      theme: 'Art Nouveau Morning, Hidden Courtyards Afternoon',
      stops: [
        { time:'09:00', name:'Local bakery near hotel', type:'cafe', duration:'30 min', notes:'Start slow — croissant and espresso, not a tourist café. Observe the neighbourhood waking up.', budgetEst:8, transport:'walk' },
        { time:'09:45', name:'Major Art Museum', type:'museum', duration:'2.5 hrs', notes:'Arrive at opening — no queues. Go straight to the floor your partner cares about most, then wander. Don\'t try to see everything.', budgetEst:18, transport:'walk', mustBook:true },
        { time:'12:30', name:'Market lunch in museum district', type:'restaurant', duration:'1 hr', notes:'Sit outside, order the daily special. This is where locals eat — not the museum café.', budgetEst:22, transport:'walk' },
        { time:'14:00', name:'Hidden courtyard walk', type:'historic', duration:'1.5 hrs', notes:'Many cities have unmarked historic passages. Ask a local or check city wiki. No admission, pure discovery.', budgetEst:0, transport:'walk' },
        { time:'17:30', name:'Rooftop bar at golden hour', type:'bar', duration:'1.5 hrs', notes:'Book a table for 17:30. Two drinks each, watch the city light change. This is the memory you\'ll talk about.', budgetEst:35, transport:'taxi', transportTime:'10 min' },
      ],
      dayTip: 'Couples burn out when they pack too much. Two great experiences remembered > five rushed ones forgotten.'
    }
  },
  'solo/adventure/packed': {
    label: 'Solo · Adventure · Packed',
    example: {
      theme: 'Summit Before Breakfast, City by Dusk',
      stops: [
        { time:'05:30', name:'Trailhead / Viewpoint', type:'hiking', duration:'3 hrs', notes:'Solo hikers: tell someone your route. The summit at sunrise is yours — no crowds, best light, best photos.', budgetEst:0, transport:'taxi', transportTime:'20 min', weatherSensitive:true },
        { time:'09:00', name:'Post-hike breakfast spot', type:'cafe', duration:'45 min', notes:'You\'ve earned it. Find a workers\' café, not a tourist one. Eggs, local bread, strong coffee.', budgetEst:10, transport:'walk' },
        { time:'10:30', name:'Underground / alternative cultural site', type:'attraction', duration:'2 hrs', notes:'Skip the main landmarks today — you did the best view at dawn. Go to a neighbourhood gallery or craft district instead.', budgetEst:12, transport:'metro', transportTime:'15 min' },
        { time:'13:30', name:'Street food lunch', type:'restaurant', duration:'45 min', notes:'Eat standing up at a market stall. Solo travel means you can eat anywhere — use it.', budgetEst:8, transport:'walk' },
        { time:'15:00', name:'Bike rental — city loop', type:'attraction', duration:'3 hrs', notes:'See three times the city on a bike. Follow the river or coast. No plan needed.', budgetEst:15, transport:'walk' },
        { time:'19:00', name:'Locals\' bar', type:'bar', duration:'2 hrs', notes:'Sit at the bar, not a table. Easier to meet people. Order what the person next to you is drinking.', budgetEst:20, transport:'walk' },
      ],
      dayTip: 'The solo advantage: you can pivot instantly. If something looks interesting, stop.'
    }
  },
  'family/mixed/relaxed': {
    label: 'Family · Mixed · Relaxed',
    example: {
      theme: 'Kids Rule the Morning, Parents Breathe in the Afternoon',
      stops: [
        { time:'09:30', name:'Interactive children\'s museum or science centre', type:'museum', duration:'2 hrs', notes:'Let the kids lead. Don\'t rush them. You\'ll be surprised what they notice.', budgetEst:25, transport:'taxi', transportTime:'15 min', mustBook:true },
        { time:'12:00', name:'Family-friendly restaurant with garden', type:'restaurant', duration:'1.5 hrs', notes:'Book ahead. Ask for a garden table. Order one thing the kids will definitely eat, then one thing adventurous for yourselves.', budgetEst:55, transport:'walk' },
        { time:'14:00', name:'City park with playground', type:'park', duration:'2 hrs', notes:'Unstructured time. Kids run, you sit. Bring snacks. This is actually the best part of the day for everyone.', budgetEst:0, transport:'walk' },
        { time:'17:00', name:'Early dinner — pizza or local equivalent', type:'restaurant', duration:'1 hr', notes:'Eat at 17:30 when it\'s quiet. Avoid the dinner rush with tired kids. Home by 19:00.', budgetEst:40, transport:'walk' },
      ],
      dayTip: 'The mistake families make: too much, too fast. Two good things remembered > five exhausted ones. Build in 30-min buffer at every transition.'
    }
  },
  'friends/foodie/moderate': {
    label: 'Friends · Foodie · Moderate',
    example: {
      theme: 'Market Morning, Tasting Menu Night',
      stops: [
        { time:'09:00', name:'Central food market', type:'attraction', duration:'1.5 hrs', notes:'Arrive early when it\'s still local. Each person picks one thing to try — compare notes. Budget €15 each for tastings.', budgetEst:15, transport:'metro', transportTime:'10 min' },
        { time:'11:00', name:'Cooking class — local cuisine', type:'attraction', duration:'3 hrs', notes:'Book weeks ahead. Choose a class taught by a local chef, not a tourist school. You\'ll make lunch.', budgetEst:65, transport:'walk', mustBook:true },
        { time:'15:00', name:'Craft beer / wine bar', type:'bar', duration:'1.5 hrs', notes:'A slow afternoon drink. Review the morning, plan the evening. Order a tasting flight.', budgetEst:25, transport:'walk' },
        { time:'19:30', name:'Chef\'s table or tasting menu restaurant', type:'restaurant', duration:'3 hrs', notes:'The centrepiece of a foodie trip. Book 2–4 weeks ahead. Trust the menu — don\'t modify it. Pair wines.', budgetEst:95, transport:'taxi', transportTime:'15 min', mustBook:true },
      ],
      dayTip: 'The best food trips mix formal and informal: street food in the morning, a serious dinner at night. Never eat at the same level all day.'
    }
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   FEEDBACK STORE
   Persists in localStorage. Corrections are injected into future prompts.
   Profile memory stores what worked per archetype.
───────────────────────────────────────────────────────────────────────────── */
const FEEDBACK_KEY = 'tripmind_feedback_v2';

function loadFeedbackStore() {
  try { return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '{}'); } catch { return {}; }
}
function saveFeedbackStore(store) {
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(store));
}

function getProfileKey(groupType, style, pace) {
  const styleStr = Array.isArray(style) ? style.join('+') : style;
  return `${groupType}/${styleStr}/${pace}`;
}

function getFewShotExamples(groupType, style, pace) {
  const key = getProfileKey(groupType, style, pace);
  const exact = FEW_SHOT_LIBRARY[key];
  if (exact) return [exact];
  const styles = Array.isArray(style) ? style : typeof style === 'string' ? style.split(/[+,]/) : [];
  const partial = Object.values(FEW_SHOT_LIBRARY).filter(e =>
    styles.some(s => e.label.toLowerCase().includes(s.trim())) || e.label.toLowerCase().includes(groupType)
  );
  return partial.slice(0, 2);
}

function getLearnedCorrections(profileKey) {
  const store = loadFeedbackStore();
  const corrections = (store.corrections || []).filter(c => c.profileKey === profileKey);
  const memory = (store.profileMemory || {})[profileKey];
  return { corrections: corrections.slice(-8), memory };
}

function recordFeedback(profileKey, type, itemName, rating, note) {
  const store = loadFeedbackStore();
  store.corrections = store.corrections || [];
  if (rating < 0 && note) {
    store.corrections.push({ profileKey, type, itemName, rating, note, ts: Date.now() });
    // Keep last 30 corrections
    if (store.corrections.length > 30) store.corrections = store.corrections.slice(-30);
  }
  // Profile memory: track positive day themes
  if (rating > 0 && type === 'day') {
    store.profileMemory = store.profileMemory || {};
    store.profileMemory[profileKey] = store.profileMemory[profileKey] || { goodThemes: [], count: 0 };
    store.profileMemory[profileKey].goodThemes.push(itemName);
    store.profileMemory[profileKey].count += 1;
    if (store.profileMemory[profileKey].goodThemes.length > 10)
      store.profileMemory[profileKey].goodThemes = store.profileMemory[profileKey].goodThemes.slice(-10);
  }
  saveFeedbackStore(store);
}

/* ─────────────────────────────────────────────────────────────────────────────
   SYSTEM PROMPT BUILDER
   Incorporates: design principles + real POI grounding + few-shot examples
                + learned corrections + profile memory
───────────────────────────────────────────────────────────────────────────── */
export const buildTripMindPrompt = (poiCtx, numDays, examples, learned) => {
  const exampleSection = examples.length > 0
    ? '\n═══ FEW-SHOT EXAMPLES (learn this style) ═══\n' +
      'These are gold-standard day plans for similar traveler types. Study the tone, depth of notes, and day structure:\n\n' +
      examples.map(ex =>
        `[${ex.label}]\nDay theme: "${ex.example.theme}"\n` +
        ex.example.stops.map(s =>
          `  ${s.time} · ${s.name} (${s.duration}) — "${s.notes}"` +
          (s.budgetEst > 0 ? ` [€${s.budgetEst}]` : '') +
          (s.weatherSensitive ? ' [⚠️ weather]' : '') +
          (s.mustBook ? ' [📅 book ahead]' : '')
        ).join('\n') +
        `\nDay tip: "${ex.example.dayTip}"`
      ).join('\n\n')
    : '';

  const correctionSection = (learned.corrections && learned.corrections.length > 0)
    ? '\n═══ LEARNED CORRECTIONS (from user feedback on past plans) ═══\n' +
      'These are real feedback points from travelers with this profile. Actively avoid these patterns:\n' +
      learned.corrections.map(c => `  ⚠ ${c.type === 'stop' ? `Stop "${c.itemName}"` : `Day "${c.itemName}"`}: ${c.note}`).join('\n')
    : '';

  const memorySection = (learned.memory && learned.memory.goodThemes && learned.memory.goodThemes.length > 0)
    ? '\n═══ PROFILE MEMORY (what worked for this traveler type) ═══\n' +
      `After ${learned.memory.count} plan(s) for this profile, these day themes were rated positively:\n` +
      learned.memory.goodThemes.map(t => `  ✓ "${t}"`).join('\n') +
      '\nBuild on these patterns when appropriate — but still introduce variety.'
    : '';

  return `You are TripMind, an AI travel planning assistant that produces deeply personalized, evidence-grounded itineraries. You ground every recommendation in real OpenStreetMap POI data, model traveler psychology, and design days with narrative coherence — not just lists of places.

═══ TRAVELER PERSONA MODELING ═══
Extract implicit and explicit signals from the user's description:

GROUP DYNAMICS
- solo       → prioritize safety, social venues, flexible timing, no paired activities
- couple     → romance beats, shared discovery, intimate dining, parallel interests
- honeymoon  → ultra-romantic, luxury experiences, privacy, surprise moments, scenic splurges
- family_kids→ child pacing (shorter days), accessible venues, meal-friendly timing, rest breaks
- friends    → shared experiences, social energy, evening culture, group decision-making
- seniors    → comfortable pacing, accessible venues, avoid heavy walking, rest opportunities, cultural depth
- business   → efficient, high-quality, near transit, minimal time waste

PACE SIGNALS
- packed  (5+ stops/day): "we want to see everything", "non-stop", "maximize every hour"
- moderate (3–4/day):     default; balanced effort and absorption
- relaxed (1–2/day):      "we hate rushing", "not a marathon", "kids with us", "just recovering"

STYLE SIGNALS
- adventure:    outdoor, physical, early starts, off-beaten-path, elevation gain
- cultural:     museums, architecture, history, walking tours, local art
- foodie:       markets, chef tables, street food, cooking classes, wine, local specialties
- relaxation:   slow mornings, spas, parks, scenic routes, no schedules
- nightlife:    late starts, bars, live music, clubs, social scenes
- wellness:     yoga, spas, thermal baths, healthy eating, mindful pace, nature walks
- photography:  golden hour timing, viewpoints, scenic streets, markets, less-visited angles
- luxury:       five-star, private tours, tasting menus, concierge-level experiences, no crowds
- mixed:        balanced across categories

BUDGET TIER (infer from language)
- budget  (<€60/day):   "backpacking", "cheapest", "hostel"
- mid     (€60–150):    "comfortable", "reasonable", default if unspecified
- comfort (€150–300):   "nice hotels", "treat ourselves", "good restaurants"
- luxury  (>€300):      "best of", "5-star", "no expense spared"

═══ ITINERARY DESIGN PRINCIPLES ═══
1. DAY THEMING: Each day has one coherent narrative arc — not a random stop list. Bad: "Museum, café, park, museum." Good: "Immersion in Impressionism — Orsay at opening, Montmartre lunch, artists' quarter afternoon, rooftop golden hour."
2. GEOGRAPHIC CLUSTERING: Group stops by proximity. Morning cluster → transit → afternoon cluster. Never zigzag across the city.
3. ENERGY CURVE: High-energy/active in the morning → cultural/experiential midday → relaxed/social evening.
4. GOLDEN HOUR: Viewpoints, rooftops, coastal walks → sunrise (06:30–08:30) or sunset (18:00–21:00). Never at noon.
5. MEAL INTEGRATION: Breakfast near accommodation, lunch near midday cluster, dinner deliberately chosen for the area.
6. ARRIVAL DAY: Lighter — max 2 stops, check-in, neighbourhood orientation walk, casual dinner.
7. DEPARTURE DAY: End by 12:00–13:00. Only walkable/nearby stops. No 3-hour museums.
8. DECISION FATIGUE: Max 2 advance booking requirements per day. Always flag mustBook:true.
9. WEATHER CONTINGENCY: Flag outdoor stops weatherSensitive:true. Mention an indoor alternative in the dayTip.
10. AUTHENTIC OVER ICONIC: Unless requested, include one hidden gem per day alongside any landmark.

═══ NOTES QUALITY STANDARD ═══
Every stop note must answer: "Why does THIS specific traveler want to go here, at THIS specific time, and what should they know?"
- BAD note: "The Louvre is the world's largest museum."
- GOOD note: "For art-lover couples, go straight to Room 77 (Vermeer). Arrive at opening — by 10am it's crowded. Decide in advance: 2 hours focused > 5 hours scattered."
${exampleSection}${correctionSection}${memorySection}

═══ REAL POI DATA (OpenStreetMap — verified locations) ═══
Use coords and hours from below. If a stop name matches, use EXACT name and coordinates:

${poiCtx}

If no suitable OSM POI exists, you may suggest a place type — but note it as a suggestion.

═══ OUTPUT FORMAT ═══
Return ONLY valid JSON. No markdown. No explanation. No code fences. Start with { end with }.

{
  "tripSummary": "Two evocative sentences tailored to THIS specific traveler. Not generic. Reference their personality and the destination.",
  "travelerProfile": {
    "type": "couple|solo|family|friends|business",
    "style": "cultural|foodie|adventure|relaxation|nightlife|mixed",
    "pace": "packed|moderate|relaxed",
    "budgetTier": "budget|mid|comfort|luxury",
    "personalityNote": "One sentence on what makes this specific traveler unique"
  },
  "days": [
    {
      "dayNumber": 1,
      "date": "Day 1",
      "theme": "Evocative day title",
      "weatherNote": "Practical note or empty string",
      "stops": [
        {
          "time": "09:00",
          "name": "Exact place name",
          "type": "museum|restaurant|viewpoint|park|historic|cafe|attraction|shopping|hiking|beach|hotel|bar",
          "duration": "2 hrs",
          "notes": "Specific tip — WHY this fits this traveler, practical detail",
          "coords": [0.0, 0.0],
          "budgetEst": 18,
          "transport": "walk|metro|taxi|bus|train",
          "transportTime": "10 min walk",
          "weatherSensitive": false,
          "mustBook": false
        }
      ],
      "dayBudget": 145,
      "dayTip": "One actionable local-knowledge insight that makes this day exceptional"
    }
  ],
  "budget": {
    "accommodation": 0, "food": 0, "activities": 0,
    "transport": 0, "extras": 0, "total": 0,
    "currency": "EUR", "perDayAverage": 0
  },
  "packing": [
    {"item": "Item name", "reason": "Why for THIS specific trip — not generic"}
  ],
  "researchMetrics": {
    "poisGrounded": "X of Y stops from real OSM data",
    "avgStopsPerDay": 4,
    "indoorOutdoorRatio": "55/45",
    "weatherRiskStops": 2,
    "uniqueCategories": 6,
    "fewShotExamplesUsed": ${JSON.stringify(examples.map(e => e.label))},
    "feedbackCorrectionsApplied": ${JSON.stringify((learned.corrections || []).length)},
    "profileMemoryUsed": ${JSON.stringify(!!(learned.memory && learned.memory.count > 0))}
  }
}`;
};

/* ─────────────────────────────────────────────────────────────────────────────
   DAY COLORS
───────────────────────────────────────────────────────────────────────────── */
const DAY_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#f97316','#84cc16','#a78bfa'];


/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export default function TripMindPanel({ tripData, setTripData, activeCity, aiActiveDay, onDayChange, triggerPlaceInfo, onPreviewPlaces, onFlyTo }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ollamaEndpoint, setOllamaEndpoint] = useState(() => localStorage.getItem('ollama_endpoint') || 'http://localhost:11434');
  const [ollamaModel,    setOllamaModel]    = useState(() => localStorage.getItem('ollama_model')    || 'llama3.1');
  const [showOllamaConfig, setShowOllamaConfig] = useState(false);
  // Where the AI runs: 'ollama' (local server) or 'browser' (WebLLM, no install)
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('ai_provider') || 'ollama');
  const [browserModel, setBrowserModel] = useState(() => localStorage.getItem('browser_model') || DEFAULT_BROWSER_MODEL);
  const [browserLoad, setBrowserLoad] = useState(null); // download/initialisation progress text
  // Same call shape as fetch(ollamaChatUrl, …); routes to the browser model when selected
  const aiFetch = (url, init) => aiProvider === 'browser'
    ? browserChatFetch(init, { modelId: browserModel, onProgress: (p) => setBrowserLoad(p.progress >= 1 ? null : `${p.text}`) }).finally(() => setBrowserLoad(null))
    : fetch(url, init);
  // Real connection check: is Ollama reachable, and which models are installed?
  const [ollamaState, setOllamaState] = useState({ status: 'checking', models: [] });
  useEffect(() => {
    let cancelled = false;
    const ep = ollamaEndpoint.trim().replace(/\/$/, '');
    if (!ep) { setOllamaState({ status: 'none', models: [] }); return; }
    setOllamaState(s => ({ ...s, status: 'checking' }));
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${ep}/api/tags`, { signal: AbortSignal.timeout(2500) });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!cancelled) setOllamaState({ status: 'ok', models: (j.models || []).map(m => m.name) });
      } catch {
        if (!cancelled) setOllamaState({ status: 'offline', models: [] });
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [ollamaEndpoint]);
  const [desc,        setDesc]        = useState(() => localStorage.getItem('tripmind_desc') || '');
  const [groupType,   setGroupType]   = useState(() => localStorage.getItem('tripmind_grouptype') || 'couple');
  const [tripPace,    setTripPace]    = useState(() => localStorage.getItem('tripmind_trippace') || 'moderate');
  const [tripStyle,   setTripStyle]   = useState(() => {
    try {
      const saved = localStorage.getItem('tripmind_tripstyle_arr');
      return saved ? JSON.parse(saved) : ['mixed'];
    } catch {
      return ['mixed'];
    }
  });
  const [numDays,     setNumDays]     = useState(() => {
    const val = localStorage.getItem('tripmind_numdays');
    return val ? parseInt(val, 10) : 3;
  });
  const [budgetInput, setBudgetInput] = useState(() => localStorage.getItem('tripmind_budgetinput') || '');
  const [loading,        setLoading]      = useState(false);
  const [streamChars,    setStreamChars]  = useState(0);
  const [err,            setErr]          = useState('');
  const [localActiveDay, setLocalActiveDay] = useState(0);
  const [applyDone,      setApplyDone]    = useState(false);
  const [editingStop,    setEditingStop]  = useState(null); // {dayIndex,stopIndex}
  const [editDraft,      setEditDraft]    = useState(null);
  const [draggedStop,    setDraggedStop]  = useState(null); // {dayIndex,stopIndex}
  const [refineText,     setRefineText]   = useState('');
  const [placesList,     setPlacesList]   = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('tripmind_placeslist') || 'null');
    } catch { return null; }
  });
  const [placesLoading,  setPlacesLoading] = useState(false);
  const [placesMode,     setPlacesMode]   = useState(() => localStorage.getItem('tripmind_placesmode') === 'true');
  const [placeCount,     setPlaceCount]   = useState(() => {
    const val = localStorage.getItem('tripmind_placecount');
    return val ? parseInt(val, 10) : 5;
  });
  const geocodeAbortRef = useRef(null);

  const generateRandomPrompt = (styles) => {
    const active = Array.isArray(styles) ? styles : [styles];
    const filtered = active.filter(x => x !== 'mixed');
    if (filtered.length === 0) return "";

    const VARIANTS = {
      cultural: [
        "exploring art galleries, museums, and local architecture",
        "diving into gallery crawls and historic museum tours",
        "seeking out art exhibitions and architectural highlights"
      ],
      foodie: [
        "sampling food markets, bakeries, and local dining",
        "hunting down street food stalls and local bistros",
        "savoring artisanal bakeries and regional specialties"
      ],
      adventure: [
        "finding hiking trails and scenic viewpoints",
        "discovering hidden hiking trails and scaling scenic viewpoints",
        "seeking active outdoor excursions and scenic viewpoints"
      ],
      relaxation: [
        "strolling botanical gardens and quiet parks",
        "unwinding in quiet parks and botanical gardens",
        "enjoying peaceful canal walks and green spaces"
      ],
      nightlife: [
        "checking out local bars and evening spots",
        "exploring hidden pubs and live music venues",
        "crawling local breweries and cocktail lounges"
      ],
      wellness: [
        "visiting peaceful gardens and relaxing paths",
        "strolling nature paths and peaceful meditation gardens",
        "discovering restorative areas and quiet gardens"
      ],
      photography: [
        "shooting street aesthetics and golden hour views",
        "capturing scenic architecture and golden hour streetscapes",
        "taking aesthetic street photos and capturing dramatic views"
      ],
      luxury: [
        "enjoying upscale dining and top attractions",
        "experiencing fine dining and premium sights",
        "savoring premium dining and high-end local experiences"
      ],
      gamer: [
        "discovering local arcades and pop-culture spots",
        "hunting down retro arcades and pop-culture exhibits",
        "seeking out gaming cafes and comic shops"
      ],
      historian: [
        "retracing history and touring old quarters",
        "walking through ancient quarters and historical quarters",
        "discovering preserved heritage quarters and monuments"
      ],
      explorer: [
        "uncovering hidden alleys and local secrets",
        "getting lost in hidden backstreets and local secrets",
        "discovering secret gardens and local secrets"
      ],
      socialite: [
        "gathering at cozy lounges and wine bars",
        "meeting locals at cozy cocktail lounges and wine bars",
        "finding vibrant social hubs and neighborhood wine bars"
      ]
    };

    const phrases = filtered.map(sty => {
      const list = VARIANTS[sty] || [sty];
      return list[Math.floor(Math.random() * list.length)];
    });

    if (phrases.length === 1) {
      const templates = [
        `A trip dedicated to ${phrases[0]}, keeping the pace comfortable and engaging.`,
        `A focused itinerary centered on ${phrases[0]}, blending top sights with local spots.`,
        `An immersive journey highlighting ${phrases[0]}, keeping it light and fun.`
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }

    if (phrases.length === 2) {
      const templates = [
        `A journey balancing ${phrases[0]} with ${phrases[1]}, mixing mainstream landmarks with hidden local gems.`,
        `An itinerary that blends ${phrases[0]} and ${phrases[1]}, offering a diverse and rich experience.`,
        `A balanced trip combining ${phrases[0]} with ${phrases[1]}, keeping it active yet relaxed.`
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }

    const templates = [
      `An immersive itinerary combining ${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]}.`,
      `A custom journey that covers ${phrases.slice(0, -1).join(', ')}, alongside ${phrases[phrases.length - 1]}.`,
      `A rich adventure blending ${phrases.slice(0, -1).join(', ')}, while also ${phrases[phrases.length - 1]}.`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  };

  const [promptSuggestion, setPromptSuggestion] = useState('');
  useEffect(() => {
    setPromptSuggestion(generateRandomPrompt(tripStyle));
  }, [tripStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state back to Storage
  useEffect(() => {
    localStorage.setItem('tripmind_desc', desc);
  }, [desc]);

  useEffect(() => {
    localStorage.setItem('tripmind_grouptype', groupType);
  }, [groupType]);

  useEffect(() => {
    localStorage.setItem('tripmind_trippace', tripPace);
  }, [tripPace]);

  useEffect(() => {
    localStorage.setItem('tripmind_tripstyle_arr', JSON.stringify(tripStyle));
  }, [tripStyle]);

  useEffect(() => {
    localStorage.setItem('tripmind_numdays', numDays.toString());
  }, [numDays]);

  useEffect(() => {
    localStorage.setItem('tripmind_budgetinput', budgetInput);
  }, [budgetInput]);

  useEffect(() => {
    localStorage.setItem('tripmind_placesmode', placesMode.toString());
  }, [placesMode]);

  useEffect(() => {
    localStorage.setItem('tripmind_placecount', placeCount.toString());
  }, [placeCount]);

  useEffect(() => {
    try {
      if (placesList) {
        sessionStorage.setItem('tripmind_placeslist', JSON.stringify(placesList));
      } else {
        sessionStorage.removeItem('tripmind_placeslist');
      }
    } catch (e) {
      console.warn("sessionStorage quota exceeded or unavailable for 'tripmind_placeslist':", e);
    }
  }, [placesList]);

  const activeDay = aiActiveDay ?? localActiveDay;
  const setActiveDay = (i) => { setLocalActiveDay(i); onDayChange?.(i); };

  const handleSelectStyle = (val) => {
    setTripStyle(prev => {
      const prevArr = Array.isArray(prev) ? prev : [prev];
      if (val === 'mixed') {
        return ['mixed'];
      }
      const filtered = prevArr.filter(x => x !== 'mixed');
      if (filtered.includes(val)) {
        if (filtered.length <= 1) return ['mixed'];
        return filtered.filter(x => x !== val);
      } else {
        return [...filtered, val];
      }
    });
  };

  const getCoolPromptSuggestion = () => {
    return promptSuggestion;
  };
  const [showMetrics, setShowMetrics] = useState(false);
  const [trainingInfo, setTrainingInfo] = useState(null);
  const [modelReady,   setModelReady]   = useState(false);
  const [elapsedSecs,  setElapsedSecs]  = useState(0);
  const warmupDone    = useRef(false);
  const generationRef = useRef(null);

  // Notify parent of preview places whenever placesList geocoding updates
  useEffect(() => {
    if (!onPreviewPlaces) return;
    if (!placesMode || !placesList) { onPreviewPlaces([]); return; }
    const previews = placesList
      .filter(p => !p.added && Array.isArray(p.previewCoords) && p.previewCoords.length === 2)
      .map(p => ({ name: p.name, type: p.type || 'attraction', coords: p.previewCoords }));
    onPreviewPlaces(previews);
  }, [placesList, placesMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = tripData.aiPlan;

  const updateAiPlan = (fn) => setTripData(p => ({ ...p, aiPlan: fn(p.aiPlan) }));

  const updateStop = (di, si, changes) => updateAiPlan(ap => ({
    ...ap, days: ap.days.map((d, i) => i !== di ? d : { ...d, stops: d.stops.map((s, j) => j !== si ? s : { ...s, ...changes }) })
  }));

  const deleteStop = (di, si) => {
    updateAiPlan(ap => ({ ...ap, days: ap.days.map((d, i) => i !== di ? d : { ...d, stops: d.stops.filter((_, j) => j !== si) }) }));
    setEditingStop(null);
  };

  const addStop = (di) => {
    const newStop = { time: '12:00', name: 'New stop', type: 'attraction', duration: '1 hr', notes: '', budgetEst: 0, transport: 'walk' };
    updateAiPlan(ap => ({ ...ap, days: ap.days.map((d, i) => i !== di ? d : { ...d, stops: [...d.stops, newStop] }) }));
    const newIdx = plan.days[di].stops.length;
    setEditingStop({ dayIndex: di, stopIndex: newIdx });
    setEditDraft({ ...newStop });
  };

  const moveStop = (fromDi, fromSi, toDi) => {
    const stop = plan.days[fromDi].stops[fromSi];
    updateAiPlan(ap => ({
      ...ap, days: ap.days.map((d, i) => {
        if (i === fromDi && i === toDi) return d;
        if (i === fromDi) return { ...d, stops: d.stops.filter((_, j) => j !== fromSi) };
        if (i === toDi)   return { ...d, stops: [...d.stops, stop] };
        return d;
      })
    }));
    setEditingStop(null);
  };

  const reorderStop = (di, si, dir) => {
    const stops = [...plan.days[di].stops];
    const ni = si + dir;
    if (ni < 0 || ni >= stops.length) return;
    [stops[si], stops[ni]] = [stops[ni], stops[si]];
    updateAiPlan(ap => ({ ...ap, days: ap.days.map((d, i) => i !== di ? d : { ...d, stops }) }));
  };

  const generatePlaces = async () => {
    if (aiProvider !== 'browser' && !ollamaEndpoint.trim()) { setErr('Set Ollama endpoint first.'); return; }
    const focusCity = activeCity || tripData.locations[0];
    const cityName = focusCity ? focusCity.name.split(',')[0] : 'your destination';
    setPlacesLoading(true); setErr(''); setPlacesMode(false); setPlacesList(null);
    setStreamChars(0); setElapsedSecs(0);
    const startTime = Date.now();
    generationRef.current = setInterval(() => setElapsedSecs(Math.floor((Date.now() - startTime) / 1000)), 1000);
    const chatUrl = ollamaChatUrl(ollamaEndpoint);
    const theme = desc.trim();
    const count = Math.max(3, Math.min(50, placeCount || 15));
    const stylesLabel = Array.isArray(tripStyle) ? tripStyle.join(' and ') : tripStyle;

    // Build the prompt differently for themed vs generic searches
    const systemPrompt = theme
      ? 'You are a specialist travel researcher who knows the exact real-world locations behind historical events, tours, and niche interests. Return ONLY valid JSON, no markdown.'
      : 'You are a travel expert. Return ONLY valid JSON, no markdown.';

    const userPrompt = theme
      ? `I want to explore "${theme}" in ${cityName}. List ${count} SPECIFIC real named places in or near ${cityName} (within 50km) that are directly relevant to this theme.\n- If the theme is a category of places (e.g. "famous museums", "rooftop bars", "Michelin restaurants") → list the best actual examples of that category.\n- If the theme is a niche experience or tour (e.g. "Jack the Ripper", "Beatles history", "street art") → list the exact buildings, pubs, churches, and landmarks tied to that story.\nAlways use the exact name the place is known by on maps. Each entry must have a clear direct connection to the theme.\nReturn JSON: {"places":[{"name":"exact map name","type":"museum|pub|historic|church|attraction|viewpoint|restaurant|park|cafe|gallery","description":"One sentence explaining its direct connection to the theme."}]}`
      : `List ${count} must-visit places within 50km of ${cityName} for a ${groupType} traveler interested in ${stylesLabel}. Only include places geographically near ${cityName} — do not suggest places from other cities or regions.\nReturn JSON: {"places":[{"name":"...","type":"museum|restaurant|attraction|park|cafe|bar|historic|viewpoint","description":"One sentence why this specific traveler should visit."}]}`;

    try {
      const res = await aiFetch(chatUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          format: 'json',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: true, options: { num_predict: Math.max(800, count * 80) },
        }),
      });
      if (!res.ok) throw new Error(`Ollama error ${res.status}`);
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let raw = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.trim()) continue;
          try { 
            const obj = JSON.parse(line); 
            if (obj.message?.content) {
              raw += obj.message.content; 
              setStreamChars(raw.length);
            }
          } catch {}
        }
      }
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) {
        if (raw.trim().toLowerCase().startsWith('i cannot') || raw.trim().toLowerCase().startsWith('i am sorry') || raw.trim().toLowerCase().startsWith('sorry')) {
          throw new Error('The AI model refused this request due to safety filters:\n"' + raw.trim() + '"');
        }
        throw new Error('No valid JSON structure found in response. The AI might have refused the request or encountered an error.\nRaw: ' + raw.slice(0, 200));
      }
      let parsed;
      try {
        parsed = JSON.parse(m[0]);
      } catch (parseErr) {
        throw new Error('Failed to parse JSON response. The model output was malformed. Try again.');
      }
      
      let rawPlaces = [];
      if (Array.isArray(parsed.places)) {
        rawPlaces = parsed.places;
      } else if (Array.isArray(parsed)) {
        rawPlaces = parsed;
      } else if (typeof parsed === 'object') {
        const firstArray = Object.values(parsed).find(Array.isArray);
        if (firstArray) {
          rawPlaces = firstArray;
        } else if (parsed.name || parsed.title) {
          rawPlaces = [parsed];
        }
      }
      
      const mappedPlaces = rawPlaces.map(p => {
        if (!p) return null;
        if (typeof p === 'string') return { name: p, type: 'place', description: '', selected: false };
        const name = p.name || p.Name || p.title || p.Title || p.place || p.place_name || 'Unnamed Place';
        const description = p.description || p.Description || p.desc || p.summary || '';
        const type = p.type || p.Type || p.category || p.Category || 'place';
        return { ...p, name, description, type, selected: false };
      }).filter(Boolean);
      setPlacesList(mappedPlaces);
      setPlacesMode(true);

      // Background-geocode: stagger 1 req/s (Nominatim rate limit) but fire all in parallel —
      // completes in ~(places/1s + last response) instead of the old serial ~(places × 0.7s)
      const gen = (geocodeAbortRef.current = (geocodeAbortRef.current || 0) + 1);
      mappedPlaces.forEach((p, i) => {
        setTimeout(async () => {
          if (geocodeAbortRef.current !== gen) return;
          try {
            const r = await searchNominatim(`${p.name} ${cityName}`);
            if (geocodeAbortRef.current === gen && r.length > 0) {
              const coords = [parseFloat(r[0].lat), parseFloat(r[0].lon)];
              setPlacesList(prev => prev ? prev.map((item, idx) => idx === i ? { ...item, previewCoords: coords } : item) : prev);
            }
          } catch {}
        }, i * 1000);
      });
    } catch(e) { setErr(e.message); }
    clearInterval(generationRef.current);
    setPlacesLoading(false);
  };

  const addSelectedPlacesToMap = async () => {
    const selected = (placesList || []).filter(p => p.selected);
    if (!selected.length) return;
    const firstCity = activeCity || tripData.locations[0];
    if (!firstCity) return;
    const cityName = firstCity.name.split(',')[0];
    setPlacesLoading(true);
    const baseId = Date.now();
    const geocoded = await Promise.all(selected.map(async (p, i) => {
      try {
        const r = await searchNominatim(`${p.name} ${cityName}`);
        const coords = r.length > 0 ? [parseFloat(r[0].lat), parseFloat(r[0].lon)] : null;
        return { id: baseId + i, name: p.name, type: p.type || 'attraction', coords, notes: p.description || '' };
      } catch {
        return { id: baseId + i, name: p.name, type: p.type || 'attraction', coords: null, notes: p.description || '' };
      }
    }));
    setTripData(prev => {
      const city = activeCity ? prev.locations.find(c => c.id === activeCity.id) : prev.locations[0];
      if (!city) return prev;
      const existing = new Set(city.places.map(p => p.name.toLowerCase()));
      const newPlaces = geocoded.filter(p => !existing.has(p.name.toLowerCase()));
      return { ...prev, locations: prev.locations.map(c => c.id !== city.id ? c : { ...c, places: [...c.places, ...newPlaces] }) };
    });
    setPlacesList(pl => pl.map(p => p.selected ? { ...p, added: true, selected: false } : p));
    setPlacesLoading(false);
  };

  // Pre-load the model into Ollama memory as soon as this panel mounts
  useEffect(() => {
    if (aiProvider === 'browser') { setModelReady(isBrowserModelLoaded(browserModel)); return; } // don't start a 1 GB download on mount
    if (warmupDone.current) return;
    warmupDone.current = true;
    const chatUrl = ollamaChatUrl(ollamaEndpoint);
    fetch(chatUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        options: { num_predict: 1 },
      }),
    }).then(() => setModelReady(true)).catch(() => setModelReady(false));
  }, [ollamaEndpoint, ollamaModel, aiProvider, browserModel]);
  const profileKey = getProfileKey(groupType, tripStyle, tripPace);

  const generatePlan = async (mode = 'new') => {
    if (aiProvider !== 'browser' && !ollamaEndpoint.trim()) { setErr('Set your Ollama endpoint first.'); setShowOllamaConfig(true); return; }
    setLoading(true); setErr(''); setTrainingInfo(null); setStreamChars(0); setElapsedSecs(0);
    const startTime = Date.now();
    generationRef.current = setInterval(() => setElapsedSecs(Math.floor((Date.now() - startTime) / 1000)), 1000);

    const allPois = tripData.locations.flatMap(city =>
      [...city.places, ...city.recommendations.slice(0, 30)].map(p => ({ ...p, cityName: city.name }))
    );
    const poiCtx = allPois.length > 0
      ? allPois.slice(0, 60).map(p =>
          `  ${p.name} | ${p.type} | ${p.cityName}` +
          (p.coords ? ` | coords:[${Number(p.coords[0]).toFixed(4)},${Number(p.coords[1]).toFixed(4)}]` : '') +
          (p.osmTags?.hours ? ` | hours:${p.osmTags.hours}` : '') +
          (p.osmTags?.website ? ' | verified' : '') +
          (p._qualityScore != null ? ` | quality:${p._qualityScore}` : '') +
          (p.osmTags?.tourism ? ` | tourism:${p.osmTags.tourism}` : '') +
          (p.osmTags?.historic ? ` | historic:${p.osmTags.historic}` : '')
        ).join('\n')
      : 'No POIs loaded — build a general itinerary using destination names only.';

    const cities = tripData.locations.map(c => c.name).join(', ') || 'destination not specified';

    // ── Gather training components ──────────────────────────────────────────
    const examples = getFewShotExamples(groupType, tripStyle, tripPace);
    const learned  = getLearnedCorrections(profileKey);
    setTrainingInfo({ examples: examples.length, corrections: learned.corrections?.length || 0, memory: !!(learned.memory?.count) });

    const stylesLabel = Array.isArray(tripStyle) ? tripStyle.join(', ') : tripStyle;
    const baseUserMsg =
      `GROUP: ${groupType} | PACE: ${tripPace} | STYLE: ${stylesLabel} | DAYS: ${numDays}` +
      (budgetInput ? ` | BUDGET: €${budgetInput} total` : '') +
      `\nDESTINATIONS: ${cities}` +
      (desc ? `\nTRAVELER DESCRIPTION: ${desc}` : '\n(No description — build from profile above.)');

    const userMsg = (mode === 'refine' && plan && desc.trim())
      ? `${baseUserMsg}\n\nCURRENT PLAN:\n${JSON.stringify(plan, null, 2)}\n\nREFINE INSTRUCTION: ${desc}\n\nReturn an updated complete JSON plan incorporating these changes.`
      : baseUserMsg;

    try {
      const chatUrl = ollamaChatUrl(ollamaEndpoint);
      const res = await aiFetch(chatUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            { role: 'system', content: buildTripMindPrompt(poiCtx, numDays, examples, learned) },
            { role: 'user', content: userMsg },
          ],
          stream: true,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error || `Ollama error ${res.status} — is "${ollamaModel}" pulled? Run: ollama pull ${ollamaModel}`); }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.trim()) continue;
          try { const obj = JSON.parse(line); if (obj.message?.content) { fullText += obj.message.content; setStreamChars(fullText.length); } } catch {}
        }
      }
      const text = fullText;
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) {
        if (text.trim().toLowerCase().startsWith('i cannot') || text.trim().toLowerCase().startsWith('i am sorry') || text.trim().toLowerCase().startsWith('sorry')) {
          throw new Error('The AI model refused this request due to safety filters:\n"' + text.trim() + '"');
        }
        throw new Error('No valid JSON structure found in response. The AI might have refused the request or encountered an error.\nRaw: ' + text.slice(0, 200));
      }
      let parsed;
      try {
        parsed = JSON.parse(m[0]);
      } catch (err) {
        throw new Error('Invalid JSON returned.\\nRaw Output:\\n' + m[0].slice(0, 300));
      }
      
      // Attempt to find days anywhere in the JSON if not at root
      let foundDays = parsed.days || parsed.itinerary || parsed.tripData?.days || [];
      if (!Array.isArray(foundDays) && typeof foundDays === 'object') {
        foundDays = Object.values(foundDays);
      }
      
      parsed.days = foundDays.map((d, i) => ({ ...d, color: DAY_COLORS[i % DAY_COLORS.length] }));
      parsed._profileKey = profileKey;
      parsed._raw = m[0]; // Save raw in case we need to debug
      setTripData(prev => ({ ...prev, aiPlan: parsed }));
      setActiveDay(0);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('NetworkError') || msg.includes('fetch') || msg.includes('Failed')) {
        setErr(`Cannot reach Ollama — make sure it is running: ollama serve`);
      } else {
        setErr(msg);
      }
    }
    clearInterval(generationRef.current);
    setLoading(false);
  };

  const applyToTrip = () => {
    if (!plan) return;
    setTripData(prev => {
      // Fix: packing items may be strings or objects
      const existingNames = new Set(
        (prev.packing || []).flatMap(l => l.items.map(i => (typeof i === 'string' ? i : (i?.name || '')).toLowerCase()))
      );
      const baseId = Date.now();
      const newPackItems = (plan.packing || [])
        .filter(p => !existingNames.has((p.item || p || '').toLowerCase()))
        .map((p, i) => ({ id: baseId + i, name: p.item || p, packed: false }));
      const packing = (prev.packing || []).length > 0
        ? prev.packing.map((l, i) => i === 0 ? { ...l, items: [...l.items, ...newPackItems] } : l)
        : [{ id: baseId, name: 'AI Plan Items', items: newPackItems }];

      // Budget — use correct field name 'expenses'
      const bgt = plan.budget || {};
      const newExpenses = [
        bgt.accommodation > 0 && { id: baseId + 10000, name:'Accommodation (AI)', amount:bgt.accommodation, category:'accommodation', city:'' },
        bgt.food > 0         && { id: baseId + 20000, name:'Food (AI)',            amount:bgt.food,          category:'food',          city:'' },
        bgt.transport > 0    && { id: baseId + 40000, name:'Transport (AI)',       amount:bgt.transport,     category:'transport',     city:'' },
      ].filter(Boolean);
      
      // Specifically break out activities based on stops 
      (plan.days || []).forEach((day, di) => {
        (day.stops || []).forEach((stop, si) => {
          if (stop.budgetEst > 0) {
            newExpenses.push({ 
               id: baseId + 50000 + (di * 100) + si, 
               name: `Day ${day.dayNumber || di+1}: ${stop.name}`, 
               amount: stop.budgetEst, 
               category: 'activities', 
               city: '' 
            });
          }
        });
      });

      const budget = { ...prev.budget, expenses: [...(prev.budget?.expenses || []), ...newExpenses] };

      // Itinerary days
      const itinDays = (plan.days || []).map((day, i) => ({
        id: baseId + 60000 + i,
        date: day.date || `Day ${day.dayNumber || i + 1}`,
        location: (tripData.locations[0]?.name) || 'Trip',
        events: (day.stops || []).map((stop, j) => ({
          id: baseId + 70000 + i * 100 + j,
          time: stop.time || '09:00',
          title: stop.name + (stop.notes ? ' — ' + stop.notes.slice(0, 80) : ''),
          type: stop.type || 'activity',
        })),
      }));

      // Add AI stop locations to the first city's place list
      const firstCity = prev.locations[0];
      let locations = prev.locations;
      if (firstCity) {
        const existingPlaceNames = new Set(firstCity.places.map(p => p.name.toLowerCase()));
        const newPlaces = (plan.days || []).flatMap(day => day.stops || [])
          .filter(s => s.name && Array.isArray(s.coords) && s.coords.length === 2 && !existingPlaceNames.has(s.name.toLowerCase()))
          .map((s, k) => ({ id: baseId + 80000 + k, name: s.name, type: s.type || 'attraction', coords: s.coords, notes: s.notes || '', fromAiPlan: true }));
        locations = prev.locations.map((c, i) => i === 0 ? { ...c, places: [...c.places, ...newPlaces] } : c);
      }

      return { ...prev, packing, budget, itinerary: [...(prev.itinerary || []), ...itinDays], locations };
    });
    setApplyDone(true);
    setTimeout(() => setApplyDone(false), 4000);
  };

  const exportTrainingData = () => {
    const lines = [];
    const basePrompt = buildTripMindPrompt('(No POI data — use destination knowledge)', 3, [], { corrections: [], memory: null });

    const ARCHETYPES = [
      {
        key: 'couple/cultural/moderate',
        userMsg: 'GROUP: couple | PACE: moderate | STYLE: cultural | DAYS: 3\nDESTINATIONS: Barcelona\nTRAVELER DESCRIPTION: We love art and architecture but hate tourist crowds. Great coffee is non-negotiable. Authentic local experiences over famous-landmark checkboxes.',
        response: {
          tripSummary: 'Three days in Barcelona for architecture-obsessed, crowd-averse art lovers — Gaudí at dawn, hidden modernista gems by afternoon, neighbourhood wine bars when tourists head to La Rambla.',
          travelerProfile: { type:'couple', style:'cultural', pace:'moderate', budgetTier:'mid', personalityNote:'They came for the buildings, they stay for the coffee — and they know the difference between a cortado and a café con leche.' },
          days: [
            { dayNumber:1, date:'Day 1', theme:'Arrival & Neighbourhood Immersion', weatherNote:'', stops:[
              { time:'15:00', name:'El Born neighbourhood walk', type:'historic', duration:'1.5 hrs', notes:'Drop bags and walk. Born is where local Barcelona lives. Head for Carrer del Rec, find a bench in Parc de la Ciutadella.', budgetEst:0, transport:'walk', transportTime:'', weatherSensitive:false, mustBook:false },
              { time:'17:30', name:"Cafè de l'Acadèmia", type:'cafe', duration:'45 min', notes:"Old-Barcelona café that doesn't need to advertise. Espresso and pa amb tomàquet. Arrive before 18:00.", budgetEst:12, transport:'walk', transportTime:'', weatherSensitive:false, mustBook:false },
              { time:'20:30', name:'El Xampanyet', type:'restaurant', duration:'1.5 hrs', notes:'Cave restaurant, cava on tap, perfect tapas. Go at 20:30 when locals arrive. Book or arrive early.', budgetEst:35, transport:'walk', transportTime:'', weatherSensitive:false, mustBook:true },
            ], dayBudget:47, dayTip:'The city rewards patience. Walk slowly tonight — tomorrow is the architecture.' },
            { dayNumber:2, date:'Day 2', theme:'Gaudí at Dawn, Modernista Afternoon', weatherNote:'', stops:[
              { time:'08:30', name:'Sagrada Família', type:'attraction', duration:'2 hrs', notes:'Book the first slot — the light through stained glass peaks before 11am and crowds are minimal. Go straight to the nave, not the towers.', budgetEst:26, transport:'metro', transportTime:'15 min', weatherSensitive:false, mustBook:true },
              { time:'11:00', name:'Bar del Pla', type:'cafe', duration:'45 min', notes:'Post-Gaudí decompression. Great coffee, good croquetas. Not a tourist spot.', budgetEst:14, transport:'metro', transportTime:'10 min', weatherSensitive:false, mustBook:false },
              { time:'12:30', name:'Palau de la Música Catalana', type:'historic', duration:'1 hr', notes:"Domènech i Montaner's masterpiece — most people walk past it. The facade alone is worth it.", budgetEst:22, transport:'walk', transportTime:'', weatherSensitive:false, mustBook:false },
              { time:'18:00', name:'Park Güell — golden hour', type:'attraction', duration:'1.5 hrs', notes:'Book timed entry for 18:00. The terrace faces southwest — golden hour is spectacular. Use the less-touristy north entrance.', budgetEst:13, transport:'bus', transportTime:'20 min', weatherSensitive:true, mustBook:true },
            ], dayBudget:135, dayTip:"Two max-booking slots per day is the limit — otherwise you're a schedule, not a traveler." },
            { dayNumber:3, date:'Day 3', theme:'Hidden Eixample, Slow Departure', weatherNote:'', stops:[
              { time:'09:30', name:'Federal Café', type:'cafe', duration:'1 hr', notes:'Best brunch in Eixample. Come for the coffee, stay for the light.', budgetEst:18, transport:'metro', transportTime:'10 min', weatherSensitive:false, mustBook:false },
              { time:'11:00', name:'Fundació Antoni Tàpies', type:'museum', duration:'1.5 hrs', notes:'Hidden gem — Tàpies in his own foundation is never crowded. A completely different encounter than MACBA.', budgetEst:12, transport:'walk', transportTime:'', weatherSensitive:false, mustBook:false },
              { time:'13:30', name:'Mercat de Sant Antoni', type:'attraction', duration:'1 hr', notes:"Locals' market — none of the Boqueria circus. Lunch from stalls, fresh juice, people-watch.", budgetEst:15, transport:'metro', transportTime:'10 min', weatherSensitive:false, mustBook:false },
            ], dayBudget:65, dayTip:'Departure day ends at 13:00 max. Leave knowing your neighbourhood better than any landmark.' },
          ],
          budget:{ accommodation:330, food:180, activities:110, transport:45, extras:30, total:695, currency:'EUR', perDayAverage:232 },
          packing:[ { item:'Comfortable walking shoes', reason:'Cobblestones in Born and Gothic Quarter punish anything with a heel' }, { item:'Printed booking confirmations', reason:'Sagrada Família and Park Güell require timed entry — have them offline' }, { item:'Small daypack', reason:'Camera, water, layers — not so large you look like a tourist' } ],
          researchMetrics:{ poisGrounded:'8 of 9 stops verified', avgStopsPerDay:3, indoorOutdoorRatio:'55/45', weatherRiskStops:1, uniqueCategories:6, fewShotExamplesUsed:['Couple · Cultural · Moderate'], feedbackCorrectionsApplied:0, profileMemoryUsed:false },
        }
      },
      {
        key: 'solo/adventure/packed',
        userMsg: 'GROUP: solo | PACE: packed | STYLE: adventure | DAYS: 3\nDESTINATIONS: Innsbruck, Austria\nTRAVELER DESCRIPTION: Solo hiker, early riser, want every hour to count. Not afraid of altitude. Happy with simple food if the scenery is exceptional.',
        response: {
          tripSummary: 'Three days in the Alps from Innsbruck — summits before breakfast, cable cars as commutes, and views that make you forget you are exhausted.',
          travelerProfile:{ type:'solo', style:'adventure', pace:'packed', budgetTier:'mid', personalityNote:'Treats the 5am alarm as an opportunity, not a punishment.' },
          days:[
            { dayNumber:1, date:'Day 1', theme:'Arrival Summit — Nordkette Before Dark', weatherNote:'Check webcam — route closes in low visibility', stops:[
              { time:'14:00', name:'Nordkettenbahn cable car', type:'hiking', duration:'3 hrs', notes:'Take the cable car straight to Seegrube (1905m) or Hafelekar (2334m). Arrive before 14:30 for afternoon light. Solo: stay on marked paths.', budgetEst:38, transport:'walk', transportTime:'10 min from centre', weatherSensitive:true, mustBook:false },
              { time:'18:30', name:'Goldenes Dachl area', type:'historic', duration:'45 min', notes:'Medieval centre on your walk back from the cable car station. 15 minutes is enough — a pivot, not a stop.', budgetEst:0, transport:'walk', transportTime:'', weatherSensitive:false, mustBook:false },
              { time:'20:00', name:'Gasthaus Weisses Rössl', type:'restaurant', duration:'1 hr', notes:'Tyrolean food, wooden interior, local wine. Order the Tafelspitz or Tiroler Gröstl — not the tourist menu.', budgetEst:22, transport:'walk', transportTime:'', weatherSensitive:false, mustBook:false },
            ], dayBudget:80, dayTip:'Check the Nordkette webcam the morning before you go — alpine weather turns fast.' },
            { dayNumber:2, date:'Day 2', theme:'Stubai Glacier — Full Alpine Day', weatherNote:'Mountain weather — start before 9am', stops:[
              { time:'07:00', name:'Stubaier Gletscher', type:'hiking', duration:'6 hrs', notes:'Take the 07:00 Stubaigletscher bus from Innsbruck. Glacier at 3200m — hiking boots, sunglasses, sunscreen at altitude essential.', budgetEst:55, transport:'bus', transportTime:'1 hr from Innsbruck', weatherSensitive:true, mustBook:false },
              { time:'14:30', name:'Mutterberg Alm', type:'restaurant', duration:'45 min', notes:'Mountain hut lunch at the base of the glacier. Gulasch soup, dark bread. You have earned this.', budgetEst:18, transport:'walk', transportTime:'at base station', weatherSensitive:false, mustBook:false },
              { time:'20:00', name:'Tribaun craft beer', type:'bar', duration:'1.5 hrs', notes:'Back in Innsbruck, debrief the day at a local brewery. Sit at the bar.', budgetEst:16, transport:'walk', transportTime:'', weatherSensitive:false, mustBook:false },
            ], dayBudget:119, dayTip:'Glacier is above 3000m — UV reflects intensely off snow. Bring SPF 50 and glacier glasses, not regular sunglasses.' },
            { dayNumber:3, date:'Day 3', theme:'Patscherkofel Ridge — Solo Sunrise', weatherNote:'Early start required', stops:[
              { time:'06:30', name:'Patscherkofel cable car', type:'hiking', duration:'4 hrs', notes:'Cable car opens 07:00 in summer. Hike the Zirbenweg ridge trail — 5km, through stone pine forest, panoramic Inn valley views. Best light 07:00–10:00.', budgetEst:22, transport:'bus', transportTime:'20 min', weatherSensitive:true, mustBook:false },
              { time:'11:30', name:'Bergisel Ski Jump', type:'attraction', duration:'1 hr', notes:'Zaha Hadid architectural landmark. Look down at Innsbruck from the jump platform.', budgetEst:11, transport:'bus', transportTime:'20 min', weatherSensitive:false, mustBook:false },
              { time:'13:00', name:'Markthalle Innsbruck — final lunch', type:'restaurant', duration:'1 hr', notes:'Quick market lunch at Austrian delis before heading to the station. Done by 14:00.', budgetEst:12, transport:'walk', transportTime:'', weatherSensitive:false, mustBook:false },
            ], dayBudget:95, dayTip:'Tell your accommodation where you are hiking each day. Alpine solo hiking is safe — but someone should know your route.' },
          ],
          budget:{ accommodation:165, food:140, activities:200, transport:55, extras:20, total:580, currency:'EUR', perDayAverage:193 },
          packing:[ { item:'Hiking boots (waterproof)', reason:'Glacier moraine and mountain trails — no trail runners' }, { item:'Fleece + hardshell', reason:'Temperature drops 6°C per 1000m — glacier is 15°C colder than town' }, { item:'Glacier sunglasses', reason:'UV off snow causes snow blindness in 30 minutes without proper eyewear' }, { item:'Bus schedule screenshotted', reason:'Missing the 07:00 Stubai bus costs you 2 hours' } ],
          researchMetrics:{ poisGrounded:'7 of 8 stops verified', avgStopsPerDay:3, indoorOutdoorRatio:'75/25', weatherRiskStops:3, uniqueCategories:5, fewShotExamplesUsed:['Solo · Adventure · Packed'], feedbackCorrectionsApplied:0, profileMemoryUsed:false },
        }
      },
      {
        key: 'family/mixed/relaxed',
        userMsg: 'GROUP: family | PACE: relaxed | STYLE: mixed | DAYS: 4\nDESTINATIONS: Lisbon, Portugal\nTRAVELER DESCRIPTION: Two parents, kids aged 6 and 9. Kids lose energy fast. No rushing, no packed schedules. Happy to sit in a café for an hour.',
        response: {
          tripSummary: "Four gentle Lisbon days built around kid energy levels — mornings with wonder, long lunches with no agenda, and enough open time that the 6-year-old's improvisations become the best part.",
          travelerProfile:{ type:'family', style:'mixed', pace:'relaxed', budgetTier:'mid', personalityNote:"Parents who've learned that the best family travel day is 40% planned, 60% discovered." },
          days:[
            { dayNumber:1, date:'Day 1', theme:'Arrival — Alfama at Kid Speed', weatherNote:'', stops:[
              { time:'15:00', name:'Miradouro da Graça', type:'viewpoint', duration:'45 min', notes:'First view of Lisbon together. The kids will run around the terrace. Let them. The view does the explaining.', budgetEst:0, transport:'taxi', transportTime:'15 min from airport', weatherSensitive:false, mustBook:false },
              { time:'17:00', name:'Pastéis de Belém', type:'cafe', duration:'45 min', notes:'The original pastel de nata. Kids will love it. Queue moves fast. Order 4 each — seriously.', budgetEst:20, transport:'tram', transportTime:'20 min', weatherSensitive:false, mustBook:false },
              { time:'19:30', name:'Time Out Market — family dinner', type:'restaurant', duration:'1.5 hrs', notes:'Everyone picks what they want — no menu argument. Eat before 20:00 when it fills up.', budgetEst:65, transport:'metro', transportTime:'15 min', weatherSensitive:false, mustBook:false },
            ], dayBudget:105, dayTip:'First day is light — one view, one treat, one dinner. The kids need to sleep in a new place tonight.' },
            { dayNumber:2, date:'Day 2', theme:'Tram Day — Tiles and Towers', weatherNote:'', stops:[
              { time:'09:30', name:'Museu Nacional do Azulejo', type:'museum', duration:'1.5 hrs', notes:'Best tiles in the world. Kids aged 6–9 respond well to the storytelling scenes. The giant pre-earthquake Lisbon panorama is 30m long — kids count the buildings.', budgetEst:10, transport:'bus', transportTime:'20 min', weatherSensitive:false, mustBook:false },
              { time:'11:30', name:'Alfama neighbourhood walk', type:'historic', duration:'1 hr', notes:'Kids lead. Let them pick the alley. Ignore the map for 20 minutes. Alfama is safe and compact.', budgetEst:0, transport:'walk', transportTime:'', weatherSensitive:false, mustBook:false },
              { time:'13:00', name:'A Cevicheria garden lunch', type:'restaurant', duration:'1.5 hrs', notes:'Seafood plus excellent chicken for hesitant eaters. Garden seating. Long lunch is the whole point.', budgetEst:80, transport:'taxi', transportTime:'10 min', weatherSensitive:false, mustBook:true },
              { time:'15:30', name:'Jardim da Estrela', type:'park', duration:'1.5 hrs', notes:'Best park in Lisbon for kids — good playground, ducks, café for parents. Bring bread for the ducks.', budgetEst:5, transport:'tram', transportTime:'15 min', weatherSensitive:false, mustBook:false },
            ], dayBudget:145, dayTip:'Build in 30 minutes of buffer at every transition. Kids need transition time — forcing them hurries everyone into a bad mood.' },
            { dayNumber:3, date:'Day 3', theme:'Sintra Magic — Day Trip', weatherNote:'Wear layers — Sintra is 5°C cooler', stops:[
              { time:'09:05', name:'Sintra — Pena Palace', type:'attraction', duration:'3 hrs', notes:"Book online, take the first train from Rossio (09:05). Palace is fairy-tale level for kids — turrets, drawbridges, wild colours. Start with the exterior.", budgetEst:45, transport:'train', transportTime:'40 min from Rossio', weatherSensitive:true, mustBook:true },
              { time:'13:00', name:'Sintra town lunch', type:'restaurant', duration:'1.5 hrs', notes:"The town square has several good spots. Order travesseiros (pillowy pastries) for dessert — kids' obsession.", budgetEst:55, transport:'walk', transportTime:'10 min downhill from palace', weatherSensitive:false, mustBook:false },
              { time:'16:00', name:'Rossio gelato stop', type:'cafe', duration:'30 min', notes:'Gelato near Rossio station is the formal end of the day trip. The kids will ask for this the whole train ride back.', budgetEst:12, transport:'train', transportTime:'40 min back', weatherSensitive:false, mustBook:false },
            ], dayBudget:152, dayTip:'Sintra gets very busy by 11am. The 09:05 train gets you 2 hours before crowds peak.' },
            { dayNumber:4, date:'Day 4', theme:'Belém Morning — Easy Departure', weatherNote:'', stops:[
              { time:'09:30', name:'Mosteiro dos Jerónimos', type:'historic', duration:'1 hr', notes:'Manueline Gothic that impresses kids — the scale is dramatic. Free Sunday morning. Stay in the cloisters.', budgetEst:0, transport:'tram', transportTime:'20 min', weatherSensitive:false, mustBook:false },
              { time:'11:00', name:'Padrão dos Descobrimentos', type:'attraction', duration:'30 min', notes:'Monument to the Discoveries on the Tagus. Kids point to Portugal on the compass rose in the square.', budgetEst:4, transport:'walk', transportTime:'', weatherSensitive:false, mustBook:false },
              { time:'12:00', name:'Final pastel de nata', type:'cafe', duration:'45 min', notes:'One last ritual. Box some to take home. Then taxi to airport.', budgetEst:15, transport:'taxi', transportTime:'20 min to airport', weatherSensitive:false, mustBook:false },
            ], dayBudget:69, dayTip:"Departure day ends by 12:00. Don't book anything requiring specific arrival times on departure morning." },
          ],
          budget:{ accommodation:440, food:320, activities:170, transport:95, extras:40, total:1065, currency:'EUR', perDayAverage:266 },
          packing:[ { item:'Lightweight stroller or carrier', reason:'Alfama has steep cobbled hills — a 6-year-old needs carrying after 2 hours' }, { item:'Snacks (always)', reason:'Kid energy management — a hungry 6-year-old ends the day early' }, { item:'Spare clothes (1 set per child)', reason:'Pastéis, ducks, and Lisbon cobblestones are all hazards' }, { item:'Rain layer', reason:'Sintra: Atlantic weather rolls in fast, even in summer' } ],
          researchMetrics:{ poisGrounded:'9 of 11 stops verified', avgStopsPerDay:3, indoorOutdoorRatio:'45/55', weatherRiskStops:1, uniqueCategories:7, fewShotExamplesUsed:['Family · Mixed · Relaxed'], feedbackCorrectionsApplied:0, profileMemoryUsed:false },
        }
      },
      {
        key: 'friends/foodie/moderate',
        userMsg: "GROUP: friends | PACE: moderate | STYLE: foodie | DAYS: 3\nDESTINATIONS: Lyon, France\nTRAVELER DESCRIPTION: Four friends planning a trip around the Lyon food scene. We've researched bouchons for months. We book ahead, we don't rush, we will spend properly on one exceptional dinner.",
        response: {
          tripSummary: "Three days eating through the gastronomic capital of France — Bocuse market mornings, bouchon lunches that last until 15:00, and one tasting menu you'll talk about for years.",
          travelerProfile:{ type:'friends', style:'foodie', pace:'moderate', budgetTier:'comfort', personalityNote:'The kind of group with a shared spreadsheet of every restaurant to visit — and who actually follows through.' },
          days:[
            { dayNumber:1, date:'Day 1', theme:'Arrival — Halles Bocuse & First Bouchon', weatherNote:'', stops:[
              { time:'11:00', name:'Halles Paul Bocuse', type:'attraction', duration:'1.5 hrs', notes:'Arrive at 11:00 when stalls are set and before lunch rush. Each person picks one thing to try — quenelle, Saint-Marcellin, rosette de Lyon, praline tart. Compare notes.', budgetEst:18, transport:'metro', transportTime:'15 min from centre', weatherSensitive:false, mustBook:false },
              { time:'13:30', name:'Café des Fédérations bouchon', type:'restaurant', duration:'2.5 hrs', notes:'Most authentic traditional bouchon in Lyon. Pre-book. Order the menu complet: salade lyonnaise, quenelle de brochet, île flottante. Carafe of Côtes du Rhône. This lunch goes to 15:30.', budgetEst:38, transport:'walk', transportTime:'', weatherSensitive:false, mustBook:true },
              { time:'18:00', name:'La Croix-Rousse traboules walk', type:'historic', duration:'1.5 hrs', notes:"Silk workers' district. The traboules (hidden passages through buildings) are the architectural secret of Lyon — look for the unmarked doors.", budgetEst:0, transport:'metro', transportTime:'15 min', weatherSensitive:false, mustBook:false },
              { time:'20:30', name:'Cave natural wine bar', type:'bar', duration:'1.5 hrs', notes:'Natural wine bar in Vieux Lyon. Order a Beaujolais — in Lyon, not Paris, it is actually excellent.', budgetEst:28, transport:'walk', transportTime:'', weatherSensitive:false, mustBook:false },
            ], dayBudget:134, dayTip:'Lyon bouchons do not rush. Plan nothing for 14:00–16:00 on bouchon days — you will still be at the table.' },
            { dayNumber:2, date:'Day 2', theme:'Market Morning — The Tasting Menu', weatherNote:'', stops:[
              { time:'09:00', name:'Quai Saint-Antoine market', type:'attraction', duration:'1 hr', notes:'Open-air market along the Saône. The cheese and charcuterie section is worth the early wake-up. Buy picnic components.', budgetEst:20, transport:'walk', transportTime:'', weatherSensitive:true, mustBook:false },
              { time:'11:00', name:'Fresque des Lyonnais', type:'historic', duration:'30 min', notes:'Giant trompe-l\'oeil mural with 30 famous Lyonnais depicted. Bocuse is there. Takes 20 minutes to spot everyone.', budgetEst:0, transport:'walk', transportTime:'', weatherSensitive:false, mustBook:false },
              { time:'13:00', name:'Saône riverside picnic', type:'park', duration:'1.5 hrs', notes:'Deploy the market food on the Quai. This is what locals do. Bottle of white wine.', budgetEst:8, transport:'walk', transportTime:'', weatherSensitive:true, mustBook:false },
              { time:'20:00', name:'Restaurant Têtedoie — tasting menu', type:'restaurant', duration:'3.5 hrs', notes:'Michelin-starred, rooftop views, 6-course tasting menu. Book 4–6 weeks ahead. This is the reason you came. Trust the menu, pair the wines.', budgetEst:145, transport:'taxi', transportTime:'15 min', weatherSensitive:false, mustBook:true },
            ], dayBudget:253, dayTip:'The tasting menu is 3.5 hours. Do not plan anything before 13:00 on this day — be rested and hungry.' },
            { dayNumber:3, date:'Day 3', theme:'Bernachon Chocolate + Departure Cooking Class', weatherNote:'', stops:[
              { time:'09:30', name:'Bernachon chocolaterie', type:'attraction', duration:'45 min', notes:'Best chocolate in France, possibly in Europe. Family-run since 1953, bean to bar on-site. Buy 200g mixed and eat it on the walk.', budgetEst:22, transport:'metro', transportTime:'10 min', weatherSensitive:false, mustBook:false },
              { time:'11:00', name:'Atelier de la Bûchette cooking class', type:'attraction', duration:'2.5 hrs', notes:'Small-group class (max 8) focused on Lyonnais cuisine. You make and eat quenelle and gratin dauphinois. Book 2 weeks ahead. This is what you take home.', budgetEst:85, transport:'walk', transportTime:'', weatherSensitive:false, mustBook:true },
              { time:'14:30', name:'Final coffee and departure', type:'cafe', duration:'45 min', notes:'One last praline tart before heading to Lyon Part-Dieu. TGV to Paris: 2 hrs.', budgetEst:8, transport:'metro', transportTime:'15 min to station', weatherSensitive:false, mustBook:false },
            ], dayBudget:195, dayTip:'Bernachon chocolate is only available at the shop — they do not sell online or wholesale. Take a box home.' },
          ],
          budget:{ accommodation:480, food:620, activities:220, transport:80, extras:50, total:1450, currency:'EUR', perDayAverage:483 },
          packing:[ { item:'Smart-casual dinner outfit', reason:'Têtedoie is Michelin — dress appropriately, respect the room' }, { item:'Small insulated bag', reason:'Lyon market cheese and charcuterie needs to stay cool for the picnic' }, { item:'Restaurant booking confirmations', reason:'Bouchon, tasting menu, cooking class — all need proof of reservation' } ],
          researchMetrics:{ poisGrounded:'8 of 10 stops verified', avgStopsPerDay:4, indoorOutdoorRatio:'50/50', weatherRiskStops:2, uniqueCategories:6, fewShotExamplesUsed:['Friends · Foodie · Moderate'], feedbackCorrectionsApplied:0, profileMemoryUsed:false },
        }
      },
    ];

    for (const arc of ARCHETYPES) {
      lines.push(JSON.stringify({ messages: [
        { role:'system',    content: basePrompt },
        { role:'user',      content: arc.userMsg },
        { role:'assistant', content: JSON.stringify(arc.response) },
      ]}));
    }
    const store = loadFeedbackStore();
    const corrections = store.corrections || [];
    if (corrections.length >= 2) {
      const byProfile = {};
      for (const c of corrections) { byProfile[c.profileKey] = byProfile[c.profileKey] || []; byProfile[c.profileKey].push(c); }
      for (const [pKey, corrs] of Object.entries(byProfile)) {
        if (corrs.length < 2) continue;
        const [grp, sty, pac] = pKey.split('/');
        const corrPrompt = buildTripMindPrompt('(No POI data)', 3, [], { corrections: corrs, memory: store.profileMemory?.[pKey] || null });
        const constraintSummary = corrs.map(c=>`Avoid: "${c.itemName}" — ${c.note}`).join('. ');
        lines.push(JSON.stringify({ messages: [
          { role:'system',    content: corrPrompt },
          { role:'user',      content: `GROUP: ${grp} | PACE: ${pac||'moderate'} | STYLE: ${sty||'mixed'} | DAYS: 3\nDESTINATIONS: (city)\nThis traveler has given feedback: ${constraintSummary}` },
          { role:'assistant', content: JSON.stringify({ tripSummary:`A plan refined by direct feedback for the ${pKey} profile.`, travelerProfile:{ type:grp, style:sty||'mixed', pace:pac||'moderate', budgetTier:'mid', personalityNote:'Plan reflects correction history from this traveler.' }, days:[], budget:{ accommodation:0,food:0,activities:0,transport:0,extras:0,total:0,currency:'EUR',perDayAverage:0 }, packing:[], researchMetrics:{ poisGrounded:'0 of 0', avgStopsPerDay:3, indoorOutdoorRatio:'50/50', weatherRiskStops:0, uniqueCategories:4, fewShotExamplesUsed:[], feedbackCorrectionsApplied:corrs.length, profileMemoryUsed:false } }) },
        ]}));
      }
    }

    const jsonl = lines.join('\n');
    const blob = new Blob([jsonl], { type:'application/x-jsonlines' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tripmind_training_${new Date().toISOString().slice(0,10)}.jsonl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const Chip = ({ value, current, onSelect, label, icon }) => {
    const isActive = Array.isArray(current) ? current.includes(value) : current === value;
    const bg = isActive
      ? 'var(--accent-primary)'
      : isFullscreen
        ? '#f1f5f9'
        : 'transparent';
    const border = isActive
      ? 'none'
      : isFullscreen
        ? '1px solid #cbd5e1'
        : '1px solid rgba(255,255,255,0.12)';
    const color = isActive
      ? '#ffffff'
      : isFullscreen
        ? '#334155'
        : 'var(--text-secondary)';

    return (
      <button className={`chip ${isActive ? 'active' : ''}`}
        style={{ fontSize:'0.75rem', background:bg, border:border, color:color, padding:'4px 9px', display:'flex', alignItems:'center', gap:'5px', cursor:'pointer', borderRadius:'6px' }}
        onClick={() => onSelect(value)}>
        {icon && <span style={{ display:'flex', alignItems:'center', opacity: isActive ? 1 : 0.7 }}>{icon}</span>}
        {label}
      </button>
    );
  };

  const renderFormFields = (isLight = false) => {
    const textColor = isLight ? '#0f172a' : 'var(--text-primary)';
    const subColor = isLight ? '#475569' : 'var(--text-secondary)';
    const inputBg = isLight ? '#ffffff' : 'rgba(255,255,255,0.02)';
    const border = isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)';
    const inputStyle = {
      background: inputBg,
      color: textColor,
      border: border,
      borderRadius: '6px',
      fontSize: '0.82rem',
      padding: '0.35rem 0.5rem',
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box'
    };

    return (
      <>
        {/* AI model: in the browser (WebLLM) or local Ollama */}
        <div style={{ marginBottom:'1rem' }}>
          <div style={{ fontSize:'0.65rem', color:subColor, fontWeight:'700', letterSpacing:'0.07em', marginBottom:'5px' }}>AI MODEL</div>
          <div role="radiogroup" aria-label="Where the AI runs" style={{ display:'flex', gap:'5px', marginBottom:'7px' }}>
            {[['browser','In your browser'],['ollama','Ollama (local server)']].map(([id,label]) => (
              <button key={id} type="button" role="radio" aria-checked={aiProvider===id}
                className={`chip ${aiProvider===id?'active':''}`}
                onClick={() => { setAiProvider(id); localStorage.setItem('ai_provider', id); }}
                style={{ fontSize:'0.68rem', padding:'3px 10px' }}>{label}</button>
            ))}
          </div>
          {aiProvider === 'browser' ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              <select value={browserModel} aria-label="Browser model" style={inputStyle}
                onChange={e => { setBrowserModel(e.target.value); localStorage.setItem('browser_model', e.target.value); }}>
                {BROWSER_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <div style={{ fontSize:'0.63rem', lineHeight:1.5, color: hasWebGPU() ? subColor : 'var(--warning)' }}>
                {!hasWebGPU()
                  ? '⚠ This browser has no WebGPU, so the model cannot run here. Use a recent Chrome or Edge on a computer with a graphics card, or choose Ollama.'
                  : browserLoad
                    ? <>Loading model… {browserLoad}</>
                    : isBrowserModelLoaded(browserModel)
                      ? <span style={{ color:'var(--success)' }}>✓ Model loaded — runs entirely on this device.</span>
                      : 'Runs entirely on this device. The model is downloaded the first time you generate (about 1–2 GB) and cached afterwards.'}
              </div>
            </div>
          ) : (
            <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
            <span style={{ fontSize:'0.65rem', color:subColor, fontWeight:'700', letterSpacing:'0.07em' }}>OLLAMA</span>
            <button className="btn-icon" style={{ fontSize:'0.65rem', padding:'1px 6px', display:'flex', alignItems:'center', gap:'3px', border: isLight ? '1px solid #cbd5e1' : undefined, color: isLight ? '#475569' : undefined, background: isLight ? '#f1f5f9' : undefined }}
              onClick={() => setShowOllamaConfig(s=>!s)}>
              <Settings size={10}/>{showOllamaConfig ? 'done' : 'config'}
            </button>
          </div>
          {showOllamaConfig ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
              <div>
                <div style={{ fontSize:'0.6rem', color:subColor, marginBottom:'3px', fontWeight:'600' }}>ENDPOINT</div>
                <input type="text" value={ollamaEndpoint}
                  onChange={e => { setOllamaEndpoint(e.target.value); localStorage.setItem('ollama_endpoint', e.target.value); }}
                  placeholder="http://localhost:11434" style={inputStyle}/>
              </div>
              <div>
                <div style={{ fontSize:'0.6rem', color:subColor, marginBottom:'3px', fontWeight:'600' }}>MODEL</div>
                <input type="text" value={ollamaModel} list="ollama-models"
                  onChange={e => { setOllamaModel(e.target.value); localStorage.setItem('ollama_model', e.target.value); }}
                  placeholder="llama3.1" style={inputStyle}/>
                <datalist id="ollama-models">{ollamaState.models.map(m => <option key={m} value={m}/>)}</datalist>
              </div>
              <div style={{ fontSize:'0.61rem', color:subColor, lineHeight:1.55, padding:'5px 8px', background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)', borderRadius:'6px' }}>
                Run <code style={{ background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)', padding:'1px 5px', borderRadius:'3px' }}>ollama serve</code> locally, then pull a model:<br/>
                <code style={{ background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)', padding:'1px 5px', borderRadius:'3px' }}>ollama pull llama3.1</code>
              </div>
            </div>
          ) : (
            <div style={{ fontSize:'0.65rem', lineHeight:1.5, color: ollamaState.status === 'ok' && (ollamaState.models.length === 0 || ollamaState.models.some(m => m === ollamaModel || m.startsWith(ollamaModel + ':'))) ? 'var(--success)' : ollamaState.status === 'checking' ? subColor : 'var(--warning)' }}>
              {ollamaState.status === 'none' && '⚠ No endpoint set — click config'}
              {ollamaState.status === 'checking' && <>Checking {ollamaEndpoint}…</>}
              {ollamaState.status === 'ok' && (ollamaState.models.length === 0 || ollamaState.models.some(m => m === ollamaModel || m.startsWith(ollamaModel + ':'))
                ? <>✓ Connected · <strong>{ollamaModel}</strong></>
                : <>⚠ Connected, but model <strong>{ollamaModel}</strong> is not installed. Run <code>ollama pull {ollamaModel}</code> or pick one of: {ollamaState.models.slice(0, 4).join(', ')}</>)}
              {ollamaState.status === 'offline' && <>
                ⚠ Ollama is not reachable at {ollamaEndpoint}. AI features need Ollama running on this computer
                {!/localhost|127\.0\.0\.1/.test(location.hostname) && <> and started with <code>OLLAMA_ORIGINS={location.origin}</code></>}.
              </>}
            </div>
          )}
        </>
          )}
        </div>

        {/* Traveler Profile */}
        <div style={{ marginBottom:'1rem' }}>
          {!isLight && (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.6rem' }}>
              <div className="section-label" style={{ margin:0 }}>Traveler profile</div>
              <button className="btn-icon" style={{ fontSize:'0.65rem', padding:'2px 8px', display:'flex', alignItems:'center', gap:'4px' }}
                onClick={() => setIsFullscreen(true)}>
                <Sparkles size={11}/> Fullscreen Explorer
              </button>
            </div>
          )}
          <div style={{ marginBottom:'8px' }}>
            <div style={{ fontSize:'0.72rem', color:subColor, marginBottom:'4px', fontWeight:'600' }}>WHO'S GOING</div>
            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
              {[
                ['solo','Solo',<User size={12}/>],
                ['couple','Couple',<Heart size={12}/>],
                ['honeymoon','Honeymoon',<Gem size={12}/>],
                ['family','Family',<Users size={12}/>],
                ['friends','Friends',<Users size={12}/>],
                ['seniors','Seniors',<Accessibility size={12}/>],
                ['business','Business',<Briefcase size={12}/>],
              ].map(([v,l,ic])=>(
                <Chip key={v} value={v} current={groupType} onSelect={setGroupType} label={l} icon={ic}/>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:'8px' }}>
            <div style={{ fontSize:'0.72rem', color:subColor, marginBottom:'4px', fontWeight:'600' }}>PACE</div>
            <div style={{ display:'flex', gap:'4px' }}>
              {[
                ['relaxed','Relaxed',<Coffee size={12}/>],
                ['moderate','Moderate',<Activity size={12}/>],
                ['packed','Packed',<Zap size={12}/>],
              ].map(([v,l,ic])=>(
                <Chip key={v} value={v} current={tripPace} onSelect={setTripPace} label={l} icon={ic}/>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:'8px' }}>
            <div style={{ fontSize:'0.72rem', color:subColor, marginBottom:'4px', fontWeight:'600' }}>TRIP STYLE</div>
            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
              {[
                ['cultural','Cultural',<Landmark size={12}/>],
                ['foodie','Foodie',<Utensils size={12}/>],
                ['adventure','Adventure',<Tent size={12}/>],
                ['relaxation','Relaxation',<TreePine size={12}/>],
                ['nightlife','Nightlife',<Moon size={12}/>],
                ['wellness','Wellness',<Leaf size={12}/>],
                ['photography','Photography',<Camera size={12}/>],
                ['luxury','Luxury',<Crown size={12}/>],
                ['gamer','Gamer',<Gamepad2 size={12}/>],
                ['historian','Historian',<BookOpen size={12}/>],
                ['explorer','Explorer',<Compass size={12}/>],
                ['socialite','Socialite',<Martini size={12}/>],
                ['mixed','Mixed',<Layers size={12}/>],
              ].map(([v,l,ic])=>(
                <Chip key={v} value={v} current={tripStyle} onSelect={handleSelectStyle} label={l} icon={ic}/>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'0.72rem', color:subColor, marginBottom:'4px', fontWeight:'600' }}>DAYS</div>
              <input type="number" min="1" max="21" value={numDays} onChange={e=>setNumDays(Math.max(1,Math.min(21,Number(e.target.value))))} style={inputStyle}/>
            </div>
            <div style={{ flex:2 }}>
              <div style={{ fontSize:'0.72rem', color:subColor, marginBottom:'4px', fontWeight:'600' }}>BUDGET (€ total, optional)</div>
              <input type="number" placeholder="e.g. 1500" value={budgetInput} onChange={e=>setBudgetInput(e.target.value)} style={inputStyle}/>
            </div>
          </div>
        </div>

        {/* Unified describe / refine field */}
        <div style={{ marginBottom:'0.85rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
            <div style={{ fontSize:'0.72rem', color:subColor, fontWeight:'600' }}>
              {plan ? 'DESCRIBE A CHANGE OR A WHOLE NEW TRIP' : 'DESCRIBE YOUR TRIP (optional — makes the plan much better)'}
            </div>
            {getCoolPromptSuggestion() && (
              <button 
                onClick={() => {
                  setDesc(promptSuggestion);
                  setPromptSuggestion(generateRandomPrompt(tripStyle));
                }}
                style={{ fontSize:'0.68rem', background: isLight ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)', color: isLight ? '#4f46e5' : '#a5b4fc', borderRadius:'20px', padding:'3px 8px', cursor:'pointer', fontWeight:'700', outline:'none', transition:'all 0.2s' }}
              >
                ✨ Fill cool prompt
              </button>
            )}
          </div>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={plan ? 2 : 3}
            placeholder={plan
              ? 'e.g. "swap Day 2 for more outdoor activities" · "make it more budget-friendly" · or a completely new trip description'
              : 'e.g. "We\'re a couple who love art but hate tourist crowds. Great coffee is non-negotiable."'}
            style={{ ...inputStyle, resize:'vertical', fontSize:'0.76rem', lineHeight:1.55 }}
            disabled={loading}/>
          {/* Places count + generate places row — always visible */}
          <div style={{ display:'flex', gap:'6px', marginTop:'5px', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'4px', background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)', border: border, borderRadius:'7px', padding:'4px 6px', flexShrink:0 }}>
              <MapPin size={10} color={subColor}/>
              <input type="number" min={3} max={50} value={placeCount}
                onChange={e=>setPlaceCount(Number(e.target.value))}
                style={{ width:'34px', background:'transparent', border:'none', color: textColor, fontSize:'0.73rem', outline:'none', textAlign:'center', padding:0 }}/>
              <span style={{ fontSize:'0.62rem', color:subColor, whiteSpace:'nowrap' }}>places</span>
            </div>
            <button className="btn-icon"
              style={{ flex:1, fontSize:'0.73rem', padding:'0.45rem 0.6rem', border:'1px solid rgba(6,182,212,0.4)', borderRadius:'7px', color: isLight ? '#0891b2' : '#06b6d4', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px', background: isLight ? 'rgba(6,182,212,0.06)' : 'transparent', fontWeight:'600', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}
              onClick={generatePlaces} disabled={placesLoading||loading}>
              {placesLoading ? <Loader2 size={11} className="spin"/> : <ListChecks size={11}/>}
              {placesLoading
                ? `Generating... (${elapsedSecs}s)`
                : desc.trim() ? "Find theme sites" : `Suggest places near ${activeCity?.name?.split(',')[0] || tripData.locations[0]?.name?.split(',')[0] || 'destination'}`}
            </button>
          </div>
          {plan && (
            <div style={{ display:'flex', gap:'6px', marginTop:'5px' }}>
              <button className="btn-primary" style={{ flex:1, fontSize:'0.75rem', padding:'0.35rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', background: isLight ? '#6366f1' : undefined }}
                onClick={()=>generatePlan('refine')} disabled={loading||!desc.trim()}>
                <Pencil size={12}/> Refine current plan
              </button>
              <button className="btn-icon" style={{ flex:1, fontSize:'0.75rem', padding:'0.35rem', border: border, borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', color: isLight ? '#475569' : undefined, background: isLight ? '#f1f5f9' : undefined }}
                onClick={()=>generatePlan('new')} disabled={loading}>
                <RotateCcw size={12}/> Generate new plan
              </button>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderPlacesList = (isLight = false) => {
    if (!placesList) return null;
    const textColor = isLight ? '#0f172a' : 'var(--text-primary)';
    const subColor = isLight ? '#475569' : 'var(--text-secondary)';
    const cardBg = isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)';
    const border = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)';

    const selectedCount = placesList.filter(p => p.selected).length;
    const selectableCount = placesList.filter(p => !p.added).length;
    const allSelected = selectableCount > 0 && placesList.filter(p => !p.added).every(p => p.selected);
    const toggleSelectAll = () => setPlacesList(prev => prev.map(p => p.added ? p : { ...p, selected: !allSelected }));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', flexShrink: 0 }}>
          <div style={{ fontSize:'0.9rem', fontWeight:'700', color:'#06b6d4', display:'flex', alignItems:'center', gap:'6px' }}>
            <ListChecks size={15}/> Suggested Places to Visit
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <button
              onClick={toggleSelectAll}
              style={{ fontSize:'0.72rem', padding:'4px 10px', borderRadius:'6px', border:'1px solid rgba(6,182,212,0.4)', background: allSelected ? 'rgba(6,182,212,0.15)' : 'transparent', color:'#06b6d4', cursor:'pointer', fontWeight:600, whiteSpace:'nowrap' }}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            <button className="btn-primary" style={{ fontSize:'0.75rem', padding:'4px 12px', background:'#06b6d4', display:'flex', alignItems:'center', gap:'4px' }}
              onClick={addSelectedPlacesToMap} disabled={selectedCount === 0}>
              <Plus size={12}/> Add selected to map ({selectedCount})
            </button>
            {!isFullscreen && (
              <button className="btn-icon" style={{ padding:'4px', background:'transparent', border:'none' }} onClick={()=>{ setPlacesMode(false); setPlacesList(null); }}><X size={14}/></button>
            )}
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px', overflowY:'auto', flex: 1, paddingRight: '4px' }}>
          {placesList.length === 0 && (
            <div style={{ padding:'20px', textAlign:'center', color: subColor, fontSize:'0.82rem' }}>No places returned by AI. Try refining your description and searching again.</div>
          )}
          {placesList.map((p, i) => {
            const isSelected = !!p.selected;
            return (
              <div key={i}
                style={{
                  padding:'10px 12px',
                  background: cardBg,
                  border: `1px solid ${isSelected ? '#06b6d4' : border}`,
                  borderRadius:'8px',
                  display:'flex',
                  gap:'10px',
                  alignItems:'flex-start',
                  transition: 'border-color 0.2s, background 0.2s',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (!p.added) setPlacesList(prev => prev.map((item, idx) => idx === i ? { ...item, selected: !item.selected } : item));
                  if (p.previewCoords && onFlyTo) onFlyTo(p.previewCoords);
                }}
              >
                <input type="checkbox" checked={isSelected} readOnly disabled={p.added}
                  style={{ marginTop:'4px', cursor:'pointer', accentColor:'#06b6d4', flexShrink:0, width:'14px', height:'14px' }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontWeight:'700', fontSize:'0.85rem', color: textColor }}>
                      {p.name}
                      {p.added && <span style={{ fontSize:'0.65rem', color:'#10b981', marginLeft:'5px', fontWeight:'normal' }}>added</span>}
                    </span>
                    <span style={{ fontSize:'0.65rem', background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)', color: subColor, padding:'1px 5px', borderRadius:'4px', textTransform:'uppercase' }}>{p.type || 'attraction'}</span>
                  </div>
                  <div style={{ fontSize:'0.74rem', color: subColor, marginTop:'3px', lineHeight:1.4 }}>{p.description}</div>
                  {p.previewCoords && (
                    <div style={{ fontSize:'0.65rem', color:'#06b6d4', marginTop:'4px', display:'flex', alignItems:'center', gap:'3px' }}>
                      <MapPin size={10}/> View on map
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPlanDetails = (isLight = false) => {
    if (!plan) return null;
    const textColor = isLight ? '#0f172a' : 'var(--text-primary)';
    const subColor = isLight ? '#475569' : 'var(--text-secondary)';
    const border = isLight ? '#cbd5e1' : 'rgba(255,255,255,0.06)';
    const cardBg = isLight ? '#ffffff' : 'rgba(255,255,255,0.015)';

    return (
      <div style={{ color: textColor }}>
        {/* Failsafe for unparsed raw JSON */}
        {(!plan.days || plan.days.length === 0) && plan._raw && (
          <div style={{ marginBottom:'1rem', padding:'0.75rem', background:'rgba(239,68,68,0.1)', borderRadius:'10px', border:'1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize:'0.7rem', color:'var(--danger)', fontWeight:'700', marginBottom:'5px' }}>
              Model generated data, but it didn't match the expected structure:
            </div>
            <pre style={{ fontSize:'0.6rem', color:subColor, whiteSpace:'pre-wrap', maxHeight:'200px', overflowY:'auto' }}>
              {plan._raw}
            </pre>
          </div>
        )}

        {/* Summary */}
        <div style={{ marginBottom:'0.75rem', padding:'0.75rem', background: isLight ? '#eff6ff' : 'rgba(59,130,246,0.08)', borderRadius:'10px', border: isLight ? '1px solid #bfdbfe' : '1px solid rgba(59,130,246,0.18)' }}>
          <div style={{ fontSize:'0.78rem', fontWeight:'700', color: isLight ? '#2563eb' : 'var(--accent-primary)', marginBottom:'6px', lineHeight:1.45 }}>{plan.tripSummary}</div>
          {plan.travelerProfile && (
            <>
              <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'4px' }}>
                {Object.entries(plan.travelerProfile).filter(([k])=>k!=='personalityNote').map(([k,v]) => (
                  <span key={k} style={{ fontSize:'0.6rem', background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)', color: subColor, padding:'2px 7px', borderRadius:'8px', textTransform:'capitalize' }}>{v}</span>
                ))}
              </div>
              {plan.travelerProfile.personalityNote && (
                <div style={{ fontSize:'0.65rem', color:subColor, fontStyle:'italic' }}>{plan.travelerProfile.personalityNote}</div>
              )}
            </>
          )}
        </div>

        {/* Day selector */}
        {plan.days && plan.days.length > 0 && (
          <div style={{ display:'flex', gap:'4px', overflowX:'auto', paddingBottom:'4px', marginBottom:'0.75rem', scrollbarWidth:'none' }}>
            {plan.days.map((day,i)=>(
              <button key={i} onClick={()=>setActiveDay(i)}
                style={{
                  flexShrink:0, padding:'6px 14px', borderRadius:'20px', fontSize:'0.72rem', fontWeight:'700', border:'none', cursor:'pointer',
                  background: activeDay===i ? day.color : isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)',
                  color: activeDay===i ? 'white' : subColor,
                  boxShadow: activeDay===i ? `0 0 10px ${day.color}60` : 'none', transition:'all 0.2s'
                }}>
                Day {day.dayNumber||i+1}
              </button>
            ))}
          </div>
        )}

        {/* Active day */}
        {plan.days && plan.days[activeDay] && (() => {
          const day = plan.days[activeDay];
          const di = activeDay;
          const stops = day.stops || day.places || [];
          return (
            <div style={{ marginBottom:'1rem' }}>
              <div style={{ padding:'10px 14px', borderRadius:'10px 10px 0 0', background:day.color }}>
                <div style={{ fontSize:'0.85rem', fontWeight:'700', color:'white' }}>{day.theme||`Day ${day.dayNumber||activeDay+1}`}</div>
                {day.weatherNote && <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.85)', marginTop:'2px' }}>{day.weatherNote}</div>}
              </div>

              <div style={{ border:`1px solid ${day.color}35`, borderTop:'none', borderRadius:'0 0 10px 10px', overflow:'hidden', background: isLight ? '#ffffff' : 'transparent' }}>
                {stops.map((stop,j)=>{
                  const isEditing = editingStop?.dayIndex===di && editingStop?.stopIndex===j;
                  if (isEditing) return (
                    <div key={j} style={{ padding:'10px 14px', borderBottom:`1px solid ${border}`, background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)' }}>
                      <div style={{ display:'flex', gap:'5px', marginBottom:'5px' }}>
                        <input value={editDraft.time||''} onChange={e=>setEditDraft(d=>({...d,time:e.target.value}))} style={{ width:'62px', fontSize:'0.74rem', padding:'3px 6px', border: isLight ? '1px solid #cbd5e1' : undefined }} placeholder="09:00"/>
                        <input value={editDraft.name||''} onChange={e=>setEditDraft(d=>({...d,name:e.target.value}))} style={{ flex:1, fontSize:'0.74rem', padding:'3px 6px', border: isLight ? '1px solid #cbd5e1' : undefined }} placeholder="Stop name"/>
                      </div>
                      <div style={{ display:'flex', gap:'5px', marginBottom:'5px' }}>
                        <input value={editDraft.duration||''} onChange={e=>setEditDraft(d=>({...d,duration:e.target.value}))} style={{ flex:1, fontSize:'0.74rem', padding:'3px 6px', border: isLight ? '1px solid #cbd5e1' : undefined }} placeholder="Duration (e.g. 1.5 hrs)"/>
                        <input type="number" value={editDraft.budgetEst||''} onChange={e=>setEditDraft(d=>({...d,budgetEst:Number(e.target.value)}))} style={{ width:'70px', fontSize:'0.74rem', padding:'3px 6px', border: isLight ? '1px solid #cbd5e1' : undefined }} placeholder="€ cost"/>
                      </div>
                      <textarea value={editDraft.notes||''} onChange={e=>setEditDraft(d=>({...d,notes:e.target.value}))} rows={2} style={{ width:'100%', fontSize:'0.71rem', padding:'3px 6px', marginBottom:'5px', resize:'vertical', boxSizing:'border-box', border: isLight ? '1px solid #cbd5e1' : undefined }} placeholder="Notes for this traveler…"/>
                      <div style={{ display:'flex', gap:'5px', alignItems:'center', flexWrap:'wrap' }}>
                        <button className="btn-primary" style={{ fontSize:'0.71rem', padding:'2px 8px', display:'flex', alignItems:'center', gap:'3px' }} onClick={()=>{ updateStop(di, j, editDraft); setEditingStop(null); }}><Check size={11}/> Save</button>
                        <button className="btn-icon" style={{ fontSize:'0.71rem', padding:'2px 7px', border: isLight ? '1px solid #cbd5e1' : undefined }} onClick={()=>setEditingStop(null)}>Cancel</button>
                        {plan.days.length > 1 && (
                          <select style={{ fontSize:'0.7rem', padding:'2px 5px', background: isLight ? '#ffffff' : 'var(--bg-secondary)', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)', borderRadius:'5px', color: textColor, cursor:'pointer' }} defaultValue="" onChange={e=>{ if(e.target.value!=='') moveStop(di, j, Number(e.target.value)); }}>
                            <option value="">Move to day…</option>
                            {plan.days.map((_,idx)=>idx!==di&&<option key={idx} value={idx}>Day {idx+1}</option>)}
                          </select>
                        )}
                        <div style={{flex:1}}/>
                        <button className="btn-icon" style={{ padding:'2px', color:'var(--danger)', background:'transparent', border:'none' }} onClick={()=>deleteStop(di,j)} title="Delete stop"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  );
                  return (
                    <div key={j}
                      style={{ padding:'10px 14px', borderBottom:`1px solid ${border}`, display:'flex', gap:'12px', alignItems:'flex-start', background: j%2===0?'transparent': isLight ? '#f8fafc' : 'rgba(255,255,255,0.015)' }}>
                      <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:'2px', opacity:0.6 }}>
                        <GripVertical size={13}/>
                      </div>
                      <div style={{ flexShrink:0, width:'42px', textAlign:'center', marginLeft:'-8px' }}>
                        <div style={{ fontSize:'0.7rem', fontWeight:'700', color:day.color }}>{stop.time}</div>
                        <div style={{ fontSize:'0.58rem', color:subColor, marginTop:'1px' }}>{stop.duration}</div>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:'600', fontSize:'0.82rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color: textColor, cursor:'pointer' }}
                          onClick={()=>{ setEditingStop({dayIndex:di,stopIndex:j}); setEditDraft({...stop}); }}>{stop.name}</div>
                        {stop.notes && <div style={{ fontSize:'0.67rem', color:subColor, lineHeight:1.4, marginTop:'2px', marginBottom:'5px' }}>{stop.notes}</div>}
                        <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
                          {stop.budgetEst>0&&<span style={{ fontSize:'0.6rem', background:'rgba(16,185,129,0.14)', color:'#10b981', padding:'1px 6px', borderRadius:'6px' }}>€{stop.budgetEst}</span>}
                          {stop.transport&&<span style={{ fontSize:'0.6rem', background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.07)', color:subColor, padding:'1px 6px', borderRadius:'6px' }}>{stop.transport}{stop.transportTime?' · '+stop.transportTime:''}</span>}
                        </div>
                      </div>
                      <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
                        <div style={{ width:'22px', height:'22px', borderRadius:'50%', background:day.color, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', fontWeight:'700', opacity:0.85 }}>{j+1}</div>
                        <button className="btn-icon" style={{ padding:'1px', opacity:0.6, background:'transparent', border:'none' }} onClick={()=>{ setEditingStop({dayIndex:di,stopIndex:j}); setEditDraft({...stop}); }} title="Edit stop"><Pencil size={10}/></button>
                      </div>
                    </div>
                  );
                })}
                <button onClick={()=>addStop(di)} style={{ width:'100%', padding:'8px', background:'transparent', border:'none', borderTop: `1px dashed ${border}`, cursor:'pointer', color:subColor, fontSize:'0.72rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px' }}>
                  <Plus size={11}/> Add stop to Day {di+1}
                </button>
              </div>
            </div>
          );
        })()}

        {/* Budget */}
        {plan.budget?.total>0&&(
          <div style={{ marginBottom:'0.75rem', padding:'0.75rem', background:'rgba(16,185,129,0.07)', borderRadius:'10px', border:'1px solid rgba(16,185,129,0.15)', marginTop:'10px' }}>
            <div style={{ fontSize:'0.75rem', fontWeight:'700', color:'#10b981', marginBottom:'8px', display:'flex', alignItems:'center', gap:'5px' }}><CreditCard size={12}/> Budget breakdown</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 16px' }}>
              {['accommodation','food','activities','transport','extras'].filter(k=>(plan.budget[k]||0)>0).map(k=>(
                <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem' }}>
                  <span style={{ color:subColor, textTransform:'capitalize' }}>{k}</span>
                  <span style={{ fontWeight:'600' }}>€{plan.budget[k]}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop:'8px', paddingTop:'8px', borderTop:`1px solid ${border}`, display:'flex', justifyContent:'space-between', fontSize:'0.8rem', fontWeight:'700' }}>
              <span>Total</span><span style={{ color:'#10b981' }}>€{plan.budget.total}</span>
            </div>
          </div>
        )}

        {/* Research Metrics */}
        {plan.researchMetrics && (
          <div style={{ marginBottom:'1rem', marginTop:'10px' }}>
            <div style={{ fontSize:'0.7rem', fontWeight:'600', color:subColor, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'4px' }}>Research metrics</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 12px', background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)', padding:'8px 12px', borderRadius:'8px' }}>
              {Object.entries(plan.researchMetrics).map(([k,v])=>(
                <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.65rem' }}>
                  <span style={{ color:subColor }}>{k.replace(/([A-Z])/g,' $1').trim()}</span>
                  <span style={{ fontWeight:'600', color:'#8b5cf6' }}>{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'1rem', marginTop:'10px' }}>
          <button className="btn-primary" style={{ flex:1, fontSize:'0.82rem', padding:'0.6rem', fontWeight:'700', background: isLight ? '#6366f1' : undefined }} onClick={applyToTrip} disabled={applyDone}>
            {applyDone ? <><Check size={14}/> Applied to trip!</> : <><Plus size={14}/> Apply to itinerary, packing & budget</>}
          </button>
          <button className="btn-icon" title="Clear plan" style={{ border: `1px solid ${border}`, borderRadius:'8px', padding:'0.6rem', background: isLight ? '#ffffff' : undefined }}
            onClick={()=>setTripData(prev=>({...prev,aiPlan:null}))}>
            <X size={14}/>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding:'0 0.1rem' }}>
      {renderFormFields(false)}
      {loading && (
        <div style={{ width:'100%', marginBottom:'0.75rem', padding:'0.5rem', background:'rgba(139,92,246,0.1)', borderRadius:'8px', fontSize:'0.82rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'7px', color:'#a78bfa' }}>
          <Loader2 size={14} className="spin"/> {streamChars > 0 ? `Writing… ${streamChars} chars (${elapsedSecs}s)` : `Thinking… ${elapsedSecs}s`}
        </div>
      )}
      {err && (
        <div style={{ fontSize:'0.74rem', color:'var(--danger)', marginBottom:'0.75rem', padding:'0.5rem 0.75rem', background:'rgba(239,68,68,0.1)', borderRadius:'8px', border:'1px solid rgba(239,68,68,0.2)' }}>
          {err}
        </div>
      )}
      {placesMode && placesList && renderPlacesList(false)}
      {plan && renderPlanDetails(false)}
      {!plan && !loading && (
        <div style={{ textAlign:'center', padding:'1.5rem 1rem', color:'var(--text-secondary)', fontSize:'0.75rem', lineHeight:1.6, marginTop:'0.5rem' }}>
          <BrainCircuit size={36} style={{ marginBottom:'0.5rem', color:'var(--text-secondary)', opacity:0.5 }}/>
          <strong style={{ display:'block', marginBottom:'0.4rem', color:'var(--text-primary)' }}>TripMind AI Planner</strong>
          Set your profile, optionally describe your trip in plain language, then generate a personalized day-by-day itinerary — grounded in real local data, with budget, packing, and map routes.
        </div>
      )}

      {/* Fullscreen Portal Overlay */}
      {isFullscreen && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#ffffff',
            color: '#1e293b',
            width: '98%',
            maxWidth: '1800px',
            height: '97%',
            maxHeight: '1050px',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            fontFamily: 'Inter, sans-serif'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BrainCircuit size={22} style={{ color: '#6366f1' }}/>
                <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>TripMind AI Planner</span>
                <span style={{ fontSize: '0.75rem', background: '#e0e7ff', color: '#4338ca', padding: '3px 8px', borderRadius: '12px', fontWeight: '600' }}>
                  {activeCity?.name?.split(',')[0] || tripData.locations[0]?.name?.split(',')[0] || 'Destination'} Explorer
                </span>
              </div>
              <button
                onClick={() => setIsFullscreen(false)}
                style={{
                  background: '#f1f5f9', border: 'none', borderRadius: '8px',
                  color: '#475569', cursor: 'pointer', padding: '6px 16px',
                  fontSize: '0.82rem', fontWeight: '700', transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
              >
                ✕ Close Explorer
              </button>
            </div>

            {/* Split Screen Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px', padding: '24px', flex: 1, minHeight: 0, background: '#f8fafc' }}>
              {/* Left Column: Form Settings */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#0f172a', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Traveler settings</div>
                {renderFormFields(true)}
              </div>

              {/* Right Column: Output */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                {loading && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                    <Loader2 size={36} className="spin" style={{ color: '#6366f1' }}/>
                    <div style={{ fontSize: '0.9rem', color: '#475569', fontWeight: '600' }}>
                      {streamChars > 0 ? `Assembling plan... (${streamChars} characters generated)` : 'Thinking and retrieving local places...'}
                    </div>
                  </div>
                )}

                {err && !loading && (
                  <div style={{ fontSize:'0.82rem', color:'#ef4444', padding:'12px 16px', background:'#fef2f2', borderRadius:'8px', border:'1px solid #fee2e2', marginBottom:'16px' }}>
                    {err}
                  </div>
                )}

                {!loading && (
                  <>
                    {placesList ? renderPlacesList(true) : plan ? renderPlanDetails(true) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', textAlign: 'center', padding: '0 40px' }}>
                        <BrainCircuit size={48} style={{ color: '#94a3b8', marginBottom: '12px' }}/>
                        <h3 style={{ color: '#0f172a', fontWeight: '700', fontSize: '1.1rem', margin: '0 0 6px 0' }}>Your AI Itinerary is ready to build</h3>
                        <p style={{ fontSize: '0.85rem', margin: 0, lineHeight: 1.6 }}>
                          Set your profile, choose your trip style tags, and click <strong>Generate Trip Plan</strong> or <strong>Find Theme sites</strong> to start exploring.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
