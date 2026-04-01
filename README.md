# Fashion Garment Classification & Inspiration Web App

An AI-powered web app that helps fashion designers organize, search, and reuse inspiration imagery. Upload garment photos, get automatic AI classification, search and filter across rich metadata, and add your own annotations.

## Quick Start

### Prerequisites

- Node.js 18+
- [OpenRouter API key](https://openrouter.ai/) (for AI classification, embeddings, and reranking)
- [Gemini API key](https://aistudio.google.com/apikey) (optional, for Gemini 2.5 Flash — free)

### Setup

```bash
git clone <repo-url> && cd fashion-classifier
npm install
cp .env.example .env.local
# Edit .env.local and add your API keys
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | Used for classification models, text embeddings, reranking, and translation |
| `GEMINI_API_KEY` | Optional | For Gemini 2.5 Flash classification (free tier) |
| `PEXELS_API_KEY` | Optional | For downloading eval images from Pexels |

### Run

```bash
npm run dev
# Open http://localhost:3000
```

### Test

```bash
# Unit + integration tests
npm test

# E2E tests (requires dev server running)
npm run dev &
npx playwright install chromium
npm run test:e2e
```

## Features

- **AI Classification**: Upload garment photos and get automatic structured metadata (type, style, material, color, pattern, season, occasion, consumer profile, trend notes, location)
- **Multi-model Support**: Choose from multiple AI models at upload time
- **Semantic Search**: RAG pipeline with text embeddings, keyword boosting, multilingual support (Chinese → English), and LLM reranking
- **Dynamic Filters**: Filter options are generated from your data, not hardcoded
- **Designer Annotations**: Add your own tags and notes, searchable and separate from AI output
- **Partial Matching**: Both search and filters support partial keyword matches

## Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite (via better-sqlite3) |
| Full-text Search | SQLite FTS5 |
| AI Classification | Multi-model via OpenRouter + Gemini |
| Text Embeddings | OpenAI text-embedding-3-small (via OpenRouter) |
| Reranking | Claude Haiku 4.5 (via OpenRouter) |

### Available Classification Models

| Model | Provider | Notes |
|-------|----------|-------|
| Gemini 2.5 Flash | Google (direct) | Free tier, default |
| Claude Sonnet 4 | OpenRouter | Top-tier accuracy |
| Claude Haiku 4.5 | OpenRouter | Fast and cheap |
| GPT-4o | OpenRouter | Strong visual analysis |
| GPT-4o Mini | OpenRouter | Budget option |
| Nemotron Nano VL | OpenRouter | Free |

### Directory Structure

```
/app                    # Next.js app directory
  /api/upload           # POST - upload & classify images
  /api/images           # GET - list/filter/search images
  /api/images/[id]      # DELETE - remove an image
  /api/filters          # GET - dynamic filter options
  /api/annotations      # GET/POST - designer annotations
  /api/classify         # POST - classify without uploading
  /api/backfill-embeddings  # POST - regenerate all embeddings
  /components           # React UI components
  page.tsx              # Main page (client-side)
  layout.tsx            # Root layout
/lib
  types.ts              # Shared TypeScript types
  db.ts                 # SQLite database layer
  classifier.ts         # AI classification (multi-model)
  embeddings.ts         # Text embeddings, similarity, reranking
/eval
  download-pexels.ts    # Download test images from Pexels
  upload-and-label.ts   # Upload images & generate ground truth
  evaluate.ts           # Run evaluation against ground truth
  ground_truth.json     # Labeled test data
  eval_images/          # Test images
/tests
  /unit                 # Parser unit tests
  /integration          # Database & filter tests
  /e2e                  # Playwright end-to-end tests
```

### Search Pipeline

1. **Query** → keyword boost (partial match + Chinese→English term mapping)
2. **Embed** → `text-embedding-3-small` via OpenRouter
3. **Retrieve** → cosine similarity against stored image description embeddings
4. **Score** → hybrid: semantic similarity + keyword boost (capped at 0.5)
5. **Filter** → results above 0.15 threshold, sorted by score

### Key Design Decisions

1. **SQLite over Postgres/MongoDB**: Zero infrastructure for a proof-of-concept. SQLite's FTS5 extension provides full-text search without an extra service.

2. **Multi-model via OpenRouter**: All major vision models accessible through one API using the OpenAI SDK. Gemini 2.5 Flash is the default (free). A single prompt requests both a natural-language description and structured attributes in one call.

3. **Dynamic filters from data**: Filter options generated from `SELECT DISTINCT` queries. The filter UI adapts as more images are added. Filters use partial matching (`LIKE '%value%'`).

4. **Annotations stored separately**: Designer annotations are in a dedicated table with their own FTS index, clearly distinguished from AI-generated metadata.

5. **Hybrid search**: Combines semantic embeddings with keyword boosting and multilingual term mapping for better recall across languages.

## Evaluation

### Setup

```bash
# 1. Download 50 fashion images from Pexels
PEXELS_API_KEY=... npx tsx eval/download-pexels.ts

# 2. Upload images & generate ground truth labels (requires dev server)
npx tsx eval/upload-and-label.ts

# 3. Run evaluation (compares Gemini 2.5 Flash against ground truth)
npm run eval
```

### Evaluated Attributes

`garment_type`, `style`, `material`, `pattern`, `season`, `occasion`, `location_continent`

Matching uses normalized string comparison with partial matching.

### Expected Performance

| Attribute | Expected Accuracy | Notes |
|-----------|------------------|-------|
| garment_type | ~85-90% | Strong for common categories |
| style | ~70-80% | Subjective boundaries (casual vs. streetwear) |
| material | ~60-70% | Hard to determine from photos alone |
| pattern | ~85-90% | Visual patterns are well-detected |
| season | ~65-75% | Often ambiguous |
| occasion | ~70-80% | Reasonable when context is clear |
| location | ~30-50% | Very hard without explicit cues |

### Note

The ground truth is generated by one AI model (`google/gemma-3-27b-it:free`), then tested against another (`gemini-2.5-flash`). This measures **model agreement**, not true human-labeled accuracy. For rigorous eval, manually review and correct `ground_truth.json`.

## Simplifying Assumptions

- **Single-user**: No authentication or multi-tenant support
- **Local storage**: Images stored in `public/uploads/`; production would use S3/R2
- **Synchronous classification**: Upload blocks until AI completes; production would use a job queue
- **No image resizing**: Images stored as-is; production would generate thumbnails

## What's Next

1. **Image-based search**: Search by uploading a reference image (describe-then-search or CLIP embeddings)
2. **Batch upload with progress**: Queue uploads and classify in background
3. **Image thumbnails**: Generate optimized thumbnails for the grid view
4. **Export/share**: Export filtered collections as moodboards or PDFs
5. **Authentication**: Multi-user support with per-designer libraries
