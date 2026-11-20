"""
validate_conflicts.py  —  Approach A validation
================================================
Validates that the system's conflict-detection signal corresponds to genuine
real-world disagreement.

Hypothesis: places flagged as "contested" by the system have bimodal rating
distributions on external platforms (high variance, more 1★ and 5★ than 3★).

Usage:
  python scripts/validate_conflicts.py conflicts_London_2025-06-04.json
  python scripts/validate_conflicts.py conflicts_*.json          # multi-city

Output:
  - Ranked table of contested places by conflict ratio
  - Bimodality coefficient for each (where rating variance is provided)
  - CSV ready for manual TripAdvisor comparison column
  - LaTeX / GitHub table for paper

Rating variance injection (Approach A ground truth):
  After manually collecting TripAdvisor rating distributions for each place,
  add them to the JSON under "tripadvisor_ratings":
    {
      "place": "Borough Market",
      ...
      "tripadvisor_ratings": {"1": 12, "2": 5, "3": 8, "4": 18, "5": 57}
    }
  Then re-run this script — it will compute Spearman ρ between conflict_ratio
  and bimodality coefficient, and print the correlation for your paper.

Dependencies:
  pip install tabulate scipy
"""

import json
import sys
import os
import csv
from collections import defaultdict

try:
    from tabulate import tabulate
    HAS_TABULATE = True
except ImportError:
    HAS_TABULATE = False

try:
    from scipy.stats import spearmanr
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False


# ── Bimodality coefficient ────────────────────────────────────────────────────
# BC = (skewness² + 1) / (kurtosis + 3*(n-1)²/((n-2)(n-3)))
# Ranges 0–1; values > 0.555 suggest bimodality (Freeman & Dale 2013).
def bimodality_coefficient(ratings_dict):
    """
    ratings_dict: {"1": count, "2": count, ..., "5": count}
    Returns (BC, mean, variance, interpretation).
    """
    data = []
    for star, count in ratings_dict.items():
        data.extend([int(star)] * int(count))
    n = len(data)
    if n < 4:
        return None, None, None, "insufficient data"
    mean = sum(data) / n
    variance = sum((x - mean) ** 2 for x in data) / n
    if variance == 0:
        return 0.0, mean, variance, "uniform"
    # Skewness
    skew = (sum((x - mean) ** 3 for x in data) / n) / (variance ** 1.5)
    # Excess kurtosis
    kurt = (sum((x - mean) ** 4 for x in data) / n) / (variance ** 2) - 3
    bc = (skew ** 2 + 1) / (kurt + 3 * ((n - 1) ** 2) / ((n - 2) * (n - 3)))
    interp = "bimodal" if bc > 0.555 else "unimodal"
    return round(bc, 3), round(mean, 2), round(variance, 2), interp


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def analyze_file(path):
    data = load(path)
    city = data.get("city", os.path.basename(path))
    places = data.get("contested_places", [])

    print(f"\n{'='*64}")
    print(f"  Conflict Validation  |  City: {city}")
    print(f"  Contested places: {len(places)}  |  Total nodes: {data.get('total_nodes', '?')}")
    print(f"{'='*64}")

    if not places:
        print("  No contested places found.")
        return []

    rows = []
    bc_pairs = []  # (conflict_ratio, bc) for Spearman ρ

    for p in sorted(places, key=lambda x: -x.get("conflict_ratio", 0)):
        cr = p.get("conflict_ratio", 0)
        pos = p.get("positive_count", 0)
        neg = p.get("negative_count", 0)
        total = p.get("total_claims", pos + neg)
        cw_ratio = p.get("credibility_weighted_pos_ratio", 0.5)
        resolution = p.get("resolution") or "—"

        bc_str = "—"
        mean_str = "—"
        interp_str = "—"
        if "tripadvisor_ratings" in p:
            bc, mean, var, interp = bimodality_coefficient(p["tripadvisor_ratings"])
            if bc is not None:
                bc_str = f"{bc:.3f}"
                mean_str = f"{mean:.1f}★"
                interp_str = interp
                bc_pairs.append((cr, bc))

        rows.append((p["place"], total, pos, neg, f"{cr:.3f}", f"{cw_ratio:.2f}", bc_str, mean_str, resolution))

    headers = ["Place", "N", "Pos", "Neg", "ConflictRatio", "CredW-Pos", "BC", "Mean★", "Resolution"]

    if HAS_TABULATE:
        print(tabulate(rows, headers=headers, tablefmt="simple"))
    else:
        print("  " + " | ".join(headers))
        print("  " + "-" * 80)
        for r in rows:
            print("  " + " | ".join(str(x) for x in r))

    # Spearman ρ between conflict_ratio and bimodality coefficient
    if bc_pairs and HAS_SCIPY and len(bc_pairs) >= 5:
        crs, bcs = zip(*bc_pairs)
        rho, p_val = spearmanr(crs, bcs)
        sig = f"p < 0.05" if p_val < 0.05 else f"p = {p_val:.3f}"
        print(f"\n  Spearman ρ (conflict_ratio ↔ bimodality): {rho:.3f}  ({sig})")
        if rho > 0.3:
            print("  → Conflict detection aligns with external rating bimodality ✓")
        else:
            print("  → Weak or no alignment — may need more annotated places")

    # Write CSV for manual TripAdvisor annotation
    city_slug = city.replace(" ", "_").replace(",", "")
    csv_path = os.path.join(os.path.dirname(path), f"conflict_validation_{city_slug}.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["city", "group", "place", "conflict_ratio", "positive_count", "negative_count",
                         "tripadvisor_1star", "tripadvisor_2star", "tripadvisor_3star",
                         "tripadvisor_4star", "tripadvisor_5star", "tripadvisor_mean",
                         "bimodality_coefficient", "notes"])
        for p in places:
            ta = p.get("tripadvisor_ratings", {})
            bc, mean, _, _ = bimodality_coefficient(ta) if ta else (None, None, None, None)
            writer.writerow([
                city, "contested", p["place"], p.get("conflict_ratio", ""), p.get("positive_count", ""), p.get("negative_count", ""),
                ta.get("1", ""), ta.get("2", ""), ta.get("3", ""), ta.get("4", ""), ta.get("5", ""),
                mean or "", bc or "", ""
            ])
        # Blank template rows for the control (uncontested) set — add one row per
        # control place you pick manually, with group="control" and conflict_ratio=0.
        for i in range(len(places)):
            writer.writerow([city, "control", "", 0, "", "",
                             "", "", "", "", "", "", "", "fill in: uncontested place + its external ratings"])
    print(f"\n  CSV written → {csv_path}")
    print("  1) Fill in tripadvisor_* columns for the 'contested' rows.")
    print("  2) Fill in the blank 'control' rows with an equal-sized set of uncontested")
    print("     places (similar total claim volume) and their external ratings.")
    print("  3) Re-run this script to compute Spearman ρ, then run scripts/plot_results.py")
    print("     to generate the scatter plot for the paper.")

    return [(city, p["place"], p.get("conflict_ratio", 0)) for p in places]


# ── LaTeX summary table ───────────────────────────────────────────────────────
def print_summary(all_results):
    if len(all_results) == 0:
        return
    print(f"\n{'='*64}")
    print("  TOP CONTESTED PLACES ACROSS ALL CITIES")
    print(f"{'='*64}")
    sorted_results = sorted(all_results, key=lambda x: -x[2])[:20]
    rows = [(city, place, f"{cr:.3f}") for city, place, cr in sorted_results]
    if HAS_TABULATE:
        print(tabulate(rows, headers=["City", "Place", "Conflict Ratio"], tablefmt="latex_booktabs"))
        print()
        print(tabulate(rows, headers=["City", "Place", "Conflict Ratio"], tablefmt="github"))


if __name__ == "__main__":
    paths = sys.argv[1:]
    if not paths:
        print(__doc__)
        sys.exit(0)

    all_results = []
    for path in paths:
        if not os.path.exists(path):
            # Try glob expansion
            import glob
            expanded = glob.glob(path)
            if not expanded:
                print(f"File not found: {path}")
                continue
            for p in expanded:
                all_results.extend(analyze_file(p))
        else:
            all_results.extend(analyze_file(path))

    if len(paths) > 1:
        print_summary(all_results)
