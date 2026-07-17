from __future__ import annotations

import uuid

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


async def compute_closet_insight(
    session: AsyncSession,
    current_user: User,
    category: str,
    color: str,
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

    return None
