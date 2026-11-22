# How TravelScout decides what sources say

All rules below are implemented as small, unit-tested modules in `src/knowledge/`
(`npm test` runs the tests in `tests/`).

## 1. Statements
Travel texts (Wikivoyage, Wikitravel, Wikipedia, Travel StackExchange, Reddit excerpts) are split
into sentences. A sentence is kept as a *statement* only if it is English, 25–400 characters,
not a question and not website boilerplate (`quality.js`). Each statement is attached either to a
named place ("Louvre Museum") or, if none is found, to a topic of the city ("Paris · Transport").
Topics come from explicit keyword rules (`topics.js`); with no keyword match the topic is "General".
On ties the more decision-relevant topic wins (Safety > Money > Climate > …).

## 2. Contradictions (statement level)
"One positive and one negative statement about a place" is a difference in tone, not a contradiction.
`contradictions.js` + `nli.js`:

1. **Candidate pairs** — same place/topic, *different* sources, both ≤ 300 characters, at least one
   shared *aspect* (crowds, price, safety, quality, food, cleanliness, opening, transport, weather, noise)
   and at least two shared content words besides the place name. Near-identical text in two sources
   (word Jaccard > 0.6, e.g. Wikitravel copying Wikivoyage) is skipped — it is a copy, not independent
   evidence. Pairs are ranked (opposite sentiment first) and capped (12 per place, 3 per statement, 300 total).
2. **Natural-language inference** — model `Xenova/nli-deberta-v3-xsmall` (ONNX, quantised, runs in the
   browser via transformers.js). Each pair is scored in both directions (A→B, B→A) and the *minimum*
   contradiction/entailment probability is kept, so a pair counts only if the model is confident both ways.
3. **Verdict** — contradiction ≥ 0.8 → *contradiction*; entailment ≥ 0.8 → *agree*; else *unrelated*.
4. **Conditions** — if two contradicting statements name different values of the same condition
   (season, time of day, weekday/weekend, who travels, centre/outskirts), the verdict becomes
   *depends on conditions* with an explanation ("Depends on season: summer vs winter").
5. **Self-test** — before every run the model must label two known pairs correctly
   (open vs closed on Mondays → contradiction; two paraphrases → entailment), otherwise the run stops.

Results are stored with the trip (`knowledgeGraph.verified`: model, method, date, counts, pairs).

## 3. Credibility of a statement (`credibility.js`)
`score = reliability(source) × freshness + corroboration`, capped at 1.
- reliability: manual 1.0, Wikivoyage .85, Wikipedia .82, StackExchange .78, Wikitravel .65, Reddit .60
- freshness: half-life 1.5 years for volatile facts (prices, hours), 6 years otherwise; **only a real
  publication date counts** — when it is unknown a fixed factor of 0.85 is used
- corroboration: +0.07 per *other* source with the same sentiment about the same place (max +0.2)
- interval: ± 0.3 / √(number of distinct sources)

## 4. Evidence level of a place (`evidence.js`)
| Level | Rule | Shown as |
|---|---|---|
| Sources disagree | ≥ 1 verified contradiction | red **!** on the pin, badge on itinerary stops |
| Depends on conditions | only condition-dependent pairs | amber **~** |
| Mixed opinions | ≥ 3 opinionated statements, majority sentiment < 65 % | amber **~** |
| Little evidence | < 2 sources or < 3 statements | grey **?**, pin drawn faded |
| Sources agree | otherwise | no marker |

## 5. Personal relevance (`relevance.js`)
A verified disagreement is ranked higher for the current traveller when it concerns safety (+0.4),
the traveller group named in the statements (families, solo, couples; +0.4), an aspect linked to the
chosen trip style (e.g. foodie → food/price; +0.25) or price when a budget is set (+0.2).
The traveller profile is the one entered in the Planner.
