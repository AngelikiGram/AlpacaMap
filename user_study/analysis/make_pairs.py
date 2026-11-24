#!/usr/bin/env python3
"""Builds user_study/runner/pairs.json: statement pairs for the RQ4 block of the study.

Pairs come from the same candidate-pair rules as the paper (analysis/conflict_analysis.py, a port of
src/knowledge/contradictions.js): same place or topic, different sources, shared aspect, >= 2 shared
content words, not a near-copy, opposite sentiment. Both statements must have the same statement type
(the paper's taxonomy: practical, evaluative, norm, descriptive). The runner draws `perType` pairs per
type for each participant (seeded by participant number).

Usage (from travel_planner/):  python user_study/analysis/make_pairs.py
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, 'analysis'))
import conflict_analysis as ca  # noqa: E402

CITIES = ['london', 'paris', 'rome', 'edinburgh', 'zurich']
TYPES = ['practical', 'evaluative', 'norm', 'descriptive']
PRIORITY = ['norm', 'evaluative', 'practical', 'descriptive']   # pair type = most opinionated of its two statements
JUNK = re.compile(r"\*\*|\]\(|==|\[\s|^\W|\?\s*$|^(i|we|my|our)\b", re.I)
# Reddit threads often talk about other cities; those statements are not about this place
OTHER_CITY = re.compile(r"\b(krakow|kraków|amersfoort|amsterdam|berlin|prague|vienna|budapest|barcelona|madrid|lisbon|milan|venice|naples|"
                        r"florence|munich|brussels|bruges|seville|athens|dublin|copenhagen|bangkok|tokyo|new york|hurghada|lauterbrunnen|"
                        r"interlaken|geneva|lucerne|glasgow|manchester|nice|lyon|cinque terre|amalfi|pompeii)\b", re.I)
MAX_PER_TYPE = 30


def ok(n, city):
    t = n['claim']
    if not (40 <= len(t) <= 240) or JUNK.search(t.strip()) or n['_type'] == 'other':
        return False
    m = OTHER_CITY.search(t)
    return not m or m.group(0).lower() == city


def main():
    pools = {t: [] for t in TYPES}
    for c in CITIES:
        d = json.load(open(os.path.join(REPO, 'public', 'preprocessed', f'{c}.json'), encoding='utf8'))
        nodes = [n for n in d['nodes'] if n.get('claim') and n.get('place')]
        for n in nodes:
            n['_type'] = ca.stmt_type(n['claim'])
        seen = set()
        for p in ca.app_candidate_pairs(nodes, uncapped=True):
            if p['copy'] or not p['opp']:
                continue
            a, b = p['a'], p['b']
            if not (ok(a, c) and ok(b, c)):
                continue
            key = (a['id'], b['id'])
            if key in seen:
                continue
            seen.add(key)
            ptype = next(t for t in PRIORITY if t in (a['_type'], b['_type']))
            pools[ptype].append({
                'city': c, 'place': p['place'], 'type': ptype, 'types_ab': [a['_type'], b['_type']], 'aspects': p['aspects'],
                'a': {'claim': a['claim'], 'source': ca.src(a), 'sentiment': ca.sent(a)},
                'b': {'claim': b['claim'], 'source': ca.src(b), 'sentiment': ca.sent(b)},
            })
    out = {'generated_from': 'public/preprocessed (paris, rome)', 'types': {}}
    for t, ps in pools.items():
        # most aspect overlap first, both cities mixed
        ps.sort(key=lambda x: -len(x['aspects']))
        out['types'][t] = ps[:MAX_PER_TYPE]
        print(f'{t}: {len(ps)} candidates, kept {len(out["types"][t])}')
    path = os.path.join(REPO, 'user_study', 'runner', 'pairs.json')
    json.dump(out, open(path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print('wrote', path)


if __name__ == '__main__':
    main()
