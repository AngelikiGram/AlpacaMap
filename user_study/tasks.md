# Tasks

`{CITY}` is replaced by the city of the current block (Paris or Rome). The same four tasks are used in
both blocks; only the city and the condition change. The exact wording shown to participants is in
`runner/config.js` (study version 3.0).

## Tour (facilitator script, before block 1, same for everyone)
The runner shows a fresh app next to the tour text. In the welcome window, click **Look at an example** (London).
1. "This is a map-based trip planner. On the left is the menu, on the right the map."
2. Show the first-visit guide ("New here? Take the one-minute tour") and read its steps aloud.
3. Click the topic button **Climate** (not used in any task): "This opens the panel *Do sources agree?* on the map.
   A topic shows a few positive and negative statements and their sources."
4. Point at the coloured dots on the map: "Each dot is a place that several guides or travellers write about.
   Green means they agree, amber or red that opinions split." Click one dot to show the **place window**.
5. Open the **Time lens** (clock button on the map): "What is open, closed or busy at a chosen hour."
6. Open **Debates**: "Here you see pairs of statements that may disagree, and you decide."
7. Open **Knowledge**: "All statements about the city."
8. Show **Explore** and **Itinerary** (adding a stop to a day).
9. "Some information may come from one source only, some from several. Use whatever you find helpful."

Do not mention the conditions or point to specific disagreements.

## T1: Costs (RQ1, RQ3)
> What do the sources in the app say about **costs and prices** in {CITY}? Write one or two sentences as if advising a friend.

- Answer: free text, confidence 1 to 7, SEQ.
- Measures whether participants mention disagreement without being asked. Costs is not among the T2 answers,
  so T1 does not give away part of T2.
- **Code (two raters):** 0 = wrong or no answer, 1 = one-sided summary, 2 = says that sources differ or names
  a condition ("eating out is cheap away from the centre, expensive near the sights").

## T2: Find real disagreements (RQ3, primary)
> Find up to **three topics or places** in {CITY} where the sources in the app **really disagree**: they say opposite
> things about the same point, so both cannot be true. Different opinions about different aspects do not count.
> For each, write the topic or place and what exactly is disputed. If you find none, tick the box.

- Answer: up to 3 x (topic or place, what is disputed), confidence 1 to 7, SEQ.
- **Code (two raters), per listed item:** 1 = a real disagreement about the same point, 0 = otherwise.
  The primary measure is the number of coded items (0 to 3); "none found" counts as 0.
- **Automatic score (secondary):** items matched by name to the topics and places the app scores as "opinions split"
  (shown in M, hidden in N). Paris: Safety & Health, Transport. Rome: Safety & Health, Transport, Roma Termini.
  Recall = distinct matches / min(3, number of answers).

## T3: Check a claim (RQ3)
> A friend says: *"{CITY} is not safe for tourists."* Using the app, what do the sources say about this claim?

- Answer: mostly support your friend / mostly contradict your friend / mixed / say nothing about it, short reason,
  confidence 1 to 7, SEQ.
- **Correct answer** (`analysis/ground_truth.py`, Safety & Health statements, the same in both conditions):
  Paris **mixed** (24 positive, 17 negative), Rome **mixed** (45 positive, 38 negative).

## T4: Plan a day (RQ1, RQ5)
> Plan **one day** in {CITY} with **3 to 4 stops** in the Itinerary. Then say briefly why you picked them.

- Answer: reason, "Did information about disagreements between sources influence your plan?" (yes / a bit / no / I did not see any), SEQ.
- The stops and the participant's Debates answers are read from the app when T4 is submitted.
- **Complete:** 3 to 4 stops in the itinerary (automatic).
- **Code (two raters):** the reason mentions what sources say or that they disagree, 1 / 0.
- **Log:** whether conflict views (topic buttons, map panel, Debates, Knowledge) were used during T4.

## Coding procedure
1. Run `analyze.py`. It writes `analysis/out/coding_sheet.csv`: one row per answer to code, in random order,
   without participant number, condition or block, so raters are blind to the condition.
2. Copy it to `user_study/data/coding.csv`. Rater 1 and rater 2 fill their columns independently.
3. Discuss the rows where they differ and write the agreed code into `final`.
4. Run `analyze.py` again. It reports Cohen's kappa per code and uses `final`, or the raters' code where they agree.
New sessions add new rows to the sheet; codes already in `coding.csv` are kept.
