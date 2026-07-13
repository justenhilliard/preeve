from __future__ import annotations

import os

import boto3
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError

from auth import ApiError
from image_processing import get_env_int

DEFAULT_PRESIGNED_URL_EXPIRY_SECONDS = 3600


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
