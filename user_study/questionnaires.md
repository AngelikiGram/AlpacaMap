# Questionnaires

All items are implemented in `runner/config.js`; this file is the readable version for ethics
applications and the paper's appendix.

## Demographics (start)
1. Age group: 18–24 / 25–34 / 35–44 / 45–54 / 55+
2. How many leisure trips to an unfamiliar city have you planned in the last 3 years? 0 / 1–2 / 3–5 / 6+
3. Which sources do you usually use to plan a trip? (multi) Travel guides (e.g. Wikivoyage, Lonely Planet) · Forums (Reddit, TripAdvisor forums) · Review sites · Social media · AI chatbots · Friends/family · Other
4. Have you visited Paris? / Rome? (yes/no each)
5. How comfortable are you with map-based web apps? 1 (not at all) – 7 (very)

## SEQ: Single Ease Question (after each task)
"Overall, this task was…" 1 = very difficult … 7 = very easy

## Confidence (after T1–T3)
"How confident are you in your answer?" 1 = not at all … 7 = completely

## NASA-TLX raw (after each block)
0–100 slider each: Mental demand · Physical demand · Temporal demand · Performance (0 = perfect, 100 = failure) · Effort · Frustration.

## Statement pairs (RQ4, after block 2)
The runner shows **6 pairs** of real statements, 2 for each statement type of the paper (Section 3):
*practical* information, *evaluative* statements (opinions, ratings) and social *norms*. The pairs come
from `runner/pairs.json`, built by `analysis/make_pairs.py` with the paper's candidate-pair rules
(same place or topic, different sources, shared aspect and content, not copied, opposite sentiment). A
pair has the type of its more opinionated statement. Pairs are drawn per participant (seeded by
participant number) from all five cities. Read `pairs.json` before the study and delete pairs you
would not show. For each pair:
1. Do these two statements really disagree? Yes / Partly / No
2. Would this disagreement change your travel plans? 1 (not at all) to 5 (a lot)
3. What kind of statement is A? An opinion or rating / Practical information (hours, prices, routes, rules) /
   A custom or expected behaviour / A historical or descriptive fact / Not sure
## SUS: System Usability Scale (end)
1 = strongly disagree … 5 = strongly agree
1. I think that I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think that I would need the support of a technical person to be able to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine that most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

## Views (RQ2)
For each of: Topic buttons (What do sources say about…), Map panel (Do sources agree?), Time lens,
Debates, Place window (click on a pin), Knowledge, Explore, Itinerary:
- Did you use it? yes/no
- If yes: I understood what it shows (1–5) · It was useful for the tasks (1–5)
- Would you remove it? yes/no

Open: "Which views or features would you merge, simplify or remove, and why?"

## Integration (RQ5)
1. Seeing where sources disagree helped me decide what to put in my plan. (1–5)
2. I would prefer conflict information **inside** the planner (e.g. a warning on a stop) rather than in a separate view. (1–5)
3. I would use a tool that only shows source conflicts, without any planning features. (1–5)

## Final
- What did you like most? (open)
- What was most confusing? (open)
