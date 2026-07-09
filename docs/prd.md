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

**In scope for v1:** account creation, style preferences questionnaire, item scan (camera or upload), zero-shot category/color classification, user-correctable classification results, rule-based verdict with rationale, fixed-seed-set pairing suggestion, wardrobe log (save/view/delete).

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

- **FR-2.1** — On first login, user is prompted to complete a short questionnaire: preferred colors (multi-select from a fixed palette), preferred fit/silhouette (multi-select), formality range (single select or slider, e.g., Casual → Business Casual → Formal).
- **FR-2.2** — Preferences are saved to the user's profile record.
- **FR-2.3** — User can revisit and edit preferences at any time from a dedicated screen.

**Acceptance criteria:** Questionnaire completes in under a minute. Preferences persist and are reflected correctly the next time a verdict is generated.

### FR-3: Item Scan & Attribute Detection

- **FR-3.1** — User can capture a photo via device camera (mobile browser) or upload an existing image file.
- **FR-3.2** — Backend sends the image to a hosted CLIP inference endpoint and performs zero-shot classification against a fixed label set for category (e.g., top, bottom, dress, outerwear, shoes, accessory) and a fixed palette for dominant color. The exact label taxonomy is finalized during implementation based on classification performance against real sample images, not fixed at the spec stage.
- **FR-3.3** — UI shows a processing/loading state while classification runs.
- **FR-3.4** — If classification fails (API error, timeout, or low-confidence result), the user is shown a fallback UI to manually select category and color rather than a dead end.
- **FR-3.5** — Independent of failure, the result screen always includes a "This looks wrong" action, letting the user manually override the detected category and/or color even when classification succeeded. The corrected values are used downstream by the verdict engine in place of the original model output.

**Acceptance criteria:** A typical photo returns a classification within a few seconds under normal network conditions. A simulated API failure correctly triggers the manual fallback instead of an unhandled error. Triggering "This looks wrong" on a successful classification lets the user submit corrected values, and the resulting verdict reflects the correction, not the original output.

### FR-4: Verdict Engine

- **FR-4.1** — System compares the detected (or user-corrected) category/color against the user's saved preferences using deterministic rules.
- **FR-4.2** — System returns exactly one of: Buy, Maybe, Skip.
- **FR-4.3** — System generates a short, template-based rationale that references the specific preference matched or violated (e.g., "Navy is in your preferred palette, and blazers fit your formality range").

**Acceptance criteria:** Given a fixed preference profile and a fixed set of item attributes, the verdict and rationale are deterministic and reproducible — same inputs always produce the same output.

### FR-5: Pairing Suggestions

- **FR-5.1** — System looks up 1–2 pairing suggestions from a hand-curated seed dataset (~30–50 entries), matched by category/color tags against the scanned item.
- **FR-5.2** — If no tagged match exists in the seed dataset, the UI shows a graceful "no pairing found yet" message rather than an error or blank state.

**Acceptance criteria:** Every category/color combination present in the seed dataset returns at least one suggestion. Unmatched combinations degrade gracefully with no broken UI.

### FR-6: Wardrobe Log

- **FR-6.1** — User can save a scanned item (photo, detected attributes, verdict) to a personal wardrobe log.
- **FR-6.2** — User can view saved items in a list, most recent first.
- **FR-6.3** — User can delete a saved item.

**Acceptance criteria:** Saved items persist across sessions, render correctly with their stored photo and verdict, and deletion is immediate and permanent.

---

## 7. Non-Functional Requirements

- **Performance:** Scan-to-verdict round trip should complete within a few seconds under normal conditions. The hosted CLIP inference API is an external dependency and the primary latency risk — validate this early, before building downstream features on top of it.
- **Reliability:** No formal uptime SLA required, but the app must never hard-crash on inference API failure — always degrade to the manual-classification fallback (FR-3.4).
- **Security & privacy:** User photos are private by default (not publicly listable in storage). Authentication and credential handling are delegated to a managed provider rather than hand-rolled. No payment or sensitive personal data is collected.
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
