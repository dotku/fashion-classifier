# Fashion Garment Classification & Inspiration Web App

An AI-powered web app that helps fashion designers organize, search, and reuse inspiration imagery. Upload garment photos, get automatic AI classification, search and filter across rich metadata, and add your own annotations.

## Quick Start

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Setup

```bash
git clone <repo-url> && cd fashion-classifier
npm install
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
```

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

### Evaluate Classifier

```bash
# 1. Place test images in eval/eval_images/ (001.jpg, 002.jpg, etc.)
# 2. Update eval/ground_truth.json with expected attributes
# 3. Run evaluation
npm run eval
```

## Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite (via better-sqlite3) |
| Full-text Search | SQLite FTS5 |
| AI Classification | Claude Sonnet (Anthropic multimodal API) |

### Directory Structure

```
/app                    # Next.js app directory
  /api/upload           # POST - upload & classify images
  /api/images           # GET - list/filter/search images
  /api/filters          # GET - dynamic filter options
  /api/annotations      # GET/POST - designer annotations
  /components           # React UI components
  page.tsx              # Main page (client-side)
  layout.tsx            # Root layout
/lib
  types.ts              # Shared TypeScript types
  db.ts                 # SQLite database layer
  classifier.ts         # AI classification with Claude
/eval
  evaluate.ts           # Evaluation script
  ground_truth.json     # Labeled test data
  eval_images/          # Test images (user-provided)
/tests
  /unit                 # Parser unit tests
  /integration          # Database & filter tests
  /e2e                  # Playwright end-to-end tests
```

### Key Design Decisions

1. **SQLite over Postgres/MongoDB**: Zero infrastructure for a proof-of-concept. SQLite's FTS5 extension provides full-text search without an extra service. Trade-off: no concurrent write scaling, but fine for a single-user design tool.

2. **User-selectable AI model via OpenRouter**: Designers can choose their preferred classification model at upload time. Available options:
   - **Best accuracy**: Claude Sonnet 4 or GPT-4o — top-tier for detailed visual analysis
   - **Fastest/cheapest**: Claude Haiku 4 or GPT-4o Mini — solid for basic classification at a fraction of the cost
   - **Best value**: Gemini 2.5 Flash — competitive quality, very cost-effective

   All models are accessed through OpenRouter's unified API using the OpenAI SDK. Claude Sonnet 4 is the default. A single prompt requests both a natural-language description and structured attributes in one call to minimize latency and cost.

3. **Dynamic filters from data**: Filter options are generated from `SELECT DISTINCT` queries rather than hardcoded lists. This means the filter UI adapts as more images are added.

4. **Client-side state management**: Using React hooks (`useState`/`useEffect`) rather than a state library. Sufficient for the current complexity level.

5. **Annotations stored separately**: Designer annotations are in a dedicated table with their own FTS index, clearly distinguished from AI-generated metadata. This keeps the data model clean and makes annotations searchable independently.

## Evaluation Approach

### Method

The evaluation script (`eval/evaluate.ts`) compares classifier output against human-labeled ground truth across these attributes:

- **garment_type** (dress, jacket, coat, etc.)
- **style** (formal, casual, streetwear, etc.)
- **material** (silk, cotton, denim, etc.)
- **pattern** (solid, floral, striped, etc.)
- **season** (spring, summer, fall, winter)
- **occasion** (everyday, workwear, evening, etc.)
- **location_continent** (if inferable from image context)

Matching uses normalized string comparison with partial matching (e.g., "denim jacket" matches "denim").

### Expected Performance

Based on prior experience with multimodal models on fashion classification:

| Attribute | Expected Accuracy | Notes |
|-----------|------------------|-------|
| garment_type | ~85-90% | Strong for common categories; struggles with ambiguous items (vest vs. gilet) |
| style | ~70-80% | Subjective; "casual" vs. "streetwear" boundary is fuzzy |
| material | ~60-70% | Hard to determine from photos alone; silk vs. satin, cotton vs. linen |
| pattern | ~85-90% | Visual patterns are well-detected |
| season | ~65-75% | Often ambiguous; model tends to default to "all-season" |
| occasion | ~70-80% | Reasonable when garment context is clear |
| location | ~30-50% | Very hard without explicit context clues in the image |

### Where the Model Struggles

- **Material identification**: Distinguishing fabrics from photos is inherently difficult (e.g., silk vs. polyester satin)
- **Location inference**: Unless the image has clear environmental cues (street signs, architecture), location is guesswork
- **Ambiguous categories**: Items that span categories (shirt-dress, jacket-coat) cause classification disagreements
- **Trend notes**: Highly subjective and time-dependent

### Improvement Ideas

- **Few-shot examples**: Include example classifications in the prompt to calibrate the model's vocabulary
- **Confidence scores**: Ask the model to return confidence for each attribute; flag low-confidence for human review
- **Ensemble approach**: Run multiple prompts and merge results for higher accuracy
- **Fine-tuning vocabulary**: Provide a controlled vocabulary list to reduce synonym drift
- **User feedback loop**: Let designers correct classifications to build a labeled dataset for evaluation

## Simplifying Assumptions

- **Single-user**: No authentication or multi-tenant support
- **Local storage**: Images stored in `public/uploads/`; a production system would use S3/R2
- **Synchronous classification**: Upload blocks until AI classification completes; a production system would use a job queue
- **No image resizing**: Images are stored as-is; production would generate thumbnails
- **English only**: Classification and UI are English-only

## What I Would Do Next

1. **Batch upload with progress**: Queue uploads and classify in background with WebSocket progress updates
2. **Image thumbnails**: Generate optimized thumbnails for the grid view
3. **Similarity search**: Use embeddings to find visually similar garments
4. **Export/share**: Export filtered collections as moodboards or PDFs
5. **Authentication**: Multi-user support with per-designer libraries
6. **Bulk evaluation**: Script to download 50-100 images from Pexels and auto-label for evaluation
