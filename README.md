# AlpacaMap 🦙

*(research name: TravelScout)*

An interactive travel planning app that runs in your browser. It builds trips on top of OpenStreetMap data and surfaces where travel sources agree and disagree.

## What stays on your device — and what does not

- **Stays in your browser:** your trips, itinerary, budget, notes and the collected knowledge (localStorage + IndexedDB). There is no AlpacaMap server and no account.
- **AI processing:** runs locally — either in the browser or through [Ollama](https://ollama.com/) on your own computer. Your plans are never sent to a cloud AI service.
- **Sent to third-party services:** looking things up necessarily sends the *place names and map areas* you search for to the services that answer them — OpenStreetMap (Nominatim, Overpass), Wikipedia/Wikivoyage/Wikidata, StackExchange, PullPush (Reddit archive), Open-Meteo (weather), OSRM (routing) and Esri (map tiles). These requests contain no personal data beyond what any browser sends.

Data sources and licenses: see [DATA_LICENSES.md](DATA_LICENSES.md).


## What you can do

- **Plan in one sentence** — type “3 days in Paris, hate queues, love food, €800” on the home screen. The request is understood without AI, the plan is built from OpenStreetMap data, and stops that travel sources warn about are flagged. An AI model (in the browser or Ollama) can optionally write day stories.
- **Truth lens** (map, top right) — colours places by how much sources agree (green) or argue (red).
- **Time lens** — what is open, closed or reported as packed at any hour of a trip day, plus sunrise/sunset and golden hour for viewpoints.
- **Debates** — swipe through statements where sources may disagree and judge them yourself. Your answers are stored with the trip and teach the app which aspects (crowds, price, safety …) matter to you.
- **Be a source** — in a place's window, tell the app what you saw (“very crowded”, “not worth it” …). It becomes a statement with source type `manual`.
- **Itinerary checks** — warnings when a stop is closed that day (OpenStreetMap opening hours or a source saying so) or reported as busy at that time; a **rain plan** swaps outdoor stops for nearby indoor ones when the forecast is wet.
- **Route multiverse** — three sliders (culture ↔ food, iconic ↔ hidden, calm ↔ lively) reshape the route on the map live.
- **Knowledge loads automatically** for cities with bundled data (London, Paris, Rome, Edinburgh, Zurich). First-time visitors get a London demo trip.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open the app at `http://localhost:5174/`

## Pretrained Models (Local LLM via Ollama)

**No custom pretrained models need to be downloaded manually.** 
The application interfaces directly with [Ollama](https://ollama.com/) for all local LLM inference. Ensure you have Ollama installed and running on your machine. The app will pull and use the standard models automatically (via `llama.cpp` bindings under the hood) when you invoke the AI planner or RouteSpace features.

## Generating Knowledge Graphs (Data Ingestion)

To fetch fresh data and generate the Knowledge Graph (KG) JSON for a specific city, you can use the preprocessing scripts:

```bash
# Fetch and preprocess data for a single city
node scripts/fetch_and_preprocess_all.js --city "London"

# Or use the npm shorthand:
npm run preprocess:city "London"
```

*Note: Fetching data for all cities (`npm run preprocess`) may take 5-10 minutes per city due to rate limits.*

## Setting up the Validation Process & Results

The validation pipeline reproduces the figures from the manuscript directly from the exported Knowledge Graph JSON data. 

1. Ensure the Python dependencies are installed:
   ```bash
   pip install matplotlib numpy scipy
   ```

2. Generate the validation plots using an existing or newly generated knowledge graph:
   ```bash
   python scripts/generate_validation_plots.py --kg kg_London_2026-07-07.json --out validation/
   ```

The plots (e.g., credibility vs. age, appearance frequency histograms, sentiment distribution) will be outputted directly to the `validation/` folder.

## Notes for Contributors
- Scripts and code related to local network and LLM training (`llama.cpp`, `train_nlp.py`, `evaluate_extraction.py`) must be kept intact.
- If deploying online via GitHub Pages (`.github/workflows/deploy.yml`), be aware that the frontend will be a static site. Features dependent on local models (`llama.cpp`, Ollama) or proxy endpoints will not function without a separate backend.