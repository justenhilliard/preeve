# Preeve — Design System

**Status:** v1.1 — Locked visual direction: elegant / editorial, warm-neutral palette (revised from v1.0 — the original palette leaned rose/blush, which read as feminine-coded against a target audience that isn't gender-specific per `docs/prd.md` Section 3. Swapped the two pink-leaning tones for warm neutrals; everything else — typography, shape language, badge logic — is unchanged).

---

## Color

### Base palette

| Token | Hex | Role |
|---|---|---|
| `color-cream` | `#FAF9F8` | Page background |
| `color-stone` | `#D8D3CC` | Secondary surface (cards, subtle fills) |
| `color-clay` | `#B8674A` | Primary accent — CTAs, active states, selected chips |
| `color-charcoal` | `#4A413C` | Secondary text, borders, icons |
| `color-espresso` | `#3E2E29` | Primary text, headings |

### Semantic additions (verdict badges only)

The base palette is deliberately tonal and has no green/amber/red — adding loud, saturated semantic colors would break the palette's cohesion. Instead, two new colors join the family at the same desaturation level, and Skip reuses an existing color rather than adding a third:

| Token | Hex | Role |
|---|---|---|
| `color-sage` | `#8A9A7B` | Buy verdict badge |
| `color-ochre` | `#C9A66B` | Maybe verdict badge |
| `color-espresso` | `#3E2E29` (reused) | Skip verdict badge — dark reads as "stop" without a new hue |

Badge text on any of these three uses `color-cream` (light text on the saturated fill), matching the existing light-on-dark contrast pattern already in the palette.

### Usage rules

- Backgrounds: `color-cream` for the page, `color-stone` for cards/elevated surfaces sitting on top of it.
- Primary text: `color-espresso`. Secondary/muted text: `color-charcoal`.
- Interactive elements (buttons, links, selected states, the active nav tab underline): `color-clay`.
- Never place `color-clay` text directly on `color-stone` — both are light-to-mid tones and the contrast is too low. Clay is for fills/accents, not body text on light surfaces.

---

## Typography

Three fonts, each with one clear job — not interchangeable:

| Font | Role |
|---|---|
| **Cormorant Garamond** | Logo/wordmark only, and large display headlines (landing page hero, section titles). Never body text or UI chrome — it's a display serif, not built for small sizes or dense reading. |
| **Inter** | All UI chrome — buttons, nav labels, form inputs, badges, tags, filter chips. Anywhere the text is functional rather than expressive. |
| **Lato** | Body copy and longer-form text — rationale sentences, FAQ answers, pairing suggestion text, helper text. Warmer and more readable than Inter at paragraph length. |

Rule of thumb: if it's a headline or the logo, Cormorant Garamond. If it's something you click, Inter. If it's something you read in a sentence or two, Lato.

---

## Shape & Spacing

Reversing the earlier sharp/clipped-corner direction — that belonged to the streetwear exploration and fights this palette.

- **Corner radius:** soft and rounded throughout. Buttons and inputs `12px`, cards `16px`, badges/pills fully rounded (`9999px`). No clipped corners, no sharp edges anywhere.
- **Borders:** thin (`1px`), `color-charcoal` at low opacity rather than heavy strokes — let color and spacing do the work, not bold outlines.
- **Whitespace:** generous. Editorial/boutique aesthetics read as premium partly through restraint — don't crowd elements. Prefer more padding over more content density.
- **Imagery:** warm, soft-lit photography (coffee/vintage-clothing-rack style references — drop any floral/rose imagery from the moodboard going forward, it's the other half of the gendered signal the palette just moved away from) — avoid harsh flash-lit or clinical product photos when real item photos start populating the wardrobe log; this is a note for future photography choices, not something enforceable in code.

---

## Verdict Badge Reference

Since this is the one place color carries real functional meaning, spelling it out explicitly:

| Verdict | Fill | Text |
|---|---|---|
| Buy | `color-sage` (`#8A9A7B`) | `color-cream` |
| Maybe | `color-ochre` (`#C9A66B`) | `color-cream` |
| Skip | `color-espresso` (`#3E2E29`) | `color-cream` |

---

## Open Question

The "Preeve it" CTA copy and playful tone from the earlier streetwear exploration wasn't necessarily tied to that direction specifically — it can likely stay as-is, just rendered in this softer visual language (rounded button, Inter label, clay fill) rather than the sharp/clipped treatment. Worth a gut check once it's actually styled: does "Preeve it" still feel right against this elegant palette, or does the copy tone want to soften too (e.g., "Begin your preeve")? Not urgent — decide once you can see it rendered.
