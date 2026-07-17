from __future__ import annotations

import base64
import json
import os
import time
from io import BytesIO
from urllib import error, request

from PIL import Image

REPLICATE_BACKGROUND_MODEL = (
    "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003"
)
REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions"
MAX_REPLICATE_ATTEMPTS = 2
REPLICATE_WAIT_SECONDS = 60
REQUEST_TIMEOUT_SECONDS = 90
RETRY_PAUSE_SECONDS = 2.0
OUTPUT_BACKGROUND_COLOR = (255, 255, 255)
OUTPUT_JPEG_QUALITY = 80


def get_replicate_token() -> str:
    """Read the server-side Replicate token."""
    token = os.getenv("REPLICATE_API_TOKEN")
    if not token:
        raise RuntimeError("REPLICATE_API_TOKEN is not configured.")

    return token


def make_image_data_url(image_bytes: bytes) -> str:
    """Encode a compressed JPEG as a data URL for Replicate."""
    encoded_image = base64.b64encode(image_bytes).decode("ascii")
    return f"data:image/jpeg;base64,{encoded_image}"


def read_output_url(prediction: dict) -> str:
    """Read the background-removed image URL from a Replicate prediction."""
    output = prediction.get("output")
    if isinstance(output, str) and output:
        return output

    if isinstance(output, list) and output and isinstance(output[0], str):
        return output[0]

    if isinstance(output, dict):
        for value in output.values():
            if isinstance(value, str) and value:
                return value

    raise RuntimeError("Replicate response did not include an output image URL.")


def get_prediction(token: str, prediction_url: str) -> dict:
    """Fetch a Replicate prediction by URL."""
    prediction_request = request.Request(
        prediction_url,
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    with request.urlopen(
        prediction_request,
        timeout=REQUEST_TIMEOUT_SECONDS,
    ) as response:
        return json.load(response)


def wait_for_prediction(token: str, prediction: dict) -> dict:
    """Poll a Replicate prediction until it succeeds or reaches a terminal state."""
    deadline = time.monotonic() + REQUEST_TIMEOUT_SECONDS
    current_prediction = prediction

    while current_prediction.get("status") in {"starting", "processing"}:
        if time.monotonic() >= deadline:
            raise RuntimeError("Replicate prediction timed out.")

        prediction_url = (current_prediction.get("urls") or {}).get("get")
        if not prediction_url:
            raise RuntimeError("Replicate response did not include a polling URL.")

        time.sleep(RETRY_PAUSE_SECONDS)
        current_prediction = get_prediction(token, prediction_url)

    if current_prediction.get("status") != "succeeded":
        raise RuntimeError(
            f"Replicate prediction did not succeed: {current_prediction.get('status')}"
        )

    return current_prediction


def create_background_removal_prediction(token: str, image_bytes: bytes) -> str:
    """Call Replicate rembg and return the output image URL."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": f"wait={REPLICATE_WAIT_SECONDS}",
    }
    body = json.dumps(
        {
            "version": REPLICATE_BACKGROUND_MODEL,
            "input": {"image": make_image_data_url(image_bytes)},
        },
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

            return read_output_url(wait_for_prediction(token, prediction))
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

            raise RuntimeError(f"Replicate HTTP error: {exc.code}") from exc
        except error.URLError as exc:
            if attempt < MAX_REPLICATE_ATTEMPTS:
                time.sleep(RETRY_PAUSE_SECONDS)
                continue

            raise RuntimeError("Replicate network error.") from exc

    raise RuntimeError("Replicate prediction failed after retry.")


def download_output_image(output_url: str) -> bytes:
    """Download a Replicate-hosted prediction output image."""
    with request.urlopen(output_url, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        return response.read()


def composite_to_jpeg(image_bytes: bytes) -> bytes:
    """Composite a segmented image onto white and encode it as JPEG."""
    with Image.open(BytesIO(image_bytes)) as image:
        image.load()
        rgba_image = image.convert("RGBA")
        background = Image.new("RGBA", rgba_image.size, OUTPUT_BACKGROUND_COLOR + (255,))
        background.alpha_composite(rgba_image)

        output = BytesIO()
        background.convert("RGB").save(
            output,
            format="JPEG",
            optimize=True,
            quality=OUTPUT_JPEG_QUALITY,
        )
        return output.getvalue()


def remove_background(image_bytes: bytes) -> bytes:
    """Remove background for classification input, falling back to original bytes."""
    try:
        output_url = create_background_removal_prediction(
            get_replicate_token(),
            image_bytes,
        )
        return composite_to_jpeg(download_output_image(output_url))
    except Exception:
        return image_bytes
