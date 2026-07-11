# Preeve — Product Requirements Document (PRD)

**Author:** Justen Hilliard
**Status:** v1.0 — Approved for implementation

---

## 1. Overview

Preeve is a mobile-optimized web app that helps shoppers decide whether to buy a clothing item while still in the store. A user photographs an item, the app classifies its category and color, compares those attributes against the user's stated style preferences, and returns a Buy/Maybe/Skip verdict with a short rationale and a pairing suggestion.

**Problem statement:** Shoppers frequently buy items that don't fit their existing style or wardrobe, resulting in unworn purchases. Preeve provides an in-the-moment decision aid at the point of purchase.

**Primary goal:** Ship a functional, reliable MVP that performs genuine computer-vision-based clothing classification and rule-based style matching, end to end, with no hardcoded or simulated results in the core flow.

---

## 2. Goals & Success Criteria

| Goal | Success Criteria |
|---|---|
| Functional core loop | A user can complete scan → verdict → pairing suggestion → save, end to end, using real photos, with no manual intervention required on the happy path |
| Operational stability | No unhandled crashes or broken UI states across the core flow, including under external API failure conditions |
| Genuine ML integration | Classification is performed via a real CLIP-based inference call, not hardcoded or simulated logic |
| Deployed and accessible | Application is deployed to a publicly reachable URL |

---

## 3. Target Users

Fashion-conscious shoppers, roughly college-age to late-20s, who make in-person clothing purchases and want a quick, objective check against their own style before buying.

---

## 4. Scope

**In scope for v1:** static landing/intro screen (value prop + "Get Started" entry point, no backend behind it), account creation, style preferences questionnaire, item scan (camera or upload), zero-shot category/color classification, user-correctable classification results, rule-based verdict with rationale, fixed-seed-set pairing suggestion, wardrobe log (save/view/delete).

**Out of scope for v1:** swipe-based onboarding, embedding-based style profile, fine-tuned CV classifier, retrieval-based pairing suggestions, pattern/formality detection, social features, native mobile app, retailer/barcode integrations. See Section 10, Future Work.

---

## 5. Architecture Overview

- **Frontend:** Next.js (React) with Tailwind CSS. Responsive, mobile-optimized web app with browser-based camera capture (`getUserMedia`) and file upload support. Installable as a PWA.
- **Backend:** Python (FastAPI) service handling business logic, orchestration of the CV inference call, and verdict computation.
- **CV/ML integration:** Zero-shot classification via a hosted CLIP inference endpoint, called server-side rather than from the client.
- **Database:** PostgreSQL — stores users, style preferences, wardrobe entries, and the curated pairing-suggestion dataset.
- **Object storage:** S3-compatible storage (e.g., Cloudflare R2 or AWS S3) for user-uploaded item photos, private by default.
- **Authentication:** Delegated to a managed auth provider (e.g., Clerk, Supabase Auth, or Auth.js) rather than custom-built session/credential handling.
- **Hosting:** Frontend and backend deployed independently, with managed Postgres.

---

## 6. Functional Requirements

Each requirement includes acceptance criteria — the bar for "this is done," not just "this exists."

### FR-1: Authentication

- **FR-1.1** — User can sign up via email/password or OAuth (via managed auth provider).
- **FR-1.2** — User can log in and log out.
- **FR-1.3** — Session persists across browser visits until explicit logout.

**Acceptance criteria:** A new user can create an account, close the browser, return later, and log back in to see their saved preferences and wardrobe log intact.

### FR-2: Style Preferences Onboarding

- **FR-2.1** — On first login, user is prompted to complete a short questionnaire: preferred colors (multi-select from a fixed palette), preferred fit/silhouette (multi-select), formality preference (single select).
- **FR-2.2** — Preferences are saved to the user's profile record.
- **FR-2.3** — User can revisit and edit preferences at any time from a dedicated screen.

**Fixed taxonomies (final, v1):**

- **Colors** (17): `black, white, gray, navy, blue, red, green, olive, brown, tan, beige, pink, purple, yellow, orange, burgundy, multicolor`
- **Fits/silhouettes** (8): `baggy, oversized, relaxed, cropped, fitted, slim, tailored, straight`
- **Formality** (5): `athleisure, casual, smart_casual, business_casual, formal`

**Important scope note:** `preferred_fits` is collected in v1 for forward-compatibility with the fine-tuned-classifier roadmap item (Section 10), but is **not used by the v1 verdict engine** (see FR-4) — v1's zero-shot CLIP classification (FR-3.2) does not detect an item's fit/silhouette, so there is no item-side signal to compare it against yet. Don't build verdict logic that pretends to check it.

**Acceptance criteria:** Questionnaire completes in under a minute. Preferences persist and are reflected correctly the next time a verdict is generated.

### FR-3: Item Scan & Attribute Detection

- **FR-3.1** — User can capture a photo via device camera (mobile browser) or upload an existing image file.
- **FR-3.2** — Backend sends the image to a hosted CLIP inference endpoint and performs zero-shot classification against two fixed label sets, both finalized (v1, no longer open):
  - **Category** (6): `top, bottom, dress, outerwear, shoes, accessory`
  - **Color** (17): same 17-value palette as FR-2.1, so detected item colors and user color preferences are always directly comparable.

  These lists are the contract between the CLIP prompt/label set and everything downstream (verdict engine, pairing lookup) — if real-world testing during the Phase 1 validation spike shows CLIP performs poorly on a particular label, fix it by adjusting the prompt engineering for that label, not by silently expanding the list without updating this document, `docs/DATABASE.md`, and `docs/API_ROUTES.md` together.
- **FR-3.3** — UI shows a processing/loading state while classification runs.
- **FR-3.4** — If classification fails (API error, timeout, or low-confidence result), the user is shown a fallback UI to manually select category and color rather than a dead end.
- **FR-3.5** — Independent of failure, the result screen always includes a "This looks wrong" action, letting the user manually override the detected category and/or color even when classification succeeded. The corrected values are used downstream by the verdict engine in place of the original model output.

**Acceptance criteria:** A typical photo returns a classification within a few seconds under normal network conditions. A simulated API failure correctly triggers the manual fallback instead of an unhandled error. Triggering "This looks wrong" on a successful classification lets the user submit corrected values, and the resulting verdict reflects the correction, not the original output.

### FR-4: Verdict Engine

- **FR-4.1** — System compares the detected (or user-corrected) category/color against the user's saved preferences using deterministic, priority-ordered rules — **not** a weighted or numeric scoring model. This is a deliberate continuation of the v1 scope cut (see Section 4): similarity/embedding-based scoring is explicitly roadmap, not v1.
- **FR-4.2** — System returns exactly one of: Buy, Maybe, Skip.
- **FR-4.3** — System generates a short, template-based rationale that references the specific rule that fired.

**Rule matrix (final, v1) — evaluated top to bottom, first matching rule wins:**

| Priority | Condition | Verdict | Rationale template |
|---|---|---|---|
| 1 | `preferredColors` is non-empty AND item color NOT IN `preferredColors` | **Skip** | `"{color} isn't in your preferred palette ({preferredColorsList})."` |
| 2 | Item color IS in `preferredColors` (or `preferredColors` is empty) AND `formalityPreference` is set AND `formalityPreference` NOT IN `CATEGORY_FORMALITY_MAP[category]` | **Maybe** | `"{color} matches your palette, but {category} typically leans more toward {impliedFormalityLabel} than your {formalityPreference} preference."` |
| 3 | Neither rule above fires (color matches or no color preference set, and formality compatible or not set) | **Buy** | `"{color} is in your preferred palette."` (append `", and {category} fits your {formalityPreference} preference."` if a `formalityPreference` was actually checked) |
| — | `preferredColors` is empty AND `formalityPreference` is null (user hasn't completed onboarding) | **Maybe** | `"Set your style preferences to get a personalized verdict."` — checked before rule 1. |

**`CATEGORY_FORMALITY_MAP`** (the coarse, deterministic stand-in that makes rule 2 possible without item-level formality detection, since FR-3.2 does not detect formality directly):

| Category | Compatible `formalityPreference` values |
|---|---|
| `top` | `athleisure`, `casual`, `smart_casual`, `business_casual` |
| `bottom` | `athleisure`, `casual`, `smart_casual`, `business_casual` |
| `dress` | `smart_casual`, `business_casual`, `formal` |
| `outerwear` | `athleisure`, `casual`, `smart_casual`, `business_casual`, `formal` |
| `shoes` | `athleisure`, `casual`, `smart_casual`, `business_casual`, `formal` |
| `accessory` | `athleisure`, `casual`, `smart_casual`, `business_casual`, `formal` |

**Known, accepted limitation:** because v1's CV pipeline only detects category and color (FR-3.2), `outerwear`/`shoes`/`accessory` are mapped as formality-compatible with everything — the taxonomy is too coarse to discriminate a formal blazer from a casual jacket without per-item formality detection, which is explicitly out of scope for v1 (Section 4). Rule 2 will only meaningfully fire for `top`/`bottom` (never matches a `formal` preference) and `dress` (never matches an `athleisure` or `casual` preference). This is an intentional, documented approximation, not a bug — fixing it properly is the fine-tuned-classifier roadmap item (Section 10).

**Acceptance criteria:** Given a fixed preference profile and a fixed set of item attributes, the verdict and rationale are deterministic and reproducible — same inputs always produce the same output, evaluated via the rule matrix above with no randomness or model-based scoring involved.

### FR-5: Pairing Suggestions

- **FR-5.1** — System looks up 1–2 pairing suggestions from a hand-curated seed dataset (36 entries, one per category/color combination — see `docs/DATABASE.md` Seed Data). Lookup logic: (1) an exact category+color match against the scanned item's effective attributes is always attempted first; (2) if a second, distinct suggestion is wanted, a broader fallback match (same category with a different color, or same color with a different category) is attempted second. This lets the 1–2 range work without requiring more than one seed row per exact combination.
- **FR-5.2** — If no tagged match exists in the seed dataset, the UI shows a graceful "no pairing found yet" message rather than an error or blank state.

**Acceptance criteria:** Every category/color combination present in the seed dataset returns at least one suggestion. Unmatched combinations degrade gracefully with no broken UI.

### FR-6: Wardrobe Log

- **FR-6.1** — User can save a scanned item (photo, detected attributes, verdict) to a personal wardrobe log.
- **FR-6.2** — User can view saved items in a list, most recent first.
- **FR-6.3** — User can delete a saved item.
- **FR-6.4** — User can filter the wardrobe list by verdict (All / Buy / Maybe / Skip).
- **FR-6.5** — User can mark or unmark a saved item as a favorite, and can filter the list to show only favorited items. Favoriting is independent of the verdict filter — both can be applied at once (e.g., favorited items that are also a "Buy").

**Acceptance criteria:** Saved items persist across sessions, render correctly with their stored photo and verdict, and deletion is immediate and permanent. Verdict filter and favorites filter can be combined; favorite status persists across sessions the same as any other saved field.

---

## 7. Non-Functional Requirements

- **Performance:** Scan-to-verdict round trip should complete within a few seconds under normal conditions. The hosted CLIP inference API is an external dependency and the primary latency risk — validate this early, before building downstream features on top of it.
- **Reliability:** No formal uptime SLA required, but the app must never hard-crash on inference API failure — always degrade to the manual-classification fallback (FR-3.4).
- **Security & privacy:** User photos are stored in a strictly private R2 bucket — no public bucket access, no custom domain serving files directly. The backend is the only party with storage credentials; it generates short-lived, time-bound pre-signed URLs (via `boto3`) on demand whenever a photo needs to be displayed to its owner. No permanent public URL for a photo exists anywhere in the system. See `docs/DATABASE.md` and `docs/API_ROUTES.md` for the exact object-key convention and presigned-URL response shape. Authentication and credential handling are delegated to a managed provider (Clerk) rather than hand-rolled. No payment or sensitive personal data is collected.
- **Data retention:** User-initiated deletion (FR-6.3) is sufficient; no additional retention policy required at this stage.
- **Browser/device compatibility:** Must work reliably on modern mobile browsers (iOS Safari, Android Chrome) specifically, since the core use case is scanning items on a phone while shopping in person.
- **Cost:** Entire stack (hosting, database, storage, inference API) should stay within free or low-cost tiers appropriate for low, unpredictable traffic.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Hosted CLIP inference API adds latency and is an external dependency outside direct control | Timeout + manual fallback (FR-3.4); validate real-world latency early before building downstream features on top of it |
| Zero-shot classification accuracy on real photos (variable lighting, backgrounds, phone cameras) is unproven until tested | Test against real sample photos early; manual correction (FR-3.5) and fallback (FR-3.4) absorb low-confidence or incorrect cases rather than blocking the flow |
| Fixed pairing dataset limits suggestion diversity | Acceptable for v1; explicitly tracked as future work rather than hidden as a limitation |
| Single point of maintenance / limited engineering bandwidth | Scope intentionally kept minimal (no embeddings, fine-tuning, or retrieval logic) to keep the system maintainable by a single contributor |

---

## 9. Development Phases

1. **Foundation** — repository setup, deployment pipeline, and validation of the CV inference integration (latency, accuracy, and cost on real sample images) before further development.
2. **Authentication** — account creation and session handling via the managed auth provider.
3. **Preferences onboarding** — style preferences questionnaire and profile storage.
4. **Item scan pipeline** — image capture/upload and CLIP-based classification integration, including the manual correction flow (FR-3.5).
5. **Verdict engine** — rule-based comparison logic and rationale generation.
6. **Pairing suggestions** — curated seed dataset and tag-based lookup.
7. **Wardrobe log** — save, view, and delete scanned items.
8. **UI polish** — responsive design pass, PWA installability, loading and error states.
9. **Deployment & documentation** — finalized hosting, testing pass, and project documentation.

---

## 10. Future Work

- Replace the preference questionnaire with swipe-based onboarding that builds a learned style embedding.
- Replace rule-based verdicts with embedding-based similarity scoring between item and user profile (would introduce a vector store, e.g., via the `pgvector` Postgres extension).
- Replace zero-shot classification with a fine-tuned classifier (e.g., trained on DeepFashion2 or Fashionpedia) to support pattern and formality detection.
- Replace the fixed pairing dataset with retrieval-based suggestions using similarity search over a larger outfit dataset.
- Expand wardrobe features toward full closet management and outfit visualization.
- Add social features (sharing, following other users' style profiles).
- Native mobile app.
- Cleaned-up item photos in the wardrobe log — background removal and lighting normalization on the user's actual uploaded photo (not full AI-generated recreation, which risks misrepresenting the real item's color/texture/details in a tool whose whole purpose is accuracy). Would sit as an optional post-processing step after upload, separate from the CLIP classification call.
