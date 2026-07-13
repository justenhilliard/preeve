from __future__ import annotations

import os
from io import BytesIO

from PIL import Image, UnidentifiedImageError

from auth import ApiError

DEFAULT_IMAGE_JPEG_QUALITY = 80
DEFAULT_IMAGE_MAX_DIMENSION_PX = 1600
DEFAULT_MAX_UPLOAD_FILE_SIZE_MB = 5
SUPPORTED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png"}


def get_env_int(name: str, default: int) -> int:
    """Read a positive integer from the environment with a documented fallback."""
    raw_value = os.getenv(name)
    if raw_value is None or raw_value == "":
        return default

    try:
        value = int(raw_value)
    except ValueError as error:
        raise ApiError(
            status_code=500,
            code="internal_error",
            message=f"{name} must be an integer.",
        ) from error

    if value <= 0:
        raise ApiError(
            status_code=500,
            code="internal_error",
            message=f"{name} must be greater than zero.",
        )

    return value


def validate_upload_metadata(content_type: str | None, file_size_bytes: int) -> None:
    """Validate upload MIME type and size before image processing starts."""
    if content_type not in SUPPORTED_IMAGE_MIME_TYPES:
        raise ApiError(
            status_code=415,
            code="unsupported_media_type",
            message="Only image/jpeg and image/png are accepted.",
        )

    max_upload_size_bytes = (
        get_env_int("MAX_UPLOAD_FILE_SIZE_MB", DEFAULT_MAX_UPLOAD_FILE_SIZE_MB)
        * 1024
        * 1024
    )
    if file_size_bytes > max_upload_size_bytes:
        raise ApiError(
            status_code=413,
            code="file_too_large",
            message=f"Image exceeds the {max_upload_size_bytes // 1024 // 1024}MB limit.",
        )


def compress_image(uploaded_image: bytes) -> bytes:
    """Resize an uploaded image and encode it as a compressed JPEG."""
    try:
        with Image.open(BytesIO(uploaded_image)) as image:
            image.load()
            image.thumbnail(
                (
                    get_env_int("IMAGE_MAX_DIMENSION_PX", DEFAULT_IMAGE_MAX_DIMENSION_PX),
                    get_env_int("IMAGE_MAX_DIMENSION_PX", DEFAULT_IMAGE_MAX_DIMENSION_PX),
                ),
                Image.Resampling.LANCZOS,
            )

            output = BytesIO()
            image.convert("RGB").save(
                output,
                format="JPEG",
                optimize=True,
                quality=get_env_int("IMAGE_JPEG_QUALITY", DEFAULT_IMAGE_JPEG_QUALITY),
            )
            return output.getvalue()
    except UnidentifiedImageError as error:
        raise ApiError(
            status_code=415,
            code="unsupported_media_type",
            message="Only image/jpeg and image/png are accepted.",
        ) from error
