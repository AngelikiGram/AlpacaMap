# User study: protocol

## Goal
Evaluate the app (AlpacaMap, called TravelScout in the paper) with end users (reviewer comment C1) and answer
RQ1 to RQ5 (see `reviewer_comments_mapping.md`).

## Design
- **Within-subjects**, two conditions, two cities, fully counterbalanced.
  Both conditions show the same statements from all sources (Wikivoyage, Wikitravel, Wikipedia, Reddit, StackExchange),
  so the amount of information is equal and only the conflict views differ (reviewer comment C3).
  - **N, no conflict views:** the app hides everything that shows where sources disagree: the topic buttons, the
    Truth lens (map panel and coloured dots), Debates, the Conflicts tab and count in Knowledge, agreement badges and
    dispute pairs in the place window, warning dots on pins and stops, and the conflict chart in Insights.
    All statements stay readable in Knowledge, the place window and Explore.
  - **M, conflict views:** the full app.
  - Cities: **Paris** and **Rome** (bundled data, so the study does not depend on live APIs).
- Order follows from the participant number (`P01`, `P02`, ...):

| Participant no. mod 4 | First block | Second block |
|---|---|---|
| 1 | N, Paris | M, Rome |
| 2 | N, Rome | M, Paris |
| 3 | M, Paris | N, Rome |
| 0 | M, Rome | N, Paris |

## Participants
- **n = 24** (a multiple of 4 for balanced orders). With 24 pairs, a Wilcoxon test has 80% power for
  effects of d = 0.61 at alpha = .05, or d = 0.75 after Holm correction over the four primary outcomes.
  With 16, only d = 0.77 (0.96 corrected) is detectable.
- Adults who have planned at least one trip to an unfamiliar city in the last 3 years.
- Exclude people who have lived in Paris or Rome. The runner asks, and `analyze.py` excludes them.
- Recruitment: university mailing lists and travel forums. Compensation according to local rules.

## Setting
- Laptop or desktop with a screen of at least 13", Chrome or Edge, mouse.
- In person (think-aloud, screen and audio recording with consent) or remotely via video call with screen sharing.
- The study runner (see `README.md`) runs the session, records timings and app interactions and exports one JSON file per participant.

## Procedure (about 55 min)
| Step | Time | What happens |
|---|---|---|
| 1. Welcome and consent | 5 min | `consent_form.md`, shown in the runner; consent is required to continue |
| 2. Demographics | 3 min | `questionnaires.md`, Demographics |
| 3. App tour | 5 min | Same script for everyone: `tasks.md`, Tour |
| 4. Block 1 | 15 min | Tasks T1 to T4 in condition and city 1, ease rating after each task, NASA-TLX after the block |
| 5. Block 2 | 15 min | Same tasks in condition and city 2 |
| 6. Statement pairs | 6 min | 12 fixed pairs (RQ4) |
| 7. Post-study questionnaire | 6 min | SUS, views, integration |
| 8. Interview | 5 to 10 min | `interview_guide.md` |
| 9. Export | 1 min | Runner downloads `P##_session.json`; facilitator copies it into `user_study/data/` |

## Measures
- **Task answers**: T1 and T2 coded by two raters, blind to condition (`tasks.md`); T3 scored against ground truth; T4 stops read from the app.
- **Time on task**: start and stop in the runner.
- **Confidence** (1 to 7) after T1 to T3, **SEQ** (1 to 7) after each task.
- **NASA-TLX (raw)** after each block. Every slider must be moved.
- **SUS** once, at the end.
- **Interaction log**: each click in the app with the view it belongs to, task and time; dwell time per view is the time until the next click (capped at 120 s).
- **Debates answers** given in the app, read from the app at the end of each block.
- **Statement pairs**: real disagreement (yes / partly / no), impact on plans (1 to 5), statement type of A and of B.
- **View ratings, integration, open comments**: post-study.

## Ground truth
T2 automatic score: topics and places that the app shows as "opinions split" (same score as
`src/knowledge/controversy.js`, at least 3 statements). The data is the same in both conditions, so the ground truth is too;
in N participants have to find the disagreements by reading the statements.
Because the score is based on tone, the main T2 measure is the coded count of real disagreements (the paper's definition, Section 3).
T3's correct answer is computed from the Safety & Health statements (`tasks.md`): "mixed" in both cities.

Participants' own Debates answers change the app's colours during a block (a pair they mark as a disagreement
turns red). The runner records these answers, so the state each participant saw can be reconstructed.

## Hypotheses
Primary (Holm-corrected together):
- **H1 (RQ3)**: With conflict views (M), participants report more real disagreements in T2 than without (N) (coded count, 0 to 3).
- **H2 (RQ3)**: In M, T1 answers more often say that sources differ, without being asked (code 0 to 2).
- **H3 (RQ2)**: Workload (NASA-TLX) differs between M and N (the extra views may add load or save searching; tested two-sided).
- **H4 (RQ4)**: Perceived disagreement differs between statement types (practical, evaluative, norm).

Secondary (reported with effect sizes, no correction): time, ease and confidence per task; T3 correctness;
T2 automatic recall; use of conflict views during T4; SUS against the benchmark of 68; integration items against
the neutral point; impact on plans by statement type; pairwise type comparisons; agreement between participants'
statement types and the paper's classifier; share of dwell time per view.

## Analysis plan
- Paired comparisons M vs N: Wilcoxon signed-rank with effect size r, Hodges-Lehmann estimate of the difference and bootstrap 95% CI.
- T3 correctness and T4 use of conflict views: exact McNemar test.
- Robustness: linear mixed models (`outcome ~ condition + block + city`, random intercept per participant) and a
  condition by block interaction as a check for carry-over between blocks.
- RQ4: Friedman test on each participant's mean rating per type (Kendall's W); pairwise Wilcoxon tests; linear mixed
  model with crossed random intercepts for participants and pairs.
- Inter-rater agreement: Cohen's kappa (linear weights for the T1 code). Disagreements are resolved by discussion.
- SUS: mean with 95% CI, one-sample t test against 68, adjective scale.
- Views: share of clicks and dwell per view; proportion who would remove each view with Wilson 95% CI.
- Qualitative: thematic analysis of think-aloud notes, interview answers and open questions.
- Register the hypotheses and this plan before data collection (OSF or AsPredicted).

## Limitations
- N hides several views at once, so the conditions compare the conflict views as a whole. The contribution of single
  views comes from the interaction logs and the view ratings, not from the experiment.
- Participants who see M first know that the app can show disagreements when they work in N.
- The same four tasks are used in both blocks, so participants know what is coming in block 2. Counterbalancing and the
  carry-over check address this, but cannot remove it.
- The statement pairs are a small, hand-checked set (4 per type, `questionnaires.md`), so type effects generalise to
  other pairs only as far as the crossed mixed model allows.

## Ethics and data
- Anonymous participant numbers only; no names in exported files.
- The runner stores data only in the browser until export. Nothing is sent to a server.
- The app's own saved trips on the study computer are backed up before the session and restored at the end.
- Recordings are stored on encrypted storage and deleted after analysis (or per your institution's rules).
- Check whether your institution requires ethics-board approval before running the study.

## Interface version
Sessions must all use the same app version. The redesign of November 2026 changed what participants see:
- **Study mode** (`?study=` in the app URL, set by the runner): the destination is fixed, the app loads no
  further statements on its own (so S stays Wikivoyage-only), and the tour, example trip and My trips are hidden.
  The one-sentence planner adds to the prepared trip instead of starting a new one.
- **Debates**: one pair at a time under a plain question ("How busy is …?"), the two statements side by side with
  equal weight, a line on how they relate (context-dependent / possible contradiction / different views, not
  checked) and the answers "They really disagree", "Both can be true", "Different things" (stored as before:
  `disagree`, `both`, `unrelated`; for model-checked pairs `a`, `both`, `b`). Swiping was removed.
- **Knowledge** tabs were renamed (Add sources, Statements, Charts, Contradiction check).
- **Rating scales** in the runner: all values on one row with the end labels under the endpoints. Wording,
  range and stored values are unchanged.
- `analysis/analyze.py` recognises both the old and the new labels when mapping clicks to views.
Do not mix sessions run before and after this version in one analysis without reporting it.
