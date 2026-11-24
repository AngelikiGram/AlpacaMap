// Topic classification for statements that are not about a named place.
// Explicit keyword rules (auditable, reproducible) replace the naive Bayes model,
// which always picked *some* topic, e.g. 987 Paris statements landed in "Accommodation".
// A statement gets the topic with the most keyword hits; with no hit it is "General".

export const TOPIC_KEYWORDS = {
  'Transport': ['metro', 'subway', 'underground', 'tube', 'bus', 'buses', 'train', 'trains', 'tram', 'station', 'stations', 'taxi', 'taxis', 'uber', 'airport', 'flight', 'flights', 'rer', 'navigo', 'transit', 'public transport', 'bike', 'bikes', 'cycling', 'parking', 'ferry', 'ticket', 'tickets', 'commute', 'driving', 'drive'],
  'Food & Drink': ['restaurant', 'restaurants', 'food', 'eat', 'eating', 'cafe', 'cafes', 'café', 'cafés', 'coffee', 'bakery', 'bakeries', 'croissant', 'dinner', 'lunch', 'breakfast', 'wine', 'beer', 'cuisine', 'dish', 'dishes', 'menu', 'pizza', 'pasta', 'gelato', 'bistro', 'brasserie', 'trattoria', 'meal', 'meals', 'cheese', 'dessert', 'brunch', 'aperitivo'],
  'Accommodation': ['hotel', 'hotels', 'hostel', 'hostels', 'airbnb', 'apartment', 'apartments', 'accommodation', 'accommodations', 'guesthouse', 'b&b', 'check-in', 'check in', 'room', 'rooms', 'lodging', 'where to stay', 'stay in', 'stayed in'],
  'Safety & Health': ['pickpocket', 'pickpockets', 'pickpocketing', 'scam', 'scams', 'theft', 'thieves', 'steal', 'stolen', 'safe', 'safety', 'unsafe', 'dangerous', 'crime', 'police', 'hospital', 'pharmacy', 'emergency', 'health', 'doctor', 'robbery', 'mugging', 'beware', 'careful', 'harass', 'harassment', 'wallet', 'wallets', 'purse', 'valuables', 'bag snatching', 'women travelers', 'women travellers', 'solo female', 'alone at night', 'insurance', 'vaccination'],
  'Shopping': ['shop', 'shops', 'shopping', 'store', 'stores', 'boutique', 'boutiques', 'mall', 'souvenir', 'souvenirs', 'flea market', 'department store', 'designer', 'outlet', 'antiques'],
  'Climate': ['weather', 'rain', 'rainy', 'raining', 'summer', 'winter', 'spring', 'autumn', 'temperature', 'temperatures', 'sunny', 'snow', 'humid', 'humidity', 'heat', 'heatwave', 'umbrella', 'climate', 'degrees'],
  'History': ['century', 'centuries', 'ancient', 'roman', 'romans', 'empire', 'king', 'queen', 'medieval', 'revolution', 'war', 'built in', 'founded', 'history', 'historical', 'emperor', 'napoleon', 'dynasty', 'ruins', 'bc', 'ce'],
  'Culture': ['museum', 'museums', 'art', 'gallery', 'galleries', 'opera', 'theatre', 'theater', 'concert', 'concerts', 'festival', 'festivals', 'church', 'churches', 'cathedral', 'basilica', 'culture', 'cultural', 'language', 'tradition', 'traditions', 'etiquette', 'tipping', 'custom', 'customs', 'locals', 'exhibition', 'architecture'],
  'Districts': ['neighborhood', 'neighbourhood', 'neighborhoods', 'neighbourhoods', 'district', 'districts', 'quarter', 'arrondissement', 'arrondissements', 'rione', 'borough', 'suburb', 'suburbs', 'old town'],
  'Money & Costs': ['price', 'prices', 'expensive', 'cheap', 'cheaper', 'cost', 'costs', 'euro', 'euros', '€', 'budget', 'free entry', 'admission', 'discount', 'city pass', 'museum pass', 'cash', 'atm', 'credit card', 'overpriced', 'tourist trap'],
  'Nightlife': ['nightlife', 'club', 'clubs', 'clubbing', 'party', 'parties', 'pub', 'pubs', 'cocktail', 'cocktails', 'bar', 'bars', 'late night', 'live music'],
};

export const TOPICS = [...Object.keys(TOPIC_KEYWORDS), 'General'];

const TIE_PRIORITY = ['Safety & Health', 'Money & Costs', 'Climate', 'Food & Drink', 'Accommodation', 'Nightlife', 'Shopping', 'History', 'Culture', 'Districts', 'Transport'];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Word-boundary patterns; '€' and 'b&b' are not word characters, so match them literally.
const PATTERNS = Object.fromEntries(Object.entries(TOPIC_KEYWORDS).map(([topic, words]) => [
  topic,
  words.map((w) => (/^[\w\s'-]+$/.test(w) ? new RegExp(`\\b${escape(w)}\\b`, 'i') : new RegExp(escape(w), 'i'))),
]));

/** Returns { topic, score, scores }, topic is 'General' when no keyword matches. */
export function scoreTopics(text) {
  const t = text || '';
  const scores = {};
  for (const [topic, pats] of Object.entries(PATTERNS)) {
    const n = pats.reduce((acc, re) => acc + (re.test(t) ? 1 : 0), 0);
    if (n) scores[topic] = n;
  }
  let topic = 'General', score = 0;
  // On a tie, the more decision-relevant topic wins (a warning about pickpockets on the metro is Safety)
  for (const k of TIE_PRIORITY) if ((scores[k] || 0) > score) { topic = k; score = scores[k]; }
  return { topic, score, scores };
}

export const classifyTopic = (text) => scoreTopics(text).topic;

/** "Paris · Transport" style label used as the place of topic statements. */
export const topicLabel = (cityBase, text) => `${cityBase} · ${classifyTopic(text)}`;
