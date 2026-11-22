# Data sources and licenses

The app shows, and `public/preprocessed/*.json` bundles, sentences taken from the sources below.
Sentences are split, filtered and classified automatically (`scripts/clean_preprocessed.mjs`,
`src/knowledge/`). Every statement keeps a link to the page it came from (`source.url`).

| Source | License | How it is used |
|---|---|---|
| [Wikivoyage](https://en.wikivoyage.org) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Sentences from city articles. Redistributed under the same license. |
| [Wikitravel](https://wikitravel.org) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Sentences from city articles (bundled data only). |
| [Wikipedia](https://en.wikipedia.org) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Sentences from city articles. |
| [Travel StackExchange](https://travel.stackexchange.com) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Sentences from answers, linked to the question. |
| [Reddit](https://www.reddit.com) | [Reddit User Agreement](https://redditinc.com/policies/user-agreement) | Short excerpts only (≤ 280 characters), each linked to its source. Full posts are not stored or redistributed. |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | [ODbL](https://opendatacommons.org/licenses/odbl/) | Places and points of interest (`public/preprocessed/osm_*.json`, live Overpass/Nominatim queries). |
| [Wikidata](https://www.wikidata.org) | CC0 | Linking place names to entities. |
| [Esri basemaps](https://www.esri.com) | Esri terms of use | Map tiles (satellite, terrain, light/dark). |

**Changes made to CC BY-SA text:** split into sentences, filtered (language, boilerplate, duplicates),
assigned to places/topics and sentiment. The derived files in `public/preprocessed/` are therefore
also licensed under CC BY-SA 4.0 where they contain such text.

**Bundled cities:** Edinburgh, London, Paris, Rome, Zurich. Other files in `public/preprocessed/`
(amsterdam, barcelona, kyoto, new_york, prague, sydney, tokyo) are empty placeholders.
