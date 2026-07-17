# Preeve — API Routes

**Status:** v1.1 — Locked for implementation (revised: auth mapping, presigned URLs, validation rules, error matrix)
**Base URL (production):** `https://api.preeve.app` (placeholder domain — replace once the Render service is provisioned)
**Base URL (local dev):** `http://localhost:8000`

## Conventions

- **JSON casing:** all request/response bodies use `camelCase`, even though the Postgres schema (`docs/DATABASE.md`) is `snake_case`. FastAPI/Pydantic models handle the conversion at the API boundary via `alias_generator` — deliberate convention, not an inconsistency.
- **Timestamp serialization:** every `timestamptz` value is serialized as ISO 8601 UTC with a literal `Z` suffix — e.g. `2026-07-09T19:00:00Z`. Never a bare offset like `+00:00`, never a Unix epoch integer. This is a hard rule, not per-endpoint discretion.
- **Auth:** every route except `GET /api/health` and `POST /api/webhooks/clerk` requires `Authorization: Bearer <clerk_session_token>`. See Auth Conventions below for exactly how this is verified and mapped to a local user.
- **Error shape:** every error response shares one envelope:
  ```json
  {
    "error": {
      "code": "string_error_code",
      "message": "Human-readable description"
    }
  }
  ```
  See the Error Code Matrix at the bottom for the complete set.
- **IDs:** all resource IDs are UUIDv4 strings.

---

## Auth Conventions

**JWT claim mapping.** The frontend obtains a session token from the Clerk SDK and sends it as `Authorization: Bearer <token>`. The backend verifies it against Clerk's JWKS endpoint, then reads the verified token's `sub` claim — this is Clerk's own user ID (`user_2abcXYZ` format) — and treats it as the value of `users.auth_provider_id`. If the JWT's `email` claim is present, it's used as a fallback source for `users.email`; the webhook payload (below) is the primary source.

**Webhook events supported** at `POST /api/webhooks/clerk`:

| Event | Action |
|---|---|
| `user.created` | Upsert a `users` row: `auth_provider_id = data.id`, `email = data.email_addresses[0].email_address`. |
| `user.updated` | Same upsert — covers email changes. |
| `user.deleted` | Hard-delete the `users` row by `auth_provider_id = data.id`. Cascades to `preferences` and `scanned_items` per their FK constraints. |

Every other Clerk event type is ignored — return `200 { "received": true }` without processing, so Clerk doesn't retry-storm the endpoint on events this app doesn't care about.

**Race condition — request arrives before the webhook lands.** Webhooks are asynchronous and not guaranteed to arrive before the frontend's next authenticated API call (e.g., a user signs up and immediately hits `GET /api/users/me` a few hundred milliseconds later). The fix is a **lazy get-or-create** in the auth dependency that every protected route goes through:

1. Verify the JWT against Clerk's JWKS. If invalid/expired → `401 unauthorized`.
2. Look up `users` by `auth_provider_id = jwt.sub`.
3. If found, proceed with that user.
4. If not found, create a `users` row using `jwt.sub` and `jwt.email` (if the claim is present; if not, fetch the email via the Clerk backend API using `CLERK_SECRET_KEY`), then proceed.

This makes the webhook an optimization/consistency mechanism, not something the rest of the app blocks on or can fail because of. Implement this once as a shared FastAPI dependency (e.g. `get_current_user`), not per-route.

---

## `GET /api/health`

Unauthenticated. Used by Render for uptime checks.

**Success — 200**
```json
{ "status": "ok" }
```

---

## `POST /api/webhooks/clerk`

Authenticated via Clerk's webhook signing secret (`CLERK_WEBHOOK_SIGNING_SECRET`, verified via the `svix` headers Clerk sends), not a bearer token. Called by Clerk, not the frontend. See Auth Conventions above for the exact event handling.

**Request body** (Clerk's standard webhook payload shape, relevant fields shown)
```json
{
  "type": "user.created",
  "data": {
    "id": "user_2abcXYZ",
    "email_addresses": [{ "email_address": "student@wm.edu" }]
  }
}
```

**Success — 200**
```json
{ "received": true }
```

**Error — 400** (invalid signature)
```json
{ "error": { "code": "invalid_signature", "message": "Webhook signature verification failed." } }
```

---

## `GET /api/users/me`

Returns the current user's app-side profile, including whether onboarding (FR-2) is complete.

**Success — 200**
```json
{
  "id": "3f1b2c4d-1234-4a5b-8c6d-7e8f9a0b1c2d",
  "email": "student@wm.edu",
  "hasCompletedPreferences": true,
  "createdAt": "2026-07-01T14:22:00Z"
}
```

**Error — 401** — see Error Code Matrix.

---

## `GET /api/preferences`

**Success — 200**
```json
{
  "preferredColors": ["navy", "black", "olive"],
  "preferredFits": ["slim", "relaxed"],
  "formalityPreference": "business_casual",
  "updatedAt": "2026-07-05T09:10:00Z"
}
```

**Success — 200 (not yet set)**
```json
{
  "preferredColors": [],
  "preferredFits": [],
  "formalityPreference": null,
  "updatedAt": null
}
```

**Error — 401** — see Error Code Matrix.

---

## `PUT /api/preferences`

Upsert — used for both initial questionnaire submission (FR-2.1/2.2) and later edits (FR-2.3).

**Pydantic validation (request):**

| Field | Type | Required | Rules |
|---|---|---|---|
| `preferredColors` | `list[str]` | yes (may be empty list) | Each value must be one of the 17-value color enum (`docs/prd.md` FR-2.1). Max 17 items (no duplicates). |
| `preferredFits` | `list[str]` | yes (may be empty list) | Each value must be one of the 8-value fit enum. Max 8 items (no duplicates). |
| `formalityPreference` | `str \| null` | yes (nullable) | One of `athleisure`, `casual`, `smart_casual`, `business_casual`, `formal`, or `null`. |

**Request body**
```json
{
  "preferredColors": ["navy", "black", "olive"],
  "preferredFits": ["slim", "relaxed"],
  "formalityPreference": "business_casual"
}
```

**Success — 200**
```json
{
  "preferredColors": ["navy", "black", "olive"],
  "preferredFits": ["slim", "relaxed"],
  "formalityPreference": "business_casual",
  "updatedAt": "2026-07-09T18:45:00Z"
}
```

**Error — 422** (Pydantic validation failure, e.g. invalid enum value)
```json
{ "error": { "code": "validation_error", "message": "formalityPreference must be one of: athleisure, casual, smart_casual, business_casual, formal." } }
```

---

## `POST /api/items/scan`

Multipart upload. Validates the file, compresses it (Pillow, per
`docs/TECH_STACK.md`), uploads to R2 under `items/{userId}/{itemId}.{ext}`,
calls the CLIP inference API (via Replicate) for zero-shot classification,
extracts narrow structured visual attributes via OpenAI Structured Outputs,
computes the verdict via the rule matrix in `docs/prd.md` FR-4, looks up a
pairing suggestion, and persists the row — all synchronously in one request.

**Request** — `multipart/form-data`
```
photo: <binary image file>
```

**Validation (enforced before any processing):**

| Rule | Value | On failure |
|---|---|---|
| Allowed MIME types | `image/jpeg`, `image/png` only | `415 unsupported_media_type` |
| Max file size | `MAX_UPLOAD_FILE_SIZE_MB` (5 MB) | `413 file_too_large` |
| File presence | required | `400 validation_error` |

**Success — 201.** `photoUrl` is a **pre-signed R2 URL, valid for `R2_PRESIGNED_URL_EXPIRY_SECONDS` (1 hour)** — generated fresh on every response that includes it, never stored as-is. Do not cache this value beyond the current page session.

```json
{
  "id": "8a1c2e3d-4567-4f89-9a0b-1c2d3e4f5a6b",
  "photoUrl": "https://<account_id>.r2.cloudflarestorage.com/preeve-items/items/3f1b2c4d.../8a1c2e3d....jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&X-Amz-Signature=...",
  "detectedCategory": "outerwear",
  "detectedColor": "navy",
  "visualAttributes": {
    "garmentType": "blazer",
    "primaryColor": "navy",
    "secondaryColors": [],
    "pattern": null
  },
  "correctedCategory": null,
  "correctedColor": null,
  "verdict": "buy",
  "rationale": "navy is in your preferred palette, and outerwear fits your business_casual preference.",
  "closetInsight": "You already have 2 other navy outerwear items in your wardrobe.",
  "pairingSuggestions": [
    {
      "id": "1d2e3f4a-5b6c-7d8e-9f0a-1b2c3d4e5f6a",
      "suggestionText": "A business-casual staple — pairs with white, tan, or olive base pieces.",
      "imageUrl": null
    },
    {
      "id": "9f8e7d6c-5b4a-3c2d-1e0f-a9b8c7d6e5f4",
      "suggestionText": "Pairs well over navy or black base pieces for a crisp contrast.",
      "imageUrl": null
    }
  ],
  "savedToWardrobe": false,
  "createdAt": "2026-07-09T19:00:00Z"
}
```

Array has 1 or 2 entries per FR-5.1 — an exact category+color match is always attempted first; a second, distinct entry appears only if the broader fallback match (same category, different color, or vice versa) also finds something.

**Success — 201 (classification failed, manual fallback required — FR-3.4)**
```json
{
  "id": "8a1c2e3d-4567-4f89-9a0b-1c2d3e4f5a6b",
  "photoUrl": "https://<account_id>.r2.cloudflarestorage.com/preeve-items/items/3f1b2c4d.../8a1c2e3d....jpg?...",
  "detectedCategory": null,
  "detectedColor": null,
  "visualAttributes": null,
  "correctedCategory": null,
  "correctedColor": null,
  "verdict": null,
  "rationale": null,
  "closetInsight": null,
  "pairingSuggestions": [],
  "savedToWardrobe": false,
  "createdAt": "2026-07-09T19:00:00Z",
  "classificationFailed": true
}
```

**Error — 413**
```json
{ "error": { "code": "file_too_large", "message": "Image exceeds the 5MB limit." } }
```

**Error — 415**
```json
{ "error": { "code": "unsupported_media_type", "message": "Only image/jpeg and image/png are accepted." } }
```

`visualAttributes` is best-effort structured perception metadata and may be `null`
without affecting the CLIP-driven verdict flow. It is never used for verdict
computation. `closetInsight` is computed live from the user's current saved
wardrobe items and is not stored.

**Error — 502** (CLIP upstream unavailable — distinct from a low-confidence result, which is handled as `classificationFailed: true` above, not an HTTP error)
```json
{ "error": { "code": "inference_unavailable", "message": "Classification service is temporarily unavailable. Try again shortly." } }
```

---

## `PATCH /api/items/{itemId}/correct`

Implements the "This looks wrong" override (FR-3.5) — available whether the original classification succeeded or failed. Recomputes verdict and rationale using the corrected values via the same rule matrix.

**Pydantic validation (request):**

| Field | Type | Required | Rules |
|---|---|---|---|
| `correctedCategory` | `str` | yes | One of the 6-value category enum. |
| `correctedColor` | `str` | yes | One of the 17-value color enum. |

Both fields are required together — there's no partial-correction endpoint in v1; the user resubmits both category and color even if only one was wrong.

**Request body**
```json
{
  "correctedCategory": "top",
  "correctedColor": "burgundy"
}
```

**Success — 200**
```json
{
  "id": "8a1c2e3d-4567-4f89-9a0b-1c2d3e4f5a6b",
  "detectedCategory": "outerwear",
  "detectedColor": "navy",
  "visualAttributes": {
    "garmentType": "blazer",
    "primaryColor": "navy",
    "secondaryColors": [],
    "pattern": null
  },
  "correctedCategory": "top",
  "correctedColor": "burgundy",
  "verdict": "skip",
  "rationale": "burgundy isn't in your preferred palette (navy, black, olive).",
  "closetInsight": "This adds burgundy to your wardrobe - you haven't saved anything in that color yet.",
  "pairingSuggestions": [],
  "savedToWardrobe": false
}
```

**Error — 404**
```json
{ "error": { "code": "not_found", "message": "No item found with that ID for this user." } }
```

**Error — 422** (invalid enum value) — same shape as the preferences endpoint's validation error.

---

## `PATCH /api/items/{itemId}/save`

Marks an item as saved to the wardrobe log (FR-6.1).

**Request body:** none required.

**Success — 200**
```json
{ "id": "8a1c2e3d-4567-4f89-9a0b-1c2d3e4f5a6b", "savedToWardrobe": true }
```

**Error — 404** — see Error Code Matrix.

---

## `GET /api/items`

Wardrobe log list (FR-6.2) — returns only items where `savedToWardrobe` is true, most recent first.

**Query params (all optional, FR-6.4/FR-6.5):**

| Param | Values | Behavior |
|---|---|---|
| `verdict` | `buy`, `maybe`, `skip` | Filters to items with that verdict. Omit for all verdicts. |
| `favorited` | `true` | Filters to items where `isFavorited` is true. Omit to include all (favorited and not). There's no `favorited=false` — that's just the default unfiltered view. |

Both can be combined, e.g. `GET /api/items?verdict=buy&favorited=true` — favorited items that are also a Buy.

**Success — 200**
```json
{
  "items": [
    {
      "id": "8a1c2e3d-4567-4f89-9a0b-1c2d3e4f5a6b",
      "photoUrl": "https://<account_id>.r2.cloudflarestorage.com/preeve-items/items/3f1b2c4d.../8a1c2e3d....jpg?...",
      "detectedCategory": "outerwear",
      "detectedColor": "navy",
      "verdict": "buy",
      "isFavorited": true,
      "createdAt": "2026-07-09T19:00:00Z"
    }
  ]
}
```

Note: generating a pre-signed URL for every item in this list on every request is acceptable at v1's scale (personal project, small wardrobe logs). If this list ever grows into the hundreds, batch-sign or cache signed URLs — not a v1 concern.

This list endpoint intentionally does not include `visualAttributes` or
`closetInsight`; those fields are only returned by single-item detail,
scan, and correction responses.

---

## `PATCH /api/items/{itemId}/favorite`

Toggles or sets favorite status (FR-6.5).

**Request body**
```json
{ "isFavorited": true }
```

**Success — 200**
```json
{ "id": "8a1c2e3d-4567-4f89-9a0b-1c2d3e4f5a6b", "isFavorited": true }
```

**Error — 404** — see Error Code Matrix.

---

## `GET /api/items/{itemId}`

Single item detail (wardrobe item detail screen).

**Success — 200** — same shape as the `POST /api/items/scan` success response.

**Error — 404** — see Error Code Matrix.

---

## `DELETE /api/items/{itemId}`

FR-6.3. Deletes the DB row **and** the underlying R2 object (identified by `photo_key`) — don't leave orphaned files in the bucket.

**Success — 204** — empty body.

**Error — 404** — see Error Code Matrix.

---

## `GET /api/pairings`

Internal endpoint backing the pairing lookup used inside `POST /api/items/scan` and `PATCH /api/items/{itemId}/correct`. Exposed as its own route for debugging/reuse, not called directly by the frontend in v1.

**Query params:** `category` (string, required, one of the 6-value enum), `color` (string, required, one of the 17-value enum)

**Success — 200**
```json
{
  "suggestions": [
    {
      "id": "1d2e3f4a-5b6c-7d8e-9f0a-1b2c3d4e5f6a",
      "suggestionText": "A business-casual staple — pairs with white, tan, or olive base pieces.",
      "imageUrl": null
    }
  ]
}
```

**Success — 200 (no match — FR-5.2)**
```json
{ "suggestions": [] }
```

**Error — 422** (invalid `category`/`color` query value) — see Error Code Matrix.

---

## Error Code Matrix

Every error code used anywhere in this API, in one place, so a client can switch on `error.code` without guessing.

| HTTP status | `code` | Meaning | Where it appears |
|---|---|---|---|
| 400 | `validation_error` | Generic malformed request (e.g. missing required multipart field) | `POST /api/items/scan` |
| 400 | `invalid_signature` | Webhook signature failed verification | `POST /api/webhooks/clerk` |
| 401 | `unauthorized` | Missing, malformed, or expired bearer token | Every authenticated route |
| 404 | `not_found` | Resource doesn't exist, or exists but isn't owned by the requesting user | `.../items/{itemId}` routes |
| 413 | `file_too_large` | Upload exceeds `MAX_UPLOAD_FILE_SIZE_MB` | `POST /api/items/scan` |
| 415 | `unsupported_media_type` | Upload isn't `image/jpeg` or `image/png` | `POST /api/items/scan` |
| 422 | `validation_error` | Pydantic field-level validation failure (bad enum value, wrong type, etc.) | `PUT /api/preferences`, `PATCH /api/items/{itemId}/correct`, `GET /api/pairings` |
| 502 | `inference_unavailable` | Replicate/CLIP upstream call failed or timed out | `POST /api/items/scan` |
| 500 | `internal_error` | Unhandled server error — should never surface a stack trace to the client | Any route, fallback case |

Note the deliberate overload of `code: "validation_error"` at both `400` and `422` — `400` is for structurally malformed requests (wrong content type, missing field), `422` is for a well-formed request with an invalid value (bad enum). This distinction matters for how a frontend should react: a `400` usually means a client bug, a `422` usually means show the user a form error.
