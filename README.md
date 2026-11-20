# TravelScout

An interactive, privacy-first travel planning app that runs entirely in your browser. It builds trips on top of OpenStreetMap data, surfacing conflicts and credibility differences across sources.

`TravelScout` relies on local models and on-device processing to ensure your data stays private.

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