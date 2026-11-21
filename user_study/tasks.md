# Tasks

`{CITY}` is replaced by the city of the current block (Paris or Rome). The same four tasks are used in
both blocks; only the city and the condition change. Exact wording shown to participants is in
`runner/config.js`.

## Tour (facilitator script, before block 1, same for everyone)
1. "This is a map-based trip planner. The panel at the bottom has tabs."
2. Show **Explore** (places on the map), **Planner** (AI planner), **Itinerary** (days and stops).
3. Open **Knowledge**: "Here the app collects statements about a city from travel guides and forums.
   **Claims** lists them and **Visual** shows them as charts, **Conflicts** lists where statements disagree."
4. "Some information may come from one source only, some from several. Use whatever you find helpful."
Do **not** mention the conditions or point to specific conflicts.

## T1 — Orientation (RQ1, RQ2)
> What do travellers and guides say about **safety & health** in {CITY}? Write one or two sentences
> as if advising a friend.

- Answer: free text · Confidence 1–7 · SEQ
- **Coding (two raters):** 0 = wrong/no answer, 1 = one-sided summary, 2 = summary that mentions
  that sources differ or gives conditions ("safe, but pickpockets on metro line 1").

## T2 — Find disagreements (RQ3, main measure)
> Find up to **three topics or places** in {CITY} where the information is **contradictory or disputed**.
> For each, write the topic and what the disagreement is about. If you cannot find any, say so.

- Answer: up to 3 × (topic, description) · Confidence 1–7 · SEQ
- **Scoring (automatic + check):** each topic is matched to the ground-truth list of contested topics
  (`analysis/analyze.py`). Precision = correct / listed; recall = correct / min(3, contested in city).
  "None found" counts as 0 listed.

## T3 — Check a claim (RQ3)
> A friend says: *"{CITY} is overrated for shopping."* Using the app, do the sources **agree** with
> your friend, **disagree**, give a **mixed** picture, or is there **no information**?

- Answer: agree / disagree / mixed / no information · short reason · Confidence 1–7 · SEQ
- **Correct answer:** "mixed" — Shopping is contested across sources in both cities' data
  (verified by `analyze.py`; the script reports if this ever stops being true).

## T4 — Plan a day (RQ1, RQ5)
> Plan **one day** in {CITY} with **3–4 stops** in the Itinerary (or with the Planner). Then tell us
> briefly why you picked them.

- Answer: list of stops (copied by participant) · reason · SEQ
- Post-task: "Did information about disagreements between sources influence your plan?" (yes / a bit / no / I did not see any)
- **Log:** whether Knowledge or Conflicts was opened during T4 (RQ5).
- **Coding:** plan complete (3–4 stops in {CITY}) yes/no; reason mentions source information yes/no.
