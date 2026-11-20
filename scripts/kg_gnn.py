"""
kg_gnn.py  —  Graph-based topic reclassification (Approach C)
=============================================================
Builds a co-occurrence graph over the exported knowledge graph, runs Node2Vec
to learn node embeddings, and uses KMeans clustering to reclassify ambiguous
topic labels — replacing LLM-based reclassification with a graph-structural
approach.

Pipeline:
  1. Load exported KG JSON (from "Export KG" button in the Knowledge tab)
  2. Build a weighted co-occurrence graph:
       - Nodes  = unique place names
       - Edges  = two places appear together in the same source document
                  or share a claim type, weighted by corroboration count
  3. Run Node2Vec (random-walk-based graph embedding) → 64-dim vectors per node
  4. KMeans (k=10) clusters the embeddings → topic communities
  5. Label each cluster by majority-vote from already-classified nodes
  6. Reclassify ambiguous or NB-labelled nodes with the cluster label
  7. Write enriched JSON + print comparison vs. original NB labels

Research value:
  - Demonstrates that graph structure alone (co-occurrence + source sharing)
    carries enough topic signal to outperform or complement the NB first-pass
  - Embedding coordinates (2-D UMAP projection) can be exported for the paper
    figure showing topic cluster separation

Usage:
  python scripts/kg_gnn.py --kg kg_London_system.json
  python scripts/kg_gnn.py --kg kg_London_system.json --out kg_London_gnn.json --umap

Dependencies:
  pip install node2vec networkx scikit-learn numpy umap-learn matplotlib
"""

import json
import argparse
import sys
import os
from collections import defaultdict, Counter

try:
    import numpy as np
except ImportError:
    print("ERROR: numpy not found. Run: pip install numpy"); sys.exit(1)

try:
    import networkx as nx
except ImportError:
    print("ERROR: networkx not found. Run: pip install networkx"); sys.exit(1)

try:
    from node2vec import Node2Vec
except ImportError:
    print("ERROR: node2vec not found. Run: pip install node2vec"); sys.exit(1)

try:
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score
    from sklearn.preprocessing import normalize
except ImportError:
    print("ERROR: scikit-learn not found. Run: pip install scikit-learn"); sys.exit(1)

# ── Topic label definitions ───────────────────────────────────────────────────
# Matches the ten topic-only fallback categories actually emitted by the
# extraction pipeline, encoded as the "<City> · <Topic>" suffix of the place
# field for sentences that identify no named place (see sec:ingestion).
TOPIC_LABELS = [
    'Accommodation',
    'Climate',
    'Culture',
    'Districts',
    'Food & Drink',
    'History',
    'Safety & Health',
    'Shopping',
    'Transport',
    'Travel Tips',
]
K = len(TOPIC_LABELS)


def topic_from_place(place):
    """Extract the topic-category seed label from a '<City> · <Topic>'
    pseudo-place node. Named real places (no ' · ' separator) carry no seed
    label and are classified purely from graph structure."""
    if ' · ' in place:
        return place.split(' · ')[-1].strip()
    return ''


# ── Graph construction ────────────────────────────────────────────────────────
def build_graph(nodes):
    """
    Co-occurrence graph:
      - Nodes = unique place names (normalised lowercase)
      - Edge weight += 1 for each pair of places that share a source document URL
        (same blog post / reddit thread) or same claim type
      - Self-loops excluded
    """
    G = nx.Graph()

    # Index by source URL and by claim type
    by_url = defaultdict(list)
    by_type = defaultdict(list)
    for n in nodes:
        place = (n.get('place') or '').strip()
        if not place:
            continue
        G.add_node(place, **{
            'wikidata_id':  n.get('wikidata_id', ''),
            'claimType':    n.get('claimType', ''),
            'knowledge_type': n.get('knowledge_type', ''),
            'credibility':  n.get('credibility', 0.5),
            'sentiment':    n.get('sentiment', ''),
            'topic_nb':     topic_from_place(place),   # NB/topic-fallback label for comparison
        })
        url = n.get('url') or ''
        if url:
            by_url[url].append(place)
        ct = n.get('claimType') or ''
        if ct:
            by_type[ct].append(place)

    def add_co_occurrence(groups, weight=1.0):
        for group in groups.values():
            unique = list(set(group))
            for i in range(len(unique)):
                for j in range(i + 1, len(unique)):
                    u, v = unique[i], unique[j]
                    if G.has_edge(u, v):
                        G[u][v]['weight'] += weight
                    else:
                        G.add_edge(u, v, weight=weight)

    add_co_occurrence(by_url, weight=2.0)   # same source = stronger signal
    add_co_occurrence(by_type, weight=0.5)  # same type = weak structural signal

    return G


# ── Node2Vec embedding ────────────────────────────────────────────────────────
def embed_graph(G, dimensions=64, walk_length=20, num_walks=100, workers=2, seed=42):
    """Run Node2Vec on the co-occurrence graph."""
    if len(G.nodes) < 3:
        raise ValueError(f"Graph has only {len(G.nodes)} nodes — need at least 3 to embed.")

    n2v = Node2Vec(
        G,
        dimensions=dimensions,
        walk_length=walk_length,
        num_walks=num_walks,
        workers=workers,
        seed=seed,
        quiet=True,
    )
    model = n2v.fit(window=5, min_count=1, batch_words=4)
    nodes = list(G.nodes)
    embeddings = np.array([model.wv[n] for n in nodes])
    return nodes, embeddings, model


# ── KMeans clustering + label assignment ──────────────────────────────────────
def cluster_and_label(nodes, embeddings, G, k=K):
    """
    KMeans on normalised embeddings → cluster IDs.
    Label each cluster by majority vote of nodes whose claimType already
    matches one of the known topic labels (seeds from the NB classifier).
    """
    emb_norm = normalize(embeddings)
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(emb_norm)

    # Majority-vote topic label per cluster
    cluster_topic = {}
    for cluster_id in range(k):
        cluster_nodes = [nodes[i] for i, l in enumerate(labels) if l == cluster_id]
        votes = Counter()
        for place in cluster_nodes:
            nb_label = G.nodes[place].get('topic_nb', '')
            if nb_label in TOPIC_LABELS:
                votes[nb_label] += 1
        cluster_topic[cluster_id] = votes.most_common(1)[0][0] if votes else TOPIC_LABELS[cluster_id % k]

    sil = silhouette_score(emb_norm, labels) if len(set(labels)) > 1 else float('nan')
    return labels, cluster_topic, sil


# ── Main pipeline ─────────────────────────────────────────────────────────────
def run(kg_path, out_path, do_umap=False):
    print(f"\n{'='*64}")
    print(f"  KG-GNN Topic Reclassification  |  {os.path.basename(kg_path)}")
    print(f"{'='*64}")

    with open(kg_path, encoding='utf-8') as f:
        kg = json.load(f)

    all_nodes = kg.get('nodes', [])
    city = kg.get('city', '?')
    print(f"  City: {city}  |  Total nodes: {len(all_nodes)}")

    # ── 1. Build graph ────────────────────────────────────────────────────────
    print("\n  [1/5] Building co-occurrence graph…")
    G = build_graph(all_nodes)
    print(f"        Nodes: {G.number_of_nodes()}  |  Edges: {G.number_of_edges()}")

    if G.number_of_nodes() < 4:
        print("  Too few unique places to form a meaningful graph. Exiting.")
        return

    # ── 2. Node2Vec embeddings ────────────────────────────────────────────────
    print("  [2/5] Running Node2Vec (this takes ~30s for large graphs)…")
    graph_nodes, embeddings, wv_model = embed_graph(G)
    print(f"        Embedded {len(graph_nodes)} place-nodes → {embeddings.shape[1]}-dim vectors")

    # ── 3. KMeans clustering ──────────────────────────────────────────────────
    print("  [3/5] KMeans clustering…")
    cluster_ids, cluster_topic, sil = cluster_and_label(graph_nodes, embeddings, G)
    print(f"        Silhouette score: {sil:.3f}  (higher = better-separated clusters)")

    # ── 4. Reclassify nodes ───────────────────────────────────────────────────
    print("  [4/5] Reclassifying nodes…")
    place_to_cluster = {place: cluster_ids[i] for i, place in enumerate(graph_nodes)}
    place_to_topic   = {place: cluster_topic[cluster_ids[i]] for i, place in enumerate(graph_nodes)}

    changed = 0
    enriched_nodes = []
    for n in all_nodes:
        place = (n.get('place') or '').strip()
        gnn_topic = place_to_topic.get(place)
        nb_topic  = topic_from_place(place)  # '' for named places (no seed label)
        n_copy = dict(n)
        n_copy['gnn_topic'] = gnn_topic
        n_copy['gnn_cluster'] = int(place_to_cluster.get(place, -1))
        # Write the topic category to its own field; claimType (sentence type:
        # evaluative/temporal/conditional/sequence) is left untouched.
        n_copy['topic'] = nb_topic if nb_topic in TOPIC_LABELS else gnn_topic
        if gnn_topic and nb_topic not in TOPIC_LABELS:
            changed += 1
        enriched_nodes.append(n_copy)

    print(f"        Reclassified {changed}/{len(all_nodes)} nodes (named places with no topic seed)")

    # ── 5. Print per-cluster breakdown ────────────────────────────────────────
    print("\n  Cluster → Topic mapping:")
    cluster_sizes = Counter(cluster_ids)
    for cid in sorted(cluster_topic):
        places_in = [graph_nodes[i] for i, l in enumerate(cluster_ids) if l == cid]
        print(f"    Cluster {cid:2d} ({cluster_sizes[cid]:3d} places) → {cluster_topic[cid]}")
        for p in places_in[:4]:
            print(f"         • {p}")
        if len(places_in) > 4:
            print(f"           … +{len(places_in)-4} more")

    # Cluster-majority agreement vs. the topic-only fallback seed labels
    print("\n  GNN cluster-majority vs. topic-fallback seed label agreement:")
    agree = sum(1 for n in enriched_nodes
                if n.get('gnn_topic') == topic_from_place((n.get('place') or '').strip())
                and topic_from_place((n.get('place') or '').strip()) in TOPIC_LABELS)
    total_known = sum(1 for n in enriched_nodes
                       if topic_from_place((n.get('place') or '').strip()) in TOPIC_LABELS)
    if total_known:
        print(f"    Agreement rate: {agree}/{total_known} ({agree/total_known*100:.1f}%) on seeded nodes")

    # ── 6. Save enriched KG ───────────────────────────────────────────────────
    print(f"\n  [5/5] Writing enriched KG…")
    def _serializable(obj):
        if isinstance(obj, (np.integer,)): return int(obj)
        if isinstance(obj, (np.floating,)): return float(obj)
        if isinstance(obj, np.ndarray): return obj.tolist()
        raise TypeError(f'Object of type {obj.__class__.__name__} is not JSON serializable')

    out = {**kg, 'nodes': enriched_nodes, 'gnn': {'silhouette': round(float(sil), 4), 'k': K, 'n_edges': G.number_of_edges()}}
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, default=_serializable)
    print(f"        Written → {out_path}")

    # ── Optional UMAP 2-D projection for paper figure ──────────────────────────
    if do_umap:
        try:
            import umap
            import matplotlib.pyplot as plt
            print("\n  Generating UMAP projection…")
            reducer = umap.UMAP(n_components=2, random_state=42, n_neighbors=min(15, len(graph_nodes)-1))
            xy = reducer.fit_transform(normalize(embeddings))

            # Colour by topic LABEL, not raw cluster id — two clusters that
            # both majority-voted the same topic (e.g. two "Accommodation"
            # sub-clusters) should render as the same colour and get only
            # one label, not two overlapping duplicate text boxes.
            unique_topics = sorted(set(cluster_topic.values()))
            topic_color_idx = {t: i for i, t in enumerate(unique_topics)}
            n_topics = max(len(unique_topics), 1)
            point_colors = plt.cm.tab10([topic_color_idx[cluster_topic[c]] / max(n_topics - 1, 1) for c in cluster_ids])

            fig, ax = plt.subplots(figsize=(7, 5.5))
            ax.scatter(xy[:, 0], xy[:, 1], c=point_colors, s=40, alpha=0.75, edgecolors='none')

            # One label per topic: place it at the centroid of the largest
            # cluster carrying that topic (avoids duplicate/overlapping text
            # when multiple clusters share a label).
            cluster_sizes_by_id = Counter(cluster_ids)
            best_cluster_for_topic = {}
            for cid, topic in cluster_topic.items():
                if cluster_sizes_by_id.get(cid, 0) == 0:
                    continue
                if topic not in best_cluster_for_topic or cluster_sizes_by_id[cid] > cluster_sizes_by_id[best_cluster_for_topic[topic]]:
                    best_cluster_for_topic[topic] = cid
            for topic, cid in best_cluster_for_topic.items():
                mask = [i for i, l in enumerate(cluster_ids) if l == cid]
                if not mask:
                    continue
                cx, cy = np.mean(xy[mask, 0]), np.mean(xy[mask, 1])
                ax.text(cx, cy, topic, fontsize=7, ha='center',
                        bbox=dict(boxstyle='round,pad=0.2', facecolor='white', alpha=0.7, edgecolor='none'))

            # Proper legend (colour swatch -> topic name + place count),
            # sorted by cluster size, placed outside the axes so it never
            # overlaps the point cloud.
            from matplotlib.lines import Line2D
            topic_sizes = Counter()
            for cid, sz in cluster_sizes_by_id.items():
                topic_sizes[cluster_topic[cid]] += sz
            legend_topics = sorted(unique_topics, key=lambda t: -topic_sizes[t])
            handles = [
                Line2D([0], [0], marker='o', linestyle='', markersize=7,
                       color=plt.cm.tab10(topic_color_idx[t] / max(n_topics - 1, 1)),
                       label=f'{t} ({topic_sizes[t]})')
                for t in legend_topics
            ]
            ax.legend(handles=handles, title='Topic (places)', loc='center left',
                      bbox_to_anchor=(1.02, 0.5), fontsize=8, title_fontsize=9,
                      frameon=False, handletextpad=0.6, labelspacing=0.7)

            ax.set_title(f'Node2Vec + UMAP — place embeddings by topic cluster ({city})', fontweight='bold')
            ax.set_xlabel('UMAP dim 1'); ax.set_ylabel('UMAP dim 2')
            ax.grid(alpha=0.2)
            fig.tight_layout()
            umap_path = out_path.replace('.json', '_umap.pdf')
            os.makedirs(os.path.dirname(umap_path) or '.', exist_ok=True)
            fig.savefig(umap_path, dpi=300, bbox_inches='tight')
            fig.savefig(umap_path.replace('.pdf', '.png'), dpi=200, bbox_inches='tight')
            print(f"        UMAP figure -> {umap_path}")
        except ImportError:
            print("  umap-learn not installed — skipping UMAP projection (pip install umap-learn matplotlib)")

    print(f"\n  Done. Silhouette: {sil:.3f}  |  Reclassified: {changed}  |  Output: {out_path}\n")
    return sil, changed


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--kg', required=True, metavar='FILE', help='KG JSON exported from the app (Export KG button)')
    parser.add_argument('--out', metavar='FILE', help='Output path for enriched KG JSON (default: <input>_gnn.json)')
    parser.add_argument('--umap', action='store_true', help='Also generate a UMAP 2-D cluster figure for the paper')
    args = parser.parse_args()

    if not os.path.exists(args.kg):
        print(f"File not found: {args.kg}"); sys.exit(1)

    out_path = args.out or args.kg.replace('.json', '_gnn.json')
    run(args.kg, out_path, do_umap=args.umap)
