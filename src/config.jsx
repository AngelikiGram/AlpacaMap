import { Train, Plane, Car, Bus, Ship, Bed, Activity, Utensils } from 'lucide-react';

// Overpass API endpoints for fallback
export const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
export let OVERPASS_URL = OVERPASS_URLS[0];

// Simple in-memory cache for Overpass queries
const overpassCache = new Map();

export async function fetchOverpassWithCache(query) {
  const cacheKey = query;
  if (overpassCache.has(cacheKey)) {
    return overpassCache.get(cacheKey);
  }
  let lastError = null;
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      if (res.ok) {
        const data = await res.json();
        overpassCache.set(cacheKey, data);
        OVERPASS_URL = url; // Use the fastest working endpoint
        return data;
      }
      lastError = res.statusText;
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error('All Overpass endpoints failed: ' + lastError);
}

export const OVERPASS_TAGS = {
  Restaurants: [['amenity','restaurant'],['amenity','fast_food'],['amenity','food_court'],['amenity','pub']],
  Coffee:      [['amenity','cafe']],
  Museums:     [['amenity','museum'],['tourism','museum']],
  Art:         [['tourism','gallery'],['tourism','artwork'],['amenity','arts_centre']],
  Parks:       [['leisure','park'],['leisure','garden'],['leisure','nature_reserve']],
  Shopping:    [['shop','supermarket'],['shop','clothes'],['shop','mall'],['amenity','marketplace'],['shop','department_store'],['shop','bakery'],['shop','books']],
  Attractions: [['tourism','attraction'],['amenity','theatre'],['amenity','cinema'],['leisure','stadium']],
  Hiking:      [['natural','peak'],['natural','saddle'],['waterway','waterfall'],['natural','cave_entrance']],
  Viewpoints:  [['tourism','viewpoint'],['natural','peak'],['natural','saddle']],
  Beaches:     [['natural','beach'],['leisure','beach_resort'],['natural','bay']],
  Camping:     [['tourism','camp_site'],['tourism','caravan_site'],['leisure','camp_site']],
  Historic:    [['historic','castle'],['historic','ruins'],['historic','monument'],['historic','memorial'],['historic','archaeological_site']],
};

export const TOURIST_LANDMARK_TAGS = new Set(['attraction','museum','gallery','viewpoint','artwork','theme_park','aquarium','zoo']);

export const CATEGORY_ZOOM_PRIORITY = {
  low:    new Set(['Attractions','Museums','Art','Historic','Viewpoints','Restaurants','Coffee','Parks']),
  medium: new Set(['Attractions','Museums','Art','Historic','Viewpoints','Restaurants','Coffee','Parks','Shopping','Camping','Beaches','Hiking']),
  high:   null,
};

export const SEARCH_KEYWORDS = {
  Restaurants:['restaurant'], Coffee:['cafe'], Museums:['museum'], Art:['art', 'gallery', 'exhibition'], Parks:['park'],
  Shopping:['market'], Attractions:['attraction'], Hiking:['hiking trail'],
  Viewpoints:['viewpoint'], Beaches:['beach'], Camping:['campsite'], Historic:['castle'],
};

export const INTEREST_CATEGORIES = [
  {value:'Restaurants',label:'Food'},{value:'Coffee',label:'Cafes'},
  {value:'Museums',label:'Museums'},{value:'Art',label:'Art & Galleries'},{value:'Parks',label:'Parks'},
  {value:'Shopping',label:'Shopping'},{value:'Attractions',label:'Sights'},
  {value:'Hiking',label:'Hiking'},{value:'Viewpoints',label:'Views'},
  {value:'Beaches',label:'Beaches'},{value:'Camping',label:'Camping'},
  {value:'Historic',label:'Historic'},
];

export const LOCATION_TYPE_PRESETS = {
  city:    ['Restaurants','Coffee','Museums','Art','Attractions','Shopping','Parks','Historic'],
  nature:  ['Hiking','Viewpoints','Camping','Parks','Historic'],
  coastal: ['Beaches','Restaurants','Attractions','Viewpoints'],
  mountain:['Hiking','Viewpoints','Camping','Parks'],
};

export const EVENT_TYPES=[{value:'flight',label:'Flight'},{value:'train',label:'Train'},{value:'hotel',label:'Hotel'},{value:'activity',label:'Activity'},{value:'food',label:'Food'}];

export const TRANSPORT_ICON={train:<Train size={14}/>,flight:<Plane size={14}/>,car:<Car size={14}/>,bus:<Bus size={14}/>,ferry:<Ship size={14}/>};

export const EVT_EMOJI={flight:<Plane size={14}/>,train:<Train size={14}/>,hotel:<Bed size={14}/>,activity:<Activity size={14}/>,food:<Utensils size={14}/>};

export const DOC_SECTIONS=[{key:'flights',label:'Flights',icon:<Plane size={14}/>},{key:'trains',label:'Trains',icon:<Train size={14}/>},{key:'hotels',label:'Hotels',icon:<Bed size={14}/>},{key:'leisure',label:'Leisure',icon:<Activity size={14}/>}];

export const BUDGET_CATEGORIES=[
  {value:'accommodation',label:'Stay',color:'#8b5cf6'},
  {value:'food',label:'Food',color:'#f59e0b'},
  {value:'transport',label:'Transport',color:'#3b82f6'},
  {value:'activities',label:'Activities',color:'#10b981'},
  {value:'shopping',label:'Shopping',color:'#ec4899'},
  {value:'misc',label:'Misc',color:'#6b7280'},
];

export const PACKING_TEMPLATES={
  documents:['Passport','Travel Insurance','Visa Documents','Emergency Contacts'],
  clothes:['T-shirts (5x)','Underwear (7x)','Socks (7 pairs)','Jeans (2x)','Smart outfit','Rain jacket','Warm layer'],
  electronics:['Phone + charger','Universal adapter','Power bank','Earphones','Camera'],
  toiletries:['Toothbrush & paste','Deodorant','Sunscreen SPF50+','Medications'],
  outdoor:['Hiking boots','Day pack','Trekking poles','Headlamp','Insect repellent','Water bottle'],
  beach:['Swimwear (2x)','Beach towel','Flip flops','Snorkel gear','Waterproof bag'],
  winter:['Thermal underwear','Heavy coat','Gloves','Beanie/Hat','Scarf','Wool socks'],
  business:['Suit/Blazer','Dress shirts','Dress shoes','Ties','Laptop','Business cards'],
  photography:['Camera body','Lenses','Tripod','Memory cards','Extra batteries','Lens wipes'],
};

export const ENTITY_PROFILES = {
  Museums:     {duration:'2–3 hrs', budget:'€10–20 entry fee',  packing:['Camera','Comfortable shoes'],          tip:'Great for a rainy day',      weatherSafe:true},
  Art:         {duration:'1–2 hrs', budget:'Free to €15',       packing:['Camera'],                               tip:'Check for temporary exhibitions', weatherSafe:true},
  Historic:    {duration:'1–2 hrs', budget:'Free to €10',       packing:['Good walking shoes','Water'],           tip:'Best in morning light',     weatherSafe:false},
  Restaurants: {duration:'1–1.5 hrs',budget:'€20–50/person',  packing:['Reservation confirmation'],             tip:'Book ahead for dinner',     weatherSafe:true},
  Coffee:      {duration:'30–60 min',budget:'€5–15',          packing:[],                                       tip:'Good Wi-Fi spot often',    weatherSafe:true},
  Shopping:    {duration:'1–3 hrs', budget:'Variable',         packing:['Reusable bag'],                         tip:'Check opening hours',      weatherSafe:true},
  Attractions: {duration:'1–3 hrs', budget:'€10–30',          packing:['Camera','Sunscreen'],                   tip:'Buy tickets online',       weatherSafe:false},
  Parks:       {duration:'1–3 hrs', budget:'Free',            packing:['Water','Sunscreen','Snacks'],           tip:'Perfect for a picnic',     weatherSafe:false},
  Hiking:      {duration:'3–6 hrs', budget:'Free to €5',       packing:['Water (2L+)','Hiking boots','Rain jacket','Snacks'],tip:'Start before 9am',weatherSafe:false},
  Viewpoints:  {duration:'30–60 min',budget:'Free',           packing:['Camera','Sunscreen','Layers'],          tip:'Golden hour is magic',     weatherSafe:false},
  Beaches:     {duration:'2–4 hrs', budget:'€10–20 sunbed',   packing:['Sunscreen','Swimwear','Towel','Water'], tip:'Go early or late afternoon',weatherSafe:false},
  Camping:     {duration:'Overnight',budget:'€20–40/night',  packing:['Tent','Sleeping bag','Torch','Food'],   tip:'Book pitches in advance',  weatherSafe:false},
};

