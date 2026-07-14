from __future__ import annotations

import base64
import hashlib
import json
import math
import os
import time
from dataclasses import dataclass
from threading import Lock
from urllib import error, request

from auth import ApiError
from models import CATEGORY_VALUES, COLOR_VALUES
from object_storage import download_json_object, upload_json_object

REPLICATE_MODEL = "openai/clip"
REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions"
MAX_REPLICATE_ATTEMPTS = 2
REPLICATE_WAIT_SECONDS = 60
REQUEST_TIMEOUT_SECONDS = 90
RETRY_PAUSE_SECONDS = 2.0


# These prompts intentionally match backend/scripts/clip_validation_spike.py
# verbatim, EXCEPT `dress`, tuned deliberately below. The confidence/margin
# thresholds were derived from the spike's observed score distribution —
# reworded prompts shift similarity scores, which would silently invalidate
# the calibration if changed casually. `dress` is the one documented
# exception: real usage reproduced the spike's own flagged failure mode
# (tank1.jpeg, a sleeveless top, scored dress=0.2468 vs. top=0.2276, a narrow
# 0.0193 margin). Making the prompt explicitly contrastive against separates
# only nudged this to dress=0.2444 (margin 0.0169) — still wrong. This is a
# real representational overlap between sleeveless tops and dresses in
# CLIP's embedding space, not something prompt wording alone reliably fixes.
# Accepted as a known v1 limitation — the manual correction screen exists
# for exactly this case. Don't sink further time into prompt-tuning this;
# a fine-tuned classifier (PRD Future Work) is the real fix if it matters
# enough later.
#
# `tan` vs. `blue` on denim was tried too, and reverted for the same reason:
# a real scan (light-wash blue denim shorts) scored tan=0.2170 vs.
# blue=0.2149, a 0.0021 margin — within the same noise band where blue is
# correctly top on other denim (jeans1.jpeg: blue margin ~0.002-0.04) and a
# polo (polo1.jpeg: blue margin 0.0015-0.0004 depending on prompt wording).
# Narrowing `blue` toward denim fixed the failing case but dropped polo1's
# blue score from 1st to 9th place (0.2597 -> 0.2292), a clear regression.
# Narrowing `tan` alone (excluding "blue denim") flipped the failing case
# back correctly but then flipped jeans1 — previously reliably blue —
# to tan instead (tan=0.2428 vs. blue=0.2270). Each version traded one
# wrong case for another rather than net-improving. Same conclusion as
# `dress`: real embedding-space overlap, not a wording problem.
CATEGORY_PROMPTS = {
    "top": "a photo of a top clothing item, shirt, sweater, tank, or polo",
    "bottom": "a photo of a bottom clothing item, jeans, shorts, skirt, or pants",
    "dress": (
        "a photo of a one-piece dress that covers the torso and legs in a "
        "single garment, not a separate top, tank, or camisole"
    ),
    "outerwear": "a photo of outerwear, jacket, coat, blazer, or hoodie",
    "shoes": "a photo of shoes, sneakers, boots, loafers, or sandals",
    "accessory": "a photo of a fashion accessory, hat, jewelry, bag, or sunglasses",
}
COLOR_PROMPTS = {
    "black": "a photo of a black clothing item",
    "white": "a photo of a white clothing item",
    "gray": "a photo of a gray clothing item",
    "navy": "a photo of a navy blue clothing item",
    "blue": "a photo of a blue clothing item",
    "red": "a photo of a red clothing item",
    "green": "a photo of a green clothing item",
    "olive": "a photo of an olive green clothing item",
    "brown": "a photo of a brown clothing item",
    "tan": "a photo of a tan clothing item",
    "beige": "a photo of a beige clothing item",
    "pink": "a photo of a pink clothing item",
    "purple": "a photo of a purple clothing item",
    "yellow": "a photo of a yellow clothing item",
    "orange": "a photo of an orange clothing item",
    "burgundy": "a photo of a burgundy clothing item",
    "multicolor": "a photo of a multicolor patterned clothing item",
}

# The spike showed useful top similarities clustered near 0.20-0.28 and
# frequent close runners-up, especially where `dress` over-triggered and
# backgrounds distorted color. These conservative first-pass gates prefer
# manual fallback over storing a confident-looking wrong label.
CATEGORY_MIN_SIMILARITY = 0.21
COLOR_MIN_SIMILARITY = 0.20
MIN_RUNNER_UP_MARGIN = 0.012

_label_embeddings: dict[str, dict[str, list[float]]] | None = None
_label_embeddings_lock = Lock()


@dataclass(frozen=True)
class RankedLabel:
    label: str
    margin: float
    runner_up_score: float
    score: float


@dataclass(frozen=True)
class ClassificationResult:
    detected_category: str | None
    detected_color: str | None
    classification_failed: bool


class InferenceUnavailableError(Exception):
    pass


def get_replicate_token() -> str:
    """Read the server-side Replicate token."""
    token = os.getenv("REPLICATE_API_TOKEN")
    if not token:
        raise InferenceUnavailableError("REPLICATE_API_TOKEN is not configured.")

    return token


def make_image_data_url(image_bytes: bytes) -> str:
    """Encode a compressed JPEG as a data URL for Replicate."""
    encoded_image = base64.b64encode(image_bytes).decode("ascii")
    return f"data:image/jpeg;base64,{encoded_image}"


def cosine_similarity(left: list[float], right: list[float]) -> float:
    """Compute cosine similarity between two embedding vectors."""
    numerator = sum(
        left_value * right_value
        for left_value, right_value in zip(left, right, strict=False)
    )
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0

    return numerator / (left_norm * right_norm)


def create_replicate_prediction(token: str, input_payload: dict[str, str]) -> list[float]:
    """Call Replicate's CLIP endpoint and return an embedding vector."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": f"wait={REPLICATE_WAIT_SECONDS}",
    }
    body = json.dumps(
        {"version": REPLICATE_MODEL, "input": input_payload},
    ).encode("utf-8")

    for attempt in range(1, MAX_REPLICATE_ATTEMPTS + 1):
        try:
            prediction_request = request.Request(
                REPLICATE_PREDICTIONS_URL,
                data=body,
                headers=headers,
                method="POST",
            )
            with request.urlopen(
                prediction_request,
                timeout=REQUEST_TIMEOUT_SECONDS,
            ) as response:
                prediction = json.load(response)

            if prediction.get("status") != "succeeded":
                raise InferenceUnavailableError(
                    f"Replicate prediction did not succeed: {prediction.get('status')}"
                )

            output = prediction.get("output") or {}
            embedding = output.get("embedding")
            if not isinstance(embedding, list):
                raise InferenceUnavailableError(
                    "Replicate response did not include an embedding list."
                )

            return [float(value) for value in embedding]
        except error.HTTPError as exc:
            if exc.code == 429 and attempt < MAX_REPLICATE_ATTEMPTS:
                retry_after = exc.headers.get("Retry-After")
                sleep_seconds = (
                    float(retry_after)
                    if retry_after and retry_after.isdigit()
                    else RETRY_PAUSE_SECONDS
                )
                time.sleep(sleep_seconds)
                continue

            raise InferenceUnavailableError(
                f"Replicate HTTP error: {exc.code}"
            ) from exc
        except error.URLError as exc:
            if attempt < MAX_REPLICATE_ATTEMPTS:
                time.sleep(RETRY_PAUSE_SECONDS)
                continue

            raise InferenceUnavailableError("Replicate network error.") from exc

    raise InferenceUnavailableError("Replicate prediction failed after retry.")


def embed_labels(token: str, prompts: dict[str, str]) -> dict[str, list[float]]:
    """Generate embeddings for a prompt set."""
    return {
        label: create_replicate_prediction(token, {"text": prompts[label]})
        for label in prompts
    }


def get_label_embedding_cache_key() -> str:
    """Derive the persistent label embedding cache key from prompt content."""
    prompt_payload = {
        "category": CATEGORY_PROMPTS,
        "color": COLOR_PROMPTS,
    }
    serialized_prompts = json.dumps(
        prompt_payload,
        sort_keys=True,
        separators=(",", ":"),
    )
    prompt_hash = hashlib.sha256(serialized_prompts.encode("utf-8")).hexdigest()[:16]
    return f"system/clip-label-embeddings-{prompt_hash}.json"


def normalize_cached_embedding_group(
    payload: object,
    expected_labels: tuple[str, ...],
) -> dict[str, list[float]] | None:
    """Validate and normalize one cached embedding group."""
    if not isinstance(payload, dict):
        return None

    normalized_group: dict[str, list[float]] = {}
    for label in expected_labels:
        embedding = payload.get(label)
        if not isinstance(embedding, list):
            return None

        try:
            normalized_group[label] = [float(value) for value in embedding]
        except (TypeError, ValueError):
            return None

    return normalized_group


def normalize_cached_label_embeddings(
    payload: dict[str, object] | None,
) -> dict[str, dict[str, list[float]]] | None:
    """Validate and normalize the persisted label embedding cache payload."""
    if payload is None:
        return None

    category_embeddings = normalize_cached_embedding_group(
        payload.get("category"),
        CATEGORY_VALUES,
    )
    color_embeddings = normalize_cached_embedding_group(
        payload.get("color"),
        COLOR_VALUES,
    )
    if category_embeddings is None or color_embeddings is None:
        return None

    return {
        "category": category_embeddings,
        "color": color_embeddings,
    }


def download_cached_label_embeddings() -> dict[str, dict[str, list[float]]] | None:
    """Read label embeddings from R2, treating storage errors as cache misses."""
    try:
        cached_payload = download_json_object(get_label_embedding_cache_key())
    except ApiError:
        return None

    return normalize_cached_label_embeddings(cached_payload)


def upload_cached_label_embeddings(
    label_embeddings: dict[str, dict[str, list[float]]],
) -> None:
    """Persist label embeddings to R2 without blocking classification on failure."""
    try:
        upload_json_object(get_label_embedding_cache_key(), label_embeddings)
    except ApiError:
        return


def get_label_embeddings() -> dict[str, dict[str, list[float]]]:
    """Return cached category and color label embeddings."""
    global _label_embeddings

    if _label_embeddings is not None:
        return _label_embeddings

    with _label_embeddings_lock:
        if _label_embeddings is None:
            cached_label_embeddings = download_cached_label_embeddings()
            if cached_label_embeddings is not None:
                _label_embeddings = cached_label_embeddings
                return _label_embeddings

            token = get_replicate_token()
            _label_embeddings = {
                "category": embed_labels(
                    token,
                    {label: CATEGORY_PROMPTS[label] for label in CATEGORY_VALUES},
                ),
                "color": embed_labels(
                    token,
                    {label: COLOR_PROMPTS[label] for label in COLOR_VALUES},
                ),
            }
            upload_cached_label_embeddings(_label_embeddings)

    return _label_embeddings


def rank_labels(
    image_embedding: list[float],
    label_embeddings: dict[str, list[float]],
) -> RankedLabel:
    """Rank labels by cosine similarity to the image embedding."""
    ranked_scores = sorted(
        (
            (label, cosine_similarity(image_embedding, embedding))
            for label, embedding in label_embeddings.items()
        ),
        key=lambda score: score[1],
        reverse=True,
    )
    top_label, top_score = ranked_scores[0]
    _, runner_up_score = ranked_scores[1]

    return RankedLabel(
        label=top_label,
        margin=top_score - runner_up_score,
        runner_up_score=runner_up_score,
        score=top_score,
    )


def is_confident_label(
    ranked_label: RankedLabel,
    minimum_similarity: float,
    *,
    require_margin: bool = True,
) -> bool:
    """Check whether a ranked CLIP label clears confidence and margin gates.

    The margin gate is skipped for color: live testing against three of the
    spike's own sample images showed color's top pick was correct every time
    (absolute score above COLOR_MIN_SIMILARITY) but its runner-up margin was
    often two orders of magnitude below MIN_RUNNER_UP_MARGIN — e.g. blue vs.
    gray/navy on denim and a polo shirt. Color labels cluster far more
    tightly in CLIP's embedding space than category labels do (yellow vs.
    everything else was a clean 0.046 margin, but blue-family colors sit
    within ~0.001-0.002 of each other even when blue is unambiguously
    correct). Applying the same margin bar to both fields was rejecting
    correct color picks. Category keeps the margin gate — it's doing real
    work there against `dress` competing with `top`/`bottom`, per the spike's
    documented over-triggering finding.
    """
    if not require_margin:
        return ranked_label.score >= minimum_similarity

    return (
        ranked_label.score >= minimum_similarity
        and ranked_label.margin >= MIN_RUNNER_UP_MARGIN
    )


def classify_image_bytes(image_bytes: bytes) -> ClassificationResult:
    """Classify a compressed item photo by category and color."""
    token = get_replicate_token()
    label_embeddings = get_label_embeddings()
    image_embedding = create_replicate_prediction(
        token,
        {"image": make_image_data_url(image_bytes)},
    )

    category = rank_labels(image_embedding, label_embeddings["category"])
    color = rank_labels(image_embedding, label_embeddings["color"])
    category_is_confident = is_confident_label(category, CATEGORY_MIN_SIMILARITY)
    color_is_confident = is_confident_label(
        color, COLOR_MIN_SIMILARITY, require_margin=False
    )

    if not category_is_confident or not color_is_confident:
        return ClassificationResult(
            detected_category=None,
            detected_color=None,
            classification_failed=True,
        )

    return ClassificationResult(
        detected_category=category.label,
        detected_color=color.label,
        classification_failed=False,
    )
