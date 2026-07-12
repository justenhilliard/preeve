#!/usr/bin/env python3
"""Run a standalone Replicate CLIP validation spike over local sample images."""

from __future__ import annotations

import base64
import json
import math
import mimetypes
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from urllib import error, request

REPLICATE_MODEL = "openai/clip"
REPLICATE_MODEL_VERSION = "versionless official model"
REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions"
REPLICATE_PRICE_PER_SECOND_USD = 0.000975
MAX_ATTEMPTS = 5
REQUEST_TIMEOUT_SECONDS = 120
REQUEST_PAUSE_SECONDS = 10.0
CACHE_PATH = Path("/tmp/preeve_clip_validation_cache.json")

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

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


@dataclass(frozen=True)
class ReplicateEmbedding:
    embedding: list[float]
    latency_ms: int
    predict_time_seconds: float
    total_time_seconds: float
    billed_seconds: float


@dataclass(frozen=True)
class CachedEmbedding:
    embedding: list[float]
    latency_ms: int
    predict_time_seconds: float
    total_time_seconds: float
    billed_seconds: float


@dataclass(frozen=True)
class PredictionResult:
    filename: str
    predicted_category: str
    category_similarity: float
    predicted_color: str
    color_similarity: float
    latency_ms: int
    predict_time_seconds: float
    total_time_seconds: float
    billed_seconds: float
    category_scores: dict[str, float]
    color_scores: dict[str, float]


def project_root() -> Path:
    """Return the repository root inferred from this script's location."""
    return Path(__file__).resolve().parents[2]


def read_replicate_token(env_path: Path) -> str:
    """Read REPLICATE_API_TOKEN from backend/.env."""
    for line in env_path.read_text().splitlines():
        if line.startswith("REPLICATE_API_TOKEN="):
            token = line.split("=", 1)[1].strip()
            if token:
                return token
    raise RuntimeError(f"REPLICATE_API_TOKEN is missing from {env_path}")


def make_data_url(image_path: Path) -> str:
    """Encode a local image file as a data URL for Replicate."""
    mime_type = mimetypes.guess_type(image_path.name)[0] or "image/jpeg"
    encoded_image = base64.b64encode(image_path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded_image}"


def load_cache() -> dict[str, CachedEmbedding]:
    """Load cached embeddings from /tmp for interrupted spike runs."""
    if not CACHE_PATH.exists():
        return {}
    cache_payload = json.loads(CACHE_PATH.read_text())
    return {
        key: CachedEmbedding(
            embedding=[float(value) for value in value["embedding"]],
            latency_ms=int(value.get("latency_ms") or 0),
            predict_time_seconds=float(value["predict_time_seconds"]),
            total_time_seconds=float(value["total_time_seconds"]),
            billed_seconds=float(value["billed_seconds"]),
        )
        for key, value in cache_payload.items()
    }


def save_cache(cache: dict[str, CachedEmbedding]) -> None:
    """Persist cached embeddings outside the repository."""
    cache_payload = {
        key: {
            "embedding": value.embedding,
            "latency_ms": value.latency_ms,
            "predict_time_seconds": value.predict_time_seconds,
            "total_time_seconds": value.total_time_seconds,
            "billed_seconds": value.billed_seconds,
        }
        for key, value in cache.items()
    }
    CACHE_PATH.write_text(json.dumps(cache_payload))


def cosine_similarity(left: list[float], right: list[float]) -> float:
    """Compute cosine similarity between two embedding vectors."""
    numerator = sum(left_value * right_value for left_value, right_value in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return numerator / (left_norm * right_norm)


def create_replicate_prediction(
    token: str,
    input_payload: dict[str, str],
    cache_key: str,
    cache: dict[str, CachedEmbedding],
) -> ReplicateEmbedding:
    """Call Replicate's prediction API and return a CLIP embedding."""
    if cache_key in cache:
        cached_embedding = cache[cache_key]
        return ReplicateEmbedding(
            embedding=cached_embedding.embedding,
            latency_ms=cached_embedding.latency_ms,
            predict_time_seconds=cached_embedding.predict_time_seconds,
            total_time_seconds=cached_embedding.total_time_seconds,
            billed_seconds=0.0,
        )

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "wait=60",
    }
    body = json.dumps({"version": REPLICATE_MODEL, "input": input_payload}).encode("utf-8")

    for attempt in range(1, MAX_ATTEMPTS + 1):
        started_at = time.perf_counter()
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
            latency_ms = round((time.perf_counter() - started_at) * 1000)
            if prediction.get("status") != "succeeded":
                raise RuntimeError(
                    f"Replicate prediction did not succeed: {prediction.get('status')}"
                )
            output = prediction.get("output") or {}
            embedding = output.get("embedding")
            if not isinstance(embedding, list):
                raise RuntimeError("Replicate response did not include an embedding list.")
            metrics = prediction.get("metrics") or {}
            billed_seconds = float(
                metrics.get("unspecified_billing_metric")
                or metrics.get("predict_time")
                or 0.0
            )
            return ReplicateEmbedding(
                embedding=[float(value) for value in embedding],
                latency_ms=latency_ms,
                predict_time_seconds=float(metrics.get("predict_time") or 0.0),
                total_time_seconds=float(metrics.get("total_time") or 0.0),
                billed_seconds=billed_seconds,
            )
        except error.HTTPError as exc:
            if exc.code == 429 and attempt < MAX_ATTEMPTS:
                retry_after = exc.headers.get("Retry-After")
                retry_after_seconds = (
                    float(retry_after) if retry_after and retry_after.isdigit() else 0.0
                )
                sleep_seconds = max(
                    retry_after_seconds,
                    REQUEST_PAUSE_SECONDS * attempt,
                )
                print(
                    f"Rate limited; sleeping {sleep_seconds:.0f}s before retry {attempt + 1}.",
                    file=sys.stderr,
                    flush=True,
                )
                time.sleep(sleep_seconds)
                continue
            details = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Replicate HTTP {exc.code}: {details}") from exc
        except error.URLError as exc:
            if attempt < MAX_ATTEMPTS:
                sleep_seconds = REQUEST_PAUSE_SECONDS * attempt
                print(
                    f"Network error ({exc.reason}); sleeping {sleep_seconds:.0f}s "
                    f"before retry {attempt + 1}.",
                    file=sys.stderr,
                    flush=True,
                )
                time.sleep(sleep_seconds)
                continue
            raise RuntimeError(f"Replicate network error: {exc.reason}") from exc

    raise RuntimeError("Replicate prediction failed after retries.")


def embed_labels(
    token: str,
    labels: dict[str, str],
    label_group: str,
    cache: dict[str, CachedEmbedding],
) -> dict[str, ReplicateEmbedding]:
    """Generate embeddings for every candidate label prompt."""
    embeddings: dict[str, ReplicateEmbedding] = {}
    for label, prompt in labels.items():
        cache_key = f"text:{label_group}:{label}:{prompt}"
        was_cached = cache_key in cache
        print(f"Embedding {label_group} label: {label}", flush=True)
        embeddings[label] = create_replicate_prediction(
            token,
            {"text": prompt},
            cache_key,
            cache,
        )
        if cache_key not in cache:
            cache[cache_key] = CachedEmbedding(
                embedding=embeddings[label].embedding,
                latency_ms=embeddings[label].latency_ms,
                predict_time_seconds=embeddings[label].predict_time_seconds,
                total_time_seconds=embeddings[label].total_time_seconds,
                billed_seconds=embeddings[label].billed_seconds,
            )
            save_cache(cache)
        if not was_cached:
            time.sleep(REQUEST_PAUSE_SECONDS)
    return embeddings


def rank_labels(
    image_embedding: list[float],
    label_embeddings: dict[str, ReplicateEmbedding],
) -> tuple[str, float, dict[str, float]]:
    """Rank labels by cosine similarity to the image embedding."""
    scores = {
        label: cosine_similarity(image_embedding, embedding.embedding)
        for label, embedding in label_embeddings.items()
    }
    predicted_label = max(scores, key=scores.get)
    return predicted_label, scores[predicted_label], scores


def classify_image(
    token: str,
    image_path: Path,
    category_embeddings: dict[str, ReplicateEmbedding],
    color_embeddings: dict[str, ReplicateEmbedding],
    cache: dict[str, CachedEmbedding],
) -> PredictionResult:
    """Classify one sample image by category and color."""
    cache_key = f"image:{image_path.name}:{image_path.stat().st_size}:{image_path.stat().st_mtime_ns}"
    image_embedding = create_replicate_prediction(
        token,
        {"image": make_data_url(image_path)},
        cache_key,
        cache,
    )
    if cache_key not in cache:
        cache[cache_key] = CachedEmbedding(
            embedding=image_embedding.embedding,
            latency_ms=image_embedding.latency_ms,
            predict_time_seconds=image_embedding.predict_time_seconds,
            total_time_seconds=image_embedding.total_time_seconds,
            billed_seconds=image_embedding.billed_seconds,
        )
        save_cache(cache)
    category, category_similarity, category_scores = rank_labels(
        image_embedding.embedding,
        category_embeddings,
    )
    color, color_similarity, color_scores = rank_labels(
        image_embedding.embedding,
        color_embeddings,
    )
    return PredictionResult(
        filename=image_path.name,
        predicted_category=category,
        category_similarity=category_similarity,
        predicted_color=color,
        color_similarity=color_similarity,
        latency_ms=image_embedding.latency_ms,
        predict_time_seconds=image_embedding.predict_time_seconds,
        total_time_seconds=image_embedding.total_time_seconds,
        billed_seconds=image_embedding.billed_seconds,
        category_scores=category_scores,
        color_scores=color_scores,
    )


def format_summary_table(results: list[PredictionResult]) -> str:
    """Format the required summary table for terminal output."""
    rows = [
        (
            "image",
            "category",
            "cat_sim",
            "color",
            "color_sim",
            "latency_ms",
        )
    ]
    for result in results:
        rows.append(
            (
                result.filename,
                result.predicted_category,
                f"{result.category_similarity:.4f}",
                result.predicted_color,
                f"{result.color_similarity:.4f}",
                str(result.latency_ms),
            )
        )

    widths = [max(len(row[index]) for row in rows) for index in range(len(rows[0]))]
    lines = []
    for row_index, row in enumerate(rows):
        line = "  ".join(value.ljust(widths[index]) for index, value in enumerate(row))
        lines.append(line)
        if row_index == 0:
            lines.append("  ".join("-" * width for width in widths))
    return "\n".join(lines)


def result_to_dict(result: PredictionResult) -> dict[str, object]:
    """Convert a prediction result into JSON-serializable data."""
    return {
        "filename": result.filename,
        "predicted_category": result.predicted_category,
        "category_similarity": result.category_similarity,
        "predicted_color": result.predicted_color,
        "color_similarity": result.color_similarity,
        "latency_ms": result.latency_ms,
        "predict_time_seconds": result.predict_time_seconds,
        "total_time_seconds": result.total_time_seconds,
        "billed_seconds": result.billed_seconds,
        "estimated_cost_usd": result.billed_seconds * REPLICATE_PRICE_PER_SECOND_USD,
        "category_scores": result.category_scores,
        "color_scores": result.color_scores,
    }


def main() -> int:
    """Run the validation spike over backend/scripts/sample_images."""
    root = project_root()
    backend_dir = root / "backend"
    sample_dir = backend_dir / "scripts" / "sample_images"
    token = read_replicate_token(backend_dir / ".env")
    cache = load_cache()
    image_paths = [
        path
        for path in sorted(sample_dir.iterdir())
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
    ]
    if not image_paths:
        raise RuntimeError(f"No sample images found in {sample_dir}")

    print(f"Using Replicate model: {REPLICATE_MODEL} ({REPLICATE_MODEL_VERSION})", flush=True)
    print(f"Using cache: {CACHE_PATH}", flush=True)
    print("Embedding category labels...", flush=True)
    category_embeddings = embed_labels(token, CATEGORY_PROMPTS, "category", cache)
    print("Embedding color labels...", flush=True)
    color_embeddings = embed_labels(token, COLOR_PROMPTS, "color", cache)

    results: list[PredictionResult] = []
    for image_path in image_paths:
        image_cache_key = (
            f"image:{image_path.name}:{image_path.stat().st_size}:"
            f"{image_path.stat().st_mtime_ns}"
        )
        was_cached = image_cache_key in cache
        print(f"Classifying {image_path.name}...", file=sys.stderr, flush=True)
        results.append(
            classify_image(
                token,
                image_path,
                category_embeddings,
                color_embeddings,
                cache,
            )
        )
        if not was_cached:
            time.sleep(REQUEST_PAUSE_SECONDS)

    print()
    print(format_summary_table(results))
    print()
    print("JSON_RESULTS_START")
    print(json.dumps([result_to_dict(result) for result in results], indent=2, sort_keys=True))
    print("JSON_RESULTS_END")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
