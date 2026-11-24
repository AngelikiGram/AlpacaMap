"""
train_nlp.py
============
Generates src/data/nlp_data.json used by KnowledgePanel.jsx.
ALL data is fetched live from the internet, nothing is hardcoded.

Sources used:
  - NLTK Brown corpus         → entityCommonWords, heuristicCommon
  - NLTK VADER lexicon        → sentimentDictionary
  - Wikivoyage public API     → trainingData (10 travel categories)
  - Wikitravel public API     → trainingData supplement (fallback)

Usage:
  python scripts/train_nlp.py                        # full run, 50 cities
  python scripts/train_nlp.py --cities 80            # fetch more cities
  python scripts/train_nlp.py --cities 20            # faster, fewer cities

Output: src/data/nlp_data.json

Dependencies:
  pip install nltk requests
"""

import json
import re
import os
import sys
import time
import random
import argparse
import urllib.request
import urllib.parse
from collections import Counter, defaultdict

# ── NLTK bootstrap ────────────────────────────────────────────────────────────
try:
    import nltk
except ImportError:
    print("ERROR: nltk not found. Run:  pip install nltk requests")
    sys.exit(1)

def ensure_nltk(*datasets):
    for ds in datasets:
        try:
            nltk.data.find(ds)
        except LookupError:
            print(f"  Downloading NLTK dataset: {ds} ...")
            nltk.download(ds.split("/")[-1], quiet=True)

ensure_nltk("corpora/brown", "corpora/stopwords", "sentiment/vader_lexicon")

from nltk.corpus import brown, stopwords
from nltk.sentiment.vader import SentimentIntensityAnalyzer

# ── Paths ─────────────────────────────────────────────────────────────────────
OUTPUT_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "src", "data", "nlp_data.json")
)

# ── Large pool of well-documented Wikivoyage cities ──────────────────────────
# Script shuffles this and fetches until target_per_class is reached or pool exhausted.
CITY_POOL = [
    # Europe
    "London", "Paris", "Rome", "Berlin", "Barcelona", "Amsterdam",
    "Prague", "Vienna", "Lisbon", "Budapest", "Copenhagen", "Stockholm",
    "Athens", "Warsaw", "Brussels", "Zurich", "Milan", "Edinburgh",
    "Dublin", "Helsinki", "Oslo", "Krakow", "Bruges", "Seville",
    "Florence", "Venice", "Lyon", "Marseille", "Porto", "Ljubljana",
    "Tallinn", "Riga", "Vilnius", "Bratislava", "Valletta", "Reykjavik",
    "Sarajevo", "Sofia", "Bucharest", "Belgrade", "Zagreb",
    # Asia
    "Tokyo", "Bangkok", "Singapore", "Seoul", "Kyoto", "Shanghai",
    "Hong Kong", "Kuala Lumpur", "Bali", "Hanoi", "Ho Chi Minh City",
    "Osaka", "Beijing", "Taipei", "Jakarta", "Mumbai", "Delhi",
    "Kathmandu", "Colombo", "Yangon", "Phnom Penh", "Vientiane",
    "Ulaanbaatar", "Almaty", "Tashkent", "Tbilisi", "Yerevan", "Baku",
    # Middle East & Africa
    "Dubai", "Istanbul", "Cairo", "Marrakech", "Nairobi", "Cape Town",
    "Casablanca", "Tunis", "Amman", "Beirut", "Tel Aviv", "Jerusalem",
    "Muscat", "Doha", "Accra", "Addis Ababa",
    # Americas
    "New York City", "San Francisco", "New Orleans", "Chicago", "Miami",
    "Los Angeles", "Vancouver", "Toronto", "Montreal", "Mexico City",
    "Buenos Aires", "Lima", "Bogota", "Rio de Janeiro", "São Paulo",
    "Santiago", "Havana", "Cusco", "Cartagena", "Quito",
    # Oceania & Pacific
    "Sydney", "Melbourne", "Auckland", "Wellington", "Queenstown",
    "Christchurch", "Honolulu", "Fiji",
]

# ── Wikivoyage section heading → training class ───────────────────────────────
SECTION_CLASS_MAP = {
    # Accommodation
    "sleep": "Accommodation",
    "accommodation": "Accommodation",
    "lodging": "Accommodation",
    "where to sleep": "Accommodation",
    "hotels": "Accommodation",
    "hostels": "Accommodation",
    "camping": "Accommodation",
    # Food & Drink
    "eat": "Food & Drink",
    "drink": "Food & Drink",
    "food": "Food & Drink",
    "dining": "Food & Drink",
    "restaurants": "Food & Drink",
    "nightlife": "Food & Drink",
    "bars": "Food & Drink",
    "cafes": "Food & Drink",
    # Transport
    "get around": "Transport",
    "get in": "Transport",
    "get out": "Transport",
    "by bus": "Transport",
    "by train": "Transport",
    "by metro": "Transport",
    "by taxi": "Transport",
    "by car": "Transport",
    "by ferry": "Transport",
    "by bicycle": "Transport",
    "transport": "Transport",
    "getting around": "Transport",
    "getting there": "Transport",
    "public transport": "Transport",
    # Safety & Health
    "stay safe": "Safety & Health",
    "safety": "Safety & Health",
    "health": "Safety & Health",
    "dangers": "Safety & Health",
    "risks": "Safety & Health",
    "crime": "Safety & Health",
    "emergencies": "Safety & Health",
    "stay healthy": "Safety & Health",
    "be safe": "Safety & Health",
    # Climate
    "climate": "Climate",
    "weather": "Climate",
    "when to go": "Climate",
    "seasons": "Climate",
    "best time to visit": "Climate",
    "best time": "Climate",
    # Culture
    "see": "Culture",
    "do": "Culture",
    "culture": "Culture",
    "arts": "Culture",
    "museums": "Culture",
    "attractions": "Culture",
    "sights": "Culture",
    "landmarks": "Culture",
    "events": "Culture",
    "festivals": "Culture",
    "entertainment": "Culture",
    # History
    "history": "History",
    "background": "History",
    "understand": "History",
    "historical": "History",
    "heritage": "History",
    # Shopping
    "buy": "Shopping",
    "shop": "Shopping",
    "shopping": "Shopping",
    "markets": "Shopping",
    "souvenirs": "Shopping",
    "retail": "Shopping",
    # Districts
    "districts": "Districts",
    "neighbourhoods": "Districts",
    "neighborhoods": "Districts",
    "areas": "Districts",
    "quarters": "Districts",
    "boroughs": "Districts",
    "regions": "Districts",
    "zones": "Districts",
    # Travel Tips
    "cope": "Travel Tips",
    "connect": "Travel Tips",
    "tips": "Travel Tips",
    "practical": "Travel Tips",
    "advice": "Travel Tips",
    "money": "Travel Tips",
    "costs": "Travel Tips",
    "budget": "Travel Tips",
    "visas": "Travel Tips",
    "etiquette": "Travel Tips",
    "currency": "Travel Tips",
    "communication": "Travel Tips",
    "language": "Travel Tips",
    "electricity": "Travel Tips",
    "tipping": "Travel Tips",
}

ALL_CLASSES = [
    "Accommodation", "Climate", "Culture", "Districts",
    "Food & Drink", "History", "Safety & Health", "Shopping",
    "Transport", "Travel Tips",
]

TARGET_PER_CLASS = 200
MIN_SENT = 45
MAX_SENT = 280


# ── Text utilities ────────────────────────────────────────────────────────────

def clean(text):
    text = re.sub(r"<listing\b[^>]*>.*?</listing>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<listing\b[^>]*/?>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\[\[(?:Image|File|Media):[^\]]*?\]\]", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\[\[[^\]|]*\|([^\]]*)\]\]", r"\1", text)
    text = re.sub(r"\[\[([^\]]*)\]\]", r"\1", text)
    text = re.sub(r"\{\{[^}]*\}\}", "", text)
    text = re.sub(r"\|[^|\[\]]*\]\]", "", text)
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-z#0-9]+;", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def sentences(text):
    raw = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in raw if MIN_SENT <= len(s.strip()) <= MAX_SENT]


def parse_sections(wikitext):
    """Returns [(heading_lower, body_text), ...]."""
    parts = re.split(r"(==+\s*.+?\s*==+)", wikitext)
    result = []
    heading = "__intro__"
    buf = []
    for part in parts:
        m = re.match(r"==+\s*(.+?)\s*==+", part)
        if m:
            if buf:
                result.append((heading, clean(" ".join(buf))))
            heading = m.group(1).lower().strip()
            buf = []
        else:
            buf.append(part)
    if buf:
        result.append((heading, clean(" ".join(buf))))
    return result


def heading_to_class(heading):
    for key, cls in SECTION_CLASS_MAP.items():
        if key in heading:
            return cls
    return None


# ── Wikivoyage API ────────────────────────────────────────────────────────────

_UA = "TravelPlannerNLP/1.0 (research; python-urllib) train_nlp.py"


def _get(url, timeout=14, retries=3):
    """GET with User-Agent header and exponential backoff on 429."""
    req = urllib.request.Request(url, headers={"User-Agent": _UA})
    delay = 2.0
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = delay * (2 ** attempt)
                print(f" [429, waiting {wait:.0f}s]", end="", flush=True)
                time.sleep(wait)
            else:
                raise
    raise RuntimeError(f"Failed after {retries} retries (429)")


def wikivoyage_wikitext(title):
    params = urllib.parse.urlencode({
        "action": "query", "titles": title,
        "prop": "revisions", "rvprop": "content",
        "format": "json", "origin": "*",
    })
    try:
        data = _get(f"https://en.wikivoyage.org/w/api.php?{params}")
        page = next(iter(data["query"]["pages"].values()))
        if "missing" in page:
            return None
        return page["revisions"][0]["*"]
    except Exception as e:
        print(f" [skip: {e}]", end="")
        return None


def wikitravel_wikitext(title):
    params = urllib.parse.urlencode({
        "action": "query", "titles": title,
        "prop": "revisions", "rvprop": "content",
        "format": "json", "origin": "*",
    })
    try:
        data = _get(f"https://wikitravel.org/wiki/en/api.php?{params}")
        page = next(iter(data["query"]["pages"].values()))
        if "missing" in page:
            return None
        return page["revisions"][0]["*"]
    except Exception:
        return None


# ── Training data builder ─────────────────────────────────────────────────────

def fetch_training_data(num_cities):
    """
    Fetches Wikivoyage (and Wikitravel as supplement) for up to num_cities cities.
    Returns {class: [sentence, ...]} with no hardcoded data.
    """
    by_class = defaultdict(list)
    seen = set()
    pool = CITY_POOL[:]
    random.shuffle(pool)
    pool = pool[:num_cities]

    print(f"  Fetching training data from {len(pool)} cities (Wikivoyage + Wikitravel)...")

    for city in pool:
        # Try Wikivoyage first, then Wikitravel as supplement
        for fetcher, label in [(wikivoyage_wikitext, "WV"), (wikitravel_wikitext, "WT")]:
            print(f"    {city} [{label}]...", end=" ", flush=True)
            wikitext = fetcher(city)
            if not wikitext:
                print("not found")
                continue

            city_count = 0
            for heading, text in parse_sections(wikitext):
                cls = heading_to_class(heading)
                if not cls:
                    continue
                for sent in sentences(text):
                    key = re.sub(r"\s+", " ", sent.lower())[:100]
                    if key in seen:
                        continue
                    seen.add(key)
                    by_class[cls].append(sent)
                    city_count += 1
            print(f"{city_count} sentences")
            time.sleep(1.2)

            # Once we have enough for all classes from Wikivoyage, skip Wikitravel
            if all(len(by_class[c]) >= TARGET_PER_CLASS for c in ALL_CLASSES):
                break

        if all(len(by_class[c]) >= TARGET_PER_CLASS for c in ALL_CLASSES):
            print("  All classes at target, stopping early.")
            break

    # Report coverage
    for cls in ALL_CLASSES:
        n = len(by_class[cls])
        status = "✓" if n >= TARGET_PER_CLASS else f"⚠ only {n}"
        print(f"    {cls:20s}: {n} sentences {status}")

    return by_class


def build_training_records(by_class):
    records = []
    for cls in ALL_CLASSES:
        examples = by_class.get(cls, [])
        for text in examples[:TARGET_PER_CLASS]:
            records.append({"text": text, "class": cls})
    return records


# ── Word lists from Brown corpus ─────────────────────────────────────────────

def build_entity_common_words(target=2450):
    print("  Building entityCommonWords from Brown corpus ...")
    freq = Counter(w.lower() for w in brown.words() if w.isalpha() and len(w) > 1)
    sw = set(stopwords.words("english"))
    pool = sorted(
        (w for w, _ in sorted(freq.items(), key=lambda x: -x[1]) if w in sw or freq[w] > 30),
        key=lambda w: (-freq[w], w)
    )
    result = sorted(set(pool[:target]))
    print(f"    → {len(result)} words")
    return result


def build_heuristic_common(entity_common_words, target=850):
    print("  Building heuristicCommon ...")
    freq = Counter(w.lower() for w in brown.words() if w.isalpha())
    ecw = set(entity_common_words)
    ranked = sorted(
        (w for w in ecw if w in freq),
        key=lambda w: -freq[w]
    )[:target]
    result = sorted(ranked)
    print(f"    → {len(result)} words")
    return result


# ── VADER sentiment dictionary ────────────────────────────────────────────────

def build_sentiment_dictionary():
    print("  Building sentimentDictionary from VADER lexicon ...")
    vader = SentimentIntensityAnalyzer()
    lexicon = vader.lexicon
    max_abs = max(abs(v) for v in lexicon.values()) or 1.0
    result = {word: round(score / max_abs, 4) for word, score in lexicon.items()}
    print(f"    → {len(result)} entries")
    return result


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--cities", type=int, default=50,
        help="Number of cities to fetch from Wikivoyage (default: 50)"
    )
    args = parser.parse_args()

    print("\n=== train_nlp.py, building NLP data from live sources ===\n")

    entity_common_words = build_entity_common_words(2450)
    heuristic_common    = build_heuristic_common(entity_common_words, 850)
    sentiment_dict      = build_sentiment_dictionary()

    by_class     = fetch_training_data(args.cities)
    training_data = build_training_records(by_class)

    classes = sorted(set(d["class"] for d in training_data))
    output = {
        "_generated": {
            "by": "scripts/train_nlp.py",
            "sources": [
                "NLTK Brown corpus",
                "NLTK VADER",
                "Wikivoyage API",
                "Wikitravel API",
            ],
            "entityCommonWords_count": len(entity_common_words),
            "heuristicCommon_count":   len(heuristic_common),
            "sentimentDictionary_count": len(sentiment_dict),
            "trainingData_count": len(training_data),
            "classes": classes,
        },
        "entityCommonWords":    entity_common_words,
        "heuristicCommon":      heuristic_common,
        "sentimentDictionary":  sentiment_dict,
        "trainingData":         training_data,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    print(f"\n✓  Written → {OUTPUT_PATH}")
    per_class = Counter(d["class"] for d in training_data)
    for cls in classes:
        print(f"   {cls:20s}: {per_class[cls]}")
    print(f"\n   Total: {len(training_data)} training examples")


if __name__ == "__main__":
    main()
