# Preeve — CLIP Validation Spike

**Status:** Draft findings for review, not a final model decision  
**Date run:** 2026-07-11  
**Script:** `backend/scripts/clip_validation_spike.py`  
**Samples:** 15 local images from `backend/scripts/sample_images/`

## Methodology

The spike used Replicate's official [`openai/clip`](https://replicate.com/openai/clip)
model through Replicate's HTTP predictions API. I chose this model because it is an
official Replicate model, uses OpenAI CLIP ViT-L/14 embeddings, is versionless for
API calls, has high public usage, and has transparent runtime pricing. I considered
`zsxkib/jina-clip-v2`, but did not use it for this spike because its license is
CC-BY-NC-4.0 and it runs on T4 hardware; for this validation pass, official CLIP
was the safer baseline for a production-oriented app path.

The model returns embeddings, not direct labels, so the script implements standard
zero-shot classification:

1. Embed each candidate category prompt and color prompt.
2. Embed each sample image.
3. Compute cosine similarity between the image embedding and each prompt embedding.
4. Pick the highest-scoring category and color independently.

Category labels match FR-3.2: `top`, `bottom`, `dress`, `outerwear`, `shoes`,
`accessory`.

Color labels match FR-2.1 / FR-3.2: `black`, `white`, `gray`, `navy`, `blue`,
`red`, `green`, `olive`, `brown`, `tan`, `beige`, `pink`, `purple`, `yellow`,
`orange`, `burgundy`, `multicolor`.

The script reads `REPLICATE_API_TOKEN` from `backend/.env`, reads images directly
from `backend/scripts/sample_images/`, and is not imported by FastAPI or the
frontend.

## Results

| Image | Eyeball category/color | Predicted category | Category similarity | Predicted color | Color similarity | Latency ms | Notes |
|---|---|---|---:|---|---:|---:|---|
| `bracelets1.jpeg` | accessory, tan/gold/pink | accessory | 0.1887 | tan | 0.2172 | 1087 | Category right; color acceptable for jewelry/tan tones. |
| `hat1.jpeg` | accessory, yellow | accessory | 0.2247 | yellow | 0.2626 | 941 | Correct. |
| `jacket1.jpeg` | outerwear, tan/brown | dress | 0.2267 | brown | 0.2546 | 890 | Color reasonable; category wrong. |
| `jeans1.jpeg` | bottom, blue | bottom | 0.2807 | blue | 0.2267 | 988 | Correct. |
| `jorts1.jpeg` | bottom, blue/navy | bottom | 0.2698 | tan | 0.2144 | 1115 | Category right; color wrong. |
| `longskirt1.jpeg` | bottom, navy | bottom | 0.2549 | navy | 0.2214 | 955 | Correct. |
| `polo1.jpeg` | top, navy/blue | top | 0.2751 | blue | 0.2577 | 748 | Correct. |
| `shoes1.jpeg` | shoes, green/olive | shoes | 0.2215 | green | 0.2375 | 1163 | Correct. |
| `shoes2.jpeg` | shoes, black/brown | shoes | 0.2544 | olive | 0.2340 | 919 | Category right; color wrong or weak. |
| `shoes3.jpeg` | shoes, white/gray | shoes | 0.2186 | beige | 0.2088 | 923 | Category right; color close but not ideal. |
| `stripedsweater1.jpeg` | top, brown/gray/multicolor | top | 0.2376 | brown | 0.2684 | 1312 | Category right; color acceptable. |
| `stripedsweater2.jpeg` | top/outerwear, red/white | dress | 0.2353 | red | 0.2798 | 793 | Color right; category wrong. |
| `sunglasses1.jpeg` | accessory, black/brown | accessory | 0.2001 | white | 0.1522 | 1063 | Category right; color wrong, likely distracted by sky/background. |
| `tank1.jpeg` | top, white/beige | dress | 0.2465 | beige | 0.2654 | 901 | Color acceptable; category wrong. |
| `tshirt1.jpeg` | top, blue | dress | 0.2267 | blue | 0.2426 | 821 | Color right; category wrong. |

## Observations

- Latency is good for the image embedding call: 748-1312 ms per sample, with a mean
  of roughly 975 ms. That fits the PRD's "few seconds" scan-to-verdict target if
  label embeddings are precomputed or cached server-side.
- Category accuracy by eyeball was roughly 11/15. The model handled bottoms, shoes,
  accessories, and one sweater well, but confused several tops/outerwear items with
  `dress`.
- Color accuracy by eyeball was roughly 10/15 if near-neutrals are treated
  generously. Clear colors like yellow, blue, green, navy, brown, and red worked
  better than black/white/gray/tan cases with strong backgrounds or skin tones.
- Similarity scores are low and often close together. A production handler should
  not treat the top label as high confidence without a margin/threshold check.
- Backgrounds clearly matter. `sunglasses1.jpeg` predicted `white`, likely because
  the frame contains large bright sky/background regions. `jorts1.jpeg` predicted
  `tan`, likely influenced by skin/background/tan stitching.
- The prompt wording matters. The current category prompts helped `bottom` and
  `shoes`, but `dress` appears over-attractive for multiple garment photos.

## Cost

The completed cached run recorded 38 successful Replicate predictions: 23 label
embeddings and 15 image embeddings. Recorded billed runtime was `0.5786356926`
seconds. At the model page's listed rate of `$0.975` per thousand seconds, that is
about `$0.000564`.

There was also one explicit pre-script text-embedding probe (`0.0073046684` billed
seconds, about `$0.000007`) and an interrupted pre-cache run that completed at
least the six category-label embeddings before hitting a rate limit. Based on the
recorded category-label average, the known duplicate category-label cost is about
`$0.000030`; if any color embeddings also completed before the interruption, the
unrecorded additional amount should still be well under `$0.0001`.

Practical cost flag for this spike: approximately `$0.0006-$0.0007`, i.e. below
one tenth of one cent. The exact account-side total could not be reconciled from
Replicate's prediction list endpoint because that endpoint returned HTTP 403 for
this token.

## Draft Recommendation For Review

Recommendation for the review pass: keep Replicate-hosted CLIP viable for the
MVP latency target, but do not wire `openai/clip` into production as-is without a
confidence/margin fallback and prompt/taxonomy tuning. The latency is promising;
the category accuracy is not strong enough to remove manual correction or
low-confidence fallback behavior. Next review should decide whether to tune prompts
for `top` vs. `dress`/`outerwear`, test a direct image-classification or stronger
vision-language model, or accept CLIP with conservative fallback thresholds for v1.
