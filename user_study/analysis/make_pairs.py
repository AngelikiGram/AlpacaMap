#!/usr/bin/env python3
"""Build the fixed set of statement pairs for the RQ4 block (user_study/runner/pairs.json).

Candidates follow the paper's pair rules (analysis/conflict_analysis.py): same place or topic,
different sources, shared aspect, shared content words, not a copy, opposite sentiment.
Statement A is always the statement of the pair's type. Every participant sees the same pairs.

Usage (from travel_planner/):
    python user_study/analysis/make_pairs.py
    python user_study/analysis/make_pairs.py --pick user_study/analysis/pairs_pick.json

All candidates are written to analysis/out/pair_candidates.json for review. To replace the
automatic choice, list pairs per type in a pick file (user_study/analysis/pairs_pick.json). An entry is a
candidate id, or a pair chosen by hand: {"city": "london", "a": "start of claim A", "b": "start of claim B"}.
"a_source" and "b_source" pick one statement when the same text comes from several sources;
"a_text" and "b_text" replace the shown text, e.g. to repair a sentence cut by the extraction.
"""
import argparse
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, 'analysis'))
import conflict_analysis as ca  # noqa: E402

# Cities not used in the tasks, so participants have not seen these statements.
CITIES = ['london', 'edinburgh', 'zurich']
FALLBACK_CITIES = ['paris', 'rome']
TYPES = ['practical', 'evaluative', 'norm']
PER_TYPE = 4

HEADINGS = ('Get around', 'Get in', 'Pricing', 'Fares', 'See', 'Do', 'Buy', 'Eat', 'Drink', 'Sleep', 'Stay safe',
            'Stay healthy', 'Respect', 'Understand', 'Cope', 'Connect', 'By bus', 'By train', 'By taxi')
HEADING_RE = re.compile(r'^(%s)\s+(?=[A-Z])' % '|'.join(HEADINGS))
JUNK_RE = re.compile(r"\*|\]\(|\[|==|'''|:o\b|^\W|\?\s*$|^(i|we|my|our|here are)\b|\bI\b|\bI'm\b", re.I)
OTHER_CITY_RE = re.compile(
    r'\b(krakow|amsterdam|berlin|prague|vienna|budapest|barcelona|madrid|lisbon|milan|venice|naples|florence|'
    r'munich|brussels|athens|dublin|copenhagen|bangkok|tokyo|new york|hawaii|geneva|lucerne|glasgow|manchester)\b', re.I)


def clean(text):
    text = HEADING_RE.sub('', text.strip())
    return re.sub(r"''+", '', text).strip()


def usable(node, city):
    text = clean(node['claim'])
    if not 40 <= len(text) <= 220 or JUNK_RE.search(text):
        return False
    other = OTHER_CITY_RE.search(text)
    return not other or other.group(0).lower() == city


def pair_id(a, b):
    return hashlib.sha1((a['claim'] + '|' + b['claim']).encode('utf8')).hexdigest()[:8]


def quality(a, b, aspects):
    shared = len((ca.content_words(a['claim']) & ca.content_words(b['claim'])))
    same_type = a['_type'] == b['_type']
    return 3 * same_type + 2 * len(aspects) + min(shared, 4) - abs(len(a['claim']) - len(b['claim'])) / 100


def candidates(city):
    path = os.path.join(REPO, 'public', 'preprocessed', f'{city}.json')
    with open(path, encoding='utf8') as f:
        nodes = [n for n in json.load(f)['nodes'] if n.get('claim') and n.get('place')]
    for n in nodes:
        n['_type'] = ca.stmt_type(n['claim'])
    out = []
    for p in ca.app_candidate_pairs(nodes, uncapped=True):
        if p['copy'] or not p['opp']:
            continue
        a, b = p['a'], p['b']
        if not (usable(a, city) and usable(b, city)):
            continue
        for ptype in TYPES:
            if ptype not in (a['_type'], b['_type']):
                continue
            first, second = (a, b) if a['_type'] == ptype else (b, a)
            out.append({
                'id': pair_id(first, second), 'type': ptype, 'city': city, 'place': p['place'],
                'types_ab': [first['_type'], second['_type']], 'aspects': p['aspects'],
                'quality': round(quality(first, second, p['aspects']), 2),
                'a': {'claim': clean(first['claim']), 'source': ca.src(first), 'sentiment': ca.sent(first)},
                'b': {'claim': clean(second['claim']), 'source': ca.src(second), 'sentiment': ca.sent(second)},
            })
    return out


def find_node(nodes, start, source=None):
    hits = [n for n in nodes if clean(n['claim']).startswith(start) and (not source or ca.src(n) == source)]
    if len(hits) != 1:
        sys.exit(f'{len(hits)} statements start with: {start}')
    return hits[0]


def manual_pair(entry, ptype):
    with open(os.path.join(REPO, 'public', 'preprocessed', f"{entry['city']}.json"), encoding='utf8') as f:
        nodes = [n for n in json.load(f)['nodes'] if n.get('claim')]
    a = find_node(nodes, entry['a'], entry.get('a_source'))
    b = find_node(nodes, entry['b'], entry.get('b_source'))
    return {
        'id': pair_id(a, b), 'type': ptype, 'city': entry['city'], 'place': a['place'],
        'types_ab': [ca.stmt_type(a['claim']), ca.stmt_type(b['claim'])], 'aspects': [], 'quality': None, 'manual': True,
        'a': {'claim': entry.get('a_text') or clean(a['claim']), 'source': ca.src(a), 'sentiment': ca.sent(a)},
        'b': {'claim': entry.get('b_text') or clean(b['claim']), 'source': ca.src(b), 'sentiment': ca.sent(b)},
    }


def choose(pool, ptype, pick):
    if pick.get(ptype):
        by_id = {c['id']: c for c in pool}
        chosen = []
        for entry in pick[ptype]:
            if isinstance(entry, dict):
                chosen.append(manual_pair(entry, ptype))
            elif entry in by_id:
                chosen.append(by_id[entry])
            else:
                sys.exit(f'Unknown {ptype} id in pick file: {entry}')
        return chosen
    chosen, used = [], set()
    for c in sorted(pool, key=lambda c: (c['city'] in FALLBACK_CITIES, -c['quality'])):
        if c['type'] != ptype or {c['a']['claim'], c['b']['claim']} & used:
            continue
        chosen.append(c)
        used |= {c['a']['claim'], c['b']['claim']}
        if len(chosen) == PER_TYPE:
            break
    return chosen


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pick', help='JSON file with the chosen pairs per type')
    args = ap.parse_args()
    pick = {}
    if args.pick:
        with open(args.pick, encoding='utf8') as f:
            pick = json.load(f)

    pool = [c for city in CITIES + FALLBACK_CITIES for c in candidates(city)]
    pool = list({c['id']: c for c in pool}.values())

    out_dir = os.path.join(HERE, 'out')
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, 'pair_candidates.json'), 'w', encoding='utf8') as f:
        json.dump(sorted(pool, key=lambda c: (c['type'], -c['quality'])), f, ensure_ascii=False, indent=1)

    pairs = []
    for ptype in TYPES:
        chosen = choose(pool, ptype, pick)
        print(f'{ptype}: {sum(c["type"] == ptype for c in pool)} candidates, {len(chosen)} chosen')
        pairs += chosen
    path = os.path.join(REPO, 'user_study', 'runner', 'pairs.json')
    with open(path, 'w', encoding='utf8') as f:
        json.dump({'pairs': pairs}, f, ensure_ascii=False, indent=1)
    print('wrote', path)


if __name__ == '__main__':
    main()
