"""
validate_novelty.py  —  Approach B validation
==============================================
Validates that the system surfaces knowledge NOT found in standard travel
sources (top Google results / Wikivoyage alone).

Core claim: the system's multi-source aggregation produces more nuanced,
contested, and temporally-aware knowledge than a single mainstream guide.

Usage:
  # Basic comparison: system KG vs a baseline KG
  python scripts/validate_novelty.py --system kg_London_system.json --baseline kg_London_baseline.json

  # Single-file analysis (without a baseline)
  python scripts/validate_novelty.py kg_London_system.json

  # Multiple cities
  python scripts/validate_novelty.py --system kg_London.json kg_Prague.json --baseline kg_London_base.json kg_Prague_base.json

Creating a baseline KG:
  1. Fetch knowledge for the same city using ONLY Wikivoyage (uncheck all other sources)
  2. Export the KG from the Conflicts tab → "Export KG"
  3. Save as kg_<city>_baseline.json
  Then run this script with --system and --baseline to see what the full system adds.

Output:
  - Claim count comparison (system vs baseline)
  - % of system claims not in baseline (novelty rate)
  - Breakdown by claim type and source
  - Contested claims unique to system
  - LaTeX table for paper

Dependencies:
  pip install tabulate scipy
"""

import json
import sys
import os
import re
import argparse
from collections import defaultdict

try:
    from tabulate import tabulate
    HAS_TABULATE = True
except ImportError:
    HAS_TABULATE = False

try:
    from scipy.stats import mannwhitneyu
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False


# ── Text normalisation for claim matching ─────────────────────────────────────
def normalise(text):
    """Lowercase, strip punctuation, collapse whitespace — for fuzzy dedup."""
    t = text.lower()
    t = re.sub(r"[^\w\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def claim_tokens(text, min_len=4):
    return set(w for w in normalise(text).split() if len(w) >= min_len)


def jaccard(a_tokens, b_tokens):
    if not a_tokens or not b_tokens:
        return 0.0
    return len(a_tokens & b_tokens) / len(a_tokens | b_tokens)


def is_novel(claim, baseline_token_sets, threshold=0.45):
    """A claim is novel if no baseline claim shares ≥ threshold Jaccard similarity."""
    toks = claim_tokens(claim)
    if not toks:
        return True
    return all(jaccard(toks, bt) < threshold for bt in baseline_token_sets)


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ── Single-file analysis ─────────────────────────────────────────────────────
def analyze_single(data):
    city = data.get("city", "?")
    nodes = data.get("nodes", [])

    print(f"\n{'='*64}")
    print(f"  Knowledge Graph Analysis  |  City: {city}")
    print(f"  Total claims: {len(nodes)}")
    print(f"{'='*64}")

    # Source breakdown
    by_source = defaultdict(list)
    for n in nodes:
        by_source[n.get("sourceType", "unknown")].append(n)

    print("\n  Claims by source:")
    src_rows = []
    for src, items in sorted(by_source.items(), key=lambda x: -len(x[1])):
        pos = sum(1 for n in items if n.get("sentiment") == "positive")
        neg = sum(1 for n in items if n.get("sentiment") == "negative")
        contested = sum(1 for n in items if n.get("sentiment") in ("positive", "negative"))
        src_rows.append((src, len(items), pos, neg, f"{pos/len(items)*100:.0f}%", f"{neg/len(items)*100:.0f}%"))
    if HAS_TABULATE:
        print(tabulate(src_rows, headers=["Source", "N", "Positive", "Negative", "% Pos", "% Neg"], tablefmt="simple"))
    else:
        for r in src_rows:
            print(f"  {r[0]:12s}  n={r[1]:4d}  pos={r[2]:3d}  neg={r[3]:3d}")

    # Claim type breakdown
    by_type = defaultdict(list)
    for n in nodes:
        by_type[n.get("claimType", "unknown")].append(n)

    print("\n  Claims by type:")
    type_rows = [(ct, len(items), f"{len(items)/len(nodes)*100:.1f}%") for ct, items in sorted(by_type.items(), key=lambda x: -len(x[1]))]
    if HAS_TABULATE:
        print(tabulate(type_rows, headers=["Type", "N", "% of total"], tablefmt="simple"))
    else:
        for r in type_rows:
            print(f"  {r[0]:12s}  n={r[1]:4d}  {r[2]}")

    # Contested places
    place_sentiments = defaultdict(lambda: {"pos": 0, "neg": 0})
    for n in nodes:
        p = (n.get("place") or "").lower()
        if n.get("sentiment") == "positive":
            place_sentiments[p]["pos"] += 1
        elif n.get("sentiment") == "negative":
            place_sentiments[p]["neg"] += 1
    contested = [(p, v["pos"], v["neg"]) for p, v in place_sentiments.items() if v["pos"] > 0 and v["neg"] > 0]
    print(f"\n  Contested places: {len(contested)} of {len(place_sentiments)} unique places ({len(contested)/max(len(place_sentiments),1)*100:.1f}%)")

    return {
        "city": city,
        "total": len(nodes),
        "by_source": {s: len(i) for s, i in by_source.items()},
        "by_type": {t: len(i) for t, i in by_type.items()},
        "contested_count": len(contested),
        "unique_places": len(place_sentiments),
        "nodes": nodes,
    }


# ── Comparative analysis ─────────────────────────────────────────────────────
def compare(system_data, baseline_data):
    city = system_data.get("city", "?")
    sys_nodes = system_data.get("nodes", [])
    base_nodes = baseline_data.get("nodes", [])

    print(f"\n{'='*64}")
    print(f"  Novelty Comparison  |  City: {city}")
    print(f"  System: {len(sys_nodes)} claims  |  Baseline: {len(base_nodes)} claims")
    print(f"{'='*64}")

    # Build baseline token sets once
    base_token_sets = [claim_tokens(n["claim"]) for n in base_nodes if n.get("claim")]

    # Classify each system claim as novel or baseline-covered
    novel_nodes = [n for n in sys_nodes if n.get("claim") and is_novel(n["claim"], base_token_sets)]
    covered_nodes = [n for n in sys_nodes if n.get("claim") and not is_novel(n["claim"], base_token_sets)]
    novelty_rate = len(novel_nodes) / max(len(sys_nodes), 1)

    print(f"\n  Novel claims (not in baseline): {len(novel_nodes)} / {len(sys_nodes)}  =  {novelty_rate*100:.1f}%")
    print(f"  Baseline-covered claims:        {len(covered_nodes)} / {len(sys_nodes)}")

    # Novel claims breakdown by source
    novel_by_src = defaultdict(int)
    for n in novel_nodes:
        novel_by_src[n.get("sourceType", "unknown")] += 1

    all_by_src = defaultdict(int)
    for n in sys_nodes:
        all_by_src[n.get("sourceType", "unknown")] += 1

    print("\n  Novel claims by source (% of that source that is novel):")
    src_rows = []
    for src in sorted(all_by_src, key=lambda s: -all_by_src[s]):
        total_src = all_by_src[src]
        novel_src = novel_by_src.get(src, 0)
        src_rows.append((src, total_src, novel_src, f"{novel_src/total_src*100:.0f}%"))
    if HAS_TABULATE:
        print(tabulate(src_rows, headers=["Source", "Total", "Novel", "Novelty %"], tablefmt="simple"))
    else:
        for r in src_rows:
            print(f"  {r[0]:12s}  total={r[1]:4d}  novel={r[2]:4d}  {r[3]}")

    # Novel claim type distribution vs baseline
    def type_dist(nlist):
        d = defaultdict(int)
        for n in nlist:
            d[n.get("claimType", "unknown")] += 1
        return d

    sys_types = type_dist(sys_nodes)
    base_types = type_dist(base_nodes)
    novel_types = type_dist(novel_nodes)

    all_types = sorted(set(sys_types) | set(base_types), key=lambda t: -sys_types.get(t, 0))
    print("\n  Claim type distribution (system vs baseline vs novel):")
    type_rows = []
    for ct in all_types:
        s = sys_types.get(ct, 0)
        b = base_types.get(ct, 0)
        nv = novel_types.get(ct, 0)
        s_pct = f"{s/max(len(sys_nodes),1)*100:.0f}%"
        b_pct = f"{b/max(len(base_nodes),1)*100:.0f}%"
        type_rows.append((ct, s, s_pct, b, b_pct, nv))
    if HAS_TABULATE:
        print(tabulate(type_rows, headers=["Type", "Sys N", "Sys %", "Base N", "Base %", "Novel N"], tablefmt="simple"))
    else:
        for r in type_rows:
            print(f"  {r[0]:12s}  sys={r[1]:4d}({r[2]})  base={r[3]:4d}({r[4]})  novel={r[5]:4d}")

    # Contested places unique to system
    def get_contested(nlist):
        ps = defaultdict(lambda: {"pos": 0, "neg": 0})
        for n in nlist:
            p = (n.get("place") or "").lower()
            if n.get("sentiment") == "positive": ps[p]["pos"] += 1
            elif n.get("sentiment") == "negative": ps[p]["neg"] += 1
        return {p for p, v in ps.items() if v["pos"] > 0 and v["neg"] > 0}

    sys_contested = get_contested(sys_nodes)
    base_contested = get_contested(base_nodes)
    sys_only_contested = sys_contested - base_contested
    print(f"\n  Contested places: system={len(sys_contested)}, baseline={len(base_contested)}")
    print(f"  Contested places unique to system: {len(sys_only_contested)}")

    # Credibility score comparison (system novel vs covered)
    if HAS_SCIPY:
        novel_creds = [n["credibility"] for n in novel_nodes if "credibility" in n]
        covered_creds = [n["credibility"] for n in covered_nodes if "credibility" in n]
        if len(novel_creds) >= 5 and len(covered_creds) >= 5:
            stat, p = mannwhitneyu(novel_creds, covered_creds, alternative="two-sided")
            sig = "p < 0.05" if p < 0.05 else f"p = {p:.3f}"
            mean_novel = sum(novel_creds) / len(novel_creds)
            mean_covered = sum(covered_creds) / len(covered_creds)
            print(f"\n  Credibility: novel claims mean={mean_novel:.3f}, covered mean={mean_covered:.3f}")
            print(f"  Mann-Whitney U ({sig}) — novel claims are {'significantly ' if p < 0.05 else 'not significantly '}different in credibility")

    # Sample novel claims
    print(f"\n  Sample novel claims (5 of {len(novel_nodes)}):")
    for n in novel_nodes[:5]:
        src = n.get("sourceType", "?")
        place = n.get("place", "?")
        claim = (n.get("claim") or "")[:90]
        print(f"    [{src}] {place}: {claim}…")

    return {
        "city": city,
        "sys_total": len(sys_nodes),
        "base_total": len(base_nodes),
        "novel_count": len(novel_nodes),
        "novelty_rate": round(novelty_rate, 3),
        "sys_contested": len(sys_contested),
        "base_contested": len(base_contested),
        "sys_only_contested": len(sys_only_contested),
        "novelty_by_source": {
            src: {"total": all_by_src[src], "novel": novel_by_src.get(src, 0),
                  "novelty_rate": round(novel_by_src.get(src, 0) / all_by_src[src], 3) if all_by_src[src] else 0}
            for src in all_by_src
        },
    }


def print_summary_table(results):
    if not results:
        return
    print(f"\n{'='*64}")
    print("  SUMMARY TABLE  (paste into paper)")
    print(f"{'='*64}")
    rows = [(r["city"], r["sys_total"], r["base_total"], r["novel_count"],
             f"{r['novelty_rate']*100:.1f}%", r["sys_contested"], r["sys_only_contested"])
            for r in results]
    headers = ["City", "Sys N", "Base N", "Novel", "Novelty %", "Contested", "Contested (sys-only)"]
    if HAS_TABULATE:
        print(tabulate(rows, headers=headers, tablefmt="latex_booktabs"))
        print()
        print(tabulate(rows, headers=headers, tablefmt="github"))
    else:
        print("  " + " | ".join(headers))
        for r in rows:
            print("  " + " | ".join(str(x) for x in r))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate KG novelty vs a baseline.")
    parser.add_argument("files", nargs="*", help="KG JSON file(s) for single-file analysis")
    parser.add_argument("--system", nargs="+", metavar="FILE", help="System KG JSON file(s)")
    parser.add_argument("--baseline", nargs="+", metavar="FILE", help="Baseline KG JSON file(s), same order as --system")
    parser.add_argument("--json-out", metavar="FILE", help="Write pooled comparison results to this JSON file (for plot_results.py)")
    args = parser.parse_args()

    if args.system and args.baseline:
        if len(args.system) != len(args.baseline):
            print("ERROR: --system and --baseline must have the same number of files.")
            sys.exit(1)
        all_results = []
        for sf, bf in zip(args.system, args.baseline):
            if not os.path.exists(sf):
                print(f"System file not found: {sf}"); continue
            if not os.path.exists(bf):
                print(f"Baseline file not found: {bf}"); continue
            result = compare(load(sf), load(bf))
            all_results.append(result)
        if len(all_results) > 1:
            print_summary_table(all_results)
        if args.json_out:
            with open(args.json_out, "w", encoding="utf-8") as f:
                json.dump(all_results, f, indent=2)
            print(f"\nJSON results written → {args.json_out}")
    elif args.files:
        for path in args.files:
            if not os.path.exists(path):
                print(f"File not found: {path}"); continue
            analyze_single(load(path))
    else:
        print(__doc__)
        sys.exit(0)
