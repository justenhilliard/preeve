from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from typing import Any

from openai import OpenAI

OPENAI_VISION_MODEL = "gpt-4.1-mini"
REQUEST_TIMEOUT_SECONDS = 20

VISUAL_ATTRIBUTES_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "garmentType": {"type": "string"},
        "primaryColor": {"type": "string"},
        "secondaryColors": {
            "type": "array",
            "items": {"type": "string"},
        },
        "pattern": {"type": ["string", "null"]},
    },
    "required": [
        "garmentType",
        "primaryColor",
        "secondaryColors",
        "pattern",
    ],
}


@dataclass(frozen=True)
class VisualAttributes:
    garment_type: str
    primary_color: str
    secondary_colors: list[str]
    pattern: str | None

    def to_api_dict(self) -> dict[str, str | list[str] | None]:
        """Return the stored/API camelCase shape for visual attributes."""
        return {
            "garmentType": self.garment_type,
            "primaryColor": self.primary_color,
            "secondaryColors": self.secondary_colors,
            "pattern": self.pattern,
        }


def get_openai_api_key() -> str:
    """Read the server-side OpenAI API key."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    return api_key


def make_image_data_url(image_bytes: bytes) -> str:
    """Encode a compressed JPEG as a data URL for OpenAI vision input."""
    encoded_image = base64.b64encode(image_bytes).decode("ascii")
    return f"data:image/jpeg;base64,{encoded_image}"


def read_response_text(response: Any) -> str:
    """Extract the structured-output text from an OpenAI response object."""
    output_text = getattr(response, "output_text", None)
    if isinstance(output_text, str) and output_text:
        return output_text

    for output in getattr(response, "output", []) or []:
        for content in getattr(output, "content", []) or []:
            text = getattr(content, "text", None)
            if isinstance(text, str) and text:
                return text

    raise ValueError("OpenAI response did not include output text.")


def parse_visual_attributes(payload: Any) -> VisualAttributes:
    """Validate structured visual attributes returned by the vision model."""
    if not isinstance(payload, dict):
        raise ValueError("Visual attributes payload must be an object.")

    garment_type = payload.get("garmentType")
    primary_color = payload.get("primaryColor")
    secondary_colors = payload.get("secondaryColors")
    pattern = payload.get("pattern")

    if not isinstance(garment_type, str) or not garment_type.strip():
        raise ValueError("garmentType must be a non-empty string.")

    if not isinstance(primary_color, str) or not primary_color.strip():
        raise ValueError("primaryColor must be a non-empty string.")

    if not isinstance(secondary_colors, list) or not all(
        isinstance(color, str) and color.strip()
        for color in secondary_colors
    ):
        raise ValueError("secondaryColors must be a list of strings.")

    if pattern is not None and (not isinstance(pattern, str) or not pattern.strip()):
        raise ValueError("pattern must be null or a non-empty string.")

    return VisualAttributes(
        garment_type=garment_type.strip(),
        primary_color=primary_color.strip(),
        secondary_colors=[color.strip() for color in secondary_colors],
        pattern=pattern.strip() if isinstance(pattern, str) else None,
    )


def extract_visual_attributes(image_bytes: bytes) -> VisualAttributes | None:
    """Extract narrow structured garment attributes from an item photo."""
    try:
        client = OpenAI(
            api_key=get_openai_api_key(),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response = client.responses.create(
            model=OPENAI_VISION_MODEL,
            input=[
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                "Extract only visible garment attributes for one "
                                "primary clothing or accessory item in the photo. "
                                "If multiple wearable items are visible, choose the "
                                "item that appears intentionally framed: largest, "
                                "most centered, most in focus, or deliberately held "
                                "up for the camera. Treat jewelry or clothing worn "
                                "incidentally by a hand or person holding another "
                                "item as background context unless it is clearly "
                                "the main subject. Return structured fields only. "
                                "Do not give opinions, recommendations, styling "
                                "advice, or prose analysis."
                            ),
                        },
                    ],
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                "Identify the single main item's specific garment "
                                "type, primary color, any secondary colors, and any "
                                "notable pattern or material visible in the image."
                            ),
                        },
                        {
                            "type": "input_image",
                            "image_url": make_image_data_url(image_bytes),
                        },
                    ],
                },
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "visual_attributes",
                    "schema": VISUAL_ATTRIBUTES_SCHEMA,
                    "strict": True,
                },
            },
        )
        return parse_visual_attributes(json.loads(read_response_text(response)))
    except Exception:
        return None
