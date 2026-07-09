# Preeve

Preeve is a mobile-optimized web app that helps shoppers decide whether to buy a clothing item while still in the store. Photograph an item, get its category and color classified via computer vision, compare it against your stated style preferences, and get a Buy/Maybe/Skip verdict with a pairing suggestion.

## Status

Early development. See [`docs/prd.md`](docs/prd.md) for the full product requirements, architecture, and scope.

## Tech Stack

- **Frontend:** Next.js + Tailwind CSS
- **Backend:** Python (FastAPI)
- **Database:** PostgreSQL
- **CV/ML:** Zero-shot CLIP classification via a hosted inference API
- **Storage:** S3-compatible object storage (Cloudflare R2 / AWS S3)
- **Auth:** Managed provider ??

## Project Structure

```
preeve/
├── frontend/     # Next.js app
├── backend/      # FastAPI service
├── docs/         # Product requirements and planning docs
```

## Getting Started

Setup instructions will be added once the frontend and backend are scaffolded.

## Documentation

- [Product Requirements Document](docs/prd.md)
