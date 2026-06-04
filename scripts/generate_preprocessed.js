import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.resolve(__dirname, '../public');
const targetDir = path.resolve(publicDir, 'preprocessed');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const data = {
  barcelona: {
    wikivoyage: {
      text: "Barcelona, capital of Catalonia, is Spain's second-largest city. Famous for Antoni Gaudi's architecture like the Sagrada Familia and Parc Guell.",
      url: "https://en.wikivoyage.org/wiki/Barcelona",
      title: "Barcelona",
      nodes: [
        {
          place: "Sagrada Familia",
          claim: "extraordinary Basilica designed by Antoni Gaudi",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "book tickets weeks in advance online",
          sentiment: "positive",
          intensity: 0.9,
          snippet: "Famous for Antoni Gaudi's architecture"
        },
        {
          place: "Parc Guell",
          claim: "scenic public park system with Gaudi design",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "positive",
          intensity: 0.8,
          snippet: "Famous for Antoni Gaudi's architecture"
        }
      ]
    },
    wikitravel: {
      text: "Explore Barri Gotic and La Rambla. Avoid pickpockets on La Rambla.",
      url: "https://wikitravel.org/en/Barcelona",
      title: "Barcelona",
      nodes: [
        {
          place: "Gothic Quarter",
          claim: "charming old city center with narrow medieval streets",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "positive",
          intensity: 0.8,
          snippet: "Explore Barri Gotic"
        },
        {
          place: "La Rambla",
          claim: "extremely high density of pickpockets",
          claimType: "conditional",
          knowledge_type: "volatile",
          conditions: {},
          advice: "keep bags closed and watch belongings closely",
          sentiment: "negative",
          intensity: 0.9,
          snippet: "Avoid pickpockets on La Rambla"
        }
      ]
    },
    wikipedia: {
      text: "Barcelona is the capital of Catalonia community. Hosted 1992 Olympics.",
      url: "https://en.wikipedia.org/wiki/Barcelona",
      title: "Barcelona",
      nodes: [
        {
          place: "Barcelona",
          claim: "capital of Catalonia autonomous community",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "neutral",
          intensity: 0.5,
          snippet: "capital of Catalonia community"
        }
      ]
    },
    reddit: {
      text: "[SOURCE:reddit r/travel]\nTapas in Gracia are much cheaper and better than on La Rambla.\n\n---\n\n[SOURCE:reddit r/solotravel]\nWatch out for pickpockets at Barcelona Sants train station.",
      count: 2,
      nodes: [
        {
          place: "Gracia",
          claim: "authentic tapas are cheaper and better than tourist traps",
          claimType: "evaluation",
          knowledge_type: "volatile",
          conditions: {},
          advice: "eat tapas in Gracia neighborhood instead of La Rambla",
          sentiment: "positive",
          intensity: 0.8,
          snippet: "Tapas in Gracia are much cheaper"
        },
        {
          place: "Barcelona Sants",
          claim: "pickpockets frequently target distracted travelers",
          claimType: "temporal",
          knowledge_type: "volatile",
          conditions: {},
          advice: "stay alert at the train station",
          sentiment: "negative",
          intensity: 0.8,
          snippet: "Watch out for pickpockets at Barcelona Sants"
        }
      ]
    },
    stackexchange: {
      text: "[SOURCE:stackexchange votes:15]\nAerobus is the fastest transport option from airport to center.",
      count: 1,
      nodes: [
        {
          place: "Aerobus",
          claim: "most reliable and fastest airport transfer option",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "take Aerobus instead of train or public bus",
          sentiment: "positive",
          intensity: 0.9,
          snippet: "Aerobus is the fastest transport option"
        }
      ]
    }
  },
  kyoto: {
    wikivoyage: {
      text: "Kyoto, former capital of Japan, is famous for classical Buddhist temples and Shinto shrines.",
      url: "https://en.wikivoyage.org/wiki/Kyoto",
      title: "Kyoto",
      nodes: [
        {
          place: "Kyoto",
          claim: "former imperial capital of Japan",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "neutral",
          intensity: 0.5,
          snippet: "former capital of Japan"
        }
      ]
    },
    wikitravel: {
      text: "Kyoto has top attractions: Kinkaku-ji temple and traditional Gion district.",
      url: "https://wikitravel.org/en/Kyoto",
      title: "Kyoto",
      nodes: [
        {
          place: "Kinkaku-ji",
          claim: "iconic golden temple structure",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "positive",
          intensity: 0.9,
          snippet: "Kinkaku-ji temple"
        },
        {
          place: "Gion",
          claim: "traditional district famous for geisha culture and tea houses",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "positive",
          intensity: 0.8,
          snippet: "traditional Gion district"
        }
      ]
    },
    wikipedia: {
      text: "Kyoto is the capital of Kyoto Prefecture. Seat of Emperor historically.",
      url: "https://en.wikipedia.org/wiki/Kyoto",
      title: "Kyoto",
      nodes: [
        {
          place: "Kyoto Prefecture",
          claim: "historical base of Japanese Emperors",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "neutral",
          intensity: 0.5,
          snippet: "Seat of Emperor historically"
        }
      ]
    },
    reddit: {
      text: "[SOURCE:reddit r/travel]\nArrive at Fushimi Inari at 7:00 AM to beat massive crowds. Arashiyama Bamboo Grove is similar.",
      count: 2,
      nodes: [
        {
          place: "Fushimi Inari",
          claim: "gets heavily overcrowded by tour buses by 9:30 AM",
          claimType: "temporal",
          knowledge_type: "volatile",
          conditions: { timeOfDay: "morning" },
          advice: "arrive at 7:00 AM to enjoy crowd-free walk",
          sentiment: "negative",
          intensity: 0.9,
          snippet: "Arrive at Fushimi Inari at 7:00 AM to beat massive crowds"
        },
        {
          place: "Arashiyama Bamboo Grove",
          claim: "highly crowded during normal daylight hours",
          claimType: "temporal",
          knowledge_type: "volatile",
          conditions: {},
          advice: "visit early in morning or late afternoon",
          sentiment: "negative",
          intensity: 0.8,
          snippet: "Arashiyama Bamboo Grove is similar"
        }
      ]
    },
    stackexchange: {
      text: "[SOURCE:stackexchange votes:22]\nKyoto bus is great but gets stuck in cherry blossom traffic. Use train lines.",
      count: 1,
      nodes: [
        {
          place: "Kyoto Bus System",
          claim: "buses get gridlocked during cherry blossom season",
          claimType: "conditional",
          knowledge_type: "volatile",
          conditions: { season: "spring" },
          advice: "use subway and train lines instead of buses during sakura season",
          sentiment: "neutral",
          intensity: 0.7,
          snippet: "gets stuck in cherry blossom traffic"
        }
      ]
    }
  },
  london: {
    wikivoyage: {
      text: "London is the capital of the UK. Sights include British Museum and Tower of London.",
      url: "https://en.wikivoyage.org/wiki/London",
      title: "London",
      nodes: [
        {
          place: "British Museum",
          claim: "world class museum of history and art",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "positive",
          intensity: 0.9,
          snippet: "Sights include British Museum"
        },
        {
          place: "Tower of London",
          claim: "historic castle containing the Crown Jewels",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "positive",
          intensity: 0.8,
          snippet: "Tower of London"
        }
      ]
    },
    wikitravel: {
      text: "Free museums in London! Free access to British Museum, National Gallery.",
      url: "https://wikitravel.org/en/London",
      title: "London",
      nodes: [
        {
          place: "London Museums",
          claim: "most major galleries and museums offer free admission",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "take advantage of free entry to British Museum and National Gallery",
          sentiment: "positive",
          intensity: 0.9,
          snippet: "Free museums in London"
        }
      ]
    },
    wikipedia: {
      text: "London is the capital and largest city of the UK and England.",
      url: "https://en.wikipedia.org/wiki/London",
      title: "London",
      nodes: [
        {
          place: "London",
          claim: "capital and largest metropolitan area of the UK",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "neutral",
          intensity: 0.5,
          snippet: "capital and largest city of the UK"
        }
      ]
    },
    reddit: {
      text: "[SOURCE:reddit r/travel]\nBook a free timed entry slot for the British Museum online. Don't use Oyster cards, just tap contactless.",
      count: 2,
      nodes: [
        {
          place: "British Museum",
          claim: "requires booking a free entry ticket online to avoid giant lines",
          claimType: "conditional",
          knowledge_type: "volatile",
          conditions: {},
          advice: "book a free timed entry slot online in advance",
          sentiment: "positive",
          intensity: 0.7,
          snippet: "Book a free timed entry slot for the British Museum"
        },
        {
          place: "London Tube",
          claim: "contactless payments are easier and same price as Oyster cards",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "tap contactless card or phone instead of buying Oyster card",
          sentiment: "positive",
          intensity: 0.8,
          snippet: "Don't use Oyster cards, just tap contactless"
        }
      ]
    },
    stackexchange: {
      text: "[SOURCE:stackexchange votes:18]\nHeathrow Terminal 5 can have very long queues. Arrive 3 hours early for international departures.",
      count: 1,
      nodes: [
        {
          place: "Heathrow Airport",
          claim: "security queues can be extremely slow at Terminal 5",
          claimType: "temporal",
          knowledge_type: "volatile",
          conditions: { travelerType: "international" },
          advice: "arrive 3 hours prior to departure",
          sentiment: "neutral",
          intensity: 0.7,
          snippet: "Arrive 3 hours early for international departures"
        }
      ]
    }
  },
  paris: {
    wikivoyage: {
      text: "Paris, capital of France, features Eiffel Tower and Louvre museum.",
      url: "https://en.wikivoyage.org/wiki/Paris",
      title: "Paris",
      nodes: [
        {
          place: "Eiffel Tower",
          claim: "iconic historic landmark monument of Paris",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "positive",
          intensity: 0.9,
          snippet: "features Eiffel Tower"
        },
        {
          place: "Louvre Museum",
          claim: "vast art museum holding world class collections",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "positive",
          intensity: 0.9,
          snippet: "Louvre museum"
        }
      ]
    },
    wikitravel: {
      text: "Metro is great. Beware bracelet scammers near Sacre-Coeur.",
      url: "https://wikitravel.org/en/Paris",
      title: "Paris",
      nodes: [
        {
          place: "Sacre-Coeur",
          claim: "friendship bracelet scammers target tourists near entrance",
          claimType: "conditional",
          knowledge_type: "volatile",
          conditions: {},
          advice: "avoid street vendors trying to tie threads to your wrist",
          sentiment: "negative",
          intensity: 0.8,
          snippet: "Beware bracelet scammers near Sacre-Coeur"
        }
      ]
    },
    wikipedia: {
      text: "Paris is the capital of France. Set on the river Seine.",
      url: "https://en.wikipedia.org/wiki/Paris",
      title: "Paris",
      nodes: [
        {
          place: "Paris",
          claim: "capital and main hub of France",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "neutral",
          intensity: 0.5,
          snippet: "capital of France"
        }
      ]
    },
    reddit: {
      text: "[SOURCE:reddit r/travel]\nBook Eiffel Tower summit tickets 60 days early. Enter Louvre underground via Carousel to skip lines.",
      count: 2,
      nodes: [
        {
          place: "Eiffel Tower",
          claim: "summit tickets sell out quickly when released",
          claimType: "temporal",
          knowledge_type: "volatile",
          conditions: {},
          advice: "book summit tickets 60 days in advance online",
          sentiment: "positive",
          intensity: 0.8,
          snippet: "Book Eiffel Tower summit tickets 60 days early"
        },
        {
          place: "Louvre Museum",
          claim: "main pyramid entrance has long security queues",
          claimType: "conditional",
          knowledge_type: "volatile",
          conditions: {},
          advice: "use Carousel du Louvre underground entrance to skip queues",
          sentiment: "positive",
          intensity: 0.8,
          snippet: "Enter Louvre underground via Carousel"
        }
      ]
    },
    stackexchange: {
      text: "[SOURCE:stackexchange votes:12]\nMetro is safe but watch your bags closely on Line 1.",
      count: 1,
      nodes: [
        {
          place: "Paris Metro Line 1",
          claim: "pickpockets operate on crowded subway trains",
          claimType: "conditional",
          knowledge_type: "volatile",
          conditions: {},
          advice: "keep bag zipped and in front of you",
          sentiment: "neutral",
          intensity: 0.7,
          snippet: "watch your bags closely on Line 1"
        }
      ]
    }
  },
  tokyo: {
    wikivoyage: {
      text: "Tokyo is Japan's capital. Famous for Shibuya Crossing and Akihabara.",
      url: "https://en.wikivoyage.org/wiki/Tokyo",
      title: "Tokyo",
      nodes: [
        {
          place: "Shibuya Crossing",
          claim: "world famous pedestrian scramble crossing",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "positive",
          intensity: 0.8,
          snippet: "Shibuya Crossing"
        }
      ]
    },
    wikitravel: {
      text: "Get a digital Suica card. Small ramen shops only take cash.",
      url: "https://wikitravel.org/en/Tokyo",
      title: "Tokyo",
      nodes: [
        {
          place: "Tokyo Transport",
          claim: "Suica and Pasmo cards make train boarding instant",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "add a digital Suica card to Apple Wallet/Google Wallet",
          sentiment: "positive",
          intensity: 0.9,
          snippet: "Get a digital Suica card"
        }
      ]
    },
    wikipedia: {
      text: "Tokyo is the capital of Japan and its largest metropolitan area.",
      url: "https://en.wikipedia.org/wiki/Tokyo",
      title: "Tokyo",
      nodes: []
    },
    reddit: {
      text: "[SOURCE:reddit r/travel]\nGo to Starbucks Tsutaya for Shibuya Crossing photo. Restaurants need cash.",
      count: 2,
      nodes: [
        {
          place: "Shibuya Crossing",
          claim: "Starbucks Tsutaya floor 2 offers great aerial view of intersection",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "go to Starbucks or Shibuya Sky for crossing photo",
          sentiment: "positive",
          intensity: 0.7,
          snippet: "Go to Starbucks Tsutaya for Shibuya Crossing photo"
        },
        {
          place: "Tokyo Restaurants",
          claim: "many local ramen ticket machines accept cash only",
          claimType: "conditional",
          knowledge_type: "volatile",
          conditions: {},
          advice: "carry physical cash Yen bills and coins",
          sentiment: "neutral",
          intensity: 0.7,
          snippet: "Restaurants need cash"
        }
      ]
    },
    stackexchange: {
      text: "[SOURCE:stackexchange votes:35]\nNarita Express to Shinjuku or Keisei Skyliner to Ueno.",
      count: 1,
      nodes: [
        {
          place: "Narita Express",
          claim: "comfortable direct train option from Narita to Shinjuku",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "use NEX to Shinjuku, or Keisei Skyliner if heading to Ueno",
          sentiment: "positive",
          intensity: 0.8,
          snippet: "Narita Express to Shinjuku or Keisei Skyliner to Ueno"
        }
      ]
    }
  },
  rome: {
    wikivoyage: {
      text: "Rome features ruins like Colosseum and Pantheon.",
      url: "https://en.wikivoyage.org/wiki/Rome",
      title: "Rome",
      nodes: [
        {
          place: "Colosseum",
          claim: "iconic ancient amphitheater of Roman Empire",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "positive",
          intensity: 0.9,
          snippet: "features ruins like Colosseum"
        }
      ]
    },
    wikitravel: {
      text: "Rome is the Eternal City. Water is free at public fountains (nasoni).",
      url: "https://wikitravel.org/en/Rome",
      title: "Rome",
      nodes: [
        {
          place: "Rome Fountains",
          claim: "cold fresh drinking water is free from street fountains",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "bring a reusable bottle and refill at nasoni fountains",
          sentiment: "positive",
          intensity: 0.9,
          snippet: "Water is free at public fountains (nasoni)"
        }
      ]
    },
    wikipedia: {
      text: "Rome is the capital of Italy and Lazio region.",
      url: "https://en.wikipedia.org/wiki/Rome",
      title: "Rome",
      nodes: []
    },
    reddit: {
      text: "[SOURCE:reddit r/travel]\nBuy Colosseum tickets 30 days early. Avoid restaurants with pictures.",
      count: 2,
      nodes: [
        {
          place: "Colosseum",
          claim: "tickets on official website sell out in minutes",
          claimType: "temporal",
          knowledge_type: "volatile",
          conditions: {},
          advice: "check official tickets site exactly 30 days early or book tour",
          sentiment: "negative",
          intensity: 0.8,
          snippet: "Buy Colosseum tickets 30 days early"
        },
        {
          place: "Rome Dining",
          claim: "restaurants immediately next to sights are tourist traps",
          claimType: "conditional",
          knowledge_type: "volatile",
          conditions: {},
          advice: "avoid places with picture menus and hosts outside, walk 2 blocks away",
          sentiment: "negative",
          intensity: 0.8,
          snippet: "Avoid restaurants with pictures"
        }
      ]
    },
    stackexchange: {
      text: "[SOURCE:stackexchange votes:28]\nVatican has strict dress code: knees and shoulders covered.",
      count: 1,
      nodes: [
        {
          place: "Vatican Museum",
          claim: "security will deny entry if dress code is violated",
          claimType: "conditional",
          knowledge_type: "stable",
          conditions: {},
          advice: "ensure knees and shoulders are covered before entering",
          sentiment: "neutral",
          intensity: 0.8,
          snippet: "strict dress code: knees and shoulders covered"
        }
      ]
    }
  },
  new_york: {
    wikivoyage: {
      text: "New York features Central Park, Empire State, Times Square.",
      url: "https://en.wikivoyage.org/wiki/New_York_City",
      title: "New York City",
      nodes: [
        {
          place: "Central Park",
          claim: "beautiful massive public park in center of Manhattan",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "positive",
          intensity: 0.9,
          snippet: "features Central Park"
        }
      ]
    },
    wikitravel: {
      text: "Use OMNY to pay subway fare. Tap phone or bank card.",
      url: "https://wikitravel.org/en/New_York_City",
      title: "New York City",
      nodes: [
        {
          place: "NYC Subway",
          claim: "OMNY readers accept credit cards directly",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "tap contactless card or mobile wallet at turnstiles to pay",
          sentiment: "positive",
          intensity: 0.9,
          snippet: "Use OMNY to pay subway fare"
        }
      ]
    },
    wikipedia: {
      text: "New York City is the most populous city in the USA.",
      url: "https://en.wikipedia.org/wiki/New_York_City",
      title: "New York City",
      nodes: []
    },
    reddit: {
      text: "[SOURCE:reddit r/travel]\nTKTS booth in Times Square has 50% discount Broadway tickets.",
      count: 1,
      nodes: [
        {
          place: "Broadway Tickets",
          claim: "TKTS booth sells discounted same-day show tickets",
          claimType: "conditional",
          knowledge_type: "volatile",
          conditions: {},
          advice: "visit TKTS booth in Times Square or use TodayTix app",
          sentiment: "positive",
          intensity: 0.8,
          snippet: "TKTS booth in Times Square has 50% discount"
        }
      ]
    },
    stackexchange: {
      text: "[SOURCE:stackexchange votes:42]\nJFK AirTrain to Jamaica and LIRR to Penn Station is fastest.",
      count: 1,
      nodes: [
        {
          place: "JFK Airport Transfer",
          claim: "AirTrain combined with LIRR train is fastest route into town",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "take AirTrain to Jamaica and transfer to LIRR to Penn Station",
          sentiment: "positive",
          intensity: 0.9,
          snippet: "JFK AirTrain to Jamaica and LIRR to Penn Station is fastest"
        }
      ]
    }
  },
  prague: {
    wikivoyage: {
      text: "Prague features Charles Bridge and Prague Castle.",
      url: "https://en.wikivoyage.org/wiki/Prague",
      title: "Prague",
      nodes: [
        {
          place: "Charles Bridge",
          claim: "historic stone bridge across Vltava river",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "positive",
          intensity: 0.9,
          snippet: "features Charles Bridge"
        }
      ]
    },
    wikitravel: {
      text: "Avoid street money exchange. High commission fees.",
      url: "https://wikitravel.org/en/Prague",
      title: "Prague",
      nodes: [
        {
          place: "Money Exchange",
          claim: "street currency booths scam tourists with hidden fees",
          claimType: "conditional",
          knowledge_type: "volatile",
          conditions: {},
          advice: "only use official ATMs or card payments for Czech Koruna",
          sentiment: "negative",
          intensity: 0.9,
          snippet: "Avoid street money exchange"
        }
      ]
    },
    wikipedia: {
      text: "Prague is the capital of the Czech Republic.",
      url: "https://en.wikipedia.org/wiki/Prague",
      title: "Prague",
      nodes: []
    },
    reddit: {
      text: "[SOURCE:reddit r/travel]\nTrdelnik is tourist trap, drink Pilsner Urquell at Lokal. Walk bridge at sunrise.",
      count: 2,
      nodes: [
        {
          place: "Trdelnik Pastry",
          claim: "chimney cakes are not authentic Czech food",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "go to Lokal restaurant for real Czech beer and snacks instead",
          sentiment: "neutral",
          intensity: 0.5,
          snippet: "Trdelnik is tourist trap"
        },
        {
          place: "Charles Bridge",
          claim: "bridge is extremely packed during the day",
          claimType: "temporal",
          knowledge_type: "volatile",
          conditions: {},
          advice: "walk the bridge at sunrise or late night to enjoy it",
          sentiment: "negative",
          intensity: 0.8,
          snippet: "Walk bridge at sunrise"
        }
      ]
    },
    stackexchange: {
      text: "[SOURCE:stackexchange votes:14]\nYou must validate yellow transit tickets or get fined.",
      count: 1,
      nodes: [
        {
          place: "Prague Public Transport",
          claim: "unvalidated tickets lead to large fines from inspectors",
          claimType: "conditional",
          knowledge_type: "volatile",
          conditions: {},
          advice: "always stamp your yellow ticket in validation machine upon boarding",
          sentiment: "negative",
          intensity: 0.8,
          snippet: "validate yellow transit tickets or get fined"
        }
      ]
    }
  },
  amsterdam: {
    wikivoyage: {
      text: "Amsterdam is the capital. Sights: Rijksmuseum and Van Gogh Museum.",
      url: "https://en.wikivoyage.org/wiki/Amsterdam",
      title: "Amsterdam",
      nodes: [
        {
          place: "Rijksmuseum",
          claim: "stunning Dutch national history and art museum",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "positive",
          intensity: 0.9,
          snippet: "Sights: Rijksmuseum"
        }
      ]
    },
    wikitravel: {
      text: "Watch out for tram tracks when cycling. Book Anne Frank House months early.",
      url: "https://wikitravel.org/en/Amsterdam",
      title: "Amsterdam",
      nodes: [
        {
          place: "Bicycle Renting",
          claim: "tram tracks can catch bicycle tires causing crashes",
          claimType: "conditional",
          knowledge_type: "volatile",
          conditions: {},
          advice: "cross tram tracks at a wide angle",
          sentiment: "neutral",
          intensity: 0.7,
          snippet: "Watch out for tram tracks when cycling"
        }
      ]
    },
    wikipedia: {
      text: "Amsterdam is the capital of the Netherlands.",
      url: "https://en.wikipedia.org/wiki/Amsterdam",
      title: "Amsterdam",
      nodes: []
    },
    reddit: {
      text: "[SOURCE:reddit r/travel]\nAnne Frank tickets release Tuesdays 10 AM. Stay out of red bike lanes.",
      count: 2,
      nodes: [
        {
          place: "Anne Frank House",
          claim: "tickets sell out instantly upon release",
          claimType: "temporal",
          knowledge_type: "volatile",
          conditions: {},
          advice: "buy tickets online on Tuesday at 10 AM local time for following week",
          sentiment: "positive",
          intensity: 0.7,
          snippet: "Anne Frank tickets release Tuesdays 10 AM"
        },
        {
          place: "Amsterdam Bike Lanes",
          claim: "cyclists ride fast and will crash into pedestrians in their lanes",
          claimType: "conditional",
          knowledge_type: "volatile",
          conditions: {},
          advice: "do not stand or walk on red painted bike lanes",
          sentiment: "negative",
          intensity: 0.8,
          snippet: "Stay out of red bike lanes"
        }
      ]
    },
    stackexchange: {
      text: "[SOURCE:stackexchange votes:20]\nUse OVpay to tap contactless bank card directly on trams.",
      count: 1,
      nodes: [
        {
          place: "Amsterdam Public Transport",
          claim: "OVpay system lets you tap bank card directly",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "use your phone or debit card to tap on/off trams and buses",
          sentiment: "positive",
          intensity: 0.9,
          snippet: "Use OVpay to tap contactless bank card"
        }
      ]
    }
  },
  sydney: {
    wikivoyage: {
      text: "Sydney features Opera House, Harbour Bridge, Bondi Beach.",
      url: "https://en.wikivoyage.org/wiki/Sydney",
      title: "Sydney",
      nodes: [
        {
          place: "Sydney Opera House",
          claim: "iconic sail shaped performing arts center on harbour",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: null,
          sentiment: "positive",
          intensity: 0.9,
          snippet: "features Opera House"
        }
      ]
    },
    wikitravel: {
      text: "Ferries are scenic and cheap. Take Manly ferry from Circular Quay.",
      url: "https://wikitravel.org/en/Sydney",
      title: "Sydney",
      nodes: [
        {
          place: "Manly Ferry",
          claim: "ferry ride offers stunning harbour views for cheap",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "take Manly ferry from Circular Quay instead of expensive cruise",
          sentiment: "positive",
          intensity: 0.9,
          snippet: "Take Manly ferry from Circular Quay"
        }
      ]
    },
    wikipedia: {
      text: "Sydney is the state capital of New South Wales.",
      url: "https://en.wikipedia.org/wiki/Sydney",
      title: "Sydney",
      nodes: []
    },
    reddit: {
      text: "[SOURCE:reddit r/travel]\nBondi to Coogee walk is beautiful. Bring sunscreen. Tap contactless for transport.",
      count: 2,
      nodes: [
        {
          place: "Bondi to Coogee Walk",
          claim: "scenic cliffside walk connects several beaches",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "do the coastal walk and wear plenty of sunscreen",
          sentiment: "positive",
          intensity: 0.9,
          snippet: "Bondi to Coogee walk is beautiful"
        },
        {
          place: "Sydney Transit",
          claim: "bank cards work for tap payment on all transit",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "tap contactless card directly on trains and ferries",
          sentiment: "positive",
          intensity: 0.8,
          snippet: "Tap contactless for transport"
        }
      ]
    },
    stackexchange: {
      text: "[SOURCE:stackexchange votes:10]\nCircular Quay to Opera House is 10-minute flat walk.",
      count: 1,
      nodes: [
        {
          place: "Sydney Opera House",
          claim: "very close proximity to Circular Quay station",
          claimType: "evaluation",
          knowledge_type: "stable",
          conditions: {},
          advice: "walk 10 minutes along the flat harbour promenade",
          sentiment: "positive",
          intensity: 0.8,
          snippet: "Circular Quay to Opera House is 10-minute flat walk"
        }
      ]
    }
  }
};

// Also copy to variants
data.newyork = data.new_york;
data.new_york_city = data.new_york;

Object.entries(data).forEach(([city, content]) => {
  const filePath = path.resolve(targetDir, `${city}.json`);
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
  console.log(`Generated ${filePath}`);
});

console.log("All preprocessed data successfully written!");
