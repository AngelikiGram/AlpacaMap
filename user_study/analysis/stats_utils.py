"""Statistics used in the study analysis."""
import math
import statistics as st
import warnings

import numpy as np
import statsmodels.formula.api as smf
from scipy import stats

RNG = np.random.default_rng(1)


def describe(xs):
    xs = [x for x in xs if x is not None]
    if not xs:
        return 'n/a'
    if len(xs) == 1:
        return f'{xs[0]:.2f} (n=1)'
    return f'M = {st.mean(xs):.2f}, SD = {st.stdev(xs):.2f}, Mdn = {st.median(xs):.2f}, n = {len(xs)}'


def mean_ci(xs, level=0.95):
    xs = np.asarray([x for x in xs if x is not None], float)
    if len(xs) < 2:
        return None
    half = stats.t.ppf((1 + level) / 2, len(xs) - 1) * xs.std(ddof=1) / math.sqrt(len(xs))
    return xs.mean() - half, xs.mean() + half


def wilson(k, n, z=1.96):
    if not n:
        return None
    p = k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return centre - half, centre + half


def hodges_lehmann(d):
    d = np.asarray(d, float)
    walsh = (d[:, None] + d[None, :]) / 2
    return float(np.median(walsh[np.triu_indices(len(d))]))


def bootstrap_ci(d, fn=hodges_lehmann, n=5000):
    d = np.asarray(d, float)
    reps = [fn(RNG.choice(d, len(d))) for _ in range(n)]
    return float(np.percentile(reps, 2.5)), float(np.percentile(reps, 97.5))


def wilcoxon_paired(pairs):
    """pairs: [(first, second)]. Difference is second minus first. r = Z / sqrt(n pairs)."""
    s = np.array([a for a, _ in pairs], float)
    m = np.array([b for _, b in pairs], float)
    d = m - s
    if len(d) < 6 or not d.any():
        return None
    res = stats.wilcoxon(m, s, method='approx')
    lo, hi = bootstrap_ci(d)
    return {'n': len(d), 'W': float(res.statistic), 'p': float(res.pvalue),
            'r': abs(float(res.zstatistic)) / math.sqrt(len(d)),
            'estimate': hodges_lehmann(d), 'ci_low': lo, 'ci_high': hi}


def mcnemar_exact(pairs):
    """pairs: [(N, M)] as 0/1."""
    b = sum(1 for s, m in pairs if s == 0 and m == 1)
    c = sum(1 for s, m in pairs if s == 1 and m == 0)
    if not b + c:
        return None
    return {'n': len(pairs), 'N0_M1': b, 'N1_M0': c, 'p': float(stats.binomtest(min(b, c), b + c, 0.5).pvalue)}


def one_sample_wilcoxon(xs, mu):
    xs = np.asarray([x for x in xs if x is not None], float)
    if len(xs) < 6 or not (xs - mu).any():
        return None
    res = stats.wilcoxon(xs - mu, method='approx')
    return {'n': len(xs), 'W': float(res.statistic), 'p': float(res.pvalue),
            'r': abs(float(res.zstatistic)) / math.sqrt(len(xs)), 'median': float(np.median(xs))}


def one_sample_t(xs, mu):
    xs = np.asarray([x for x in xs if x is not None], float)
    if len(xs) < 3:
        return None
    res = stats.ttest_1samp(xs, mu)
    return {'n': len(xs), 't': float(res.statistic), 'df': len(xs) - 1, 'p': float(res.pvalue),
            'd': float((xs.mean() - mu) / xs.std(ddof=1))}


def friedman(table):
    """table: rows = participants, columns = conditions (no missing values)."""
    table = np.asarray(table, float)
    if len(table) < 6:
        return None
    res = stats.friedmanchisquare(*table.T)
    k = table.shape[1]
    return {'n': len(table), 'chi2': float(res.statistic), 'df': k - 1, 'p': float(res.pvalue),
            'kendall_w': float(res.statistic / (len(table) * (k - 1)))}


def holm(pvalues):
    """Holm-adjusted p values, same order as the input."""
    order = sorted(range(len(pvalues)), key=lambda i: pvalues[i])
    adjusted, running = [0.0] * len(pvalues), 0.0
    for rank, i in enumerate(order):
        running = max(running, (len(pvalues) - rank) * pvalues[i])
        adjusted[i] = min(1.0, running)
    return adjusted


def cohen_kappa(a, b, weighted=False):
    """Cohen's kappa for two raters; linear weights for ordinal codes."""
    rows = [(x, y) for x, y in zip(a, b) if x is not None and y is not None]
    if len(rows) < 2:
        return None
    cats = sorted({v for r in rows for v in r})
    if len(cats) == 1:
        return 1.0
    idx = {c: i for i, c in enumerate(cats)}
    k = len(cats)
    obs = np.zeros((k, k))
    for x, y in rows:
        obs[idx[x], idx[y]] += 1
    obs /= obs.sum()
    exp = np.outer(obs.sum(1), obs.sum(0))
    w = np.abs(np.subtract.outer(np.arange(k), np.arange(k))) / (k - 1) if weighted else 1 - np.eye(k)
    denom = (w * exp).sum()
    return float(1 - (w * obs).sum() / denom) if denom else 1.0


def mixed_model(df, outcome, group='pid'):
    """Random intercept per participant; fixed condition, block and city.

    Returns the M vs S effect and, from a second model, the condition by block interaction
    (a check for carry-over between blocks).
    """
    data = df.dropna(subset=[outcome])
    if data[group].nunique() < 8 or data['cond'].nunique() < 2:
        return None
    cond = 'C(cond, Treatment("N"))'

    def fit(rhs):
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            return smf.mixedlm(f'{outcome} ~ {rhs}', data, groups=data[group]).fit(reml=True)

    main = fit(f'{cond} + C(block) + C(city)')
    term = next(t for t in main.params.index if t.startswith('C(cond'))
    lo, hi = main.conf_int().loc[term]
    inter = fit(f'{cond} * C(block) + C(city)')
    inter_term = next(t for t in inter.params.index if ':' in t)
    return {'n': data[group].nunique(), 'b': float(main.params[term]), 'ci_low': float(lo), 'ci_high': float(hi),
            'p': float(main.pvalues[term]), 'p_carryover': float(inter.pvalues[inter_term])}


def crossed_mixed_model(df, outcome, fixed, groups=('pid', 'pair')):
    """Crossed random intercepts for participants and items. Returns the fixed effects."""
    data = df.dropna(subset=[outcome]).assign(_all=1)
    if data[groups[0]].nunique() < 8:
        return None
    vc = {g: f'0 + C({g})' for g in groups}
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        fit = smf.mixedlm(f'{outcome} ~ {fixed}', data, groups=data['_all'], vc_formula=vc, re_formula='0').fit(reml=True)
    ci = fit.conf_int()
    return {t: {'b': float(fit.params[t]), 'ci_low': float(ci.loc[t, 0]), 'ci_high': float(ci.loc[t, 1]), 'p': float(fit.pvalues[t])}
            for t in fit.params.index if t != 'Intercept' and not t.endswith('Var')}
