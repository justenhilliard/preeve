import asyncio
import uuid

from closet_insight import compute_closet_insight
from models import ScannedItem, User


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
    item_id: uuid.UUID | None = None,
    fit: str | None = None,
) -> ScannedItem:
    return ScannedItem(
        id=item_id or uuid.uuid4(),
        user_id=user.id,
        photo_key="items/test/item.jpg",
        detected_category=category,
        detected_color=color,
        visual_attributes={"fit": fit} if fit is not None else None,
        saved_to_wardrobe=True,
    )


def test_existing_match_returns_counted_insight() -> None:
    user = make_user()
    session = FakeSession(
        [
            make_saved_item(user, "top", "navy"),
            make_saved_item(user, "top", "navy"),
            make_saved_item(user, "bottom", "navy"),
        ],
    )

    insight = asyncio.run(
        compute_closet_insight(session, user, "top", "navy"),
    )

    assert insight == "You already have 2 other navy top items in your wardrobe."


def test_new_color_returns_color_gap_insight() -> None:
    user = make_user()
    session = FakeSession(
        [
            make_saved_item(user, "top", "black"),
            make_saved_item(user, "bottom", "white"),
        ],
    )

    insight = asyncio.run(
        compute_closet_insight(session, user, "top", "burgundy"),
    )

    assert (
        insight
        == "This adds burgundy to your wardrobe - you haven't saved anything "
        "in that color yet."
    )


def test_existing_color_without_category_match_returns_none() -> None:
    user = make_user()
    session = FakeSession(
        [
            make_saved_item(user, "bottom", "navy"),
            make_saved_item(user, "shoes", "black"),
        ],
    )

    insight = asyncio.run(
        compute_closet_insight(session, user, "top", "navy"),
    )

    assert insight is None


def test_fit_variety_returns_most_common_other_fit() -> None:
    user = make_user()
    session = FakeSession(
        [
            make_saved_item(user, "top", "navy", fit="relaxed"),
            make_saved_item(user, "bottom", "navy", fit="relaxed"),
            make_saved_item(user, "shoes", "navy", fit="tailored"),
        ],
    )

    insight = asyncio.run(
        compute_closet_insight(session, user, "accessory", "navy", fit="slim"),
    )

    assert insight == (
        "This slim fit adds variety - your saved pieces lean toward relaxed."
    )


def test_fit_variety_ties_break_alphabetically() -> None:
    user = make_user()
    session = FakeSession(
        [
            make_saved_item(user, "top", "navy", fit="tailored"),
            make_saved_item(user, "bottom", "navy", fit="relaxed"),
        ],
    )

    insight = asyncio.run(
        compute_closet_insight(session, user, "accessory", "navy", fit="slim"),
    )

    assert insight == (
        "This slim fit adds variety - your saved pieces lean toward relaxed."
    )


def test_fit_variety_does_not_fire_when_matching_fit_exists() -> None:
    user = make_user()
    session = FakeSession(
        [
            make_saved_item(user, "top", "navy", fit="relaxed"),
            make_saved_item(user, "bottom", "navy", fit="slim"),
        ],
    )

    insight = asyncio.run(
        compute_closet_insight(session, user, "accessory", "navy", fit="slim"),
    )

    assert insight is None


def test_fit_variety_does_not_fire_with_fewer_than_two_comparable_fits() -> None:
    user = make_user()
    session = FakeSession(
        [
            make_saved_item(user, "top", "navy", fit="relaxed"),
            make_saved_item(user, "bottom", "navy"),
        ],
    )

    insight = asyncio.run(
        compute_closet_insight(session, user, "accessory", "navy", fit="slim"),
    )

    assert insight is None


def test_fit_variety_does_not_fire_without_item_fit() -> None:
    user = make_user()
    session = FakeSession(
        [
            make_saved_item(user, "top", "navy", fit="relaxed"),
            make_saved_item(user, "bottom", "navy", fit="tailored"),
        ],
    )

    insight = asyncio.run(
        compute_closet_insight(session, user, "accessory", "navy", fit=None),
    )

    assert insight is None


def test_category_color_insight_takes_priority_over_fit_variety() -> None:
    user = make_user()
    session = FakeSession(
        [
            make_saved_item(user, "top", "navy", fit="relaxed"),
            make_saved_item(user, "bottom", "navy", fit="tailored"),
            make_saved_item(user, "top", "navy", fit="straight"),
        ],
    )

    insight = asyncio.run(
        compute_closet_insight(session, user, "top", "navy", fit="slim"),
    )

    assert insight == "You already have 2 other navy top items in your wardrobe."


def test_excluded_current_item_is_not_counted_as_other() -> None:
    user = make_user()
    current_item_id = uuid.uuid4()
    session = FakeSession(
        [
            make_saved_item(user, "top", "navy", current_item_id),
        ],
    )

    insight = asyncio.run(
        compute_closet_insight(
            session,
            user,
            "top",
            "navy",
            exclude_item_id=current_item_id,
        ),
    )

    assert insight is None
