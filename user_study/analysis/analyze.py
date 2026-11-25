#!/usr/bin/env python3
"""Score and analyse the study sessions.

Usage (from travel_planner/):
    pip install -r user_study/analysis/requirements.txt
    python user_study/analysis/analyze.py
    python user_study/analysis/analyze.py --include-pilot --keep-lived

Inputs:  user_study/data/P##_session.json, and user_study/data/coding.csv once the raters have coded.
Outputs: user_study/analysis/out/ (CSV tables, tests.csv, coding_sheet.csv, summary.md).
"""
import argparse
import csv
import glob
import hashlib
import json
import math
import os
import random
from collections import Counter, defaultdict
from datetime import datetime

import pandas as pd

import ground_truth as gt
import stats_utils as su

HERE = os.path.dirname(os.path.abspath(__file__))
STUDY = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'out')
DATA = os.path.join(STUDY, 'data')

VIEWS = ['topics', 'map_panel', 'time_lens', 'place_window', 'debates', 'knowledge', 'explore', 'itinerary']
CONFLICT_VIEWS = {'topics', 'map_panel', 'debates', 'knowledge'}
TYPES = ['practical', 'evaluative', 'norm']
DISAGREE_SCORE = {'Yes': 2, 'Partly': 1, 'No': 0}
DWELL_CAP = 120
SUS_BENCHMARK = 68

CODES = {
    't1_code': 'T1: 0 = wrong or no answer, 1 = one-sided summary, 2 = says that sources differ or names a condition',
    't2_real': 'T2 item: 1 = a real disagreement about the same point (both cannot be true), 0 = otherwise',
    't4_sources': 'T4 reason: 1 = mentions what sources say or that they disagree, 0 = otherwise',
}
WEIGHTED = {'t1_code'}


# Sessions

def load_sessions(data_dir, include_pilot, keep_lived):
    sessions, excluded = [], []
    for path in sorted(glob.glob(os.path.join(data_dir, '*_session.json'))):
        with open(path, encoding='utf-8') as f:
            s = json.load(f)
        demo = s.get('answers', {}).get('demographics') or {}
        if s.get('pilot') and not include_pilot:
            excluded.append((s['pid'], 'pilot'))
        elif not (s.get('answers', {}).get('consent') or {}).get('agree'):
            excluded.append((s['pid'], 'no consent'))
        elif not keep_lived and 'Yes' in (demo.get('lived_paris'), demo.get('lived_rome')):
            excluded.append((s['pid'], 'lived in Paris or Rome'))
        else:
            sessions.append(s)
    return sessions, excluded


def code_id(*parts):
    return hashlib.sha1('|'.join(map(str, parts)).encode()).hexdigest()[:8]


# Coding

def load_coding(path):
    if not os.path.exists(path):
        return {}
    with open(path, encoding='utf-8') as f:
        return {r['code_id']: r for r in csv.DictReader(f)}


def as_int(v):
    v = (v or '').strip()
    return int(v) if v.lstrip('-').isdigit() else None


def coded_value(coding, cid):
    """Final code: the 'final' column, else the raters' code when they agree, else None."""
    row = coding.get(cid)
    if not row:
        return None
    final = as_int(row.get('final'))
    if final is not None:
        return final
    r1, r2 = as_int(row.get('rater1')), as_int(row.get('rater2'))
    return r1 if r1 is not None and r1 == r2 else None


def write_coding_sheet(items, coding):
    """Blind sheet: no participant number, condition or order. Rows already coded keep their codes."""
    rows = []
    for it in items:
        old = coding.get(it['code_id'], {})
        rows.append({**it, 'instructions': CODES[it['field']],
                     'rater1': old.get('rater1', ''), 'rater2': old.get('rater2', ''), 'final': old.get('final', '')})
    random.Random(1).shuffle(rows)
    write_csv('coding_sheet.csv', rows)


# Tables

def t2_items(answers):
    if answers.get('none_found'):
        return []
    items = []
    for i in (1, 2, 3):
        topic, about = (answers.get(f'topic{i}') or '').strip(), (answers.get(f'about{i}') or '').strip()
        if topic or about:
            items.append((i, f'{topic}: {about}'.strip(': ')))
    return items


def dwell_rows(s):
    """Click log with time until the next click (capped) as dwell for the clicked view."""
    end = {(r['block'], r['task']): r.get('submittedAt') for r in s.get('tasks', [])}
    by_task = defaultdict(list)
    for entry in s.get('log', []):
        by_task[(entry['block'], entry['task'])].append(entry)
    rows = []
    for key, entries in by_task.items():
        entries.sort(key=lambda e: e['t'])
        stamps = [e['t'] for e in entries[1:]] + [end.get(key) or entries[-1]['t']]
        for e, nxt in zip(entries, stamps):
            secs = (datetime.fromisoformat(nxt.replace('Z', '+00:00')) - datetime.fromisoformat(e['t'].replace('Z', '+00:00'))).total_seconds()
            rows.append({'pid': s['pid'], **{k: e.get(k) for k in ('block', 'task', 'view', 'text', 't')},
                         'dwell': max(0.0, min(secs, DWELL_CAP))})
    return rows


def build_tables(sessions, coding):
    gt_m = {c: gt.contested(c) for c in gt.CITIES}
    t3_key = {c: gt.t3_expected(c) for c in gt.CITIES}
    tasks, participants, views, pairs, clicks, coding_items = [], [], [], [], [], []

    for s in sessions:
        pid, a = s['pid'], s.get('answers', {})
        cond_of = {r['block']: r['cond'] for r in s.get('tasks', [])}
        tlx = {b: tlx_raw(a.get(f'tlx_b{b}')) for b in (1, 2)}
        session_clicks = dwell_rows(s)
        for c in session_clicks:
            c['cond'] = cond_of.get(c['block'])
        clicks += session_clicks

        for r in s.get('tasks', []):
            ans, block, task = r.get('answers') or {}, r['block'], r['task']
            row = {'pid': pid, 'block': block, 'cond': r['cond'], 'city': r['city'], 'task': task,
                   'seconds': r.get('seconds'), 'log_seconds': math.log(r['seconds']) if r.get('seconds') else None,
                   'seq': ans.get('seq'), 'confidence': ans.get('confidence'), 'tlx': tlx.get(block)}
            if task == 'T1':
                cid = code_id(pid, block, 'T1')
                coding_items.append({'code_id': cid, 'field': 't1_code', 'city': r['city'], 'text': ans.get('answer', '')})
                row.update(t1_answer=ans.get('answer'), t1_code=coded_value(coding, cid))
            elif task == 'T2':
                items = t2_items(ans)
                real = []
                for i, text in items:
                    cid = code_id(pid, block, 'T2', i)
                    coding_items.append({'code_id': cid, 'field': 't2_real', 'city': r['city'], 'text': text})
                    real.append(coded_value(coding, cid))
                matched = sorted({t for _, text in items for t in gt.match_topics(text, gt_m[r['city']])})
                row.update(t2_listed=len(items), t2_real=sum(real) if None not in real else None,
                           t2_auto_matched='; '.join(matched),
                           t2_auto_recall=len(matched) / min(3, len(gt_m[r['city']])),
                           t2_raw=' | '.join(text for _, text in items))
            elif task == 'T3':
                expected = t3_key[r['city']]
                row.update(t3_verdict=ans.get('verdict'), t3_expected=expected['verdict'],
                           t3_correct=gt.t3_correct(ans.get('verdict'), expected), t3_reason=ans.get('reason'))
            elif task == 'T4':
                app = r.get('app') or {}
                stops = app.get('stops') or []
                used = {c['view'] for c in session_clicks if c['block'] == block and c['task'] == 'T4'}
                cid = code_id(pid, block, 'T4')
                coding_items.append({'code_id': cid, 'field': 't4_sources', 'city': r['city'], 'text': ans.get('why', '')})
                row.update(t4_stops=' | '.join(stops), t4_n_stops=len(stops), t4_complete=int(3 <= len(stops) <= 4) if app else None,
                           t4_why=ans.get('why'), t4_sources=coded_value(coding, cid),
                           t4_conflict_influence=ans.get('conflict_influence'),
                           t4_used_conflict_views=int(bool(used & CONFLICT_VIEWS)), t4_used_debates=int('debates' in used),
                           debate_labels=len(app.get('debateLabels') or []))
            tasks.append(row)

        demo = a.get('demographics') or {}
        participants.append({
            'pid': pid, 'order': ' > '.join(f"{o['cond']}-{o['city']}" for o in s.get('order', [])),
            **{k: demo.get(k) for k in ('age', 'gender', 'english', 'trips', 'visited_paris', 'visited_rome', 'map_comfort')},
            'sources': '; '.join(demo.get('sources') or []),
            'sus': sus_score(a.get('sus')), **(a.get('integration') or {}),
            **{f'final_{k}': v for k, v in (a.get('final') or {}).items()},
        })
        views += [{'pid': pid, 'view': v, **vals} for v, vals in (a.get('views') or {}).items()]
        for p in s.get('pairs') or []:
            ans = p.get('answers') or {}
            pairs.append({'pid': pid, 'pair': p['id'], 'type': p['type'], 'type_a': p['typesAB'][0], 'type_b': p['typesAB'][1],
                          'city': p['city'], 'place': p['place'], 'a_source': p['a']['source'], 'a_claim': p['a']['claim'],
                          'b_source': p['b']['source'], 'b_claim': p['b']['claim'], 'disagree': ans.get('disagree'),
                          'disagree_score': DISAGREE_SCORE.get(ans.get('disagree')), 'impact': ans.get('impact'),
                          'kind_a': ans.get('kind_a'), 'kind_b': ans.get('kind_b')})
    return tasks, participants, views, pairs, clicks, coding_items, gt_m, t3_key


def sus_score(a):
    if not a or any(a.get(f'sus{i}') is None for i in range(1, 11)):
        return None
    return 2.5 * sum((a[f'sus{i}'] - 1) if i % 2 else (5 - a[f'sus{i}']) for i in range(1, 11))


def sus_adjective(score):
    return 'excellent' if score >= 85.5 else 'good' if score >= 71.4 else 'OK' if score >= 50.9 else 'poor'


def tlx_raw(a):
    vals = [a.get(f'tlx_{k}') for k in ('mental', 'physical', 'temporal', 'performance', 'effort', 'frustration')] if a else []
    return sum(vals) / len(vals) if vals and None not in vals else None


def write_csv(name, rows):
    if not rows:
        return
    keys = list(dict.fromkeys(k for r in rows for k in r))
    with open(os.path.join(OUT, name), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(rows)


# Tests

def paired(tasks, task, key, a='N', b='M', by='cond'):
    vals = defaultdict(dict)
    for r in tasks:
        if r['task'] == task and r.get(key) is not None:
            vals[r['pid']][r[by]] = r[key]
    return [(v[a], v[b]) for v in vals.values() if a in v and b in v]


def run_tests(tasks, participants, pairs):
    tests = []

    def add(rq, family, outcome, test, res, **extra):
        if res:
            tests.append({'rq': rq, 'family': family, 'outcome': outcome, 'test': test, **res, **extra})

    # Primary outcomes, Holm-corrected together.
    add('RQ2', 'primary', 'NASA-TLX raw (block)', 'Wilcoxon M vs N', su.wilcoxon_paired(paired(tasks, 'T1', 'tlx')))
    add('RQ3', 'primary', 'T2 real disagreements found (coded)', 'Wilcoxon M vs N', su.wilcoxon_paired(paired(tasks, 'T2', 't2_real')))
    add('RQ3', 'primary', 'T1 code (0 to 2)', 'Wilcoxon M vs N', su.wilcoxon_paired(paired(tasks, 'T1', 't1_code')))
    per_type = pair_means(pairs, 'disagree_score')
    add('RQ4', 'primary', 'Perceived disagreement by statement type', 'Friedman', su.friedman(per_type))

    # Secondary outcomes.
    for task in ('T1', 'T2', 'T3', 'T4'):
        add('RQ1', 'secondary', f'{task} log time', 'Wilcoxon M vs N', su.wilcoxon_paired(paired(tasks, task, 'log_seconds')))
        add('RQ1', 'secondary', f'{task} SEQ', 'Wilcoxon M vs N', su.wilcoxon_paired(paired(tasks, task, 'seq')))
    for task in ('T1', 'T2', 'T3'):
        add('RQ3', 'secondary', f'{task} confidence', 'Wilcoxon M vs N', su.wilcoxon_paired(paired(tasks, task, 'confidence')))
    add('RQ3', 'secondary', 'T2 automatic recall', 'Wilcoxon M vs N', su.wilcoxon_paired(paired(tasks, 'T2', 't2_auto_recall')))
    add('RQ3', 'secondary', 'T3 correct', 'McNemar exact', su.mcnemar_exact(paired(tasks, 'T3', 't3_correct')))
    add('RQ5', 'secondary', 'T4 used conflict views', 'McNemar exact', su.mcnemar_exact(paired(tasks, 'T4', 't4_used_conflict_views')))
    add('RQ1', 'secondary', 'SUS vs 68', 'one-sample t', su.one_sample_t([p['sus'] for p in participants], SUS_BENCHMARK))
    for key in ('int_helped', 'int_inside', 'int_standalone'):
        add('RQ5', 'secondary', f'{key} vs neutral (3)', 'one-sample Wilcoxon', su.one_sample_wilcoxon([p.get(key) for p in participants], 3))
    add('RQ4', 'secondary', 'Impact on plans by statement type', 'Friedman', su.friedman(pair_means(pairs, 'impact')))
    for i, t1 in enumerate(TYPES):
        for t2 in TYPES[i + 1:]:
            res = su.wilcoxon_paired([(row[i], row[TYPES.index(t2)]) for row in per_type])
            add('RQ4', 'secondary', f'Perceived disagreement, {t2} minus {t1}', 'Wilcoxon', res)

    # Robustness: mixed models with order (block) and city, and a carry-over check.
    df = pd.DataFrame(tasks)
    if not df.empty:
        for task, key, label in (('T1', 'tlx', 'NASA-TLX raw'), ('T2', 't2_real', 'T2 real disagreements'),
                                 ('T1', 't1_code', 'T1 code'), ('T2', 'log_seconds', 'T2 log time')):
            add('robustness', 'secondary', label, 'mixed model, M vs N', su.mixed_model(df[df.task == task], key))
    pdf = pd.DataFrame(pairs)
    if not pdf.empty:
        for key in ('disagree_score', 'impact'):
            res = su.crossed_mixed_model(pdf, key, 'C(type, Treatment("practical"))')
            for term, vals in (res or {}).items():
                add('RQ4', 'secondary', f'{key}, {term.split("[T.")[-1].rstrip("]")} vs practical', 'mixed model, crossed', vals)

    primary = [t for t in tests if t['family'] == 'primary']
    for t, p in zip(primary, su.holm([t['p'] for t in primary])):
        t['p_holm'] = p
    return tests


def pair_means(pairs, key):
    by = defaultdict(lambda: defaultdict(list))
    for p in pairs:
        if p.get(key) is not None:
            by[p['pid']][p['type']].append(p[key])
    return [[sum(v[t]) / len(v[t]) for t in TYPES] for v in by.values() if all(v[t] for t in TYPES)]


# Summary

def fmt_p(p):
    return 'p < .001' if p < 0.001 else f'p = {p:.3f}'.replace('0.', '.')


def fmt_test(t):
    if 'W' in t and 'estimate' in t:
        s = f"W = {t['W']:.1f}, {fmt_p(t['p'])}, r = {t['r']:.2f}, HL = {t['estimate']:.2f} [{t['ci_low']:.2f}, {t['ci_high']:.2f}], n = {t['n']}"
    elif 'chi2' in t:
        s = f"chi2({t['df']}) = {t['chi2']:.2f}, {fmt_p(t['p'])}, Kendall's W = {t['kendall_w']:.2f}, n = {t['n']}"
    elif 'N0_M1' in t:
        s = f"N no and M yes = {t['N0_M1']}; N yes and M no = {t['N1_M0']}; {fmt_p(t['p'])}, n = {t['n']}"
    elif 't' in t:
        s = f"t({t['df']}) = {t['t']:.2f}, {fmt_p(t['p'])}, d = {t['d']:.2f}"
    elif 'W' in t:
        s = f"Mdn = {t['median']:.1f}, W = {t['W']:.1f}, {fmt_p(t['p'])}, r = {t['r']:.2f}, n = {t['n']}"
    else:
        s = f"b = {t['b']:.2f} [{t['ci_low']:.2f}, {t['ci_high']:.2f}], {fmt_p(t['p'])}"
        if 'p_carryover' in t:
            s += f", condition x block {fmt_p(t['p_carryover'])}"
    if 'p_holm' in t:
        s += f", Holm {fmt_p(t['p_holm'])}"
    return s


def summary(sessions, excluded, tasks, participants, views, pairs, clicks, coding_items, coding, gt_m, t3_key, tests):
    def by(task, cond, key):
        return [r[key] for r in tasks if r['task'] == task and r['cond'] == cond and r.get(key) is not None]

    L = ['# User study summary', '', f'Participants analysed: **{len(sessions)}**']
    if excluded:
        L.append('Excluded: ' + ', '.join(f'{pid} ({why})' for pid, why in excluded))

    L += ['', '## Ground truth', '', 'T2, topics and places shown as "opinions split" (the same data in both conditions):']
    L += [f'- {c.title()}: ' + ', '.join(t.split('·')[-1].strip() for t in gt_m[c]) for c in gt.CITIES]
    L += ['', 'T3, correct answer:']
    for c, e in sorted(t3_key.items()):
        accept = '; "mixed" also accepted' if e['verdict'] != 'mixed' and e['score'] >= gt.NEAR_SPLIT else ''
        L.append(f"- {c.title()}: **{e['verdict']}** ({e['pos']} positive, {e['neg']} negative, score {e['score']:.2f}{accept})")

    uncoded = sum(coded_value(coding, it['code_id']) is None for it in coding_items)
    L += ['', '## Coding and inter-rater agreement', '',
          f'{len(coding_items)} answers to code, {uncoded} without a final code. Sheet: `out/coding_sheet.csv`, '
          'save the coded copy as `user_study/data/coding.csv`.']
    for field, text in CODES.items():
        rows = [coding.get(it['code_id'], {}) for it in coding_items if it['field'] == field]
        k = su.cohen_kappa([as_int(r.get('rater1')) for r in rows], [as_int(r.get('rater2')) for r in rows], field in WEIGHTED)
        L.append(f"- {text}: Cohen's kappa{' (linear weights)' if field in WEIGHTED else ''} = {k:.2f}" if k is not None
                 else f'- {text}: not coded yet')

    if not sessions:
        return L + ['', '_No session files found._']

    L += ['', '## Tests', '', 'Primary outcomes are Holm-corrected together. All other tests are secondary.', '']
    for family in ('primary', 'secondary'):
        L += [f'### {family.title()}', '', '| RQ | Outcome | Test | Result |', '|---|---|---|---|']
        L += [f"| {t['rq']} | {t['outcome']} | {t['test']} | {fmt_test(t)} |" for t in tests if t['family'] == family]
        L.append('')

    sus = [p['sus'] for p in participants if p['sus'] is not None]
    ci = su.mean_ci(sus)
    L += ['## RQ1, usability', '']
    if sus:
        L.append(f"- SUS: {su.describe(sus)}" + (f', 95% CI [{ci[0]:.1f}, {ci[1]:.1f}]' if ci else '')
                 + f', adjective: {sus_adjective(sum(sus) / len(sus))}')
    for task in ('T1', 'T2', 'T3', 'T4'):
        L.append(f"- {task} time (s), N: {su.describe(by(task, 'N', 'seconds'))}; M: {su.describe(by(task, 'M', 'seconds'))}")
        L.append(f"- {task} SEQ, N: {su.describe(by(task, 'N', 'seq'))}; M: {su.describe(by(task, 'M', 'seq'))}")
    t4 = [r['t4_complete'] for r in tasks if r['task'] == 'T4' and r.get('t4_complete') is not None]
    L.append(f'- T4 plan complete (3 to 4 stops): {sum(t4)}/{len(t4)}')

    L += ['', '## RQ2, views and workload', '',
          f"- NASA-TLX raw, N: {su.describe(by('T1', 'N', 'tlx'))}; M: {su.describe(by('T1', 'M', 'tlx'))}", '',
          '| View | used | understood (1-5) | useful (1-5) | would remove [95% CI] | clicks | dwell share |', '|---|---|---|---|---|---|---|']
    n_clicks = Counter(c['view'] for c in clicks)
    dwell = Counter()
    for c in clicks:
        dwell[c['view']] += c['dwell']
    total_dwell = sum(dwell.values()) or 1
    for v in sorted(VIEWS, key=lambda v: -dwell.get(v, 0)):
        vs = [x for x in views if x['view'] == v]
        if not vs:
            continue
        und = [x['understood'] for x in vs if x.get('understood')]
        use = [x['useful'] for x in vs if x.get('useful')]
        used = sum(bool(x['used']) for x in vs)
        rem = sum(bool(x['remove']) for x in vs)
        lo, hi = su.wilson(rem, len(vs))
        und_s = f'{sum(und) / len(und):.1f}' if und else '-'
        use_s = f'{sum(use) / len(use):.1f}' if use else '-'
        L.append(f'| {v} | {used}/{len(vs)} | {und_s} | {use_s} | {rem}/{len(vs)} [{lo:.2f}, {hi:.2f}] | '
                 f'{n_clicks.get(v, 0)} | {dwell.get(v, 0) / total_dwell:.0%} |')
    top = sorted((dwell.get(v, 0) for v in VIEWS), reverse=True)
    if top:
        k = math.ceil(len(top) / 3)
        L.append(f'\nThe top third of views ({k} of {len(top)}) account for {sum(top[:k]) / (sum(top) or 1):.0%} of dwell time in the rated views.')

    t3n, t3m = by('T3', 'N', 't3_correct'), by('T3', 'M', 't3_correct')
    L += ['', '## RQ3, without (N) vs with conflict views (M)', '',
          f"- T1 code, N: {su.describe(by('T1', 'N', 't1_code'))}; M: {su.describe(by('T1', 'M', 't1_code'))}",
          f"- T2 real disagreements (coded), N: {su.describe(by('T2', 'N', 't2_real'))}; M: {su.describe(by('T2', 'M', 't2_real'))}",
          f"- T2 automatic recall, N: {su.describe(by('T2', 'N', 't2_auto_recall'))}; M: {su.describe(by('T2', 'M', 't2_auto_recall'))}",
          f'- T3 correct, N: {sum(t3n)}/{len(t3n)}; M: {sum(t3m)}/{len(t3m)}']

    L += ['', '## RQ4, statement types', '',
          '| Type | ratings | really disagree (yes/partly/no) | impact (1-5) | A classified as the paper type |', '|---|---|---|---|---|']
    for t in TYPES:
        ps = [p for p in pairs if p['type'] == t]
        if ps:
            d = Counter(p['disagree'] for p in ps)
            match = [p['kind_a'] == p['type_a'] for p in ps if p['kind_a'] not in (None, 'unsure')]
            L.append(f"| {t} | {len(ps)} | {d['Yes']}/{d['Partly']}/{d['No']} | {su.describe([p['impact'] for p in ps])} | "
                     f"{sum(match)}/{len(match)} |")
    rated = [(p[f'kind_{s}'], p[f'type_{s}']) for p in pairs for s in 'ab' if p[f'kind_{s}'] not in (None, 'unsure')]
    k = su.cohen_kappa([x for x, _ in rated], [y for _, y in rated])
    if k is not None:
        L.append(f"\nAgreement between participants' statement types and the paper's classifier: Cohen's kappa = {k:.2f} ({len(rated)} ratings).")
    L.append('Concrete high-impact examples: `out/rq4_examples.csv`.')

    L += ['', '## RQ5, conflicts while planning (T4)', '']
    for cond in ('N', 'M'):
        u = by('T4', cond, 't4_used_conflict_views')
        L.append(f'- Used conflict views during T4, {cond}: {sum(u)}/{len(u)}')
    L.append(f"- Influence of disagreements (M): {dict(Counter(by('T4', 'M', 't4_conflict_influence')))}")
    src = [r['t4_sources'] for r in tasks if r['task'] == 'T4' and r.get('t4_sources') is not None]
    L.append(f'- Reason mentions source information (coded): {sum(src)}/{len(src)}')
    for key, text in (('int_helped', 'Disagreements helped me decide'), ('int_inside', 'Prefer conflicts inside the planner'),
                      ('int_standalone', 'Would use a conflicts-only tool')):
        L.append(f"- '{text}': {su.describe([p.get(key) for p in participants])}")
    return L


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=DATA)
    ap.add_argument('--include-pilot', action='store_true')
    ap.add_argument('--keep-lived', action='store_true', help='keep participants who lived in Paris or Rome')
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)

    sessions, excluded = load_sessions(args.data, args.include_pilot, args.keep_lived)
    coding = load_coding(os.path.join(args.data, 'coding.csv'))
    tasks, participants, views, pairs, clicks, coding_items, gt_m, t3_key = build_tables(sessions, coding)
    tests = run_tests(tasks, participants, pairs) if sessions else []

    write_coding_sheet(coding_items, coding)
    for name, rows in (('tasks.csv', tasks), ('participants.csv', participants), ('views.csv', views), ('pairs.csv', pairs),
                       ('clicks.csv', clicks), ('tests.csv', tests),
                       ('rq4_examples.csv', [p for p in pairs if p['disagree'] == 'Yes' and (p['impact'] or 0) >= 4])):
        write_csv(name, rows)
    lines = summary(sessions, excluded, tasks, participants, views, pairs, clicks, coding_items, coding, gt_m, t3_key, tests)
    with open(os.path.join(OUT, 'summary.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print('\n'.join(lines))
    print(f'\nWrote tables and summary.md to {OUT}')


if __name__ == '__main__':
    main()
