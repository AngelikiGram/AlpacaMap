import React from 'react';
import {
  Navigation, MapPin, Calendar as CalendarIcon, Compass, FileText,
  DollarSign, Package, BookOpen, Sparkles, Activity,
  Plane, Train, Car, Bus, Ship, Bed, Utensils,
  Layers, MountainSnow, Moon, Satellite, TreePine,
} from 'lucide-react';

export const MAP_LAYERS = [
  {
    id: 'streets', icon: <MapPin size={14}/>, label: 'Streets (OSM)', desc: 'Detailed OSM map with places & roads',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '© OpenStreetMap', maxNative: 19, subdomains: 'abc',
  },
  {
    id: 'clean', icon: <Layers size={14}/>, label: 'Clean', desc: 'Clean street map (Voyager)',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attr: '© CARTO', maxNative: 19, subdomains: 'abcd',
  },
  {
    id: 'satellite', icon: <Satellite size={14}/>, label: 'Satellite', desc: 'Aerial imagery with place labels',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelsUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attr: '© Esri', maxNative: 17, subdomains: '',
  },
  {
    id: 'terrain', icon: <MountainSnow size={14}/>, label: 'Terrain', desc: 'Topographic map — trails, elevation',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attr: '© Esri', maxNative: 19, subdomains: '',
  },
  {
    id: 'dark', icon: <Moon size={14}/>, label: 'Dark', desc: 'Dark mode — great for night planning',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr: '© CARTO', maxNative: 19, subdomains: 'abcd',
  },
  {
    id: 'osm', icon: <TreePine size={14}/>, label: 'Outdoors', desc: 'Full OSM detail — trails, parks, POIs',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '© OpenStreetMap contributors', maxNative: 19, subdomains: 'abc',
  },
];

export const SEARCH_KEYWORDS = {
  Restaurants: ['restaurant'], Coffee: ['cafe'], Museums: ['museum'], Parks: ['park'],
  Shopping: ['market'], Attractions: ['attraction'], Hiking: ['hiking trail'],
  Viewpoints: ['viewpoint'], Beaches: ['beach'], Camping: ['campsite'], Historic: ['castle'],
};

export const INTEREST_CATEGORIES = [
  { value: 'Restaurants', label: 'Food'     },
  { value: 'Coffee',      label: 'Cafes'    },
  { value: 'Museums',     label: 'Museums'  },
  { value: 'Parks',       label: 'Parks'    },
  { value: 'Shopping',    label: 'Shopping' },
  { value: 'Attractions', label: 'Sights'   },
  { value: 'Hiking',      label: 'Hiking'   },
  { value: 'Viewpoints',  label: 'Views'    },
  { value: 'Beaches',     label: 'Beaches'  },
  { value: 'Camping',     label: 'Camping'  },
  { value: 'Historic',    label: 'Historic' },
];

export const LOCATION_TYPE_PRESETS = {
  city:     ['Restaurants','Coffee','Museums','Attractions','Shopping'],
  nature:   ['Hiking','Viewpoints','Camping','Parks','Historic'],
  coastal:  ['Beaches','Restaurants','Attractions','Viewpoints'],
  mountain: ['Hiking','Viewpoints','Camping','Parks'],
};

export const detectLocationType = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('national park') || n.includes('nature reserve') || n.includes('forest') ||
      n.includes('wilderness')    || n.includes('canyon')         || n.includes('valley'))  return 'nature';
  if (n.includes('beach') || n.includes('coast') || n.includes('bay')    ||
      n.includes('island')|| n.includes('sea')   || n.includes('ocean'))                    return 'coastal';
  if (n.includes('mountain') || n.includes('peak') || n.includes('alps') ||
      n.includes('highland')  || n.includes('range')|| n.includes('glacier'))               return 'mountain';
  return 'city';
};

export const EVENT_TYPES = [
  { value: 'flight',   label: 'Flight'   },
  { value: 'train',    label: 'Train'    },
  { value: 'hotel',    label: 'Hotel'    },
  { value: 'activity', label: 'Activity' },
  { value: 'food',     label: 'Food'     },
];

export const TRANSPORT_ICON = {
  train: <Train size={14}/>,
  flight: <Plane size={14}/>,
  car:   <Car size={14}/>,
  bus:   <Bus size={14}/>,
  ferry: <Ship size={14}/>,
};

export const EVT_EMOJI = {
  flight:   <Plane size={14}/>,
  train:    <Train size={14}/>,
  hotel:    <Bed size={14}/>,
  activity: <Activity size={14}/>,
  food:     <Utensils size={14}/>,
};

export const DOC_SECTIONS = [
  { key: 'flights', label: 'Flights',  icon: <Plane size={14}/> },
  { key: 'trains',  label: 'Trains',   icon: <Train size={14}/> },
  { key: 'hotels',  label: 'Hotels',   icon: <Bed size={14}/>   },
  { key: 'leisure', label: 'Leisure',  icon: <Activity size={14}/> },
];

export const BUDGET_CATEGORIES = [
  { value: 'accommodation', label: 'Stay',      color: '#8b5cf6' },
  { value: 'food',          label: 'Food',      color: '#f59e0b' },
  { value: 'transport',     label: 'Transport', color: '#3b82f6' },
  { value: 'activities',    label: 'Activities',color: '#10b981' },
  { value: 'shopping',      label: 'Shopping',  color: '#ec4899' },
  { value: 'misc',          label: 'Misc',      color: '#6b7280' },
];

export const PACKING_TEMPLATES = {
  documents:   ['Passport','Travel Insurance','Visa Documents','Emergency Contacts'],
  clothes:     ['T-shirts (5x)','Underwear (7x)','Socks (7 pairs)','Jeans (2x)','Smart outfit','Rain jacket','Warm layer'],
  electronics: ['Phone + charger','Universal adapter','Power bank','Earphones','Camera'],
  toiletries:  ['Toothbrush & paste','Deodorant','Sunscreen SPF50+','Medications'],
  outdoor:     ['Hiking boots','Day pack','Trekking poles','Headlamp','Insect repellent','Water bottle'],
  beach:       ['Swimwear (2x)','Beach towel','Flip flops','Snorkel gear','Waterproof bag'],
};

export const ENTITY_PROFILES = {
  Museums:     { duration: '2–3 hrs',   budget: '€10–20 entry fee', packing: ['Camera','Comfortable shoes'],           tip: 'Great for a rainy day',      weatherSafe: true  },
  Historic:    { duration: '1–2 hrs',   budget: 'Free – €10',       packing: ['Good walking shoes','Water'],           tip: 'Best in morning light',      weatherSafe: false },
  Restaurants: { duration: '1–1.5 hrs', budget: '€20–50/person',    packing: ['Reservation confirmation'],             tip: 'Book ahead for dinner',      weatherSafe: true  },
  Coffee:      { duration: '30–60 min', budget: '€5–15',            packing: [],                                       tip: 'Good Wi-Fi spot often',      weatherSafe: true  },
  Shopping:    { duration: '1–3 hrs',   budget: 'Variable',         packing: ['Reusable bag'],                         tip: 'Check opening hours',        weatherSafe: true  },
  Attractions: { duration: '1–3 hrs',   budget: '€10–30',           packing: ['Camera','Sunscreen'],                   tip: 'Buy tickets online',         weatherSafe: false },
  Parks:       { duration: '1–3 hrs',   budget: 'Free',             packing: ['Water','Sunscreen','Snacks'],           tip: 'Perfect for a picnic',       weatherSafe: false },
  Hiking:      { duration: '3–6 hrs',   budget: 'Free – €5',        packing: ['Water (2L+)','Hiking boots','Rain jacket','Snacks'], tip: 'Start before 9am', weatherSafe: false },
  Viewpoints:  { duration: '30–60 min', budget: 'Free',             packing: ['Camera','Sunscreen','Layers'],          tip: 'Golden hour is magic',       weatherSafe: false },
  Beaches:     { duration: '2–4 hrs',   budget: '€10–20 sunbed',    packing: ['Sunscreen','Swimwear','Towel','Water'], tip: 'Go early or late afternoon', weatherSafe: false },
  Camping:     { duration: 'Overnight', budget: '€20–40/night',     packing: ['Tent','Sleeping bag','Torch','Food'],   tip: 'Book pitches in advance',    weatherSafe: false },
};

export const INITIAL_TRIP = {
  title: 'Grand European Tour 2026',
  locations: [
    { id: 1, name: 'London, United Kingdom', coords: [51.5074, -0.1278], zoomLevel: 13, places: [{ id: 100, name: 'British Museum', type: 'museum', coords: [51.5194, -0.1270] }], recommendations: [] },
    { id: 2, name: 'Paris, France',          coords: [48.8566, 2.3522],  zoomLevel: 13, places: [{ id: 101, name: 'Louvre Museum', type: 'museum', coords: [48.8606, 2.3376] }], recommendations: [] },
    { id: 3, name: 'Zurich, Switzerland',    coords: [47.3769, 8.5417],  zoomLevel: 13, places: [{ id: 102, name: 'Grossmünster', type: 'sight', coords: [47.3700, 8.5439] }], recommendations: [] },
    { id: 4, name: 'Edinburgh, United Kingdom', coords: [55.9533, -3.1883], zoomLevel: 13, places: [{ id: 103, name: 'Edinburgh Castle', type: 'sight', coords: [55.9486, -3.1999] }], recommendations: [] },
  ],
  routes: [
    { id: 101, from: 1, to: 2, mode: 'train',  path: [[51.5074, -0.1278], [48.8566, 2.3522]] },
    { id: 102, from: 2, to: 3, mode: 'train',  path: [[48.8566, 2.3522], [47.3769, 8.5417]] },
    { id: 103, from: 3, to: 4, mode: 'flight', path: [[47.3769, 8.5417], [55.9533, -3.1883]] }
  ],
  itinerary: [
    { id: 1, date: '2026-09-10', location: 'London, United Kingdom',    events: [{ id: 11, time: '09:00', title: 'LHR Arrival & Check-in', type: 'flight' }, { id: 12, time: '14:00', title: 'British Museum visit', type: 'activity' }] },
    { id: 2, date: '2026-09-11', location: 'Paris, France',             events: [{ id: 13, time: '08:00', title: 'Eurostar to Paris Gare du Nord', type: 'train' }, { id: 14, time: '15:00', title: 'Louvre Museum tour', type: 'activity' }] },
    { id: 3, date: '2026-09-12', location: 'Zurich, Switzerland',       events: [{ id: 15, time: '09:30', title: 'TGV Lyria Train to Zurich HB', type: 'train' }, { id: 16, time: '17:00', title: 'Grossmünster & Limmat walk', type: 'activity' }] },
    { id: 4, date: '2026-09-13', location: 'Edinburgh, United Kingdom',  events: [{ id: 17, time: '11:00', title: 'Flight LX824 to Edinburgh', type: 'flight' }, { id: 18, time: '16:00', title: 'Edinburgh Castle tour', type: 'activity' }] },
  ],
  notes: { general: 'Remember universal adapters.\nCall bank to authorize cards for Europe.', cities: {} },
  documents: { flights: [], trains: [], hotels: [], leisure: [] },
  budget: {
    total: 5000, currency: 'EUR',
    expenses: [
      { id: 1, name: 'Flights & Rail Passes', amount: 850,  category: 'transport',     city: 'London, United Kingdom' },
      { id: 2, name: 'Hotels (All Cities)',   amount: 1200, category: 'accommodation', city: 'Paris, France' },
    ],
  },
  packing: [
    { id: 1, name: 'Documents',    items: [{ id: 11, text: 'Passport', checked: true }, { id: 12, text: 'Travel Insurance', checked: false }, { id: 13, text: 'Emergency Contacts', checked: false }] },
    { id: 2, name: 'Clothes',      items: [{ id: 21, text: 'T-shirts (5x)', checked: false }, { id: 22, text: 'Rain jacket', checked: false }, { id: 23, text: 'Smart outfit', checked: false }] },
    { id: 3, name: 'Electronics',  items: [{ id: 31, text: 'Phone + charger', checked: false }, { id: 32, text: 'Universal adapter', checked: true }, { id: 33, text: 'Power bank', checked: false }] },
  ],
};

export const TABS = [
  { id: 'locations', label: 'Explore',   Icon: MapPin       },
  { id: 'route',     label: 'Route',     Icon: Navigation   },
  { id: 'calendar',  label: 'Schedule',  Icon: CalendarIcon },
  { id: 'budget',    label: 'Budget',    Icon: DollarSign   },
  { id: 'packing',   label: 'Packing',   Icon: Package      },
  { id: 'notes',     label: 'Notes',     Icon: BookOpen     },
  { id: 'documents', label: 'Docs',      Icon: FileText     },
  { id: 'analyze',   label: 'Analyze',   Icon: Activity     },
  { id: 'tripmind',  label: 'Planner',   Icon: Sparkles     },
];
