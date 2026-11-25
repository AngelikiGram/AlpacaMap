// The trip a first-time visitor sees: a London long weekend that shows off what AlpacaMap does, 
// knowledge loads automatically (bundled London statements), the Truth lens lights up, two stops
// get timing warnings (St Paul's is closed to sightseers on Sundays; Camden Market closes at 18:00),
// Hyde Park on Sunday gets a rain plan when the forecast is wet, and Sky Garden sits in golden hour.

const nextFriday = (today = new Date()) => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() + (((5 - d.getDay() + 7) % 7) || 7));
  return d;
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const P = {
  bm:     { name: 'British Museum', type: 'museum', coords: [51.51931, -0.12688], hours: 'Sa-Th 10:00-17:00; Fr 10:00-20:30', wikidata: 'Q6373' },
  cg:     { name: 'Covent Garden', type: 'restaurant', coords: [51.51174, -0.12404], hours: null },
  ng:     { name: 'National Gallery', type: 'gallery', coords: [51.50889, -0.12875], hours: 'Sa-Th 10:00-18:00; Fr 10:00-21:00', wikidata: 'Q180788' },
  pc:     { name: 'Piccadilly Circus', type: 'attraction', coords: [51.5099, -0.13438], hours: null, wikidata: 'Q215255' },
  soho:   { name: 'Soho', type: 'restaurant', coords: [51.5136, -0.1365], hours: null },
  tate:   { name: 'Tate Modern', type: 'museum', coords: [51.50743, -0.09939], hours: 'Su-Th 10:00-18:00; Fr-Sa 10:00-21:00', wikidata: 'Q193375' },
  boro:   { name: 'Borough Market', type: 'market', coords: [51.50551, -0.09103], hours: null },
  globe:  { name: "Shakespeare's Globe", type: 'attraction', coords: [51.50812, -0.09709], hours: '09:00-17:00', wikidata: 'Q7725501' },
  sky:    { name: 'Sky Garden', type: 'viewpoint', coords: [51.5111, -0.0836], hours: 'Mo-Fr 10:00-18:00; Sa-Su,PH 11:00-21:00' },
  hyde:   { name: 'Hyde Park', type: 'park', coords: [51.50731, -0.16572], hours: null },
  kg:     { name: 'Kensington Gardens', type: 'park', coords: [51.50665, -0.1802], hours: null, wikidata: 'Q822607' },
  va:     { name: 'Victoria and Albert Museum', type: 'museum', coords: [51.49691, -0.17212], hours: 'Sa-Th 10:00-17:45; Fr 10:00-22:00', wikidata: 'Q213322' },
  stp:    { name: "St Paul's Cathedral", type: 'church', coords: [51.51378, -0.09844], hours: 'Mo-Sa 08:30-16:00', wikidata: 'Q173882' },
  camden: { name: 'Camden Market', type: 'market', coords: [51.54238, -0.14719], hours: '10:00-18:00', wikidata: 'Q1028420' },
};

export const DEMO_FLAG = 'demo-london';

export function makeDemoTrip(today = new Date()) {
  const fri = nextFriday(today);
  const day = (n) => { const d = new Date(fri); d.setDate(d.getDate() + n); return iso(d); };
  let pid = 9100;
  const places = Object.values(P).map((p) => ({
    id: ++pid, name: p.name, type: p.type, coords: p.coords,
    osmTags: { hours: p.hours, wikidata: p.wikidata || null },
  }));
  const ev = (id, time, key, type = 'activity') => ({ id, time, title: P[key].name, type });
  return {
    title: 'Example: London long weekend',
    demo: DEMO_FLAG,
    locations: [{ id: 91, name: 'London, United Kingdom', coords: [51.5074, -0.1278], zoomLevel: 13, places, recommendations: [] }],
    routes: [],
    itinerary: [
      { id: 9201, date: day(0), location: 'London', events: [
        { id: 9300, time: '08:40', title: 'Train to London St Pancras', type: 'train' },
        ev(9301, '10:00', 'bm'), ev(9302, '13:00', 'cg', 'food'), ev(9303, '15:00', 'ng'), ev(9304, '17:30', 'pc'), ev(9305, '19:30', 'soho', 'food')] },
      { id: 9202, date: day(1), location: 'London', events: [
        ev(9311, '10:00', 'tate'), ev(9312, '12:30', 'boro', 'food'), ev(9313, '14:30', 'globe'), ev(9314, '16:00', 'sky')] },
      { id: 9203, date: day(2), location: 'London', events: [
        ev(9321, '10:00', 'hyde'), ev(9322, '11:30', 'kg'), ev(9323, '13:30', 'va'), ev(9324, '16:00', 'stp'), ev(9325, '18:30', 'camden')] },
    ],
    notes: { general: 'This is a demo trip. Try the Truth lens and Time buttons on the map, swipe a few Debates, and check the ⚠ warnings on Sunday in the Itinerary.\nWhen you are ready, type your own trip into the box on the home screen.', cities: {} },
    documents: { flights: [], trains: [], hotels: [], leisure: [] },
    budget: { total: 900, currency: 'GBP', expenses: [
      { id: 1, name: 'Return train', amount: 120, category: 'transport', city: 'London, United Kingdom' },
      { id: 2, name: 'Hotel (2 nights)', amount: 310, category: 'accommodation', city: 'London, United Kingdom' },
    ] },
    packing: [
      { id: 1, name: 'Essentials', items: [{ id: 11, text: 'Contactless card (for the Tube)', checked: false }, { id: 12, text: 'UK plug adapter', checked: false }, { id: 13, text: 'Umbrella', checked: false }] },
    ],
    knowledgeGraph: { nodes: [], edges: [], lastUpdated: null },
  };
}
