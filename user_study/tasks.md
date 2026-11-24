# Tasks

`{CITY}` is replaced by the city of the current block (Paris or Rome). The same four tasks are used in
both blocks; only the city and the condition change. Exact wording shown to participants is in
`runner/config.js` (study version 2.0).

## Tour (facilitator script, before block 1, same for everyone)
1. "This is a map-based trip planner. On the left is the menu, on the right the map."
2. Show the **first-visit guide** at the top of the menu ("How AlpacaMap works") and read its three steps aloud.
3. Click one **topic button** under "What do sources say about…" (always **Culture**, which is not used in any task):
   "This opens the panel *Do sources agree?* on the map. A topic shows a few positive and negative statements and their sources."
4. Point at the **coloured dots** on the map: "Each dot is a place that several guides or travellers write about.
   Green means they agree, amber or red that opinions split."
5. Open **Debates**: "Here you see pairs of statements that may disagree, and you decide."
6. Show **Explore** and **Itinerary** (adding a stop to a day).
7. "Some information may come from one source only, some from several. Use whatever you find helpful."

Do **not** mention the conditions or point to specific disagreements.

## T1: Getting around (RQ1, RQ2)
> What do travellers and guides say about **getting around (transport)** in {CITY}? Write one or two
> sentences as if advising a friend.

- Answer: free text · Confidence 1–7 · SEQ
- **Coding (two raters):** 0 = wrong or no answer, 1 = one-sided summary, 2 = summary that says sources
  differ or names the condition ("the metro is fast, but very crowded at rush hour").

## T2: Find real disagreements (RQ3, main measure)
> Find up to **three topics or places** in {CITY} where guides and travellers **really disagree**. For each,
> write the topic or place and what exactly they disagree about. If you cannot find any, say so.

- Answer: up to 3 × (topic or place, what is disputed) · Confidence 1–7 · SEQ
- **Automatic score:** each item is matched to the ground truth, the topics and places that the app's
  *Do sources agree?* panel shows as "opinions split" with all sources (same score as the app, `analysis/analyze.py`).
  Paris: Safety & Health, Transport. Rome: Safety & Health, Transport, Roma Termini.
  Precision = matched / listed; recall = distinct matched / min(3, ground truth). "None found" = 0 listed.
- **Manual score (two raters):** `t2_real_rater1/2` = number of listed items that describe a **real
  disagreement about the same thing** (same aspect, cannot both be true), not just a difference in tone or a
  different aspect. This follows the paper's definition (Section 3) and catches answers the automatic match misses.

## T3: Check a claim (RQ3)
> A friend says: *"{CITY} is not safe for tourists."* Using the app, do the sources **agree** with your friend,
> **disagree**, give a **mixed** picture, or is there **no information**?

- Answer: agree / disagree / mixed / no information · short reason · Confidence 1–7 · SEQ
- **Correct answer** depends on what the condition shows (computed by `analyze.py` from the Safety & Health statements):

| City | S (Wikivoyage only) | M (all sources) |
|---|---|---|
| Paris | agree (4 positive, 12 negative) | mixed (24 positive, 17 negative) |
| Rome | disagree (7 positive, 6 negative; "mixed" also accepted, score near the threshold) | mixed (45 positive, 38 negative) |

## T4: Plan a day (RQ1, RQ5)
> Plan **one day** in {CITY} with **3–4 stops** in the Itinerary. Then tell us briefly why you picked them.

- Answer: list of stops (copied by participant) · reason · SEQ
- Post-task: "Did information about disagreements between sources influence your plan?" (yes / a bit / no / I did not see any)
- **Log:** whether conflict information (topic buttons, map panel, Debates, Knowledge) or Debates was opened during T4 (RQ5).
- **Coding:** plan complete (3–4 stops in {CITY}) yes/no; reason mentions source information yes/no.
