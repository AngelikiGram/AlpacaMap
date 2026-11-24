# TravelScout user study

Everything needed to run the end-user evaluation requested in the Transactions in GIS review
(manuscript 9295540): design, materials, a browser-based study runner and the analysis script.

| File | What it is |
|---|---|
| `reviewer_comments_mapping.md` | Each reviewer comment about the app → research question → what is measured |
| `protocol.md` | Design (within-subjects, single-source vs multi-source, Paris/Rome counterbalanced), participants, procedure, measures, hypotheses, analysis plan, ethics |
| `consent_form.md` | Consent text (also shown in the runner) |
| `tasks.md` | The four tasks, facilitator tour script, scoring and coding rules |
| `questionnaires.md` | Demographics, SEQ, confidence, NASA-TLX, statement pairs, SUS, view ratings, integration, privacy |
| `interview_guide.md` | Semi-structured interview questions |
| `runner/` | The study web page: runs the whole session, preloads the app per condition, logs clicks inside the app, exports one JSON per participant |
| `runner/pairs.json` | The statement pairs for RQ4, built by `analysis/make_pairs.py` (paper's candidate-pair rules and statement types). Read it before the study and delete pairs you would not show. |
| `analysis/make_pairs.py` | Rebuilds `runner/pairs.json` from `public/preprocessed/` (run after the data changes) |
| `analysis/analyze.py` | Scores and summarises all sessions → CSV tables + `summary.md` |
| `data/` | Put exported sessions here (git-ignored) |

## Running a session

**Online (recommended):** open **https://angelikigram.github.io/AlpacaMap/study/**
(the deploy workflow copies `runner/` there on every push).

**Locally:** `npm run dev`, then open **http://localhost:5174/user_study/runner/**
(the dev server serves the whole project folder, so the runner and the app share an origin).

1. Enter the participant number (`P01`, `P02`, …). The order of conditions and cities follows from it (`protocol.md`).
2. Hand over the computer. The runner shows consent, questions and tasks; the app appears on the right during tasks.
3. At the end, press **Export session** and move `P##_session.json` into `data/`.
4. Press **End session & restore app data**. The app's own saved trips on that computer were backed up at the start and are restored now.

Tips
- Run one **pilot** session first (tick "Pilot session"); pilots are excluded from analysis by default.
- If anything breaks mid-session, **Ctrl + Shift + E** exports what has been collected so far. Reloading the page resumes the session where it stopped.
- Use Chrome or Edge, full screen, at least 1366 × 768.

## How the conditions work
The runner writes a trip for the block's city into the app's browser storage before loading it:
- **S (single source):** only Wikivoyage statements from `public/preprocessed/<city>.json`.
- **M (multi-source):** all statements (Wikivoyage, Wikitravel, Wikipedia, Reddit, StackExchange).

The app itself is not modified, and no live APIs are needed, so every participant sees the same data.

## Analysis

```bash
python user_study/analysis/analyze.py              # add --include-pilot to include pilots
```
Outputs in `analysis/out/`: `tasks.csv`, `participants.csv`, `views.csv`, `pairs.csv`, `clicks.csv`,
`rq4_examples.csv`, `summary.md`. Install `scipy` to add Wilcoxon/McNemar tests. T1 answers and T4 plans
need manual coding by two raters (columns are prepared in `tasks.csv`).
