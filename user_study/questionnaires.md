# Questionnaires

All items are implemented in `runner/config.js`; this file is the readable version for ethics
applications and the paper's appendix. Items marked * are required.

## Demographics (start)
1. Age group*: 18-24 / 25-34 / 35-44 / 45-54 / 55+
2. Gender (optional): woman / man / non-binary / prefer not to say
3. How well do you read English?*: native / fluent / good / basic
4. How many leisure trips to an unfamiliar city have you planned in the last 3 years?*: 0 / 1-2 / 3-5 / 6+
5. Which sources do you usually use to plan a trip? (multiple) Travel guides (e.g. Wikivoyage, Lonely Planet), forums (Reddit, TripAdvisor forums), review sites, social media, AI chatbots, friends/family, other
6. Have you ever lived in Paris?* / in Rome?* (yes/no each; yes = excluded from analysis)
7. Have you visited Paris?* / Rome?* (yes/no each)
8. How comfortable are you with map-based web apps?* 1 (not at all) to 7 (very)

## After each task
- **SEQ***: "Overall, this task was..." 1 = very difficult to 7 = very easy
- **Confidence*** (T1 to T3): "How confident are you in your answer?" 1 = not at all to 7 = completely

## NASA-TLX raw (after each block)
Slider 0 to 100 for each*: mental demand, physical demand, temporal demand, performance (0 = perfect, 100 = failure),
effort, frustration. A slider that was not moved counts as unanswered.

## Statement pairs (RQ4, after block 2)
Every participant rates the same **12 pairs** of real statements, 4 for each statement type of the paper (Section 3):
*practical* information, *evaluative* statements (opinions, ratings) and social *norms*. The order is shuffled per
participant. Statement A is always the statement of the pair's type. Per type, three pairs are about the same point and
in tension, one agrees (a control). Practical and evaluative pairs were chosen from the paper's candidate pairs; the rules
found too few usable norm pairs, so those were paired by hand from norm statements about the same custom (rushing,
tipping, greeting, dress code). Most pairs come from London and Edinburgh, the rest from Paris and Rome. The choice is in
`analysis/pairs_pick.json`; `runner/pairs.json` is built from it by `analysis/make_pairs.py`.
For each pair:
1. Do these two statements really disagree?*: yes / partly / no
2. Would this disagreement change your travel plans?*: 1 (not at all) to 5 (a lot)
3. What kind of statement is A?* and B?*: an opinion or rating / practical information (hours, prices, routes, rules) /
   a custom or expected behaviour / a historical or descriptive fact / not sure

## SUS: System Usability Scale (end)
1 = strongly disagree to 5 = strongly agree, all required.
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
For each of: topic buttons (What do sources say about...), map panel (Do sources agree?), time lens, place window
(click on a pin), Debates, Knowledge, Explore, Itinerary:
- Did you use it? yes/no
- If yes*: I understood what it shows (1 to 5), it was useful for the tasks (1 to 5)
- Would you remove it? yes/no

Open: "Which views or features would you merge, simplify or remove, and why?"

## Integration (RQ5)
1 = strongly disagree to 5 = strongly agree, all required.
1. Seeing where sources disagree helped me decide what to put in my plan.
2. I would prefer conflict information **inside** the planner (e.g. a warning on a stop) instead of in a separate view.
3. I would use a tool that only shows source conflicts, without any planning features.

## Final
- What did you like most? (open)
- What was most confusing? (open)
