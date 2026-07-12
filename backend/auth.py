import os
from datetime import UTC, datetime
from typing import Any

from clerk_backend_api import AuthenticateRequestOptions, Clerk
from fastapi import Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_async_session
from models import User


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message


def format_timestamp(timestamp: datetime) -> str:
    """Serialize a timestamp as ISO 8601 UTC with a Z suffix."""
    return timestamp.astimezone(UTC).isoformat().replace("+00:00", "Z")


def get_clerk_client() -> Clerk:
    """Build a Clerk backend client from the server-side secret key."""
    secret_key = os.getenv("CLERK_SECRET_KEY")
    if not secret_key:
        raise ApiError(
            status_code=500,
            code="internal_error",
            message="Server authentication is not configured.",
        )

    return Clerk(bearer_auth=secret_key)


def get_claim_text(claims: dict[str, Any], key: str) -> str | None:
    """Read a non-empty string claim from the verified JWT payload."""
    value = claims.get(key)
    return value if isinstance(value, str) and value else None


async def verify_clerk_session(request: Request) -> dict[str, Any]:
    """Verify the Clerk session token and return its JWT claims."""
    clerk_client = get_clerk_client()
    secret_key = os.getenv("CLERK_SECRET_KEY", "")

    try:
        request_state = await clerk_client.authenticate_request_async(
            request,
            AuthenticateRequestOptions(
                secret_key=secret_key,
                accepts_token=["session_token"],
            ),
        )
    except Exception as error:
        raise ApiError(
            status_code=401,
            code="unauthorized",
            message="Missing, malformed, or expired bearer token.",
        ) from error

    if not request_state.is_authenticated or request_state.payload is None:
        raise ApiError(
            status_code=401,
            code="unauthorized",
            message="Missing, malformed, or expired bearer token.",
        )

    return request_state.payload


def extract_email_from_clerk_user(clerk_user: Any) -> str | None:
    """Read the primary Clerk email address from a Clerk user object."""
    primary_email_address_id = getattr(clerk_user, "primary_email_address_id", None)
    email_addresses = getattr(clerk_user, "email_addresses", [])

    for email_address in email_addresses:
        if getattr(email_address, "id", None) == primary_email_address_id:
            return getattr(email_address, "email_address", None)

    if email_addresses:
        return getattr(email_addresses[0], "email_address", None)

    return None


async def fetch_clerk_email(auth_provider_id: str) -> str:
    """Fetch a user's email from the Clerk backend API."""
    clerk_user = await get_clerk_client().users.get_async(user_id=auth_provider_id)
    email = extract_email_from_clerk_user(clerk_user)
    if not email:
        raise ApiError(
            status_code=500,
            code="internal_error",
            message="Clerk user email is unavailable.",
        )

    return email


async def get_user_by_auth_provider_id(
    session: AsyncSession,
    auth_provider_id: str,
) -> User | None:
    """Look up an app user by Clerk user ID."""
    result = await session.execute(
        select(User).where(User.auth_provider_id == auth_provider_id),
    )
    return result.scalar_one_or_none()


async def create_user_from_claims(
    session: AsyncSession,
    auth_provider_id: str,
    email: str,
) -> User:
    """Create a user row, re-reading on unique conflicts caused by webhook races."""
    user = User(auth_provider_id=auth_provider_id, email=email)
    session.add(user)

    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing_user = await get_user_by_auth_provider_id(session, auth_provider_id)
        if existing_user is not None:
            return existing_user
        raise

    await session.refresh(user)
    return user


async def get_current_user(request: Request) -> User:
    """Verify Clerk auth and lazily provision the matching app user."""
    claims = await verify_clerk_session(request)
    auth_provider_id = get_claim_text(claims, "sub")
    if auth_provider_id is None:
        raise ApiError(
            status_code=401,
            code="unauthorized",
            message="Missing, malformed, or expired bearer token.",
        )

    async for session in get_async_session():
        existing_user = await get_user_by_auth_provider_id(session, auth_provider_id)
        if existing_user is not None:
            return existing_user

        email = get_claim_text(claims, "email")
        if email is None:
            email = await fetch_clerk_email(auth_provider_id)

        return await create_user_from_claims(session, auth_provider_id, email)

    raise ApiError(
        status_code=500,
        code="internal_error",
        message="Database session is unavailable.",
    )
