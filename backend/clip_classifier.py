from __future__ import annotations

import base64
import json
import math
import os
import time
from dataclasses import dataclass
from threading import Lock
from urllib import error, request

from models import CATEGORY_VALUES, COLOR_VALUES

REPLICATE_MODEL = "openai/clip"
REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions"
MAX_REPLICATE_ATTEMPTS = 2
REPLICATE_WAIT_SECONDS = 60
REQUEST_TIMEOUT_SECONDS = 90
RETRY_PAUSE_SECONDS = 2.0


# These prompts intentionally match backend/scripts/clip_validation_spike.py
# verbatim. The confidence/margin thresholds below were derived from that
# spike's observed score distribution — reworded prompts shift the actual
# similarity scores, which would silently invalidate the calibration.
CATEGORY_PROMPTS = {
    "top": "a photo of a top clothing item, shirt, sweater, tank, or polo",
    "bottom": "a photo of a bottom clothing item, jeans, shorts, skirt, or pants",
    "dress": "a photo of a dress clothing item",
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


def get_label_embeddings() -> dict[str, dict[str, list[float]]]:
    """Return cached category and color label embeddings."""
    global _label_embeddings

    if _label_embeddings is not None:
        return _label_embeddings

    with _label_embeddings_lock:
        if _label_embeddings is None:
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
