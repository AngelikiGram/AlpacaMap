"""Correct answers for T2 and T3, computed from the app's data with the app's own score."""
import json
import os
import re
from collections import defaultdict

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CITIES = ['paris', 'rome']
SPLIT = 0.4          # src/knowledge/controversy.js: "opinions split" from this score
NEAR_SPLIT = 0.3     # T3: "mixed" is also accepted from this score
T3_TOPIC = 'Safety & Health'


def split_score(nodes):
    """Same formula as controversyScore() for evidence without verified pairs."""
    pos = sum((n.get('evaluation') or {}).get('sentiment') == 'positive' for n in nodes)
    neg = sum((n.get('evaluation') or {}).get('sentiment') == 'negative' for n in nodes)
    sources = {n['source']['sourceType'] for n in nodes}
    opinionated = pos + neg
    if not opinionated:
        return 0.05, pos, neg
    minority = min(pos, neg) / opinionated
    score = 0.08 + minority * 1.3 * min(1, opinionated / 6) * (1 if len(sources) >= 2 else 0.5)
    return min(1, score), pos, neg


def load_nodes(city):
    with open(os.path.join(REPO, 'public', 'preprocessed', f'{city}.json'), encoding='utf-8') as f:
        return json.load(f)['nodes']


def contested(city):
    """Topics and places shown as "opinions split" (at least 3 statements). Same data in both conditions."""
    groups = defaultdict(list)
    for n in load_nodes(city):
        groups[n['place']].append(n)
    return sorted(p for p, ns in groups.items() if len(ns) >= 3 and split_score(ns)[0] >= SPLIT)


def t3_expected(city):
    """Correct T3 verdict for the claim "{city} is not safe for tourists"."""
    nodes = [n for n in load_nodes(city) if n['place'].endswith(T3_TOPIC)]
    score, pos, neg = split_score(nodes)
    if len(nodes) < 3:
        verdict = 'no information'
    elif score >= SPLIT:
        verdict = 'mixed'
    else:
        verdict = 'agree' if neg > pos else 'disagree'
    return {'verdict': verdict, 'pos': pos, 'neg': neg, 'score': score}


def t3_correct(answer, expected):
    if answer == expected['verdict']:
        return 1
    return int(answer == 'mixed' and expected['score'] >= NEAR_SPLIT)


def _keywords(topic):
    name = topic.split('·', 1)[-1].strip().lower()
    return {w for w in re.split(r'[^a-zà-ÿ]+', name) if len(w) > 3} | {name}


def match_topics(text, topics):
    text = (text or '').lower()
    return sorted(t for t in topics if any(re.search(rf'\b{re.escape(k)}\b', text) for k in _keywords(t)))
