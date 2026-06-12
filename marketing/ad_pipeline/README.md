# 🎬 TikTok Ad Reverse-Engineering Pipeline

Uses **Gemini Embedding 2** to embed TikTok ad videos and CheckPet value propositions into the same vector space, find the best creative matches, and generate tailored ad scripts.

## Quick Start

### 0. Activate the environment
```bash
cd marketing/ad_pipeline
source .venv/bin/activate
```

### 1. Discover & download viral pet health TikToks
```bash
# Automatic: searches 12 pet health queries, ranks by views, downloads top 10
python discover_videos.py

# Or customize:
python discover_videos.py --top-n 15 --queries "dog emergency" "vet reacts"

# Preview only (no download):
python discover_videos.py --queries-only

# Manual mode — provide your own URLs:
python discover_videos.py --from-file manual_urls.txt
```

### 2. Run the embedding pipeline
```bash
python embed_and_match.py

# Optional: use smaller embeddings for faster prototyping
python embed_and_match.py --dimensions 768
```

### 3. Generate ad scripts
```bash
python generate_scripts.py --top-n 2
```

Output: `results/ad_scripts.md` + `results/ad_scripts.json`

## Files

| File | Purpose |
|------|---------|
| `discover_videos.py` | Step 1: Find & download viral pet health TikToks |
| `embed_and_match.py` | Step 2: Embed videos + value props, compute similarity |
| `generate_scripts.py` | Step 3: Generate ad scripts from top matches |
| `value_props.json` | CheckPet marketing messages (editable) |
| `videos/` | Downloaded TikTok videos |
| `results/` | Output directory |

## How It Works

```
   ┌──────────────────────────────────────────┐
   │   discover_videos.py                     │
   │   Search TikTok → Rank by views          │
   │   → Download top 10                      │
   └────────────────┬─────────────────────────┘
                    │
                    ▼
TikTok Videos (.mp4)          CheckPet Value Props (text)
       │                              │
       ▼                              ▼
┌─────────────────────────────────────────────┐
│     Gemini Embedding 2 Preview              │
│     (Unified Multimodal Vector Space)       │
└─────────────┬───────────────────────────────┘
              │
              ▼
     Cosine Similarity Matrix
     (video × value_prop scores)
              │
              ▼
     Top-N matches per value prop
              │
              ▼
┌─────────────────────────────────────────────┐
│     Gemini 2.0 Flash                        │
│     "Analyze this ad's creative DNA         │
│      and write a CheckPet script"           │
└─────────────┬───────────────────────────────┘
              │
              ▼
     📄 Ad Scripts (hook/body/CTA)
```

## Search Queries

`discover_videos.py` uses 12 curated queries targeting pet health panic moments:
- `dog ate something emergency`, `pet emergency signs`, `when to take dog to vet`
- `cat throwing up should I worry`, `puppy health tips`, `vet reacts pet emergency`
- `dog owner mistake vet`, `pet health hack`, `is my dog sick`
- `emergency vet visit story`, `pet parent anxiety`, `dog symptoms to watch for`

Override with: `--queries "custom query 1" "custom query 2"`

## Environment

Requires `GEMINI_API_KEY`. The scripts auto-load from:
- `.env` in the pipeline directory
- `../../.env.local` (project root)
- `../../web-triage-funnel/.env.local`
