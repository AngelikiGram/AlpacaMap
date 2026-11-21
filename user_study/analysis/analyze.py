#!/usr/bin/env python3
"""Analyse TravelScout user-study sessions.

Usage (from the repo root):
    python user_study/analysis/analyze.py                 # all sessions in user_study/data/
    python user_study/analysis/analyze.py --include-pilot
    python user_study/analysis/analyze.py --data some/other/folder

Needs only the Python standard library. If scipy is installed, paired tests
(Wilcoxon, McNemar) are added to the summary.
Outputs go to user_study/analysis/out/: CSV tables + summary.md
"""
import argparse, csv, glob, json, math, os, re, statistics as st
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
STUDY = os.path.dirname(HERE)
REPO = os.path.dirname(STUDY)
OUT = os.path.join(HERE, 'out')
CITIES = ['paris', 'rome']
# Click text inside the app -> view name (first match wins, so order matters)
VIEW_KEYWORDS = {
    'Knowledge · Conflicts': ['conflicts'],
    'Knowledge · Claims': ['claims', 'graph', 'constellation', 'radar', 'bubbles', 'force graph'],
    'Knowledge · Visual': ['visual'],
    'Knowledge · Ingest': ['ingest', 'fetch online', 'load offline'],
    'Knowledge': ['knowledge'], 'Explore': ['explore'], 'Planner': ['planner'], 'TripSpace': ['tripspace'],
    'Insights': ['insights'], 'Overview': ['overview'], 'Itinerary': ['itinerary'], 'Budget': ['budget'], 'Packing': ['packing'],
    'Notes': ['notes'], 'Docs': ['docs'], 'Export': ['export'],
}


# ───────────────────────── ground truth ─────────────────────────
def contested_topics(city):
    """Topics with >=1 positive and >=1 negative statement from different sources."""
    with open(os.path.join(REPO, 'public', 'preprocessed', f'{city}.json'), encoding='utf-8') as f:
        nodes = json.load(f)['nodes']
    pol = defaultdict(lambda: {'positive': set(), 'negative': set()})
    for n in nodes:
        s = (n.get('evaluation') or {}).get('sentiment')
        if s in ('positive', 'negative'):
            pol[n['place']][s].add(n['source']['sourceType'])
    return sorted(p for p, d in pol.items()
                  if d['positive'] and d['negative'] and any(a != b for a in d['positive'] for b in d['negative']))


def topic_keywords(topic):
    name = topic.split('·', 1)[-1].strip().lower()
    words = [w for w in re.split(r'[^a-zà-ÿ]+', name) if len(w) > 3]
    return set(words) | {name}


def match_topics(answer_text, gt):
    text = (answer_text or '').lower()
    return sorted({t for t in gt if any(k in text for k in topic_keywords(t))})


# ───────────────────────── scoring helpers ─────────────────────────
def sus_score(a):
    if not a or any(a.get(f'sus{i}') is None for i in range(1, 11)):
        return None
    return 2.5 * sum((a[f'sus{i}'] - 1) if i % 2 else (5 - a[f'sus{i}']) for i in range(1, 11))


def tlx_raw(a):
    keys = ['mental', 'physical', 'temporal', 'performance', 'effort', 'frustration']
    vals = [a.get(f'tlx_{k}') for k in keys] if a else []
    return st.mean(vals) if vals and None not in vals else None


def classify_click(text):
    t = (text or '').lower()
    for view, kws in VIEW_KEYWORDS.items():
        if any(k in t for k in kws):
            return view
    return None


def desc(xs):
    xs = [x for x in xs if x is not None]
    if not xs:
        return 'n/a'
    if len(xs) == 1:
        return f'{xs[0]:.2f} (n=1)'
    return f'{st.mean(xs):.2f} ± {st.stdev(xs):.2f} (median {st.median(xs):.2f}, n={len(xs)})'


def write_csv(name, rows):
    if not rows:
        return
    keys = list(dict.fromkeys(k for r in rows for k in r))
    with open(os.path.join(OUT, name), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(rows)


# ───────────────────────── main ─────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--include-pilot', action='store_true')
    ap.add_argument('--data', default=os.path.join(STUDY, 'data'))
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)

    gt = {c: contested_topics(c) for c in CITIES}
    shopping_ok = {c: any('shopping' in t.lower() for t in gt[c]) for c in CITIES}

    sessions = []
    for path in sorted(glob.glob(os.path.join(args.data, '*_session.json'))):
        with open(path, encoding='utf-8') as f:
            s = json.load(f)
        if s.get('pilot') and not args.include_pilot:
            continue
        if not (s.get('answers', {}).get('consent') or {}).get('agree'):
            continue
        sessions.append(s)

    task_rows, part_rows, pair_rows, view_rows, click_rows = [], [], [], [], []
    for s in sessions:
        pid = s['pid']
        a = s.get('answers', {})
        tlx_by_block = {b: tlx_raw(a.get(f'tlx_b{b}')) for b in (1, 2)}
        for r in s.get('tasks', []):
            ans = r.get('answers') or {}
            row = {'pid': pid, 'block': r['block'], 'cond': r['cond'], 'city': r['city'], 'task': r['task'],
                   'seconds': r.get('seconds'), 'seq': ans.get('seq'), 'confidence': ans.get('confidence')}
            if r['task'] == 'T1':
                row.update({'t1_answer': ans.get('answer'), 't1_code_rater1': '', 't1_code_rater2': ''})
            if r['task'] == 'T2':
                listed = [] if ans.get('none_found') else [
                    f"{ans.get(f'topic{i}', '')} {ans.get(f'about{i}', '')}".strip() for i in (1, 2, 3)]
                listed = [x for x in listed if x]
                hits = sorted({t for x in listed for t in match_topics(x, gt[r['city']])})
                correct = sum(1 for x in listed if match_topics(x, gt[r['city']]))
                row.update({'t2_listed': len(listed), 't2_correct': correct,
                            't2_precision': (correct / len(listed)) if listed else None,
                            't2_recall': len(hits) / min(3, len(gt[r['city']])) if gt[r['city']] else None,
                            't2_matched_topics': '; '.join(hits), 't2_raw': ' | '.join(listed)})
            if r['task'] == 'T3':
                row.update({'t3_verdict': ans.get('verdict'), 't3_correct': int(ans.get('verdict') == 'mixed'),
                            't3_reason': ans.get('reason')})
            if r['task'] == 'T4':
                clicks = [l for l in s.get('log', []) if l.get('block') == r['block'] and l.get('task') == 'T4']
                views = {classify_click(l.get('text')) for l in clicks}
                row.update({'t4_stops': (ans.get('stops') or '').replace('\n', ' | '), 't4_why': ans.get('why'),
                            't4_conflict_influence': ans.get('conflict_influence'),
                            't4_opened_knowledge': int(any(v and v.startswith('Knowledge') for v in views)),
                            't4_opened_conflicts': int('Knowledge · Conflicts' in views),
                            't4_complete_coder': ''})
            row['tlx_block'] = tlx_by_block.get(r['block'])
            task_rows.append(row)

        for l in s.get('log', []):
            click_rows.append({'pid': pid, **l, 'view': classify_click(l.get('text'))})

        demo = a.get('demographics') or {}
        part_rows.append({
            'pid': pid, 'order': ' → '.join(f"{o['cond']}·{o['city']}" for o in s.get('order', [])),
            'age': demo.get('age'), 'trips': demo.get('trips'), 'sources': '; '.join(demo.get('sources') or []),
            'visited_paris': demo.get('visited_paris'), 'visited_rome': demo.get('visited_rome'),
            'map_comfort': demo.get('map_comfort'), 'sus': sus_score(a.get('sus')),
            **(a.get('integration') or {}),
            **{k: ('; '.join(v) if isinstance(v, list) else v) for k, v in (a.get('privacy') or {}).items()},
            **{f'final_{k}': v for k, v in (a.get('final') or {}).items()},
        })
        for view, v in (a.get('views') or {}).items():
            view_rows.append({'pid': pid, 'view': view, **v})
        for p in s.get('pairs') or []:
            ans = p.get('answers') or {}
            pair_rows.append({'pid': pid, 'claim_type': p['claimType'], 'city': p['city'], 'topic': p['place'],
                              'a_source': p['a']['source'], 'b_source': p['b']['source'],
                              'a_claim': p['a']['claim'], 'b_claim': p['b']['claim'],
                              'disagree': ans.get('disagree'), 'impact': ans.get('impact'), 'kind_A': ans.get('kind')})

    write_csv('tasks.csv', task_rows)
    write_csv('participants.csv', part_rows)
    write_csv('views.csv', view_rows)
    write_csv('pairs.csv', pair_rows)
    write_csv('clicks.csv', click_rows)
    write_csv('rq4_examples.csv', [r for r in pair_rows if r['disagree'] == 'Yes' and (r['impact'] or 0) >= 4])

    # ── summary.md ──
    L = ['# TravelScout user study — summary', '',
         f'Participants analysed: **{len(sessions)}**' + (' (incl. pilots)' if args.include_pilot else ''), '',
         '## Ground truth (cross-source contested topics)', '']
    for c in CITIES:
        L.append(f'- **{c.title()}** ({len(gt[c])}): ' + ', '.join(t.split('·')[-1].strip() for t in gt[c]))
        if not shopping_ok[c]:
            L.append(f'  - WARNING: "Shopping" is not contested in {c}, so T3 scoring ("mixed" = correct) is invalid there.')
    if not sessions:
        L += ['', '_No session files found in `user_study/data/` yet._']
        with open(os.path.join(OUT, 'summary.md'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(L) + '\n')
        print('\n'.join(L))
        return

    def by(task, cond, key):
        return [r[key] for r in task_rows if r['task'] == task and r['cond'] == cond and r.get(key) is not None]

    L += ['', '## RQ1 — usability', '', f"- SUS: {desc([p['sus'] for p in part_rows])}  (68 = average, 80+ = good)"]
    for t in ['T1', 'T2', 'T3', 'T4']:
        L.append(f"- {t} time (s) — S: {desc(by(t, 'S', 'seconds'))} · M: {desc(by(t, 'M', 'seconds'))}")
        L.append(f"- {t} SEQ — S: {desc(by(t, 'S', 'seq'))} · M: {desc(by(t, 'M', 'seq'))}")

    tlx = lambda cond: [r['tlx_block'] for r in task_rows if r['task'] == 'T1' and r['cond'] == cond]
    L += ['', '## RQ2 — views and workload', '', f"- NASA-TLX raw — S: {desc(tlx('S'))} · M: {desc(tlx('M'))}", '',
          '| View | used | understood (1–5) | useful (1–5) | would remove | clicks |', '|---|---|---|---|---|---|']
    clicks = Counter(r['view'] for r in click_rows if r['view'])
    for view in sorted({v['view'] for v in view_rows}, key=lambda v: -clicks.get(v, 0)):
        vs = [v for v in view_rows if v['view'] == view]
        und = [v['understood'] for v in vs if v.get('understood')]
        use = [v['useful'] for v in vs if v.get('useful')]
        L.append(f"| {view} | {sum(bool(v['used']) for v in vs)}/{len(vs)} | {f'{st.mean(und):.1f}' if und else '–'} | "
                 f"{f'{st.mean(use):.1f}' if use else '–'} | {sum(bool(v['remove']) for v in vs)}/{len(vs)} | {clicks.get(view, 0)} |")

    t3s, t3m = by('T3', 'S', 't3_correct'), by('T3', 'M', 't3_correct')
    L += ['', '## RQ3 — single source (S) vs multi-source with conflicts (M)', '',
          f"- T2 recall — S: {desc(by('T2', 'S', 't2_recall'))} · M: {desc(by('T2', 'M', 't2_recall'))}",
          f"- T2 precision — S: {desc(by('T2', 'S', 't2_precision'))} · M: {desc(by('T2', 'M', 't2_precision'))}",
          f"- T3 correct ('mixed') — S: {sum(t3s)}/{len(t3s)} · M: {sum(t3m)}/{len(t3m)}",
          f"- T3 confidence — S: {desc(by('T3', 'S', 'confidence'))} · M: {desc(by('T3', 'M', 'confidence'))}"]
    try:
        from scipy import stats

        def paired(task, key):
            out = []
            for pid in sorted({r['pid'] for r in task_rows}):
                s_ = [r[key] for r in task_rows if r['pid'] == pid and r['task'] == task and r['cond'] == 'S' and r.get(key) is not None]
                m_ = [r[key] for r in task_rows if r['pid'] == pid and r['task'] == task and r['cond'] == 'M' and r.get(key) is not None]
                if s_ and m_:
                    out.append((s_[0], m_[0]))
            return out

        for task, key in [('T2', 't2_recall'), ('T2', 'seconds'), ('T3', 'confidence'), ('T1', 'tlx_block')]:
            p = paired(task, key)
            if len(p) >= 6 and any(x != y for x, y in p):
                res = stats.wilcoxon([x for x, _ in p], [y for _, y in p])
                z = stats.norm.isf(res.pvalue / 2)
                L.append(f'- Wilcoxon {task} {key}: W={res.statistic:.1f}, p={res.pvalue:.4f}, r={z / math.sqrt(len(p)):.2f} (n={len(p)})')
        t3 = paired('T3', 't3_correct')
        b = sum(1 for s_, m_ in t3 if s_ == 0 and m_ == 1)
        c = sum(1 for s_, m_ in t3 if s_ == 1 and m_ == 0)
        if b + c:
            L.append(f'- McNemar T3 (exact): S wrong→M right = {b}, S right→M wrong = {c}, p={stats.binomtest(min(b, c), b + c, 0.5).pvalue:.4f}')
    except ImportError:
        L.append('- _Install scipy for Wilcoxon / McNemar tests._')

    L += ['', '## RQ4 — statement types', '',
          '| claim type | n | really disagree (yes/partly/no) | impact on plans (1–5) | participants classified A as |',
          '|---|---|---|---|---|']
    for ct in ['evaluation', 'temporal', 'conditional']:
        ps = [p for p in pair_rows if p['claim_type'] == ct]
        if ps:
            d = Counter(p['disagree'] for p in ps)
            k = Counter(p['kind_A'] for p in ps)
            L.append(f"| {ct} | {len(ps)} | {d['Yes']}/{d['Partly']}/{d['No']} | {desc([p['impact'] for p in ps])} | "
                     + ', '.join(f'{x}: {n}' for x, n in k.most_common()) + ' |')
    L.append('\nConcrete high-impact examples: `out/rq4_examples.csv`.')

    def frac(task, cond, key):
        v = by(task, cond, key)
        return f'{sum(v)}/{len(v)}'

    L += ['', '## RQ5 — conflicts while planning (T4)', '',
          f"- Opened Knowledge during T4 — S: {frac('T4', 'S', 't4_opened_knowledge')} · M: {frac('T4', 'M', 't4_opened_knowledge')}",
          f"- Opened Conflicts during T4 — S: {frac('T4', 'S', 't4_opened_conflicts')} · M: {frac('T4', 'M', 't4_opened_conflicts')}",
          f"- Influence of disagreements (M): {dict(Counter(by('T4', 'M', 't4_conflict_influence')))}",
          f"- 'Disagreements helped me decide': {desc([p.get('int_helped') for p in part_rows])}",
          f"- 'Prefer conflicts inside the planner': {desc([p.get('int_inside') for p in part_rows])}",
          f"- 'Would use a conflicts-only tool': {desc([p.get('int_standalone') for p in part_rows])}",
          '', '## RQ6 — privacy', '',
          f"- Processing on own device matters: {desc([p.get('priv_device') for p in part_rows])}",
          f"- OK with server-side analysis of public sources: {desc([p.get('priv_server_ok') for p in part_rows])}",
          f"- OK sharing itinerary with a server: {desc([p.get('priv_share_itinerary') for p in part_rows])}",
          '', '## To code by hand', '',
          '- `tasks.csv`: fill `t1_code_rater1/2` (0/1/2, see tasks.md) and `t4_complete_coder`; '
          'check `t2_matched_topics` against `t2_raw`.']
    with open(os.path.join(OUT, 'summary.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(L) + '\n')
    print('\n'.join(L))
    print(f'\nWrote CSVs and summary.md to {OUT}')


if __name__ == '__main__':
    main()
