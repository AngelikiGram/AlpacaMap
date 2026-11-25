# User study

Everything needed to run the end-user evaluation requested in the Transactions in GIS review
(manuscript 9295540): design, materials, a browser-based study runner and the analysis.
Participants see the app as **AlpacaMap**; the paper calls it TravelScout.

| File | What it is |
|---|---|
| `reviewer_comments_mapping.md` | Each reviewer comment about the app, its research question and what is measured |
| `protocol.md` | Design, participants and power, procedure, measures, hypotheses, analysis plan, limitations, ethics |
| `consent_form.md` | Consent text (also shown in the runner) |
| `tasks.md` | Tour script, the four tasks, ground truth and the coding procedure |
| `questionnaires.md` | All questionnaire items |
| `interview_guide.md` | Semi-structured interview questions |
| `runner/` | The study web page: runs the session, preloads the app per condition, logs clicks, exports one JSON per participant |
| `runner/config.js` | All wording, tasks and questionnaires |
| `runner/pairs.json` | The 12 statement pairs for RQ4, built by `analysis/make_pairs.py` |
| `analysis/analyze.py` | Scores the sessions, runs the tests, writes the coding sheet, tables and `summary.md` |
| `analysis/ground_truth.py` | Correct answers for T2 and T3 from the app's data |
| `analysis/stats_utils.py` | Statistical tests |
| `analysis/make_pairs.py` | Builds `runner/pairs.json` |
| `data/` | Exported sessions and `coding.csv` (git-ignored) |

## Before the study
1. **Statement pairs.** The 12 pairs are chosen in `analysis/pairs_pick.json` (see `questionnaires.md`). To change them,
   edit that file and run `python user_study/analysis/make_pairs.py --pick user_study/analysis/pairs_pick.json`.
   All automatic candidates are listed in `analysis/out/pair_candidates.json`.
2. Register the hypotheses and analysis plan (`protocol.md`).
3. Run one or two **pilot** sessions (tick "Pilot session") and check `analysis/out/clicks.csv`: every click should have a view.

## Running a session
**Online:** open **https://angelikigram.github.io/AlpacaMap/study/** (the deploy workflow copies `runner/` there on every push).

**Locally:** `npm run dev`, then open **http://localhost:5174/user_study/runner/**.

1. Enter the participant number (`P01`, `P02`, ...). The order of conditions and cities follows from it.
2. Give the tour on the app shown next to the tour text (`tasks.md`), then hand over the computer.
3. At the end, press **Export session** and move `P##_session.json` into `data/`.
4. Press **End session & restore app data**. The app's own saved trips on that computer were backed up at the start and are restored now.

Tips
- If anything breaks mid-session, **Ctrl + Shift + E** exports what has been collected so far. Reloading the page resumes the session.
- Use Chrome or Edge, full screen, at least 1366 x 768.

## How the conditions work
For each block the runner writes a trip with all statements for the city (`public/preprocessed/<city>.json`) into the
app's browser storage before loading it:
- **N (no conflict views):** the runner also sets `alpacamap_study_hide_conflicts`. The app reads it in `src/studyMode.js`
  and hides the views that show where sources disagree (`protocol.md`, Design).
- **M (conflict views):** the full app.

The trip marks the city's bundled statements as already loaded, so the app does not load them a second time. After
loading, the runner selects the trip's city so that the topic buttons and the map panel show its statements. The flag is
removed when the next block starts and when the session ends, so the app is unchanged outside the study. No live APIs
are needed, so every participant sees the same data.

## Analysis
```bash
pip install -r user_study/analysis/requirements.txt
python user_study/analysis/analyze.py          # --include-pilot, --keep-lived
```
Outputs in `analysis/out/`: `summary.md`, `tests.csv` (all tests with effect sizes, CIs and Holm-corrected p for the
primary outcomes), `tasks.csv`, `participants.csv`, `views.csv`, `pairs.csv`, `clicks.csv`, `rq4_examples.csv` and
`coding_sheet.csv`. T1, T2 and T4 answers are coded by two raters, blind to condition (`tasks.md`, Coding procedure).
