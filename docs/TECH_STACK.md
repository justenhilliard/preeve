# Preeve — Tech Stack

**Status:** v1.1 — Locked for implementation (revised: env vars, runtime pins, image compression)
**Versions verified via web search on 2026-07-09.** Package ecosystems move fast; if you're implementing this more than a few weeks after that date, re-check with `npm view <package> version` / `pip index versions <package>` before installing, rather than trusting the numbers below blindly.

This document closes out every "e.g., X or Y" option left open in `docs/prd.md`'s Architecture Overview — each choice below is the concrete pick, not a menu.

---

## Frontend

| Component | Choice | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | **16.2.7** | Turbopack is the default bundler as of v16. Node.js pin: `>=20.9.0` — set this in `frontend/package.json`'s `"engines"` field so Vercel enforces it: `"engines": { "node": ">=20.9.0" }`. Active LTS as of mid-2026 is Node 24; 20.9.0 is the floor, not the target — install whatever current LTS you have locally. |
| UI library | React | **19.x** (bundled with Next.js 16) | Installed automatically as a Next.js dependency — don't pin separately. |
| Language | TypeScript | latest stable at install | `npx create-next-app@latest` sets this up; no separate version decision needed. |
| Styling | Tailwind CSS | **4.3.2** | v4's config is CSS-first (`@import "tailwindcss"` in globals.css), not the old `tailwind.config.js` JS-based setup from v3 — don't follow v3 tutorials verbatim. |
| Server-state / data fetching | TanStack Query (`@tanstack/react-query`) | **5.101.2** | Used for all calls to the FastAPI backend (scan results, wardrobe log, preferences) — handles caching, loading/error states, and refetching. |
| Local UI state | React built-ins (`useState`, `useContext`) | n/a | No Redux/Zustand/Jotai — the app's local state needs (form inputs, modal open/close, current step in the questionnaire) don't justify a global state library. |
| Auth SDK | Clerk (`@clerk/nextjs`) | latest stable at install (not independently verified — check npm at install time) | Concrete pick over Supabase Auth/Auth.js: best first-party Next.js App Router integration, generous free tier, handles session/JWT plumbing for you. |

## Backend

| Component | Choice | Version | Notes |
|---|---|---|---|
| Framework | FastAPI | **0.128.8** (revised from 0.139.0 — see note) | 0.139.0 was the pin at spec time, but wasn't installable via pip during ticket 001's scaffold (backend ran on Python 3.12.4 locally; the environment resolved 0.128.8 as the newest compatible version). 0.128.8 is a real, current-enough FastAPI release with no functionality this project needs missing — accepted rather than fought. Re-check at deploy time in case the Render environment can resolve 0.139.0 instead. |
| Language | Python | **3.12+ minimum, 3.14.6 target** | 3.14.x is current stable as of July 2026. If any dependency (CLIP client SDK, boto3, etc.) hasn't published 3.14 wheels yet when you actually install, fall back to 3.12 rather than fighting it. **Render deployment:** add a `backend/runtime.txt` file containing `python-3.12.7` as the safe, native-runtime fallback pin (check Render's currently-supported Python list at deploy time and adjust the patch if 3.12.7 has aged out — don't leave this file missing, Render's default can drift). |
| ASGI server | Uvicorn | latest stable at install | Standard FastAPI production server. |
| ORM | SQLAlchemy | **2.0.x** (exact patch not independently verified — check PyPI at install time) | Async engine (`create_async_engine`) to match FastAPI's async request handlers. |
| Migrations | Alembic | latest stable at install | Paired with SQLAlchemy for schema migrations — see `docs/DATABASE.md`. |
| Auth verification | Clerk Python SDK / JWKS verification | latest stable at install | Backend verifies the Clerk-issued JWT forwarded by the frontend on every request; does not independently manage sessions. See `docs/API_ROUTES.md` → Auth Conventions for the exact claim mapping. |
| Object storage client | boto3 | latest stable at install | Works against Cloudflare R2 since R2 is S3-API-compatible — just point the endpoint URL at R2, not AWS. Used for both uploading to the private bucket and generating pre-signed GET URLs (`generate_presigned_url`) — see `docs/prd.md` Security & Privacy NFR. |
| Image processing | Pillow | latest stable at install | Server-side compression before storing: resize to a 1600px max dimension on the longest side, re-encode as JPEG at quality 80. Runs synchronously in the `POST /api/items/scan` handler, before both the R2 upload and the CLIP inference call — smaller images mean a faster Replicate round trip too. |

## Database

| Component | Choice | Version | Notes |
|---|---|---|---|
| Database engine | PostgreSQL | **18.4** | Current stable major as of July 2026. Postgres 19 is in beta — do not use a beta version for this project. |
| Hosting | Neon | n/a (managed service) | Serverless Postgres, generous free tier, works well with Vercel/Render's request patterns. Supabase is a reasonable alternative if you'd rather also use Supabase Auth and consolidate vendors. |
| Extensions | `pgcrypto` (for `gen_random_uuid()`) | bundled with Postgres | No `pgvector` in v1 — not needed until the embedding-based roadmap items in `docs/prd.md` Section 10 are built. |

## CV/ML Integration

| Component | Choice | Notes |
|---|---|---|
| Classification approach | Zero-shot CLIP | Per `docs/prd.md` FR-3 — no fine-tuning, no self-hosted model weights. |
| Background removal | Replicate `cjwbw/rembg` | Hosted preprocessing. |
| Hosting | Replicate | Concrete pick over Hugging Face Inference Endpoints: simple pay-per-call REST API, no need to manage a persistently warm endpoint for a low-traffic personal project. Call it server-side from FastAPI, never directly from the Next.js client. |

Background removal is a hosted preprocessing step only. It removes distracting
surroundings without adding self-hosted segmentation weights.

## Hosting & Deployment

| Component | Choice | Notes |
|---|---|---|
| Frontend hosting | Vercel | First-party Next.js support, auto-deploys on push to `main`. |
| Backend hosting | Render | Concrete pick over Railway/Fly.io: straightforward Docker/native Python deploys, reasonable free tier for low traffic. |
| Object storage | Cloudflare R2 | Concrete pick over AWS S3: zero egress fees, S3-API-compatible so `boto3` works unchanged. |
| CI/CD | GitHub → Vercel/Render auto-deploy | No separate CI pipeline needed at this scale; both platforms redeploy automatically on push to `main`. |

## Environment Variables

Full spec for both apps. `.env.example` at the repo root mirrors this list — keep the two in sync if you add a variable. Never commit real values; both `.env` and `.env.local` are already in `.gitignore`.

### `frontend/.env.local`

| Variable | Example / format | Notes |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` / `pk_live_...` | Public, safe to expose client-side (that's what `NEXT_PUBLIC_` means in Next.js). |
| `CLERK_SECRET_KEY` | `sk_test_...` / `sk_live_...` | Server-side only — used by Clerk's Next.js middleware to protect routes. Never prefix this one with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` (dev) / `https://api.preeve.app` (prod) | Base URL the frontend calls for all FastAPI requests. |

### `backend/.env`

| Variable | Example / format | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host/dbname` | Neon connection string, async driver prefix for SQLAlchemy's async engine. |
| `CLERK_SECRET_KEY` | `sk_test_...` / `sk_live_...` | Used for backend-to-Clerk API calls (e.g., fetching user details not present in the JWT). |
| `CLERK_WEBHOOK_SIGNING_SECRET` | `whsec_...` | Distinct from `CLERK_SECRET_KEY` — this is the per-webhook-endpoint secret Clerk issues, used to verify `POST /api/webhooks/clerk` payloads are genuinely from Clerk. |
| `R2_ACCOUNT_ID` | Cloudflare account ID | |
| `R2_ACCESS_KEY_ID` | R2 API token access key | |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret | |
| `R2_BUCKET_NAME` | `preeve-items` | Strictly private bucket — no public access enabled at the Cloudflare dashboard level, ever. |
| `R2_ENDPOINT_URL` | `https://<account_id>.r2.cloudflarestorage.com` | Passed to `boto3.client("s3", endpoint_url=...)`. |
| `R2_PRESIGNED_URL_EXPIRY_SECONDS` | `3600` | How long a generated photo URL stays valid (1 hour). Frontend must not cache/store this URL long-term — re-fetch the resource if it's needed again later. |
| `REPLICATE_API_TOKEN` | `r8_...` | |
| `MAX_UPLOAD_FILE_SIZE_MB` | `5` | Enforced in the `POST /api/items/scan` handler before any processing — see `docs/API_ROUTES.md`. |
| `IMAGE_MAX_DIMENSION_PX` | `1600` | Pillow compression target, longest side. |
| `IMAGE_JPEG_QUALITY` | `80` | Pillow compression target. |
| `CORS_ALLOWED_ORIGINS` | `https://preeve.vercel.app,http://localhost:3000` | Comma-separated. FastAPI's `CORSMiddleware` splits this at startup — production URL plus local dev, nothing else. |

## Explicitly Not Used in v1

- `pgvector` / any vector database — no embeddings exist in this version's scope.
- Redux, Zustand, or any global state library — unnecessary for this app's state complexity.
- Self-hosted ML model weights or a custom-trained classifier — see `docs/prd.md` Section 10 for when this changes.
- A separate CI test-runner service — not justified until the test suite (Phase 5, verdict engine unit tests) actually exists and needs automated running on every push.
