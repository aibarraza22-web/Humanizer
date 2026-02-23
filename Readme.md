# Humanizer v8

Human-focused rewrite/answer pipeline with minimal LLM passes.

## What changed

- `humanize` now uses **1 main rewrite call** plus **optional 1 length-correction call**.
- Most cleanup is deterministic JS (`humanizeText`) instead of extra model rounds.
- `answer` now uses **a single conversational model call** with optional chat history.
- Example selection is randomized each run to reduce repeated prompt fingerprints.
- Word-count tolerance widened to **±20%** and enforced at most once.

## Real dataset workflow (no synthetic "human" examples)

1. Import public human/AI datasets:

```bash
npm run import:datasets
```

2. Send imported records through your GPTZero workflow to label classes:
   - `human`
   - `mixed`
   - `ai_paraphrased`
   - `ai`

3. Keep only trusted `human` rows as positive anchors.
4. Use `mixed`, `ai_paraphrased`, `ai` rows as negative/counter anchors.

> This repo includes source pointers in `data.js` and a dataset import script in `scripts/import-real-datasets.mjs`.

### Railway deployment notes for dataset import

If `npm run import:datasets` fails in Railway due to network/rate limits:

- set `HF_TOKEN` in Railway variables (Hugging Face read token)
- optionally tune:
  - `DATASET_MAX_ROWS` (default `3000`)
  - `DATASET_PAGE_SIZE` (default `200`)
  - `DATASET_TIMEOUT_MS` (default `25000`)
- if outbound internet is restricted, upload pre-downloaded files and set:
  - `LOCAL_DATASET_DIR=/app/datasets/bootstrap`
  - expected files: `hc3.jsonl`, `ghostbuster.jsonl`
- if datasets are required for startup, set:
  - `REQUIRE_DATASETS=true` (script exits non-zero when import fails)

The importer now tries in order:
1) local files from `LOCAL_DATASET_DIR`
2) Hugging Face `datasets-server` API (paged rows)
3) direct file fallback URLs
4) bundled bootstrap files in `datasets/bootstrap`

This gives you a working path even when Railway cannot reach external endpoints.


## Setup

```bash
npm install
npm start
```

Open http://localhost:3000
