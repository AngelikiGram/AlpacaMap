# TravelScout user study: protocol

## Goal
Evaluate TravelScout with end users (reviewer comment C1) and answer RQ1–RQ5
(see `reviewer_comments_mapping.md`).

## Design
- **Within-subjects**, two conditions, two cities, fully counterbalanced.
  - **S, Single source:** the app is preloaded with Wikivoyage statements only.
  - **M, Multi-source:** the app is preloaded with all sources (Wikivoyage, Wikitravel, Wikipedia, Reddit, StackExchange), so cross-source conflicts are visible.
  - Cities: **Paris** and **Rome** (both have preprocessed data bundled in the app, so the study does not depend on live APIs).
- Order is assigned from the participant number (`P01`, `P02`, …):

| Participant no. mod 4 | First block | Second block |
|---|---|---|
| 1 | S · Paris | M · Rome |
| 2 | S · Rome | M · Paris |
| 3 | M · Paris | S · Rome |
| 0 | M · Rome | S · Paris |

## Participants
- Target **n = 16–24** (multiple of 4 for balanced orders).
- Adults who have planned at least one trip to an unfamiliar city in the last 3 years.
- Exclude people who lived in Paris or Rome (prior knowledge would mask the conditions).
- Recruitment: university mailing lists / travel forums. Compensation according to local rules.

## Setting
- Laptop or desktop with a screen ≥ 13", Chrome or Edge, mouse.
- In person (think-aloud, screen + audio recording with consent) or remote via video call with screen sharing.
- The study runner page (see `README.md`) runs the whole session, records timings and app interactions and exports one JSON file per participant.

## Procedure (≈ 50–60 min)
| Step | Time | What happens |
|---|---|---|
| 1. Welcome & consent | 5 min | `consent_form.md`, shown in the runner; consent is required to continue |
| 2. Demographics | 3 min | `questionnaires.md` §Demographics |
| 3. App tour | 5 min | Facilitator shows the first-visit guide, a topic button (Culture), the coloured dots, Debates, Explore and Itinerary. Same script for everyone: `tasks.md` §Tour |
| 4. Block 1 | 15 min | Tasks T1–T4 in condition/city 1, then §SEQ after each task, §TLX after the block |
| 5. Block 2 | 15 min | Same tasks in condition/city 2 |
| 6. Statement pairs | 5 min | §Statement pairs (RQ4) |
| 7. Post-study questionnaire | 6 min | §SUS, §Views, §Integration |
| 8. Interview | 5–10 min | `interview_guide.md` |
| 9. Export | 1 min | Runner downloads `P##_session.json`; facilitator copies it into `user_study/data/` |

## Measures
- **Task success**: T2 and T3 are scored automatically against ground truth computed from the app's data; T2 is also coded by two raters for real disagreements, and T1 and T4 are coded by two raters (see `tasks.md`, report Cohen's κ).
- **Time on task**: start/stop in the runner.
- **Confidence**: 1–7 after T1–T3.
- **SEQ**: Single Ease Question (1–7) after each task.
- **NASA-TLX (raw)**: after each block.
- **SUS**: once, at the end.
- **Interaction log**: clicks in the app (tab/view names), with task id and timestamp.
- **View ratings, integration, open comments**: post-study.

## Ground truth
T2 is scored against the topics and places that the app's *Do sources agree?* panel shows as "opinions split" with all sources: the same score as `src/knowledge/controversy.js` (`controversyScore` ≥ 0.4, at least 3 statements). `analysis/analyze.py` recomputes this from `public/preprocessed/<city>.json`. Because this score is based on the tone of statements, T2 answers are also coded by hand for whether they name a real disagreement about the same thing (the paper's definition, Section 3). T3's correct answer is computed per condition from the Safety & Health statements visible in it (see `tasks.md`).

## Hypotheses
- H1 (RQ3): In M, participants identify more topics or places where sources disagree (higher recall) than in S.
- H2 (RQ3): In M, T3 answers are more often correct ("mixed") and confidence is better calibrated.
- H3 (RQ2): Workload (TLX) is higher in M, and a minority of views accounts for most interaction time.
- H4 (RQ4): Pairs of evaluative statements and social norms are judged as real disagreements less often than pairs of practical statements, but are rated as more relevant for planning.

## Analysis plan
- Paired comparisons S vs M: Wilcoxon signed-rank (time, TLX, confidence, recall); McNemar for T3 correctness; report effect size r and 95% CI.
- Order and city effects checked with a mixed model (`condition + order + city`, random intercept for participant) if n ≥ 16.
- SUS reported as mean ± SD with the adjective scale.
- View usage: share of clicks and dwell per view; views rated "would remove" by ≥ 50% are candidates for removal.
- Qualitative: thematic analysis of think-aloud notes and interview answers.

## Ethics & data
- Anonymous participant numbers only; no names in exported files.
- The runner stores data only in the browser until export. Nothing is sent to a server.
- The app's own saved trips on the study computer are backed up before the session and restored at the end.
- Recordings stored on encrypted storage, deleted after analysis (or per your institution's rules).
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
