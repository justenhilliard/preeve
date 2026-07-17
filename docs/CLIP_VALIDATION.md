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

- `bracelets1.jpeg`: eyeball accessory, tan/gold/pink. Predicted accessory
  (`0.1887`) and tan (`0.2172`) in 1087 ms. Category right; color acceptable
  for jewelry/tan tones.
- `hat1.jpeg`: eyeball accessory, yellow. Predicted accessory (`0.2247`) and
  yellow (`0.2626`) in 941 ms. Correct.
- `jacket1.jpeg`: eyeball outerwear, tan/brown. Predicted dress (`0.2267`) and
  brown (`0.2546`) in 890 ms. Color reasonable; category wrong.
- `jeans1.jpeg`: eyeball bottom, blue. Predicted bottom (`0.2807`) and blue
  (`0.2267`) in 988 ms. Correct.
- `jorts1.jpeg`: eyeball bottom, blue/navy. Predicted bottom (`0.2698`) and tan
  (`0.2144`) in 1115 ms. Category right; color wrong.
- `longskirt1.jpeg`: eyeball bottom, navy. Predicted bottom (`0.2549`) and navy
  (`0.2214`) in 955 ms. Correct.
- `polo1.jpeg`: eyeball top, navy/blue. Predicted top (`0.2751`) and blue
  (`0.2577`) in 748 ms. Correct.
- `shoes1.jpeg`: eyeball shoes, green/olive. Predicted shoes (`0.2215`) and
  green (`0.2375`) in 1163 ms. Correct.
- `shoes2.jpeg`: eyeball shoes, black/brown. Predicted shoes (`0.2544`) and
  olive (`0.2340`) in 919 ms. Category right; color wrong or weak.
- `shoes3.jpeg`: eyeball shoes, white/gray. Predicted shoes (`0.2186`) and
  beige (`0.2088`) in 923 ms. Category right; color close but not ideal.
- `stripedsweater1.jpeg`: eyeball top, brown/gray/multicolor. Predicted top
  (`0.2376`) and brown (`0.2684`) in 1312 ms. Category right; color acceptable.
- `stripedsweater2.jpeg`: eyeball top/outerwear, red/white. Predicted dress
  (`0.2353`) and red (`0.2798`) in 793 ms. Color right; category wrong.
- `sunglasses1.jpeg`: eyeball accessory, black/brown. Predicted accessory
  (`0.2001`) and white (`0.1522`) in 1063 ms. Category right; color wrong,
  likely distracted by sky/background.
- `tank1.jpeg`: eyeball top, white/beige. Predicted dress (`0.2465`) and beige
  (`0.2654`) in 901 ms. Color acceptable; category wrong.
- `tshirt1.jpeg`: eyeball top, blue. Predicted dress (`0.2267`) and blue
  (`0.2426`) in 821 ms. Color right; category wrong.

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

## Addendum — Background Removal Preprocessing (2026-07-17)

Background removal was added before CLIP classification to address the documented
skin/background color-confusion failure modes above, especially `jorts1.jpeg`
predicting `tan` for blue/navy denim and `sunglasses1.jpeg` being distracted by
bright sky/background regions. The implementation uses hosted Replicate model
`cjwbw/rembg`, then composites the segmented subject onto a white JPEG so CLIP and
the structured vision extractor still receive normal photo bytes rather than a
transparent PNG.

This is an input preprocessing change only: the CLIP category/color taxonomies,
prompts, confidence gates, and verdict engine remain unchanged. The user-visible
stored wardrobe photo also remains the original compressed upload, not the
background-stripped cutout.

Informal verification against sample images produced changed background-removed
JPEGs for `jorts1.jpeg` in 4.15s, `jeans1.jpeg` in 11.99s, and
`sunglasses1.jpeg` in 10.35s. The sunglasses image still retains the hands
holding the glasses, so this reduces scene/background noise but does not isolate
only the product in every real-world photo.

## Addendum — Wrong-Subject Vision Extraction (2026-07-17)

Real-world testing found a stronger version of the same multi-object ambiguity:
a scan intended to show sunglasses was described by the structured vision pass as
a white/gold bracelet because jewelry was visible on the hand holding the item.
The prompt now instructs the vision model to describe one primary subject item,
preferring the largest, most centered, most in-focus, or deliberately posed
wearable object, and to treat incidental worn jewelry/clothing as background
context. This is only a prompt refinement; without object detection or a human
review step, genuinely ambiguous photos can still select the wrong subject.
