import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from models import ScannedItem, User
from pairing_lookup import MAX_PAIRING_SUGGESTIONS
from wardrobe_pairing import (
    format_item_display_label,
    format_wardrobe_pairing_suggestion,
    find_wardrobe_pairing_suggestions,
)


class FakeScalarResult:
    def __init__(self, items: list[ScannedItem]) -> None:
        self.items = items

    def scalars(self) -> "FakeScalarResult":
        return self

    def all(self) -> list[ScannedItem]:
        return self.items


class FakeSession:
    def __init__(self, items: list[ScannedItem]) -> None:
        self.items = items

    async def execute(self, _statement) -> FakeScalarResult:
        return FakeScalarResult(self.items)


def make_user() -> User:
    return User(
        id=uuid.uuid4(),
        auth_provider_id="user_test",
        email="test@example.com",
    )


def make_saved_item(
    user: User,
    category: str,
    color: str,
    *,
    item_id: uuid.UUID | None = None,
    created_at: datetime | None = None,
    photo_key: str | None = None,
    saved_to_wardrobe: bool = True,
    corrected_category: str | None = None,
    corrected_color: str | None = None,
    visual_attributes: dict | None = None,
) -> ScannedItem:
    item_uuid = item_id or uuid.uuid4()
    return ScannedItem(
        id=item_uuid,
        user_id=user.id,
        photo_key=photo_key or f"items/test/{item_uuid}.jpg",
        detected_category=category,
        detected_color=color,
        corrected_category=corrected_category,
        corrected_color=corrected_color,
        visual_attributes=visual_attributes,
        saved_to_wardrobe=saved_to_wardrobe,
        created_at=created_at or datetime.now(timezone.utc),
    )


def test_finds_complementary_saved_items_most_recent_first() -> None:
    user = make_user()
    current_item_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    older_bottom = make_saved_item(
        user,
        "bottom",
        "tan",
        created_at=now - timedelta(days=2),
    )
    newer_shoes = make_saved_item(
        user,
        "shoes",
        "black",
        created_at=now - timedelta(days=1),
    )
    session = FakeSession(
        [
            make_saved_item(user, "top", "navy", item_id=current_item_id),
            older_bottom,
            make_saved_item(user, "top", "white"),
            newer_shoes,
            make_saved_item(user, "accessory", "olive", saved_to_wardrobe=False),
        ],
    )

    suggestions = asyncio.run(
        find_wardrobe_pairing_suggestions(
            session,
            user,
            "top",
            current_item_id,
        ),
    )

    assert suggestions == [newer_shoes, older_bottom]


def test_wardrobe_lookup_does_not_require_color_matching() -> None:
    user = make_user()
    bottom = make_saved_item(user, "bottom", "tan")
    session = FakeSession([bottom])

    suggestions = asyncio.run(
        find_wardrobe_pairing_suggestions(
            session,
            user,
            "top",
            uuid.uuid4(),
        ),
    )

    assert suggestions == [bottom]


def test_wardrobe_lookup_limits_to_max_pairing_suggestions() -> None:
    user = make_user()
    now = datetime.now(timezone.utc)
    session = FakeSession(
        [
            make_saved_item(
                user,
                "bottom",
                "tan",
                created_at=now - timedelta(minutes=index),
            )
            for index in range(MAX_PAIRING_SUGGESTIONS + 2)
        ],
    )

    suggestions = asyncio.run(
        find_wardrobe_pairing_suggestions(
            session,
            user,
            "top",
            uuid.uuid4(),
        ),
    )

    assert len(suggestions) == MAX_PAIRING_SUGGESTIONS


def test_item_label_prefers_visual_attributes_and_caps_colors() -> None:
    user = make_user()
    scanned_item = make_saved_item(
        user,
        "top",
        "navy",
        visual_attributes={
            "garmentType": "tank top",
            "primaryColor": "cream",
            "secondaryColors": ["white", "orange"],
        },
    )

    assert format_item_display_label(scanned_item) == "Cream/White Tank Top"


def test_item_label_falls_back_to_effective_category_and_color() -> None:
    user = make_user()
    scanned_item = make_saved_item(
        user,
        "top",
        "navy",
        corrected_category="bottom",
        corrected_color="olive",
    )

    assert format_item_display_label(scanned_item) == "Olive Bottom"


def test_formats_wardrobe_pairing_suggestion_with_real_photo_url() -> None:
    user = make_user()
    scanned_item = make_saved_item(
        user,
        "shoes",
        "black",
        visual_attributes={
            "garmentType": "loafers",
            "primaryColor": "black",
        },
    )

    suggestion = format_wardrobe_pairing_suggestion(
        scanned_item,
        f"https://cdn.example.test/{scanned_item.photo_key}",
    )

    assert suggestion == {
        "id": f"wardrobe-{scanned_item.id}",
        "suggestionText": "Pairs with the Black Loafers you saved.",
        "imageUrl": f"https://cdn.example.test/{scanned_item.photo_key}",
    }
