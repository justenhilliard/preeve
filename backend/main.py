import os
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError

from auth import ApiError, format_timestamp, get_current_user
from database import get_async_session
from models import Preference, User

load_dotenv()


def get_cors_allowed_origins() -> list[str]:
    """Read comma-separated CORS origins from the environment."""
    raw_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


app = FastAPI(title="Preeve API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ApiError)
async def handle_api_error(_: Request, error: ApiError) -> JSONResponse:
    """Return API errors in the documented envelope shape."""
    return JSONResponse(
        status_code=error.status_code,
        content={"error": {"code": error.code, "message": error.message}},
    )


@app.get("/api/health")
async def get_health() -> dict[str, str]:
    """Return the backend health status."""
    return {"status": "ok"}


def get_clerk_webhook_secret() -> str:
    """Read the Clerk webhook signing secret from the environment."""
    webhook_secret = os.getenv("CLERK_WEBHOOK_SIGNING_SECRET")
    if not webhook_secret:
        raise ApiError(
            status_code=500,
            code="internal_error",
            message="Webhook authentication is not configured.",
        )

    return webhook_secret


def extract_webhook_email(data: dict[str, Any]) -> str | None:
    """Read the first email address from a Clerk webhook user payload."""
    email_addresses = data.get("email_addresses")
    if not isinstance(email_addresses, list) or not email_addresses:
        return None

    first_email = email_addresses[0]
    if not isinstance(first_email, dict):
        return None

    email = first_email.get("email_address")
    return email if isinstance(email, str) and email else None


async def upsert_clerk_user(session: AsyncSession, data: dict[str, Any]) -> None:
    """Upsert a local user from a Clerk user.created or user.updated event."""
    auth_provider_id = data.get("id")
    email = extract_webhook_email(data)
    if not isinstance(auth_provider_id, str) or not auth_provider_id or email is None:
        return

    statement = (
        insert(User)
        .values(auth_provider_id=auth_provider_id, email=email)
        .on_conflict_do_update(
            index_elements=[User.auth_provider_id],
            set_={"email": email},
        )
    )
    await session.execute(statement)
    await session.commit()


async def delete_clerk_user(session: AsyncSession, data: dict[str, Any]) -> None:
    """Delete a local user from a Clerk user.deleted event."""
    auth_provider_id = data.get("id")
    if not isinstance(auth_provider_id, str) or not auth_provider_id:
        return

    await session.execute(delete(User).where(User.auth_provider_id == auth_provider_id))
    await session.commit()


@app.post("/api/webhooks/clerk")
async def post_clerk_webhook(
    request: Request,
) -> dict[str, bool]:
    """Process supported Clerk user webhooks."""
    payload = await request.body()
    webhook = Webhook(get_clerk_webhook_secret())

    try:
        event = webhook.verify(payload, request.headers)
    except WebhookVerificationError as error:
        raise ApiError(
            status_code=400,
            code="invalid_signature",
            message="Webhook signature verification failed.",
        ) from error

    event_type = event.get("type")
    data = event.get("data")
    if not isinstance(data, dict):
        return {"received": True}

    if event_type in {"user.created", "user.updated"}:
        async for session in get_async_session():
            await upsert_clerk_user(session, data)

    elif event_type == "user.deleted":
        async for session in get_async_session():
            await delete_clerk_user(session, data)

    return {"received": True}


@app.get("/api/users/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, str | bool]:
    """Return the current user's app-side profile."""
    result = await session.execute(
        select(Preference.formality_preference).where(
            Preference.user_id == current_user.id,
        ),
    )
    formality_preference = result.scalar_one_or_none()

    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "hasCompletedPreferences": formality_preference is not None,
        "createdAt": format_timestamp(current_user.created_at),
    }
