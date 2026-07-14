from __future__ import annotations

import json
import os
from typing import Any

import boto3
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError

from auth import ApiError
from image_processing import get_env_int

DEFAULT_PRESIGNED_URL_EXPIRY_SECONDS = 3600


def is_missing_object_error(error: ClientError) -> bool:
    """Return whether R2 reported a normal missing object cache miss."""
    error_code = str(error.response.get("Error", {}).get("Code", ""))
    status_code = error.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
    return error_code in {"NoSuchKey", "404", "NotFound"} or status_code == 404


def get_required_env(name: str) -> str:
    """Read a required environment variable for object storage."""
    value = os.getenv(name)
    if not value:
        raise ApiError(
            status_code=500,
            code="internal_error",
            message=f"{name} is not configured.",
        )

    return value


def create_r2_client():
    """Build an S3-compatible boto3 client for Cloudflare R2."""
    return boto3.client(
        "s3",
        aws_access_key_id=get_required_env("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=get_required_env("R2_SECRET_ACCESS_KEY"),
        endpoint_url=get_required_env("R2_ENDPOINT_URL"),
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def upload_item_photo(photo_key: str, image_bytes: bytes) -> None:
    """Upload a compressed item photo to the private R2 bucket."""
    try:
        create_r2_client().put_object(
            Bucket=get_required_env("R2_BUCKET_NAME"),
            Key=photo_key,
            Body=image_bytes,
            ContentType="image/jpeg",
        )
    except (BotoCoreError, ClientError) as error:
        raise ApiError(
            status_code=500,
            code="internal_error",
            message="Photo storage is temporarily unavailable.",
        ) from error


def upload_json_object(key: str, data: dict[str, Any]) -> None:
    """Upload a JSON object to the private R2 bucket."""
    try:
        create_r2_client().put_object(
            Bucket=get_required_env("R2_BUCKET_NAME"),
            Key=key,
            Body=json.dumps(data, sort_keys=True).encode("utf-8"),
            ContentType="application/json",
        )
    except (BotoCoreError, ClientError) as error:
        raise ApiError(
            status_code=500,
            code="internal_error",
            message="Object storage is temporarily unavailable.",
        ) from error


def download_json_object(key: str) -> dict[str, Any] | None:
    """Download a JSON object from R2, returning None for a missing key."""
    try:
        response = create_r2_client().get_object(
            Bucket=get_required_env("R2_BUCKET_NAME"),
            Key=key,
        )
        body = response["Body"].read()
        payload = json.loads(body.decode("utf-8"))
    except ClientError as error:
        if is_missing_object_error(error):
            return None

        raise ApiError(
            status_code=500,
            code="internal_error",
            message="Object storage is temporarily unavailable.",
        ) from error
    except (BotoCoreError, json.JSONDecodeError, KeyError) as error:
        raise ApiError(
            status_code=500,
            code="internal_error",
            message="Object storage is temporarily unavailable.",
        ) from error

    return payload if isinstance(payload, dict) else None


def generate_photo_url(photo_key: str) -> str:
    """Generate a fresh pre-signed URL for a private R2 item photo."""
    try:
        return create_r2_client().generate_presigned_url(
            ClientMethod="get_object",
            Params={
                "Bucket": get_required_env("R2_BUCKET_NAME"),
                "Key": photo_key,
            },
            ExpiresIn=get_env_int(
                "R2_PRESIGNED_URL_EXPIRY_SECONDS",
                DEFAULT_PRESIGNED_URL_EXPIRY_SECONDS,
            ),
        )
    except (BotoCoreError, ClientError) as error:
        raise ApiError(
            status_code=500,
            code="internal_error",
            message="Photo URL generation is temporarily unavailable.",
        ) from error
