# AlpacaMap

An interactive, privacy-first travel planning app that runs entirely in your browser. Plan multi-city trips with real map data and generate personalized itineraries using local LLMs.

`AlpacaMap` is a title choice, not a statement that the app specifically runs the Alpaca model. The name references the broader llama-family and local-LLM ecosystem that this project uses through `llama.cpp` and local model workflows.

## What It Does
- Builds trips on top of OpenStreetMap data.
- Surfaces conflicts and credibility differences across sources.
- Supports local LLM-based itinerary and knowledge workflows.
- Includes validation scripts for conflict and novelty analysis.

## Project Layout
- `src/`: React application code.
- `public/preprocessed/`: Static city data used by the app.
- `scripts/generate_preprocessed.js`: Generates preprocessed city JSON.
- `scripts/train_nlp.py`: Training pipeline for the NLP model.
- `scripts/evaluate_extraction.py`: Evaluation for extraction/model output.
- `scripts/validate_conflicts.py`: Conflict validation workflow.
- `scripts/validate_novelty.py`: Novelty validation workflow.
- `llama.cpp/`: Local LLM inference dependency.

## Quick start

```bash
npm install
npm run dev
```

Navigate to `http://localhost:5174/` to open the app.

## Deploying Online

The repository includes a GitHub Pages workflow in `.github/workflows/deploy.yml`. The frontend can be deployed as a static site.

Important: GitHub Pages only hosts the static React app. Features that depend on local models, proxy routes, or local services such as `llama.cpp`, Ollama, or dev-server proxy endpoints will not work there unless you provide a separate backend.

## Notes for Contributors
- `README_MINE.md` is ignored via `.gitignore` to let developers keep local notes.
- Scripts and code related to local network and LLM training (`llama.cpp`, `train_nlp.py`, `evaluate_extraction.py`) must be kept intact.

## Training

```bash
pip install nltk requests
python scripts/train_nlp.py
python scripts/train_nlp.py --cities 80
```
