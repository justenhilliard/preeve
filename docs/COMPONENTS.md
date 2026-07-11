# Preeve — Component & Layer Naming Reference

Consolidated list of every layer name discussed for each wireframe screen. Use this while renaming Figma layers from their defaults (`Rectangle 1`, `Ellipse 2`, etc.). Naming convention throughout: `Category/SpecificName`.

Screen order matches the actual flow (10 screens total — `07-Pairing-Suggestion` was merged into `06-Verdict-Result` since the API returns both together).

---

## 00-Landing

- `Nav/Logo`
- `Nav/SignIn`
- `Hero/Headline` — "Preeve it before you buy it."
- `Hero/Subheadline` — "Snap a pic, get the verdict, skip the regret."
- `Input/Email`
- `Button/Primary-CTA` — "Preeve it" (clipped top-right corner as the signature detail)
- `Section/HowItWorks` — 3-step walkthrough (Scan → Verdict → Pairing), ideally with a small screenshot per step once you have real UI to show
- `Section/FAQ` — 6 items (What is Preeve? / Is my photo data private? / What if the verdict seems wrong? / Does Preeve work with any clothing item? / Is Preeve free? / What do I need to use it?)
- `Section/CTABanner` — repeated email + button, bookending the page before the footer
- `Footer/Logo`
- `Footer/Tagline`
- `Footer/Links` — GitHub, Contact
- `Footer/Copyright`

## 01a-SignUp

- `Nav/Back`
- `Header/Logo`
- `Header/Title` — "Create your account"
- `Input/Email` (pre-filled from landing, editable)
- `Input/Password`
- `Button/Primary-CreateAccount`
- `Button/ContinueWithGoogle`
- `Toggle/AlreadyHaveAccount` → links to `01b-LogIn`

## 01b-LogIn

- `Nav/Back`
- `Header/Logo`
- `Header/Title` — "Log in to your account"
- `Input/Email` (empty, required)
- `Input/Password` (empty, required)
- `Button/Primary-LogIn`
- `Button/ContinueWithGoogle`
- `Toggle/DontHaveAccount` → links to `01a-SignUp`

## 02a-Preferences-Colors

- `Nav/Back`
- `ProgressBar` (step 1 of 3)
- `Header/Title` — "What colors do you love wearing?"
- `Header/Subtitle`
- `Grid/ColorSwatches` — all 17: black, white, gray, navy, blue, red, green, olive, brown, tan, beige, pink, purple, yellow, orange, burgundy, multicolor
- `Button/Primary-Continue`

## 02b-Preferences-Fit

- `Nav/Back`
- `ProgressBar` (step 2 of 3)
- `Header/Title` — "What fits feel like you?"
- `Grid/FitOptions` — all 8: baggy, oversized, relaxed, cropped, fitted, slim, tailored, straight
- `Button/Primary-Continue`

## 02c-Preferences-Formality

- `Nav/Back`
- `ProgressBar` (step 3 of 3)
- `Header/Title` — "What's your everyday vibe?"
- `Cards/FormalityOptions` — all 5: athleisure, casual, smart casual, business casual, formal (single-select)
- `Button/Primary-Finish` — "See my style profile"

## 03-Home-Scan

- `Nav/TopBar` — Home (active) / Wardrobe / Preferences / Settings
- `Nav/Greeting`
- `Card/EmptyState` (first-time user) — build both this and the one below as variants
- `Card/RecentActivity` (returning user) — last scanned item thumbnail, category/color, verdict, "View your wardrobe" link
- `Button/Primary-ScanItem`

## 04-Capture-Upload

- `Nav/Back`
- `Viewfinder/Camera`
- `Text/Helper` — "Center the item in frame"
- `Button/Capture`
- `Button/UploadInstead` — "Choose from library"

## 05-Processing-State

- `Image/CapturedPhoto`
- `Spinner/Loading`
- `Text/Status` — "Analyzing your item..."

## 06-Verdict-Result

Includes the pairing suggestion — no separate page.

- `Nav/Back`
- `Image/ScannedItem`
- `Badge/Verdict` — Buy / Maybe / Skip
- `Text/Rationale`
- `Button/ThisLooksWrong` (FR-3.5 — always available, not just on failure)
- `Card/PairingSuggestion` — 1 or 2 instances (FR-5.1), each with `Text/SuggestionText` + optional `Image/Suggestion`
- `Button/Primary-SaveToWardrobe`
- `Button/Discard`

**Not yet designed:** the FR-3.4 manual-fallback variant of this screen, for when classification fails outright and category/color must be picked manually before any verdict can compute. Worth building before this screen is considered done.

## 08-Wardrobe-List

- `Nav/TopBar` — Wardrobe active
- `Header/Title` — "Your Wardrobe"
- `Toggle/FavoritesOnly`
- `Chips/VerdictFilter` — All / Buy / Maybe / Skip (mutually exclusive, combinable with the favorites toggle)
- `Grid/WardrobeItems`, each card containing:
  - `Image/ItemPhoto`
  - `Tag/CategoryColor` (hang-tag shaped)
  - `Icon/FavoriteHeart`

## 09-Wardrobe-Item-Detail

- `Nav/Back`
- `Icon/FavoriteHeart`
- `Image/ItemPhoto`
- `Text/CategoryColor`
- `Badge/Verdict`
- `Text/Rationale`
- `Text/DateScanned`
- `Button/Delete`

## 10-Settings

- `Nav/TopBar` — Settings active
- `Header/Title`
- `Text/AccountLabel`
- `Text/Email` (read-only)
- `Button/LogOut`
- `Text/DangerZoneLabel`
- `Button/DeleteAccount`

## Preferences edit (no separate screen)

Reuses `02a`/`02b`/`02c` pre-filled with saved answers, reached from the `Preferences` nav tab. No new layer names needed.

---

## Reusable components worth building once, not per-screen

These repeat across multiple screens — build them as real Figma components with instances, not copy-pasted shapes, so a later change only has to happen once:

- `Nav/TopBar` (03, 08, 09 via back-nav context, 10)
- `Badge/Verdict` (06, 09)
- `Icon/FavoriteHeart` (08, 09)
- `Button/ContinueWithGoogle` (01a, 01b)
- `ProgressBar` (02a, 02b, 02c)
