import asyncio
import os
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Request, UploadFile, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError

from auth import ApiError, format_timestamp, get_current_user
from clip_classifier import (
    InferenceUnavailableError,
    classify_image_bytes,
    get_label_embeddings,
)
from database import get_async_session
from image_processing import compress_image, validate_upload_metadata
from models import CATEGORY_VALUES, Preference, ScannedItem, User
from object_storage import generate_photo_url, upload_item_photo
from verdict_engine import VerdictPreferences, compute_verdict

load_dotenv()

COLOR_VALUES = (
    "black",
    "white",
    "gray",
    "navy",
    "blue",
    "red",
    "green",
    "olive",
    "brown",
    "tan",
    "beige",
    "pink",
    "purple",
    "yellow",
    "orange",
    "burgundy",
    "multicolor",
)
FIT_VALUES = (
    "baggy",
    "oversized",
    "relaxed",
    "cropped",
    "fitted",
    "slim",
    "tailored",
    "straight",
)
FORMALITY_VALUES = (
    "athleisure",
    "casual",
    "smart_casual",
    "business_casual",
    "formal",
)


def get_cors_allowed_origins() -> list[str]:
    """Read comma-separated CORS origins from the environment."""
    raw_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-embed CLIP category/color labels before accepting requests.

    get_label_embeddings() caches its result in-process for the rest of the
    server's lifetime, but embedding all 23 labels sequentially the first
    time takes 20-30+ seconds. Warming it here means that cost is paid once
    at boot, not on whichever user's request happens to hit the server first.
    """
    try:
        await asyncio.to_thread(get_label_embeddings)
    except InferenceUnavailableError:
        # Replicate unreachable at boot (e.g. missing token locally). Don't
        # block startup on it — classify_image_bytes will retry the lazy
        # path on the first real scan request instead.
        pass

    yield


app = FastAPI(title="Preeve API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def to_camel(field_name: str) -> str:
    """Convert a snake_case field name to camelCase for API JSON."""
    first_word, *remaining_words = field_name.split("_")
    return first_word + "".join(word.title() for word in remaining_words)


class PreferencesRequest(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    preferred_colors: list[str] = Field(max_length=17)
    preferred_fits: list[str] = Field(max_length=8)
    formality_preference: str | None

    @model_validator(mode="after")
    def validate_preferences(self) -> "PreferencesRequest":
        """Validate preferences against the locked API taxonomies."""
        validate_list_values("preferredColors", self.preferred_colors, COLOR_VALUES)
        validate_list_values("preferredFits", self.preferred_fits, FIT_VALUES)

        if (
            self.formality_preference is not None
            and self.formality_preference not in FORMALITY_VALUES
        ):
            allowed_values = ", ".join(FORMALITY_VALUES)
            raise ValueError(
                f"formalityPreference must be one of: {allowed_values}.",
            )

        return self


class PreferencesResponse(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    preferred_colors: list[str]
    preferred_fits: list[str]
    formality_preference: str | None
    updated_at: str | None


class ItemCorrectionRequest(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    corrected_category: str
    corrected_color: str

    @model_validator(mode="after")
    def validate_correction(self) -> "ItemCorrectionRequest":
        """Validate correction fields against the locked item taxonomies."""
        if self.corrected_category not in CATEGORY_VALUES:
            allowed_values = ", ".join(CATEGORY_VALUES)
            raise ValueError(
                f"correctedCategory must be one of: {allowed_values}.",
            )

        if self.corrected_color not in COLOR_VALUES:
            allowed_values = ", ".join(COLOR_VALUES)
            raise ValueError(
                f"correctedColor must be one of: {allowed_values}.",
            )

        return self


def validate_list_values(
    field_name: str,
    submitted_values: list[str],
    allowed_values: tuple[str, ...],
) -> None:
    """Validate a multi-select field's values and duplicate rules."""
    if len(submitted_values) != len(set(submitted_values)):
        raise ValueError(f"{field_name} must not contain duplicate values.")

    invalid_values = [
        submitted_value
        for submitted_value in submitted_values
        if submitted_value not in allowed_values
    ]
    if invalid_values:
        allowed_values_text = ", ".join(allowed_values)
        invalid_values_text = ", ".join(invalid_values)
        raise ValueError(
            f"{field_name} contains invalid value(s): {invalid_values_text}. "
            f"Allowed values: {allowed_values_text}.",
        )


@app.exception_handler(ApiError)
async def handle_api_error(_: Request, error: ApiError) -> JSONResponse:
    """Return API errors in the documented envelope shape."""
    return JSONResponse(
        status_code=error.status_code,
        content={"error": {"code": error.code, "message": error.message}},
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    _: Request,
    error: RequestValidationError,
) -> JSONResponse:
    """Return Pydantic validation errors in the documented envelope shape."""
    first_error = error.errors()[0] if error.errors() else {}
    message = str(first_error.get("msg", "Request validation failed."))
    if message.startswith("Value error, "):
        message = message.removeprefix("Value error, ")

    return JSONResponse(
        status_code=422,
        content={"error": {"code": "validation_error", "message": message}},
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


async def get_user_preferences(
    session: AsyncSession,
    current_user: User,
) -> Preference | None:
    """Fetch the current user's preferences row."""
    result = await session.execute(
        select(Preference).where(Preference.user_id == current_user.id),
    )
    return result.scalar_one_or_none()


def format_preferences(preference: Preference | None) -> PreferencesResponse:
    """Convert a preferences row into the documented API response shape."""
    if preference is None:
        return PreferencesResponse(
            preferred_colors=[],
            preferred_fits=[],
            formality_preference=None,
            updated_at=None,
        )

    return PreferencesResponse(
        preferred_colors=preference.preferred_colors,
        preferred_fits=preference.preferred_fits,
        formality_preference=preference.formality_preference,
        updated_at=format_timestamp(preference.updated_at),
    )


@app.get("/api/preferences", response_model=PreferencesResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> PreferencesResponse:
    """Return the current user's saved preferences or the empty onboarding state."""
    preference = await get_user_preferences(session, current_user)
    return format_preferences(preference)


@app.put("/api/preferences", response_model=PreferencesResponse)
async def put_preferences(
    preferences_request: PreferencesRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> PreferencesResponse:
    """Create or update the current user's preferences."""
    preference = await get_user_preferences(session, current_user)
    updated_at = datetime.now(UTC)

    if preference is None:
        preference = Preference(
            user_id=current_user.id,
            preferred_colors=preferences_request.preferred_colors,
            preferred_fits=preferences_request.preferred_fits,
            formality_preference=preferences_request.formality_preference,
            updated_at=updated_at,
        )
        session.add(preference)
    else:
        preference.preferred_colors = preferences_request.preferred_colors
        preference.preferred_fits = preferences_request.preferred_fits
        preference.formality_preference = preferences_request.formality_preference
        preference.updated_at = updated_at

    await session.commit()
    await session.refresh(preference)
    return format_preferences(preference)


def format_scanned_item(
    scanned_item: ScannedItem,
    photo_url: str,
    classification_failed: bool,
) -> dict[str, Any]:
    """Convert a scanned item row into the documented scan response shape."""
    # Pairings intentionally stay empty until the later pairing-lookup tickets
    # implement that contract.
    response = {
        "id": str(scanned_item.id),
        "photoUrl": photo_url,
        "detectedCategory": scanned_item.detected_category,
        "detectedColor": scanned_item.detected_color,
        "correctedCategory": scanned_item.corrected_category,
        "correctedColor": scanned_item.corrected_color,
        "verdict": scanned_item.verdict,
        "rationale": scanned_item.rationale,
        "pairingSuggestions": [],
        "savedToWardrobe": scanned_item.saved_to_wardrobe,
        "createdAt": format_timestamp(scanned_item.created_at),
    }

    if classification_failed:
        response["classificationFailed"] = True

    return response


async def apply_verdict_to_item(
    session: AsyncSession,
    current_user: User,
    scanned_item: ScannedItem,
    category: str,
    color: str,
) -> None:
    """Compute and attach the current user's verdict for one item."""
    preference = await get_user_preferences(session, current_user)
    verdict_result = compute_verdict(
        category=category,
        color=color,
        preferences=VerdictPreferences(
            preferred_colors=preference.preferred_colors if preference else [],
            formality_preference=(
                preference.formality_preference if preference else None
            ),
        ),
    )
    scanned_item.verdict = verdict_result.verdict
    scanned_item.rationale = verdict_result.rationale


def is_unresolved_classification(scanned_item: ScannedItem) -> bool:
    """Return whether an item still needs manual classification fallback."""
    return (
        scanned_item.detected_category is None
        or scanned_item.detected_color is None
    ) and (
        scanned_item.corrected_category is None
        or scanned_item.corrected_color is None
    )


async def get_user_scanned_item(
    session: AsyncSession,
    current_user: User,
    item_id: uuid.UUID,
) -> ScannedItem:
    """Fetch an item scoped to the current user or raise not_found."""
    result = await session.execute(
        select(ScannedItem).where(
            ScannedItem.id == item_id,
            ScannedItem.user_id == current_user.id,
        ),
    )
    scanned_item = result.scalar_one_or_none()
    if scanned_item is None:
        raise ApiError(
            status_code=404,
            code="not_found",
            message="No item found with that ID for this user.",
        )

    return scanned_item


@app.get("/api/items/{item_id}")
async def get_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Return one scanned item scoped to the current user."""
    scanned_item = await get_user_scanned_item(session, current_user, item_id)
    photo_url = await asyncio.to_thread(generate_photo_url, scanned_item.photo_key)
    return format_scanned_item(
        scanned_item,
        photo_url,
        is_unresolved_classification(scanned_item),
    )


@app.patch("/api/items/{item_id}/correct")
async def patch_item_correction(
    item_id: uuid.UUID,
    correction_request: ItemCorrectionRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Persist manual category and color correction for one scanned item."""
    scanned_item = await get_user_scanned_item(session, current_user, item_id)
    scanned_item.corrected_category = correction_request.corrected_category
    scanned_item.corrected_color = correction_request.corrected_color
    await apply_verdict_to_item(
        session,
        current_user,
        scanned_item,
        correction_request.corrected_category,
        correction_request.corrected_color,
    )

    await session.commit()
    await session.refresh(scanned_item)

    photo_url = await asyncio.to_thread(generate_photo_url, scanned_item.photo_key)
    return format_scanned_item(scanned_item, photo_url, False)


@app.patch("/api/items/{item_id}/save")
async def patch_item_save(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, str | bool]:
    """Mark one scanned item as saved to the current user's wardrobe."""
    scanned_item = await get_user_scanned_item(session, current_user, item_id)
    scanned_item.saved_to_wardrobe = True

    await session.commit()
    await session.refresh(scanned_item)

    return {
        "id": str(scanned_item.id),
        "savedToWardrobe": scanned_item.saved_to_wardrobe,
    }


@app.post("/api/items/scan", status_code=status.HTTP_201_CREATED)
async def post_item_scan(
    photo: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Compress, store, classify, and persist an uploaded item photo."""
    if photo is None:
        raise ApiError(
            status_code=400,
            code="validation_error",
            message="Photo upload is required.",
        )

    uploaded_image = await photo.read()
    if not uploaded_image:
        raise ApiError(
            status_code=400,
            code="validation_error",
            message="Photo upload is required.",
        )

    validate_upload_metadata(photo.content_type, len(uploaded_image))
    compressed_image = await asyncio.to_thread(compress_image, uploaded_image)

    try:
        classification = await asyncio.to_thread(
            classify_image_bytes,
            compressed_image,
        )
    except InferenceUnavailableError as error:
        raise ApiError(
            status_code=502,
            code="inference_unavailable",
            message="Classification service is temporarily unavailable. Try again shortly.",
        ) from error

    item_id = uuid.uuid4()
    photo_key = f"items/{current_user.id}/{item_id}.jpg"
    await asyncio.to_thread(upload_item_photo, photo_key, compressed_image)

    scanned_item = ScannedItem(
        id=item_id,
        user_id=current_user.id,
        photo_key=photo_key,
        detected_category=classification.detected_category,
        detected_color=classification.detected_color,
        verdict=None,
        rationale=None,
    )
    if (
        not classification.classification_failed
        and classification.detected_category is not None
        and classification.detected_color is not None
    ):
        await apply_verdict_to_item(
            session,
            current_user,
            scanned_item,
            classification.detected_category,
            classification.detected_color,
        )

    session.add(scanned_item)
    await session.commit()
    await session.refresh(scanned_item)

    photo_url = await asyncio.to_thread(generate_photo_url, photo_key)
    return format_scanned_item(
        scanned_item,
        photo_url,
        classification.classification_failed,
    )
