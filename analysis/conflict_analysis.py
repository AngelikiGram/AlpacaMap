"""Offline analysis of source conflict in the bundled TravelScout statement corpus.

Reproduces every number in Section 5 of the revised manuscript. The candidate-pair, copy and
condition rules are line-by-line ports of src/knowledge/contradictions.js (ASPECTS, CONDITION_RULES,
STOP, contentWords, candidatePairs, explainByConditions), so the "app" numbers match what the app
sends to the NLI model. The statement-type taxonomy (Section 3) exists only in this script.

Standard library only. Usage (from travel_planner/):
    python analysis/conflict_analysis.py public/preprocessed analysis/out
"""
import collections
import csv
import itertools
import json
import os
import random
import re
import sys

CITIES = ["london", "paris", "rome", "edinburgh", "zurich"]
SOURCES = ["wikivoyage", "wikitravel", "wikipedia", "stackexchange", "reddit"]

# ---- port of src/knowledge/contradictions.js -------------------------------------------------
ASPECTS = {
    "crowds": r"\b(crowd(s|ed)?|busy|packed|quiet|empty|tourists?|touristy|queues?|lines?|wait(ing)?)\b",
    "price": r"\b(price[sd]?|expensive|cheap|cost(s|ly)?|overpriced|afford\w*|value|budget|free|euros?|€|\$)\b",
    "safety": r"\b(safe(ty)?|unsafe|dangerous|pickpocket\w*|scams?|crime|theft|thie(f|ves)|sketchy)\b",
    "quality": r"\b(amazing|great|best|worst|terrible|awful|overrated|underrated|worth(while)?|disappoint\w*|beautiful|ugly|stunning|boring)\b",
    "food": r"\b(food|meals?|restaurants?|cuisine|dish(es)?|taste|delicious|bland)\b",
    "cleanliness": r"\b(clean|dirty|filthy|smell(y|s)?|litter|trash)\b",
    "opening": r"\b(open(s|ing)?|closed?|hours?|opening times?|reservations?|book(ing)? (ahead|in advance)|tickets?)\b",
    "transport": r"\b(metro|subway|bus(es)?|trains?|tram|taxi|walk(able|ing)?|traffic|parking|transport)\b",
    "weather": r"\b(weather|rain(y)?|hot|cold|warm|sunny|snow|humid|heat)\b",
    "noise": r"\b(noisy|loud|quiet|peaceful|calm)\b",
}
ASPECT_RE = {k: re.compile(v, re.I) for k, v in ASPECTS.items()}

CONDITION_RULES = {
    "season": [("summer", r"\b(summer|july|august|june|high season|peak season)\b"),
               ("winter", r"\b(winter|december|january|february|christmas|low season|off[- ]season)\b"),
               ("spring", r"\b(spring|march|april|may)\b"),
               ("autumn", r"\b(autumn|fall|september|october|november)\b")],
    "timeOfDay": [("early morning", r"\b(early (in the )?morning|at opening|first thing|before \d{1,2}\s?(am|a\.m\.))\b"),
                  ("morning", r"\b(morning)\b"), ("afternoon", r"\b(afternoon|midday|noon)\b"),
                  ("evening", r"\b(evening|sunset|dusk)\b"), ("night", r"\b(night|late|after dark|midnight)\b")],
    "week": [("weekend", r"\b(weekends?|saturdays?|sundays?)\b"),
             ("weekday", r"\b(weekdays?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?)\b")],
    "traveller": [("families", r"\b(famil(y|ies)|kids|children|toddlers?)\b"), ("solo", r"\b(solo|alone|by yourself|on your own)\b"),
                  ("women", r"\b(women|female)\b"), ("couples", r"\b(couples?|romantic|honeymoon)\b"),
                  ("budget travellers", r"\b(budget|backpack\w*|cheap)\b")],
    "area": [("centre", r"\b(cent(er|re)|downtown|old town|historic (center|centre))\b"),
             ("outskirts", r"\b(outskirts|suburbs?|outside the (city|center|centre)|periphery)\b")],
}
COND_RE = {d: [(v, re.compile(p, re.I)) for v, p in rules] for d, rules in CONDITION_RULES.items()}

STOP = set(("the a an and or but of to in on at for with from by is are was were be been it its this that these those you your we our "
            "they their there here not no do does did can will would should could have has had as if so than then just very also more "
            "most only about into out up over after before when where which who what how all any some get got one really").split())


def aspects_of(text):
    return {k for k, r in ASPECT_RE.items() if r.search(text or "")}


def content_words(text):
    return {w for w in re.findall(r"[a-zà-ÿ]{3,}", (text or "").lower()) if w not in STOP}


def extract_conditions(text, given=None):
    out = {}
    for dim, rules in COND_RE.items():
        g = (given or {}).get(dim)
        if isinstance(g, str) and g:
            out[dim] = g.lower()
            continue
        for value, r in rules:
            if r.search(text or ""):
                out[dim] = value
                break
    return out


def explain_by_conditions(a, b):
    ca = extract_conditions(a["claim"], a.get("conditions"))
    cb = extract_conditions(b["claim"], b.get("conditions"))
    for dim in CONDITION_RULES:
        if ca.get(dim) and cb.get(dim) and ca[dim] != cb[dim]:
            return dim, ca[dim], cb[dim]
    return None


def sent(n):
    return (n.get("evaluation") or {}).get("sentiment")


def src(n):
    return (n.get("source") or {}).get("sourceType")


def opposite(a, b):
    return {sent(a), sent(b)} == {"positive", "negative"}


def app_candidate_pairs(nodes, max_per_place=12, max_total=300, max_per_node=3, max_length=300, min_shared=2, uncapped=False):
    """Port of candidatePairs(). uncapped=True drops the 200-per-place slice and all caps (analysis only)."""
    by_place = collections.OrderedDict()
    for n in nodes:
        if not n.get("place") or not n.get("claim"):
            continue
        by_place.setdefault(n["place"].lower(), []).append(n)
    allp = []
    for key, lst in by_place.items():
        if len(lst) < 2:
            continue
        place_words = content_words(lst[0]["place"].replace("·", " "))
        prepared = [n for n in lst if len(n["claim"]) <= max_length]
        if not uncapped:
            prepared = prepared[:200]
        prepared = [(n, aspects_of(n["claim"]), content_words(n["claim"]) - place_words) for n in prepared]
        pairs = []
        for (A, aA, wA), (B, aB, wB) in itertools.combinations(prepared, 2):
            if src(A) == src(B):
                continue
            shared_asp = aA & aB
            if not shared_asp:
                continue
            shared = len(wA & wB)
            if shared < min_shared:
                continue
            jac = shared / ((len(wA) + len(wB) - shared) or 1)
            if jac > 0.6:
                pairs.append({"copy": True, "a": A, "b": B})
                continue
            opp = opposite(A, B)
            score = len(shared_asp) * 2 + min(shared, 4) + (6 if opp else 0)
            pairs.append({"copy": False, "place": A["place"], "a": A, "b": B, "aspects": sorted(shared_asp), "score": score, "opp": opp})
        if uncapped:
            allp.extend(pairs)
        else:
            pairs = [p for p in pairs if not p["copy"]]
            pairs.sort(key=lambda p: -p["score"])
            allp.extend(pairs[:max_per_place])
    if uncapped:
        return allp
    allp.sort(key=lambda p: -p["score"])
    uses = collections.Counter()
    out = []
    for p in allp:
        if uses[p["a"]["id"]] >= max_per_node or uses[p["b"]["id"]] >= max_per_node:
            continue
        uses[p["a"]["id"]] += 1
        uses[p["b"]["id"]] += 1
        out.append(p)
        if len(out) >= max_total:
            break
    return out


# ---- statement-type taxonomy (Section 3; this script only) ------------------------------------
TYPES = ["norm", "practical", "evaluative", "descriptive", "other"]
TYPE_RE = {
    "norm": re.compile(r"\b(tip(s|ping)?\b(?! (and|for|on))|tipped|etiquette|custom(s|ary)?|locals? (expect|consider|find)|polite\w*|rude\w*|impolite|"
                       r"offen(d|sive)|frowned upon|dress code|cover your|shoulders|queue[- ]jump\w*|stand on the right|it is (considered|customary)|"
                       r"bargain\w*|haggl\w*|greet\w*|handshake|kiss on|service charge)\b", re.I),
    "practical": re.compile(r"(\b(open(s|ed)?|clos(e|ed|es)|hours|ticket\w*|book(ed|ing)? (in advance|ahead|online)|reserv\w*|admission|entry fee|"
                            r"price[sd]?|costs?|fee[s]?|free entry|free admission|queue\w*|wait(ing)? time|minutes? (walk|by)|"
                            r"get there|take the|line [0-9]|bus (no|number|route)|platform|timetable|schedule|daily|monday|tuesday|wednesday|"
                            r"thursday|friday|saturday|sunday|weekends?|cash|card[s]?|contactless|oyster|pass(es)?|fares?|lockers?|check-in|"
                            r"you (should|can|must|will need|need to|may want)|consider (taking|buying|booking)|be (aware|careful|on guard)|"
                            r"watch out|make sure|don't forget|take (a|the) (train|bus|tram|tube|metro|taxi|ferry)|stops?|walkable|"
                            r"trains? (to|from|run)|buses (to|from|run)|routes?|tickets?|visa)\b|[£€$]\s?\d|\b\d{1,2}(:\d\d)?\s?(am|pm)\b)", re.I),
    "evaluative": re.compile(r"\b(worth\w*|recommend\w*|must[- ]see|overrated|underrated|avoid|skip|best|worst|great|good|bad|amazing|awesome|"
                             r"beautiful|stunning|lovely|nice|boring|disappoint\w*|terrible|awful|excellent|fantastic|favou?rite|love[ds]?|hate[ds]?|"
                             r"crowded|touristy|tourist trap|overpriced|pricey|cheap|expensive|safe|unsafe|dangerous|dirty|clean|charming|"
                             r"atmospher\w*|vibe|impressive|underwhelming|meh|incredible|gorgeous|delicious|atrocious|annoying|lavish|"
                             r"pleasant|unpleasant|popular|famous|well-known|spectacular|breathtaking|magnificent|worthwhile|enjoy(ed|able)?|"
                             r"highlight|gem|quirky|cosy|cozy|crap|sucks?|overwhelming|stressful|relaxing|peaceful)\b", re.I),
    "descriptive": re.compile(r"(\b(built|founded|established|constructed|designed by|dates? (back|from)|century|centuries|population|inhabitants|"
                              r"located|situated|lies on|area of|square (miles|kilomet\w*)|km2|capital|named after|home to|houses|consists of|"
                              r"was (the|a|an)|were (the|a|an)|is (the|a|an) (largest|oldest|second|main|official)|history|historic(al)?|"
                              r"empire|roman|medieval|king|queen|emperor|war\b|museum of)\b|\b1[0-9]{3}\b|\b20[0-2][0-9]\b)", re.I),
}
NOISE_RE = re.compile(r"(\?\s*\)?\s*$|===|==|\bedit\s*:|disclaimer|^question\s*:|\bthanks?\b|\bthank you\b|any (help|tips|advice|suggestions)|"
                      r"need some help|happy to answer|would be (greatly )?appreciated|^(i'm|i am|we're|we are) (staying|going|planning|visiting|travel\w*|considering|looking)|"
                      r"^(i|we) (will|'ll) be)", re.I)


def stmt_type(text):
    if NOISE_RE.search(text.strip()):
        return "other"
    for t in TYPES[:-1]:
        if TYPE_RE[t].search(text):
            return t
    return "other"


def is_topic(place):
    return "·" in place


INFORMATIVE = {"practical", "evaluative", "norm"}


def main(src_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    random.seed(20261123)
    res = {"cities": {}, "type_by_source": collections.defaultdict(collections.Counter),
           "sent_by_type": collections.defaultdict(collections.Counter)}
    sample_pool = []
    dump = []
    for c in CITIES:
        d = json.load(open(os.path.join(src_dir, c + ".json"), encoding="utf8"))
        nodes = [n for n in d["nodes"] if n.get("claim") and n.get("place")]
        for n in nodes:
            n["_type"] = stmt_type(n["claim"])
            res["type_by_source"][src(n)][n["_type"]] += 1
            res["sent_by_type"][n["_type"]][sent(n)] += 1
        by_place = collections.defaultdict(list)
        for n in nodes:
            by_place[n["place"].lower()].append(n)
        r = collections.OrderedDict()
        r["statements"] = len(nodes)
        r["sources"] = dict(collections.Counter(src(n) for n in nodes))
        r["places"] = len(by_place)
        r["named_places"] = sum(1 for p in by_place if not is_topic(p))
        r["stmts_on_named_places"] = sum(1 for n in nodes if not is_topic(n["place"]))
        r["types"] = dict(collections.Counter(n["_type"] for n in nodes))
        r["largest_bucket"] = max(len(v) for v in by_place.values())
        r["stmts_beyond_200_cap"] = sum(max(0, len([n for n in v if len(n["claim"]) <= 300]) - 200) for v in by_place.values())

        # Old polarity rule: place with >=1 positive and >=1 negative statement
        r["polarity_contested_places"] = sum(1 for v in by_place.values() if any(sent(n) == "positive" for n in v) and any(sent(n) == "negative" for n in v))

        # Funnel over ALL pairs (no 200-cap), opposite sentiment only
        opp_all = 0
        opp_x = 0
        for v in by_place.values():
            pc = collections.Counter(sent(n) for n in v)
            opp_all += pc["positive"] * pc["negative"]
            ps = collections.Counter((src(n), sent(n)) for n in v)
            same = sum(ps[(s, "positive")] * ps[(s, "negative")] for s in SOURCES)
            opp_x += pc["positive"] * pc["negative"] - same
        unc = app_candidate_pairs(nodes, uncapped=True)
        copies = [p for p in unc if p["copy"]]
        cand = [p for p in unc if not p["copy"]]
        opp_cand = [p for p in cand if p["opp"]]
        comp = [p for p in opp_cand if p["a"]["_type"] in INFORMATIVE and p["b"]["_type"] in INFORMATIVE]
        r["funnel"] = {"opposite": opp_all, "opposite_cross_source": opp_x, "same_aspect_content_not_copy": len(opp_cand),
                       "comparable_types": len(comp)}
        r["candidates_any_tone"] = len(cand)
        r["candidates_named_place"] = sum(1 for p in cand if not is_topic(p["place"]))
        r["candidates_condition_diff"] = sum(1 for p in cand if explain_by_conditions(p["a"], p["b"]))
        r["candidate_aspects"] = dict(collections.Counter(a for p in cand for a in p["aspects"]))
        r["opp_candidates_by_source_pair"] = dict(collections.Counter("+".join(sorted((src(p["a"]), src(p["b"])))) for p in opp_cand))
        r["candidates_by_source_pair"] = dict(collections.Counter("+".join(sorted((src(p["a"]), src(p["b"])))) for p in cand))
        r["condition_dimensions"] = dict(collections.Counter(c[0] for c in (explain_by_conditions(p["a"], p["b"]) for p in cand) if c))
        r["copy_pairs_same_place"] = len(copies)
        r["copy_pairs_by_sources"] = dict(collections.Counter("+".join(sorted((src(p["a"]), src(p["b"])))) for p in copies))

        # City-wide near-copy rate per source (content words, Jaccard > 0.6, >= 4 words)
        cw = [content_words(n["claim"]) for n in nodes]
        inv = collections.defaultdict(set)
        for i, ws in enumerate(cw):
            for w in ws:
                inv[w].add(i)
        copied = collections.Counter()
        for i, ws in enumerate(cw):
            if len(ws) < 4:
                continue
            hits = collections.Counter(j for w in ws for j in inv[w] if j != i)
            for j, k in hits.items():
                if k >= 3 and src(nodes[j]) != src(nodes[i]) and len(ws & cw[j]) / len(ws | cw[j]) > 0.6:
                    copied[src(nodes[i])] += 1
                    break
        r["copied_by_source"] = dict(copied)

        # Exactly what the app sends to the NLI model (default caps)
        app = app_candidate_pairs(nodes)
        r["app_candidates"] = len(app)
        r["app_candidates_opposite"] = sum(1 for p in app if p["opp"])
        r["app_candidate_places"] = len({p["place"] for p in app})
        r["app_candidates_named_place"] = sum(1 for p in app if not is_topic(p["place"]))
        r["app_candidates_condition_diff"] = sum(1 for p in app if explain_by_conditions(p["a"], p["b"]))
        res["cities"][d["city"]] = r
        for p in app:
            p["city"] = d["city"]
        sample_pool.extend(app)
        dump.extend(p for p in cand if p["opp"] or explain_by_conditions(p["a"], p["b"]))

    # NLI verdicts from analysis/run_nli.mjs (the app's own model and rules), if available
    nli = {}
    nli_path = os.path.join(out_dir, "nli_verdicts.json")
    if os.path.exists(nli_path):
        for city, v in json.load(open(nli_path, encoding="utf8"))["cities"].items():
            for q in v["verified"]:
                nli[(q["aId"], q["bId"])] = q
    for p in sample_pool:
        q = nli.get((p["a"]["id"], p["b"]["id"])) or nli.get((p["b"]["id"], p["a"]["id"]))
        p["nli"] = q["label"] if q else ""
        p["nli_c"] = round(q["scores"]["contradiction"], 3) if q else ""

    # Annotation sample (200 pairs): every pair the NLI model did not call "unrelated", then 40 per city
    # filled with opposite-tone pairs first, then the rest (random within each group).
    flagged = [p for p in sample_pool if p["nli"] and p["nli"] != "unrelated"]
    sample = list(flagged)
    for city in res["cities"]:
        pool = [p for p in sample_pool if p["city"] == city and p not in flagged]
        o = [p for p in pool if p["opp"]]
        rest = [p for p in pool if not p["opp"]]
        random.shuffle(o)
        random.shuffle(rest)
        need = 40 - sum(1 for p in flagged if p["city"] == city)
        sample.extend((o + rest)[:max(0, need)])
    random.shuffle(sample)  # coders must not see the pairs grouped by verdict
    with open(os.path.join(out_dir, "annotation_sample.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["pair_id", "city", "place", "aspects", "condition_rule", "id_A", "source_A", "sentiment_A", "type_A", "statement_A",
                    "id_B", "source_B", "sentiment_B", "type_B", "statement_B",
                    "CODE_relation (contradiction|depends_on_condition|different_aspect|same_claim|not_about_place)",
                    "CODE_type_A (descriptive|practical|evaluative|norm|other)", "CODE_type_B", "coder", "notes", "nli_label (hide from coders)", "nli_contradiction"])
        for k, p in enumerate(sample):
            cond = explain_by_conditions(p["a"], p["b"])
            w.writerow([f"P{k+1:03d}", p["city"], p["place"], ";".join(p["aspects"]), (f"{cond[0]}: {cond[1]} vs {cond[2]}" if cond else ""),
                        p["a"]["id"], src(p["a"]), sent(p["a"]), p["a"]["_type"], p["a"]["claim"],
                        p["b"]["id"], src(p["b"]), sent(p["b"]), p["b"]["_type"], p["b"]["claim"], "", "", "", "", "", p["nli"], p["nli_c"]])
    with open(os.path.join(out_dir, "candidate_pairs.txt"), "w", encoding="utf-8") as fh:
        for p in dump:
            cond = explain_by_conditions(p["a"], p["b"])
            fh.write(f"[{p['a']['city']}] {p['place']} | asp={p['aspects']} cond={cond} types={p['a']['_type']}/{p['b']['_type']}\n")
            fh.write(f"  A {src(p['a'])}/{sent(p['a'])}: {p['a']['claim']}\n  B {src(p['b'])}/{sent(p['b'])}: {p['b']['claim']}\n\n")

    res["type_by_source"] = {k: dict(v) for k, v in res["type_by_source"].items()}
    res["sent_by_type"] = {k: dict(v) for k, v in res["sent_by_type"].items()}
    pooled = collections.Counter()
    for r in res["cities"].values():
        for k, v in r.items():
            if isinstance(v, int):
                pooled[k] += v
        for k, v in r["funnel"].items():
            pooled["funnel_" + k] += v
        for k, v in r["candidate_aspects"].items():
            pooled["aspect_" + k] += v
        for k, v in r["copied_by_source"].items():
            pooled["copied_" + k] += v
        for k, v in r["sources"].items():
            pooled["src_" + k] += v
        for k, v in r["copy_pairs_by_sources"].items():
            pooled["copypair_" + k] += v
    res["pooled"] = dict(pooled)
    res["annotation_sample_size"] = len(sample)
    json.dump(res, open(os.path.join(out_dir, "results.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(json.dumps(res, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
