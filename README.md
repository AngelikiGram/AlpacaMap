# AlpacaMap

A travel planner on a map that reads travel guides, Wikipedia and traveller forums and shows where they
agree and where they disagree. Research prototype; the research name is TravelScout.

**Live:** https://angelikigram.github.io/AlpacaMap/

## Features

- **Ask the sources:** one click shows what guides and travellers say about safety, transport, food,
  money, climate or nightlife in a city.
- **Truth lens:** coloured dots on the map mark places where sources agree (green) or where opinions
  split (amber, red).
- **Time lens:** which places are open, closed or busy at a chosen hour, plus sunrise and sunset.
- **Debates:** pairs of statements that may disagree; you decide whether they really do.
- **One-sentence planner:** "3 days in Paris, hate queues, love food, €800" builds a trip from
  OpenStreetMap data and flags stops that sources warn about.
- **Itinerary checks:** warnings for stops that are closed or busy at the planned time, and a rain plan.
- **AI planner (optional):** day-by-day plans written by a language model that runs in your browser
  (WebLLM, needs WebGPU) or in [Ollama](https://ollama.com/) on your own computer.

Bundled knowledge covers London, Paris, Rome, Edinburgh and Zurich; other cities are collected live.

## Privacy

No account, no cookies, no analytics. Trips and settings stay in the browser (localStorage and
IndexedDB). Maps, places, weather and source texts are requested directly from public services, which
see the visitor's IP address. The in-app **About & privacy** page lists every service; data sources
and licences are in [DATA_LICENSES.md](DATA_LICENSES.md).

## Run locally

Requires Node.js 22.

```bash
npm install
npm run dev        # http://localhost:5174
npm test           # unit tests (node:test)
npm run build      # production build in dist/
```

For the Ollama option: install Ollama, run `ollama pull llama3.1`, and keep `ollama serve` running.
To use it from the hosted site, start Ollama with `OLLAMA_ORIGINS=https://angelikigram.github.io`.

## Project structure

```
src/
  components/map/      map, lenses and map controls
  components/panel/    side-panel views (Knowledge, Debates, Itinerary, AI planner, ...)
  components/shared/   small shared components
  knowledge/           statement pairing, contradiction check (NLI), credibility, debates
  planner/             one-sentence planner, opening hours, itinerary checks
  ai/                  browser and Ollama language-model clients
  net/                 rate limiting for the public APIs
public/preprocessed/   bundled statements and OpenStreetMap places per city
scripts/               data collection and preprocessing
analysis/              reproduces the numbers in the paper
user_study/            study protocol, materials, browser runner and analysis
tests/                 unit tests
```

## Data

```bash
npm run preprocess:city "London"   # collect and preprocess one city (about 5 to 10 minutes)
npm run preprocess                 # all cities
npm run clean-data                 # drop unusable statements from public/preprocessed/
```

`scripts/train_nlp.py` rebuilds the keyword and sentiment lists in `src/data/nlp_data.json`
(`pip install -r scripts/requirements.txt`).

## Paper analysis

```bash
python analysis/conflict_analysis.py public/preprocessed analysis/out   # standard library only
node analysis/run_nli.mjs                                               # NLI verdicts, downloads the model once
```

Results are written to `analysis/out/`. The method is described in [docs/METHODS.md](docs/METHODS.md).

## User study

See [user_study/README.md](user_study/README.md). The study runner is published at
https://angelikigram.github.io/AlpacaMap/study/.

## Deployment

Every push to `main` builds the app and publishes it to GitHub Pages
(`.github/workflows/deploy.yml`), together with the study runner under `/study/`.

## Licence

Code: [MIT](LICENSE). Bundled data keeps the licences of its sources, see [DATA_LICENSES.md](DATA_LICENSES.md).
