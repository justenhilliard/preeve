# Preeve — Database Schema

**Status:** v1.1 — Locked for implementation (revised: storage privacy model, finalized taxonomies, migration/seed detail)
**Engine:** PostgreSQL 18.4 (see `docs/TECH_STACK.md`)
**Visual ERD source:** `docs/schema.dbml` (paste into dbdiagram.io) — this document is the fuller reference with exact types, constraints, migration structure, and seed data that DBML doesn't express cleanly.

## Setup

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Required before any table is created — every table's primary key default (`gen_random_uuid()`) depends on it. This is the first statement in migration `0001_initial_schema` (see Migrations section below).

All tables use `uuid` primary keys. **All timestamp columns are `timestamptz`, never bare `timestamp`** — an earlier draft of `docs/schema.dbml` used `timestamp` inconsistently with this file; both are now aligned.

---

## Table: `users`

Links the app to the identity managed by Clerk. No passwords or session tokens are stored here — Clerk owns all of that.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `auth_provider_id` | `varchar(255)` | `NOT NULL UNIQUE` | The `sub` claim from the verified Clerk JWT. See `docs/API_ROUTES.md` → Auth Conventions for the exact claim mapping and the webhook race-condition fix. |
| `email` | `varchar(320)` | `NOT NULL UNIQUE` | Synced from Clerk via webhook, or from the JWT's `email` claim on lazy get-or-create. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

**Relationships:** one-to-one with `preferences`; one-to-many with `scanned_items`.

**Sync mechanism:** two paths write to this table, and both must exist — see `docs/API_ROUTES.md` for full detail:
1. **Webhook (primary):** Clerk sends `user.created`, `user.updated`, and `user.deleted` events to `POST /api/webhooks/clerk`. `user.created`/`user.updated` upsert by `auth_provider_id`. `user.deleted` hard-deletes the row (cascades to `preferences` and `scanned_items` per their `ON DELETE CASCADE` FKs — consistent with the "no special retention policy" NFR in `docs/prd.md`).
2. **Lazy get-or-create (fallback, resolves the race condition):** on *every* authenticated request, the auth dependency checks whether a `users` row exists for the JWT's `sub` claim. If not — because the webhook hasn't landed yet, or was missed — it creates one on the spot using the `sub` and `email` claims already present in the verified JWT. This makes the webhook an optimization, not a hard dependency the rest of the app blocks on.

---

## Table: `preferences`

One row per user. Created on first login (or lazily on first questionnaire submission), updated thereafter via the preferences edit screen.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `user_id` | `uuid` | `NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE` | One-to-one; deleting a user cascades. |
| `preferred_colors` | `text[]` | `NOT NULL DEFAULT '{}'` | Multi-select. Values must be members of the 17-value color taxonomy in `docs/prd.md` FR-2.1. |
| `preferred_fits` | `text[]` | `NOT NULL DEFAULT '{}'` | Multi-select. Values must be members of the 5-value fit taxonomy. **Not used by the v1 verdict engine** — see `docs/prd.md` FR-2.1's scope note. Collected now for the future fine-tuned-classifier roadmap item. |
| `formality_preference` | `varchar(20)` | `CHECK (formality_preference IN ('athleisure', 'casual', 'smart_casual', 'business_casual', 'formal'))` | Nullable until the user completes onboarding. |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Update on every write (trigger or application-layer — either is fine, application-layer is simpler for a single-contributor project). |

**Why no `CHECK` constraint on the array columns:** Postgres `CHECK` constraints on array *elements* require a helper function or trigger to do properly, which is disproportionate ceremony for a personal project. Enforcement for `preferred_colors` and `preferred_fits` happens at the Pydantic validation layer (`docs/API_ROUTES.md`) instead — every write goes through the API, so this is a deliberate, sufficient choice, not an oversight.

---

## Table: `scanned_items`

One row per scan. Covers FR-3 (classification), FR-4 (verdict), and FR-6 (wardrobe log) — these are the same record over its lifecycle, not three separate entities.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `user_id` | `uuid` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | |
| `photo_key` | `varchar(512)` | `NOT NULL` | **Object key, not a URL.** Format: `items/{userId}/{itemId}.{ext}` (e.g. `items/3f1b2c4d.../8a1c2e3d....jpg`), `{ext}` derived from the validated upload MIME type (`jpg` or `png`). The bucket is strictly private — see `docs/prd.md` Security & Privacy NFR. The API layer converts this key into a short-lived pre-signed URL at response time; nothing here is ever a permanent public link. |
| `detected_category` | `varchar(20)` | `CHECK (detected_category IN ('top','bottom','dress','outerwear','shoes','accessory'))`, nullable | Zero-shot CLIP output (FR-3.2). Null only if classification failed and the user hasn't yet supplied a manual fallback value. |
| `detected_color` | `varchar(20)` | `CHECK (detected_color IN ('black','white','gray','navy','blue','red','green','olive','brown','tan','beige','pink','purple','yellow','orange','burgundy','multicolor'))`, nullable | Same as above. |
| `corrected_category` | `varchar(20)` | same `CHECK` list as `detected_category`, nullable | Set only if the user overrides via "This looks wrong" (FR-3.5) or the manual-fallback flow (FR-3.4). |
| `corrected_color` | `varchar(20)` | same `CHECK` list as `detected_color`, nullable | Same as above. |
| `verdict` | `varchar(10)` | `CHECK (verdict IN ('buy', 'maybe', 'skip'))`, nullable until computed | FR-4.2, computed by the deterministic rule matrix in `docs/prd.md` FR-4. |
| `rationale` | `text` | nullable until computed | Template-generated explanation matching the rule that fired, FR-4.3. |
| `saved_to_wardrobe` | `boolean` | `NOT NULL DEFAULT false` | True once the user saves it via the verdict screen (FR-6.1). |
| `is_favorited` | `boolean` | `NOT NULL DEFAULT false` | Toggled from the wardrobe list (FR-6.5). Independent of `saved_to_wardrobe` and `verdict` — can be combined with either filter. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

**Application-layer rule (not enforced by the DB):** wherever the verdict engine or pairing lookup reads this row's category/color, it must prefer `corrected_category`/`corrected_color` over `detected_category`/`detected_color` when the corrected fields are non-null. Call this the item's "effective category/color" consistently in code and in any future doc that references it.

**Indexes:**

```sql
CREATE INDEX idx_scanned_items_wardrobe_log
  ON scanned_items (user_id, saved_to_wardrobe, created_at DESC);
```

Supports the wardrobe log query (FR-6.2: this user's saved items, most recent first) without a sequential scan.

---

## Table: `pairing_suggestions`

Hand-authored seed dataset (36 rows in the v1 blueprint below). No foreign key to `scanned_items` — matching happens as a query-time tag lookup, not a stored relationship.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `category` | `varchar(20)` | `NOT NULL`, same `CHECK` list as `scanned_items.detected_category` | Matched against the scanned item's *effective* category. |
| `color` | `varchar(20)` | `NOT NULL`, same `CHECK` list as `scanned_items.detected_color` | Matched against the scanned item's *effective* color. |
| `suggestion_text` | `text` | `NOT NULL` | |
| `image_key` | `varchar(512)` | nullable | Optional. Same private-storage convention as `scanned_items.photo_key` if present — never a public URL. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

**Indexes:**

```sql
CREATE INDEX idx_pairing_suggestions_lookup
  ON pairing_suggestions (category, color);
```

---

## Entity-Relationship Summary

```
users (1) ──── (1) preferences
users (1) ──── (∞) scanned_items

pairing_suggestions has no FK relationship to any other table —
it's queried independently by (category, color) at request time.
```

---

## Migrations

Alembic-managed. Directory layout:

```
backend/
  alembic/
    versions/
      0001_initial_schema.py
      0002_seed_pairing_suggestions.py
    env.py
  alembic.ini
```

- **`0001_initial_schema.py`** — runs `CREATE EXTENSION IF NOT EXISTS pgcrypto;`, then creates `users`, `preferences`, `scanned_items`, `pairing_suggestions` with every constraint and both indexes listed above, in that table order (respects FK dependencies).
- **`0002_seed_pairing_suggestions.py`** — a data migration (not schema) that inserts the 36-row blueprint below. Keeping it as its own migration, separate from `0001`, means the seed data can be amended later (`0003_add_more_pairings.py`, etc.) without touching the schema migration.
- No `pgvector` migration exists in v1 — see `docs/prd.md` Section 10 for when that changes.

---

## Seed Data: `pairing_suggestions` (v1 blueprint, 36 rows)

Six categories × six representative colors. This is a deliberately small, curated set (not full 6×17 coverage) — extend it after v1 ships if pairing diversity feels thin in practice, per the risk noted in `docs/prd.md` Section 8.

```sql
INSERT INTO pairing_suggestions (category, color, suggestion_text) VALUES
  ('top', 'black', 'Pair with dark wash jeans and white sneakers for an easy monochrome-adjacent look.'),
  ('top', 'white', 'Layer under a navy blazer or tuck into olive chinos for a clean, versatile combo.'),
  ('top', 'navy', 'Pair with tan chinos and brown leather shoes for a business-casual staple.'),
  ('top', 'olive', 'Pair with black jeans and white sneakers for an easy neutral-on-neutral look.'),
  ('top', 'burgundy', 'Pair with black trousers and black boots for a rich, cool-weather combo.'),
  ('top', 'tan', 'Pair with navy trousers and brown loafers for a warm neutral pairing.'),

  ('bottom', 'black', 'Pair with a white top and black boots for a simple, sharp silhouette.'),
  ('bottom', 'white', 'Pair with a navy top and tan accessories for a crisp warm-weather look.'),
  ('bottom', 'navy', 'Pair with a white top and brown belt and shoes for a classic business-casual base.'),
  ('bottom', 'olive', 'Pair with a black top and white sneakers for an easy utilitarian look.'),
  ('bottom', 'burgundy', 'Pair with a white or tan top and black shoes for a bold but balanced combo.'),
  ('bottom', 'tan', 'Pair with a navy top and white sneakers for a relaxed warm-weather outfit.'),

  ('dress', 'black', 'Add a tan or burgundy accessory to warm up the monochrome base.'),
  ('dress', 'white', 'Pair with tan or brown accessories for a soft, warm-weather look.'),
  ('dress', 'navy', 'Pair with black or tan shoes and a light accessory for versatility.'),
  ('dress', 'olive', 'Pair with black or tan accessories for an easy neutral base.'),
  ('dress', 'burgundy', 'Pair with black shoes and a simple accessory for a polished cool-weather look.'),
  ('dress', 'tan', 'Pair with white or navy accessories for a soft, warm-toned outfit.'),

  ('outerwear', 'black', 'Layer over almost anything — pairs cleanly with white, navy, or olive base pieces.'),
  ('outerwear', 'white', 'Pairs well over navy or black base pieces for a crisp contrast.'),
  ('outerwear', 'navy', 'A business-casual staple — pairs with white, tan, or olive base pieces.'),
  ('outerwear', 'olive', 'Pairs well with black or white base pieces for an easy utility look.'),
  ('outerwear', 'burgundy', 'Pairs well with black or tan base pieces for a rich cool-weather layer.'),
  ('outerwear', 'tan', 'A versatile neutral layer — pairs with navy, white, or olive base pieces.'),

  ('shoes', 'black', 'Goes with nearly everything — the safest neutral choice in your wardrobe.'),
  ('shoes', 'white', 'Pairs well with casual bottoms in navy, olive, or tan for an easy everyday look.'),
  ('shoes', 'navy', 'Pairs well with tan or white bottoms for a clean business-casual base.'),
  ('shoes', 'olive', 'Pairs well with black or tan bottoms for a casual, grounded look.'),
  ('shoes', 'burgundy', 'Pairs well with navy or tan bottoms for a polished, slightly bold look.'),
  ('shoes', 'tan', 'A warm neutral that pairs with navy, olive, or white bottoms.'),

  ('accessory', 'black', 'A safe neutral that pairs with almost any base outfit.'),
  ('accessory', 'white', 'Adds a crisp contrast point to darker base outfits.'),
  ('accessory', 'navy', 'Pairs well with tan, white, or olive base pieces for a business-casual finish.'),
  ('accessory', 'olive', 'Adds an easy utility touch to black or tan base outfits.'),
  ('accessory', 'burgundy', 'Adds a bold accent to black, tan, or navy base outfits.'),
  ('accessory', 'tan', 'A warm neutral accent that pairs with navy or olive base outfits.');
```
