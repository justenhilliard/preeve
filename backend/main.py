import asyncio
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Query, Request, UploadFile, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError

from auth import ApiError, format_timestamp, get_current_user
from background_removal import remove_background
from clip_classifier import (
    InferenceUnavailableError,
    classify_image_bytes,
    get_label_embeddings,
)
from closet_insight import compute_closet_insight
from database import get_async_session
from fit_styling import compute_fit_styling_note
from image_processing import compress_image, validate_upload_metadata
from item_description import extract_visual_attributes
from models import (
    CATEGORY_VALUES,
    FIT_VALUES,
    PairingSuggestion,
    Preference,
    ScannedItem,
    User,
)
from object_storage import delete_item_photo, generate_photo_url, upload_item_photo
from pairing_lookup import MAX_PAIRING_SUGGESTIONS, find_pairing_suggestions
from wardrobe_pairing import (
    find_wardrobe_pairing_suggestions,
    format_wardrobe_pairing_suggestion,
)
from verdict_engine import VerdictPreferences, VerdictResult, compute_verdict

load_dotenv()

logger = logging.getLogger("preeve.api")

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


class FavoriteItemRequest(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    is_favorited: bool


def validate_taxonomy_value(
    field_name: str,
    submitted_value: str,
    allowed_values: tuple[str, ...],
) -> None:
    """Validate a single enum-like API value against a locked taxonomy."""
    if submitted_value not in allowed_values:
        allowed_values_text = ", ".join(allowed_values)
        raise ApiError(
            status_code=422,
            code="validation_error",
            message=f"{field_name} must be one of: {allowed_values_text}.",
        )


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


@app.exception_handler(Exception)
async def handle_unhandled_error(_: Request, error: Exception) -> JSONResponse:
    """Return unhandled exceptions in the documented envelope shape."""
    logger.error(
        "Unhandled API exception",
        exc_info=(type(error), error, error.__traceback__),
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "Something went wrong. Try again shortly.",
            },
        },
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


async def format_pairing_suggestions(
    pairing_suggestions: list[PairingSuggestion],
) -> list[dict[str, str | None]]:
    """Convert pairing suggestion rows into the documented API shape."""
    formatted_suggestions: list[dict[str, str | None]] = []

    for pairing_suggestion in pairing_suggestions:
        image_url = (
            await asyncio.to_thread(generate_photo_url, pairing_suggestion.image_key)
            if pairing_suggestion.image_key is not None
            else None
        )
        formatted_suggestions.append(
            {
                "id": str(pairing_suggestion.id),
                "suggestionText": pairing_suggestion.suggestion_text,
                "imageUrl": image_url,
            },
        )

    return formatted_suggestions


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
    verdict: str | None,
    rationale: str | None,
    pairing_suggestions: list[dict[str, str | None]] | None = None,
    closet_insight: str | None = None,
    verdict_signals: list[dict[str, str | bool]] | None = None,
) -> dict[str, Any]:
    """Convert a scanned item row into the documented scan response shape."""
    # Routes that do not perform a pairing lookup still use the shared item
    # shape and leave suggestions empty.
    response = {
        "id": str(scanned_item.id),
        "photoUrl": photo_url,
        "detectedCategory": scanned_item.detected_category,
        "detectedColor": scanned_item.detected_color,
        "visualAttributes": scanned_item.visual_attributes,
        "correctedCategory": scanned_item.corrected_category,
        "correctedColor": scanned_item.corrected_color,
        "verdict": verdict,
        "rationale": rationale,
        "closetInsight": closet_insight,
        "fitStylingNote": compute_fit_styling_note(
            get_visual_attribute_fit(scanned_item),
        ),
        "verdictSignals": verdict_signals or [],
        "pairingSuggestions": pairing_suggestions or [],
        "savedToWardrobe": scanned_item.saved_to_wardrobe,
        "isFavorited": scanned_item.is_favorited,
        "createdAt": format_timestamp(scanned_item.created_at),
    }

    if classification_failed:
        response["classificationFailed"] = True

    return response


def get_visual_attribute_fit(scanned_item: ScannedItem) -> str | None:
    """Read the detected fit from optional visual-attributes JSON."""
    visual_attributes = scanned_item.visual_attributes or {}
    fit = visual_attributes.get("fit")
    return fit if isinstance(fit, str) else None


async def format_wardrobe_item(
    scanned_item: ScannedItem,
    verdict: str | None,
    rationale: str | None,
) -> dict[str, Any]:
    """Convert a saved scanned item row into the wardrobe list shape."""
    photo_url = await asyncio.to_thread(generate_photo_url, scanned_item.photo_key)
    return {
        "id": str(scanned_item.id),
        "photoUrl": photo_url,
        "detectedCategory": scanned_item.corrected_category
        or scanned_item.detected_category,
        "detectedColor": scanned_item.corrected_color or scanned_item.detected_color,
        "visualAttributes": scanned_item.visual_attributes,
        "verdict": verdict,
        "rationale": rationale,
        "isFavorited": scanned_item.is_favorited,
        "createdAt": format_timestamp(scanned_item.created_at),
    }


def build_verdict_preferences(preference: Preference | None) -> VerdictPreferences:
    """Convert a preference row into verdict-engine input."""
    return VerdictPreferences(
        preferred_colors=preference.preferred_colors if preference else [],
        preferred_fits=preference.preferred_fits if preference else [],
        formality_preference=preference.formality_preference if preference else None,
    )


def compute_item_verdict(
    scanned_item: ScannedItem,
    category: str,
    color: str,
    verdict_preferences: VerdictPreferences,
) -> VerdictResult:
    """Compute a verdict result from one item's effective attributes."""
    return compute_verdict(
        category=category,
        color=color,
        fit=get_visual_attribute_fit(scanned_item),
        preferences=verdict_preferences,
    )


async def apply_verdict_to_item(
    session: AsyncSession,
    current_user: User,
    scanned_item: ScannedItem,
    category: str,
    color: str,
) -> VerdictResult:
    """Compute, attach, and return the current user's verdict for one item."""
    preference = await get_user_preferences(session, current_user)
    verdict_result = compute_item_verdict(
        scanned_item,
        category,
        color,
        build_verdict_preferences(preference),
    )
    scanned_item.verdict = verdict_result.verdict
    scanned_item.rationale = verdict_result.rationale
    return verdict_result


def format_verdict_signals(verdict_result: Any) -> list[dict[str, str | bool]]:
    """Convert internal verdict signals into the compact API shape."""
    return [
        {"name": signal.name, "matches": signal.matches}
        for signal in verdict_result.signals
    ]


async def compute_live_verdict_for_item(
    session: AsyncSession,
    current_user: User,
    scanned_item: ScannedItem,
    verdict_preferences: VerdictPreferences | None = None,
) -> VerdictResult | None:
    """Recompute this item's verdict fresh from current preferences."""
    effective_category = (
        scanned_item.corrected_category or scanned_item.detected_category
    )
    effective_color = scanned_item.corrected_color or scanned_item.detected_color
    if not effective_category or not effective_color:
        return None

    if verdict_preferences is None:
        preference = await get_user_preferences(session, current_user)
        verdict_preferences = build_verdict_preferences(preference)

    return compute_verdict(
        category=effective_category,
        color=effective_color,
        fit=get_visual_attribute_fit(scanned_item),
        preferences=verdict_preferences,
    )


async def get_formatted_pairing_suggestions(
    session: AsyncSession,
    category: str,
    color: str,
) -> list[dict[str, str | None]]:
    """Look up and format pairing suggestions for item response payloads."""
    pairing_suggestions = await find_pairing_suggestions(session, category, color)
    return await format_pairing_suggestions(pairing_suggestions)


async def get_formatted_item_pairing_suggestions(
    session: AsyncSession,
    current_user: User,
    item_id: uuid.UUID,
    category: str,
    color: str,
) -> list[dict[str, str | None]]:
    """Look up wardrobe-sourced pairings before seed-dataset suggestions."""
    wardrobe_items = await find_wardrobe_pairing_suggestions(
        session,
        current_user,
        category,
        item_id,
    )
    wardrobe_suggestions = []
    for scanned_item in wardrobe_items:
        image_url = await asyncio.to_thread(generate_photo_url, scanned_item.photo_key)
        wardrobe_suggestions.append(
            format_wardrobe_pairing_suggestion(scanned_item, image_url),
        )
    remaining_count = MAX_PAIRING_SUGGESTIONS - len(wardrobe_suggestions)
    if remaining_count <= 0:
        return wardrobe_suggestions[:MAX_PAIRING_SUGGESTIONS]

    seed_suggestions = await get_formatted_pairing_suggestions(
        session,
        category,
        color,
    )
    return [
        *wardrobe_suggestions,
        *seed_suggestions[:remaining_count],
    ]


async def get_closet_insight_for_item(
    session: AsyncSession,
    current_user: User,
    scanned_item: ScannedItem,
) -> str | None:
    """Compute closet insight for an item's effective category and color."""
    effective_category = (
        scanned_item.corrected_category or scanned_item.detected_category
    )
    effective_color = scanned_item.corrected_color or scanned_item.detected_color
    if not effective_category or not effective_color:
        return None

    return await compute_closet_insight(
        session,
        current_user,
        effective_category,
        effective_color,
        fit=get_visual_attribute_fit(scanned_item),
        exclude_item_id=scanned_item.id,
    )


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


@app.get("/api/items")
async def get_items(
    verdict: Literal["buy", "maybe", "skip"] | None = None,
    favorited: Literal["true"] | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, list[dict[str, Any]]]:
    """Return saved wardrobe items scoped to the current user."""
    statement = (
        select(ScannedItem)
        .where(
            ScannedItem.user_id == current_user.id,
            ScannedItem.saved_to_wardrobe.is_(True),
        )
        .order_by(ScannedItem.created_at.desc())
    )

    if favorited == "true":
        statement = statement.where(ScannedItem.is_favorited.is_(True))

    result = await session.execute(statement)
    scanned_items = result.scalars().all()
    preference = await get_user_preferences(session, current_user)
    verdict_preferences = build_verdict_preferences(preference)

    formatted_items = []
    for scanned_item in scanned_items:
        verdict_result = await compute_live_verdict_for_item(
            session,
            current_user,
            scanned_item,
            verdict_preferences,
        )
        live_verdict = verdict_result.verdict if verdict_result else None
        if verdict is not None and live_verdict != verdict:
            continue

        formatted_items.append(
            await format_wardrobe_item(
                scanned_item,
                live_verdict,
                verdict_result.rationale if verdict_result else None,
            ),
        )

    return {"items": formatted_items}


@app.get("/api/items/{item_id}")
async def get_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Return one scanned item scoped to the current user."""
    scanned_item = await get_user_scanned_item(session, current_user, item_id)
    photo_url = await asyncio.to_thread(generate_photo_url, scanned_item.photo_key)

    # pairing_suggestions has no FK to scanned_items (see docs/DATABASE.md) —
    # it's looked up fresh on every fetch using the item's *effective*
    # category/color (a manual correction wins over the original CLIP
    # detection), not persisted at scan/correct time.
    effective_category = (
        scanned_item.corrected_category or scanned_item.detected_category
    )
    effective_color = scanned_item.corrected_color or scanned_item.detected_color
    pairing_suggestions = (
        await get_formatted_item_pairing_suggestions(
            session,
            current_user,
            scanned_item.id,
            effective_category,
            effective_color,
        )
        if effective_category and effective_color
        else []
    )
    verdict_result = await compute_live_verdict_for_item(
        session,
        current_user,
        scanned_item,
    )

    return format_scanned_item(
        scanned_item,
        photo_url,
        is_unresolved_classification(scanned_item),
        verdict_result.verdict if verdict_result else None,
        verdict_result.rationale if verdict_result else None,
        pairing_suggestions,
        await get_closet_insight_for_item(session, current_user, scanned_item),
        format_verdict_signals(verdict_result) if verdict_result else [],
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
    verdict_result = await apply_verdict_to_item(
        session,
        current_user,
        scanned_item,
        correction_request.corrected_category,
        correction_request.corrected_color,
    )

    await session.commit()
    await session.refresh(scanned_item)

    photo_url = await asyncio.to_thread(generate_photo_url, scanned_item.photo_key)
    pairing_suggestions = await get_formatted_item_pairing_suggestions(
        session,
        current_user,
        scanned_item.id,
        correction_request.corrected_category,
        correction_request.corrected_color,
    )
    return format_scanned_item(
        scanned_item,
        photo_url,
        False,
        verdict_result.verdict,
        verdict_result.rationale,
        pairing_suggestions,
        await get_closet_insight_for_item(session, current_user, scanned_item),
        format_verdict_signals(verdict_result),
    )


@app.get("/api/pairings")
async def get_pairings(
    category: str,
    color: str,
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, list[dict[str, str | None]]]:
    """Return pairing suggestions for category and color tags."""
    validate_taxonomy_value("category", category, CATEGORY_VALUES)
    validate_taxonomy_value("color", color, COLOR_VALUES)

    return {
        "suggestions": await get_formatted_pairing_suggestions(
            session,
            category,
            color,
        ),
    }


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


@app.patch("/api/items/{item_id}/favorite")
async def patch_item_favorite(
    item_id: uuid.UUID,
    favorite_request: FavoriteItemRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, str | bool]:
    """Persist favorite status for one item scoped to the current user."""
    scanned_item = await get_user_scanned_item(session, current_user, item_id)
    scanned_item.is_favorited = favorite_request.is_favorited

    await session.commit()
    await session.refresh(scanned_item)

    return {
        "id": str(scanned_item.id),
        "isFavorited": scanned_item.is_favorited,
    }


@app.delete("/api/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> None:
    """Delete one scanned item and its stored photo for the current user."""
    scanned_item = await get_user_scanned_item(session, current_user, item_id)
    await asyncio.to_thread(delete_item_photo, scanned_item.photo_key)
    await session.delete(scanned_item)
    await session.commit()


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
    classification_image = await asyncio.to_thread(remove_background, compressed_image)
    visual_attributes_task = asyncio.create_task(
        asyncio.to_thread(
            extract_visual_attributes,
            classification_image,
        ),
    )
    classification_task = asyncio.create_task(
        asyncio.to_thread(
            classify_image_bytes,
            classification_image,
        ),
    )

    try:
        classification = await classification_task
    except InferenceUnavailableError as error:
        visual_attributes_task.cancel()
        raise ApiError(
            status_code=502,
            code="inference_unavailable",
            message="Classification service is temporarily unavailable. Try again shortly.",
        ) from error
    visual_attributes = await visual_attributes_task

    item_id = uuid.uuid4()
    photo_key = f"items/{current_user.id}/{item_id}.jpg"
    await asyncio.to_thread(upload_item_photo, photo_key, compressed_image)

    scanned_item = ScannedItem(
        id=item_id,
        user_id=current_user.id,
        photo_key=photo_key,
        detected_category=classification.detected_category,
        detected_color=classification.detected_color,
        visual_attributes=(
            visual_attributes.to_api_dict() if visual_attributes is not None else None
        ),
        verdict=None,
        rationale=None,
    )
    if (
        not classification.classification_failed
        and classification.detected_category is not None
        and classification.detected_color is not None
    ):
        verdict_result = await apply_verdict_to_item(
            session,
            current_user,
            scanned_item,
            classification.detected_category,
            classification.detected_color,
        )
        pairing_suggestions = await get_formatted_item_pairing_suggestions(
            session,
            current_user,
            scanned_item.id,
            classification.detected_category,
            classification.detected_color,
        )
    else:
        verdict_result = None
        pairing_suggestions = []

    session.add(scanned_item)
    await session.commit()
    await session.refresh(scanned_item)

    photo_url = await asyncio.to_thread(generate_photo_url, photo_key)
    return format_scanned_item(
        scanned_item,
        photo_url,
        classification.classification_failed,
        verdict_result.verdict if verdict_result else None,
        verdict_result.rationale if verdict_result else None,
        pairing_suggestions,
        await get_closet_insight_for_item(session, current_user, scanned_item),
        format_verdict_signals(verdict_result) if verdict_result else [],
    )
