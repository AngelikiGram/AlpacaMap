# Reviewer comments → what the study measures

Source: Transactions in GIS, manuscript 9295540, Reviewer 1.
Only comments that concern the **app** are turned into study questions. Comments about the
manuscript text itself (writing style, length of Related Work, structure of sections) are listed
at the end for completeness but are not addressed by the study.

| # | Reviewer comment (paraphrased) | Research question | What we collect | Where |
|---|---|---|---|---|
| C1 | No user evaluation, although the tool is meant for end users. | **RQ1** Can travellers complete realistic planning tasks with the app, and how usable is it? | Task completion, task time, SUS (against the benchmark of 68), single-ease question per task | `tasks.md` T1 to T4, `questionnaires.md` SUS, SEQ |
| C2 | The number and complexity of views is overwhelming; too many features to understand. | **RQ2** Which views do people actually use and understand, and which add load without value? | Clicks and dwell time per view and task, NASA-TLX per condition, per-view ratings (understood / useful / would remove), open "what would you remove or merge" | runner log, `questionnaires.md` TLX, Views |
| C3 | "Combining multiple sources adds information" is a trivial finding. | **RQ3** Does *showing conflicts across sources* change what people notice and conclude, with the same information? | Within-subjects: all sources **without conflict views** (N) vs **with conflict views** (M). Coded real disagreements found (T2), unprompted mention of disagreement (T1), correctness and confidence of the agreement judgement (T3) | `protocol.md` Design, Hypotheses H1, H2 |
| C4 | Scope is fuzzy: opinions, facts and cultural habits are treated with the same pipeline. | **RQ4** Do people see disagreements in practical information, evaluations and social norms (the paper's statement types) as equally real and equally relevant for planning? | 12 fixed statement pairs, 4 per type: "real disagreement?", "would it change your plans?", participant's own classification of both statements | `questionnaires.md` Statement pairs |
| C5 | Unclear why conflict-aware knowledge must be paired with itinerary/route planning. | **RQ5** Do people use conflict information while building an itinerary, and do they want it integrated or as a separate tool? | Conflict views used during T4, Debates answers, "did disagreements influence your plan?", coded reasons for the plan, preference integrated vs separate | `tasks.md` T4, `questionnaires.md` Integration |
| C6 | Privacy-aware architecture: unclear what privacy is preserved; conflict analysis could run on a server. | Not studied: the revised paper removes the privacy argument and says verdicts can be computed once per city. | n/a | n/a |
| C7 | Specific examples of statements and their relevance for trip planning are missing. | (covered by RQ4) | The rated pairs are real statements from the app's data; ratings give concrete, citable examples | analysis `rq4_examples.csv` |

## Manuscript-only comments (not part of the study)

- Related Work too short (travel-planning UIs, review-visualisation tools).
- Goals of the system unclear before the implementation section.
- Some discussion redundant; evaluation section structure.
- Language: "rather than" overuse, overclaiming, verbosity.
- Suggestion to re-scope as a workshop paper or focus on the conflict analysis.
