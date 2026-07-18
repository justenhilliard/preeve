from __future__ import annotations

import uuid
from collections import Counter

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import ScannedItem, User


def get_effective_item_attributes(scanned_item: ScannedItem) -> tuple[str | None, str | None]:
    """Return corrected category/color when present, otherwise detected values."""
    return (
        scanned_item.corrected_category or scanned_item.detected_category,
        scanned_item.corrected_color or scanned_item.detected_color,
    )


def format_item_count(count: int) -> str:
    """Format the item-count noun for closet insight templates."""
    return "item" if count == 1 else "items"


def get_visual_attribute_fit(scanned_item: ScannedItem) -> str | None:
    """Read a saved item's detected fit from optional visual attributes."""
    visual_attributes = scanned_item.visual_attributes or {}
    fit = visual_attributes.get("fit")
    return fit if isinstance(fit, str) else None


def resolve_most_common_fit(fits: list[str]) -> str:
    """Return the most frequent fit, breaking ties alphabetically."""
    fit_counts = Counter(fits)
    return min(
        fit_counts,
        key=lambda fit: (-fit_counts[fit], fit),
    )


async def compute_closet_insight(
    session: AsyncSession,
    current_user: User,
    category: str,
    color: str,
    fit: str | None = None,
    exclude_item_id: uuid.UUID | None = None,
) -> str | None:
    """Compute a deterministic wardrobe-context insight for one item."""
    result = await session.execute(
        select(ScannedItem).where(
            ScannedItem.user_id == current_user.id,
            ScannedItem.saved_to_wardrobe.is_(True),
        ),
    )
    saved_items = result.scalars().all()
    comparable_items = [
        scanned_item
        for scanned_item in saved_items
        if exclude_item_id is None or scanned_item.id != exclude_item_id
    ]

    same_category_and_color_count = 0
    same_color_count = 0
    for scanned_item in comparable_items:
        item_category, item_color = get_effective_item_attributes(scanned_item)
        if item_color == color:
            same_color_count += 1
            if item_category == category:
                same_category_and_color_count += 1

    if same_category_and_color_count > 0:
        item_count = format_item_count(same_category_and_color_count)
        return (
            f"You already have {same_category_and_color_count} other {color} "
            f"{category} {item_count} in your wardrobe."
        )

    if comparable_items and same_color_count == 0:
        return (
            f"This adds {color} to your wardrobe - you haven't saved anything "
            "in that color yet."
        )

    comparable_fits = [
        item_fit
        for scanned_item in comparable_items
        if (item_fit := get_visual_attribute_fit(scanned_item)) is not None
    ]
    if (
        fit is not None
        and len(comparable_fits) >= 2
        and fit not in comparable_fits
    ):
        most_common_fit = resolve_most_common_fit(comparable_fits)
        return (
            f"This {fit} fit adds variety - your saved pieces lean toward "
            f"{most_common_fit}."
        )

    return None
