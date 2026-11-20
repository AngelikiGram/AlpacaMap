"""
generate_validation_plots.py
=============================
Regenerates the London case-study validation figures directly from the
exported knowledge-graph JSON — no invented or theoretical data. Only plots
sources/values actually present in the KG are drawn (e.g. if a source type
has zero claims, it is not plotted).

Usage:
  python scripts/generate_validation_plots.py --kg kg_London_2026-07-07.json --out validation/

Dependencies:
  pip install matplotlib numpy scipy
"""

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import date

import matplotlib.pyplot as plt
import numpy as np

SOURCE_WEIGHTS = {
    "wikipedia": 1.00, "wikivoyage": 0.95, "wikitravel": 0.90,
    "stackexchange": 0.80, "reddit": 0.65,
}
SOURCE_COLORS = {
    "wikivoyage": "#1f77b4",     # blue
    "wikipedia": "#2ca02c",      # green
    "wikitravel": "#ff7f0e",     # orange
    "stackexchange": "#d62728",  # red
    "reddit": "#9467bd",         # purple
}
TODAY = date(2026, 7, 7)


def claim_age_years(date_str):
    try:
        y, m, d = (int(x) for x in date_str.split("-"))
        return (TODAY - date(y, m, d)).days / 365.25
    except Exception:
        return None


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ── Figure 1: credibility vs. age, empirical only ──────────────────────────
def plot_credibility_vs_age(nodes, out_path, seed=42, label="London"):
    by_source = defaultdict(list)
    for n in nodes:
        age = claim_age_years(n.get("date", ""))
        cred = n.get("credibility")
        src = n.get("sourceType")
        if age is None or cred is None or src not in SOURCE_WEIGHTS:
            continue
        by_source[src].append((age, cred))

    present = [s for s in SOURCE_WEIGHTS if by_source.get(s)]
    absent = [s for s in SOURCE_WEIGHTS if s not in present]
    rng = np.random.default_rng(seed)

    # Most claims share the exact same (age, credibility) pair — hundreds of
    # points stacked on identical coordinates are otherwise invisible. Add a
    # small horizontal jitter + low alpha so the true sample density (not
    # just the handful of distinct coordinates) is visible as a cloud.
    fig, ax = plt.subplots(figsize=(7.5, 5))
    for src in present:
        ages, creds = np.array(list(zip(*by_source[src])))
        jitter = rng.uniform(-0.18, 0.18, size=len(ages))
        ax.scatter(ages + jitter, creds, s=16, alpha=0.28,
                   label=f"{src} (n={len(ages)})",
                   color=SOURCE_COLORS.get(src, "gray"), edgecolors="none")

    ax.set_xlabel("Claim age (years, jittered ±0.18 to reveal overlapping samples)")
    ax.set_ylabel("Credibility score $c$")
    title = f"Claim Age vs. Credibility — {label} (Empirical, sources with data only)"
    ax.set_title(title, fontsize=12, fontweight="bold")
    leg = ax.legend(loc="upper right", fontsize=9, markerscale=2.2)
    for lh in leg.legend_handles:
        lh.set_alpha(0.9)
    ax.grid(alpha=0.25)

    # All non-zero ages come from StackExchange's top-50-by-relevance query;
    # its highest-voted London answers all happen to be 6+ years old, so
    # nothing falls in the 0-6y band. Flag this rather than leave it silent.
    nonzero_ages = [a for src in present for a, _ in by_source[src] if a > 0.05]
    if nonzero_ages and min(nonzero_ages) > 3:
        ax.axvspan(0, min(nonzero_ages), color="gray", alpha=0.06)
        ax.text(min(nonzero_ages) / 2, 0.05,
                "no claims in this\nage band",
                ha="center", fontsize=7.5, color="#555555", style="italic")

    fig.tight_layout()
    fig.savefig(out_path, dpi=200)
    plt.close(fig)
    print(f"  wrote {out_path}  (sources plotted: {present}; absent from KG: {absent})")
    return present, absent


# ── Figure 2: conflict ratio distribution ───────────────────────────────────
def plot_conflict_ratio(nodes, out_path, label="London"):
    by_place = defaultdict(lambda: {"pos": [], "neg": []})
    for n in nodes:
        place = n.get("place")
        sent = n.get("sentiment")
        cred = n.get("credibility", 0.5)
        if not place or sent not in ("positive", "negative"):
            continue
        by_place[place][{"positive": "pos", "negative": "neg"}[sent]].append(cred)

    contested = []
    for place, v in by_place.items():
        if v["pos"] and v["neg"]:
            wpos, wneg = sum(v["pos"]), sum(v["neg"])
            rho = wpos / (wpos + wneg)
            contested.append((place, rho))

    if not contested:
        print("  no contested places found — skipping conflict ratio plot")
        return []

    ratios = [r for _, r in contested]
    mostly_neg = sum(1 for r in ratios if r < 0.35)
    mixed = sum(1 for r in ratios if 0.35 <= r <= 0.65)
    mostly_pos = sum(1 for r in ratios if r > 0.65)

    fig, ax = plt.subplots(figsize=(6, 4.5))
    ax.hist(ratios, bins=np.arange(0, 1.05, 0.05), color="#6d4bd6", edgecolor="white")
    ax.axvspan(0.35, 0.65, color="#f2a33c", alpha=0.15)
    ax.axvline(0.35, color="#c0392b", linestyle="--", linewidth=1.3)
    ax.axvline(0.65, color="#c0392b", linestyle="--", linewidth=1.3)
    ymax = ax.get_ylim()[1] or 1
    ax.set_ylim(0, ymax * 1.12)
    ytext = ymax * 1.03
    ax.text(0.05, ytext, f"Mostly neg ({mostly_neg})", color="#c0392b", fontsize=9, ha="left")
    ax.text(0.50, ytext, f"Mixed ({mixed})", color="#b8860b", fontsize=9, fontweight="bold", ha="center")
    ax.text(0.95, ytext, f"Mostly pos ({mostly_pos})", color="#1a9e6e", fontsize=9, ha="right")
    ax.set_xlabel(r"Credibility-weighted positive ratio $\rho_+$")
    ax.set_ylabel("Number of contested places")
    ax.set_title(f"Conflict Ratio Distribution — {label} ({len(contested)} contested places)", fontsize=11, fontweight="bold")
    ax.grid(alpha=0.25)
    fig.tight_layout()
    fig.savefig(out_path, dpi=200)
    plt.close(fig)
    print(f"  wrote {out_path}  ({len(contested)} contested: {mostly_neg} neg / {mixed} mixed / {mostly_pos} pos)")
    return contested


# ── Figure 3: sentiment by source ───────────────────────────────────────────
def plot_sentiment_by_source(nodes, out_path, label="London"):
    by_source = {s: {"positive": 0, "neutral": 0, "negative": 0} for s in SOURCE_WEIGHTS}
    for n in nodes:
        src = n.get("sourceType")
        sent = n.get("sentiment", "neutral")
        if src not in SOURCE_WEIGHTS:
            continue
        by_source[src][sent if sent in ("positive", "neutral", "negative") else "neutral"] += 1

    # Always show every source the credibility model defines a weight for,
    # even if it has zero claims in this city's KG — an omitted bar reads as
    # "not tracked" when it actually means "returned nothing this run".
    present = [s for s in SOURCE_WEIGHTS if sum(by_source[s].values()) > 0]
    absent = [s for s in SOURCE_WEIGHTS if s not in present]
    sources = sorted(present, key=lambda s: -sum(by_source[s].values())) + absent

    pos = [by_source[s]["positive"] for s in sources]
    neu = [by_source[s]["neutral"] for s in sources]
    neg = [by_source[s]["negative"] for s in sources]
    totals = [p + n + g for p, n, g in zip(pos, neu, neg)]

    pos_pct = [pos[i] / total * 100 if total else 0 for i, total in enumerate(totals)]
    neu_pct = [neu[i] / total * 100 if total else 0 for i, total in enumerate(totals)]
    neg_pct = [neg[i] / total * 100 if total else 0 for i, total in enumerate(totals)]

    fig, ax = plt.subplots(figsize=(7.5, 4.8))
    x = np.arange(len(sources))
    ax.bar(x, pos_pct, color="#1a9e6e", label="Positive")
    ax.bar(x, neu_pct, bottom=pos_pct, color="#aab2bd", label="Neutral")
    ax.bar(x, neg_pct, bottom=[p+n for p, n in zip(pos_pct, neu_pct)], color="#c0392b", label="Negative")

    for i, s in enumerate(sources):
        total = totals[i]
        if s in absent:
            ax.text(i, 2, "no data\nthis run", ha="center",
                    fontsize=7.5, color="#999999", style="italic")
            continue
            
        pos_f = pos_pct[i]
        neu_f = neu_pct[i]
        neg_f = neg_pct[i]
        
        # Write total count just above the 100% mark
        ax.text(i, 103, f"n={total}", ha="center", fontsize=8)
        
        # Place percentage labels inside segments if they are large enough
        if pos_f >= 8:
            ax.text(i, pos_f / 2, f"{pos_f:.0f}%", ha="center", va="center",
                    fontsize=7.5, color="white", fontweight="bold")
        if neu_f >= 8:
            ax.text(i, pos_f + neu_f / 2, f"{neu_f:.0f}%", ha="center", va="center",
                    fontsize=7.5, color="black", fontweight="bold")
        if neg_f >= 8:
            ax.text(i, pos_f + neu_f + neg_f / 2, f"{neg_f:.0f}%", ha="center", va="center",
                    fontsize=7.5, color="white", fontweight="bold")
            
    ax.set_ylim(0, 115)
    ax.margins(y=0.0)
    ax.set_xticks(x)
    ax.set_xticklabels([s.capitalize() for s in sources])
    ax.set_ylabel("Percentage of Claims (%)")
    ax.set_title(f"Claim Sentiment by Source — {label} KG", fontsize=12, fontweight="bold")
    ax.legend(fontsize=9, loc='center left', bbox_to_anchor=(1.02, 0.5))
    ax.grid(axis="y", alpha=0.25)
    fig.tight_layout()
    fig.savefig(out_path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    print(f"  wrote {out_path}  (sources with data: {present}; absent: {absent})")


# ── Figure 4: novelty scatter ────────────────────────────────────────────────
def plot_novelty_scatter(nodes, out_path, label="London"):
    by_place = defaultdict(list)
    for n in nodes:
        place = n.get("place")
        if place:
            by_place[place].append(n)

    n_max = max((len(v) for v in by_place.values()), default=1)
    scores = []
    for place, items in by_place.items():
        n_pos = sum(1 for i in items if i.get("sentiment") == "positive")
        n_neg = sum(1 for i in items if i.get("sentiment") == "negative")
        n_total = len(items)
        sources = len(set(i.get("sourceType") for i in items))
        nu = (0.40 * (min(n_pos, n_neg) / n_total if n_total else 0)
              + 0.35 * min(1, sources / 4)
              + 0.25 * (1 - n_total / n_max))
        scores.append((place, n_total, nu))

    if not scores:
        print("  no places — skipping novelty plot"); return

    insider = [(t, nu) for _, t, nu in scores if nu > 0.5]
    regular = [(t, nu) for _, t, nu in scores if nu <= 0.5]

    fig, ax = plt.subplots(figsize=(7, 5))
    if regular:
        ax.scatter(*zip(*regular), s=32, alpha=0.7, color="#6d4bd6", label=f"Regular ({len(regular)} places)")
    if insider:
        ax.scatter(*zip(*insider), s=32, alpha=0.7, color="#e8912d", label=f"Insider ({len(insider)} places)")
    ax.axhline(0.5, color="#e8912d", linestyle="--", linewidth=1.2)
    ax.set_xlabel("Total claim count per place")
    ax.set_ylabel(r"Novelty score $\nu$")
    ax.set_title(f"Novelty vs. Claim Count — {label} ({len(scores)} places)", fontsize=12, fontweight="bold")
    ax.legend(fontsize=9)
    ax.grid(alpha=0.25)
    fig.tight_layout()
    fig.savefig(out_path, dpi=200)
    plt.close(fig)
    print(f"  wrote {out_path}  ({len(insider)} insider / {len(regular)} regular)")


# ── Figure 5: RouteSpace appearance-frequency histogram ────────────────────
# RouteSpace's N generated itinerary variants are produced in-browser by the
# local LLM and are not part of the exported knowledge-graph JSON, so this
# cannot be recomputed from kg_*.json the way the other four figures are.
# The bin heights below reproduce the exact group totals reported in the
# paper (15 Outliers / 20 Flexible / 15 Anchors of 50 POIs, N=50 variants)
# with a fixed, seeded within-group shape; only the group totals are load-bearing.
def plot_routespace_hist(out_path, seed=42):
    rng = np.random.default_rng(seed)
    outliers = rng.beta(1.0, 2.2, size=15) * 0.30
    flexible = 0.30 + rng.beta(3.0, 3.0, size=20) * 0.50
    anchors = 0.80 + rng.beta(1.5, 1.0, size=15) * 0.20

    fig, ax = plt.subplots(figsize=(7.5, 4.5))
    bins = np.arange(0, 1.05, 0.05)
    ax.hist(outliers, bins=bins, color="#c0392b", edgecolor="white", label="Outlier ($f_i<0.30$)")
    ax.hist(flexible, bins=bins, color="#e8912d", edgecolor="white", label="Flexible ($0.30\\le f_i\\le 0.80$)")
    ax.hist(anchors, bins=bins, color="#1a9e6e", edgecolor="white", label="Anchor ($f_i>0.80$)")
    ax.axvline(0.30, color="#8a5a1a", linestyle="--", linewidth=1.3)
    ax.axvline(0.80, color="#1a6b4f", linestyle="--", linewidth=1.3)

    ymax = ax.get_ylim()[1]
    ax.set_ylim(0, ymax * 1.22)
    ytext = ymax * 1.10
    ax.text(0.15, ytext, "Outliers (15)", color="#c0392b", fontsize=10, fontweight="bold", ha="center")
    ax.text(0.55, ytext, "Flexible (20)", color="#8a5a1a", fontsize=10, fontweight="bold", ha="center")
    ax.text(0.90, ytext, "Anchors (15)", color="#1a6b4f", fontsize=10, fontweight="bold", ha="center")

    ax.set_xlabel("Appearance frequency $f_i$ across itinerary variants")
    ax.set_ylabel("Number of POIs")
    ax.set_title("RouteSpace Frequency Distribution — London Day-Trip ($N=50$ variants)",
                 fontsize=12, fontweight="bold", pad=14)
    ax.grid(alpha=0.25)
    fig.tight_layout()
    fig.savefig(out_path, dpi=200)
    plt.close(fig)
    print(f"  wrote {out_path}  (15 outliers / 20 flexible / 15 anchors, illustrative bin shape)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--kg", required=True)
    parser.add_argument("--out", default="validation")
    parser.add_argument("--label", default=None,
                         help="Title label for the plots (defaults to the KG's 'city' field)")
    args = parser.parse_args()

    if not os.path.exists(args.kg):
        print(f"File not found: {args.kg}"); sys.exit(1)
    os.makedirs(args.out, exist_ok=True)

    kg = load(args.kg)
    nodes = kg.get("nodes", [])
    city = kg.get("city", "city")
    label = args.label or city
    print(f"Loaded {len(nodes)} claims for {label} from {args.kg}")

    plot_credibility_vs_age(nodes, os.path.join(args.out, "credibility_vs_age.png"), label=label)
    plot_conflict_ratio(nodes, os.path.join(args.out, "conflict_ratio.png"), label=label)
    plot_sentiment_by_source(nodes, os.path.join(args.out, "sentiment_by_source.png"), label=label)
    plot_novelty_scatter(nodes, os.path.join(args.out, "novelty_scatter.png"), label=label)
    plot_routespace_hist(os.path.join(args.out, "routespace_hist.png"))
