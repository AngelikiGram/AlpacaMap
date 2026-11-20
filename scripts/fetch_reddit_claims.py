"""
fetch_reddit_claims.py
=======================
Fetches real Reddit posts/comments for a city via the PullPush archive API
(the same public, no-auth API the app's src/components/panel/KnowledgePanel.jsx
fetchRedditViaPullPush() uses), and runs real VADER sentiment classification
on the retained text — no placeholder or synthetic data.

This exists because the London case-study KG export (kg_London_2026-07-07.json)
returned zero Reddit claims for that run (PullPush likely rate-limited or the
in-app query came back empty that day), so the paper's per-source sentiment
figure was missing a real Reddit bar. This script gets one.

Usage:
  python scripts/fetch_reddit_claims.py --city london --subreddit london --out validation/reddit_london.json

Dependencies:
  pip install requests nltk
"""
import argparse
import json
import re
import sys
import time

import requests

try:
    from nltk.sentiment import SentimentIntensityAnalyzer
    import nltk
    try:
        SIA = SentimentIntensityAnalyzer()
    except LookupError:
        nltk.download("vader_lexicon", quiet=True)
        SIA = SentimentIntensityAnalyzer()
except ImportError:
    print("ERROR: nltk not found. Run: pip install nltk"); sys.exit(1)

PULLPUSH_BASE = "https://api.pullpush.io"
CITY_QUERIES = ["travel tips", "things to do", "avoid", "worth it", "recommend", "scam", "best time to visit"]
MIN_SCORE = 5
CUE_RE = re.compile(
    r"\b(should|must|avoid|recommend|book|ticket|price|fee|hour|time|scam|trap|crowd|"
    r"watch|keep|always|never|free|visit|see|go|walk|travel|trip|station|line|great|"
    r"good|best|love|amazing|wonderful|nice|fantastic|awesome|beautiful|perfect|"
    r"delicious|tasty|worth|favorite|favourite|bad|worst|terrible|awful|expensive|"
    r"overpriced|cheap|buy|eat|drink)\b", re.I)


def fetch_submissions(subreddit, query, size=100):
    url = f"{PULLPUSH_BASE}/reddit/search/submission/?q={requests.utils.quote(query)}&subreddit={subreddit}&sort=score&size={size}"
    for attempt in range(5):
        try:
            r = requests.get(url, timeout=20)
            if r.status_code == 429:
                sleep_time = 15 + attempt * 15
                print(f"  [429] Rate limited on q='{query}', sleeping {sleep_time}s and retrying (attempt {attempt+1}/5)...")
                time.sleep(sleep_time)
                continue
            if r.status_code != 200:
                print(f"  [{r.status_code}] q='{query}'"); return []
            data = r.json().get("data", [])
            return data
        except Exception as e:
            print(f"  error q='{query}': {e}")
            time.sleep(5)
    return []


def sentence_split(text):
    text = re.sub(r"\s+", " ", text or "").strip()
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def to_claims(posts, city, min_score=MIN_SCORE):
    claims = []
    seen = set()
    for p in posts:
        score = p.get("score", 0) or 0
        if score < min_score:
            continue
        title = p.get("title", "") or ""
        body = p.get("selftext", "") or ""
        created = p.get("created_utc")
        date_str = time.strftime("%Y-%m-%d", time.gmtime(created)) if created else None
        url = f"https://reddit.com{p.get('permalink', '')}" if p.get("permalink") else p.get("url", "")

        for sent in sentence_split(title) + sentence_split(body):
            if len(sent) < 15 or len(sent) > 350:
                continue
            if not CUE_RE.search(sent):
                continue
            key = sent.lower()
            if key in seen:
                continue
            seen.add(key)

            vs = SIA.polarity_scores(sent)
            compound = vs["compound"]
            sentiment = "positive" if compound >= 0.05 else "negative" if compound <= -0.05 else "neutral"

            claims.append({
                "place": city,
                "claim": sent,
                "claimType": "evaluation",
                "knowledge_type": "volatile",
                "sentiment": sentiment,
                "credibility": round(min(1.0, 0.65 + min(0.25, 0.08 * min(score // 5, 3))), 2),
                "sourceType": "reddit",
                "date": date_str,
                "url": url,
            })
    return claims


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--city", required=True)
    parser.add_argument("--subreddit", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--size", type=int, default=100)
    args = parser.parse_args()

    all_posts = []
    for q in CITY_QUERIES:
        posts = fetch_submissions(args.subreddit, q, size=args.size)
        print(f"  r/{args.subreddit} q='{q}' -> {len(posts)} submissions")
        all_posts.extend(posts)
        time.sleep(5.0)  # be polite to the free archive API

    # De-dupe by post id
    by_id = {p.get("id"): p for p in all_posts if p.get("id")}
    print(f"\nFetched {len(by_id)} unique submissions from r/{args.subreddit}")

    claims = to_claims(list(by_id.values()), args.city)
    print(f"Extracted {len(claims)} candidate claim sentences (score>={MIN_SCORE})")

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(claims, f, indent=2)
    print(f"Written -> {args.out}")
