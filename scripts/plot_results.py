"""
plot_results.py
================
Generates the two result figures for the paper from real measured data —
it does NOT invent or simulate any numbers. Run the validation scripts first
and fill in the manual columns; this script only plots what you collected.

Figure A (Approach A — conflict validity):
  Scatter of conflict_ratio vs. external bimodality coefficient, contested
  vs. control places.
  Input: one or more conflict_validation_<city>.csv files produced by
  validate_conflicts.py (with the control rows filled in by hand).

Figure B (Approach B — cross-source novelty):
  Bar chart of novelty rate by source type, pooled across cities.
  Input: the --json-out file produced by validate_novelty.py.

Usage:
  python scripts/plot_results.py --approach-a conflict_validation_*.csv --out-a paper/figures/approach_a_scatter.pdf
  python scripts/plot_results.py --approach-b novelty_results.json --out-b paper/figures/approach_b_bars.pdf

Dependencies:
  pip install matplotlib pandas
"""

import argparse
import json
import glob
import os
import sys
from collections import defaultdict

try:
    import matplotlib.pyplot as plt
except ImportError:
    print("ERROR: matplotlib not found. Run: pip install matplotlib pandas")
    sys.exit(1)

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False
    import csv


# ── Approach A: scatter plot ──────────────────────────────────────────────────
def plot_approach_a(csv_paths, out_path):
    rows = []
    for pattern in csv_paths:
        for path in glob.glob(pattern):
            if HAS_PANDAS:
                df = pd.read_csv(path)
                rows.extend(df.to_dict("records"))
            else:
                with open(path, encoding="utf-8") as f:
                    rows.extend(list(csv.DictReader(f)))

    if not rows:
        print("No conflict_validation_*.csv rows found. Did you run validate_conflicts.py and fill in the CSV?")
        return

    contested_x, contested_y = [], []
    control_x, control_y = [], []
    skipped = 0

    for r in rows:
        group = (r.get("group") or "").strip()
        try:
            cr = float(r.get("conflict_ratio") or 0)
            bc = r.get("bimodality_coefficient")
            bc = float(bc) if bc not in (None, "", "nan") else None
        except (TypeError, ValueError):
            skipped += 1
            continue
        if bc is None or not r.get("place"):
            skipped += 1
            continue
        if group == "contested":
            contested_x.append(cr); contested_y.append(bc)
        elif group == "control":
            control_x.append(cr); control_y.append(bc)

    if skipped:
        print(f"  Skipped {skipped} incomplete rows (missing bimodality_coefficient or place).")
    if not contested_x and not control_x:
        print("No usable rows — fill in tripadvisor_* and control rows in the CSV first.")
        return

    fig, ax = plt.subplots(figsize=(6, 4.5))
    if contested_x:
        ax.scatter(contested_x, contested_y, c="#ef4444", marker="o", s=55,
                   alpha=0.8, label=f"Contested (n={len(contested_x)})", edgecolors="black", linewidths=0.4)
    if control_x:
        ax.scatter(control_x, control_y, facecolors="none", edgecolors="#3b82f6",
                   marker="o", s=55, linewidths=1.3, label=f"Control (n={len(control_x)})")

    ax.axhline(0.555, color="gray", linestyle="--", linewidth=1, alpha=0.7)
    ax.text(ax.get_xlim()[1] * 0.98, 0.565, "bimodal threshold (BC=0.555)",
            fontsize=8, color="gray", ha="right")
    ax.set_xlabel("System conflict ratio")
    ax.set_ylabel("External rating bimodality coefficient (BC)")
    ax.set_title("Conflict ratio vs. external rating bimodality")
    ax.legend(loc="best", fontsize=9)
    ax.grid(alpha=0.25)
    fig.tight_layout()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    fig.savefig(out_path, dpi=300)
    print(f"✓ Figure A written → {out_path}  ({len(contested_x)} contested, {len(control_x)} control points)")


# ── Approach B: bar chart ─────────────────────────────────────────────────────
def plot_approach_b(json_path, out_path):
    with open(json_path, encoding="utf-8") as f:
        results = json.load(f)

    if not results:
        print("Empty results file.")
        return

    # Pool novelty_by_source across all cities
    pooled = defaultdict(lambda: {"total": 0, "novel": 0})
    for r in results:
        for src, stats in r.get("novelty_by_source", {}).items():
            pooled[src]["total"] += stats["total"]
            pooled[src]["novel"] += stats["novel"]

    if not pooled:
        print("No novelty_by_source data found — re-run validate_novelty.py with --json-out after the per-source fix.")
        return

    sources = sorted(pooled, key=lambda s: -pooled[s]["total"])
    rates = [pooled[s]["novel"] / pooled[s]["total"] * 100 if pooled[s]["total"] else 0 for s in sources]
    totals = [pooled[s]["total"] for s in sources]

    fig, ax = plt.subplots(figsize=(6, 4.5))
    colors = plt.cm.viridis([i / max(len(sources) - 1, 1) for i in range(len(sources))])
    bars = ax.bar(sources, rates, color=colors)
    for bar, total in zip(bars, totals):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 1,
                f"n={total}", ha="center", fontsize=8, color="#444")

    ax.set_ylabel("Novelty rate (%)")
    ax.set_title("Novelty rate by source type (pooled across cities)")
    ax.set_ylim(0, max(rates) * 1.25 if rates else 100)
    ax.grid(axis="y", alpha=0.25)
    fig.tight_layout()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    fig.savefig(out_path, dpi=300)
    print(f"✓ Figure B written → {out_path}  ({len(sources)} sources, {sum(totals)} total claims)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--approach-a", nargs="+", metavar="CSV", help="conflict_validation_*.csv file(s) or glob pattern(s)")
    parser.add_argument("--out-a", default="paper/figures/approach_a_scatter.pdf")
    parser.add_argument("--approach-b", metavar="JSON", help="--json-out file from validate_novelty.py")
    parser.add_argument("--out-b", default="paper/figures/approach_b_bars.pdf")
    args = parser.parse_args()

    if not args.approach_a and not args.approach_b:
        print(__doc__)
        sys.exit(0)

    if args.approach_a:
        plot_approach_a(args.approach_a, args.out_a)
    if args.approach_b:
        plot_approach_b(args.approach_b, args.out_b)
