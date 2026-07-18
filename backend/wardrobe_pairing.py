from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import ScannedItem, User
from pairing_lookup import MAX_PAIRING_SUGGESTIONS

COMPLEMENTARY_CATEGORY_MAP = {
    "top": ("bottom", "outerwear", "shoes", "accessory"),
    "bottom": ("top", "outerwear", "shoes", "accessory"),
    "dress": ("outerwear", "shoes", "accessory"),
    "outerwear": ("top", "bottom", "dress", "shoes", "accessory"),
    "shoes": ("top", "bottom", "dress", "outerwear", "accessory"),
    "accessory": ("top", "bottom", "dress", "outerwear", "shoes"),
}

DEFAULT_ITEM_LABEL = "saved item"


def get_effective_item_attributes(
    scanned_item: ScannedItem,
) -> tuple[str | None, str | None]:
    """Return corrected category/color when present, otherwise detected values."""
    return (
        scanned_item.corrected_category or scanned_item.detected_category,
        scanned_item.corrected_color or scanned_item.detected_color,
    )


def format_visual_attribute(value: str) -> str:
    """Format one stored visual attribute for a user-facing label."""
    return " ".join(
        word.capitalize()
        for word in value.replace("_", " ").split()
        if word
    )


def format_visual_attributes_label(visual_attributes: dict) -> str | None:
    """Format stored visual attributes using the frontend item-label pattern."""
    garment_type = visual_attributes.get("garmentType")
    primary_color = visual_attributes.get("primaryColor")
    secondary_colors = visual_attributes.get("secondaryColors") or []
    secondary_color = secondary_colors[0] if secondary_colors else None

    if not isinstance(garment_type, str) or not garment_type.strip():
        return None

    colors = [
        color
        for color in (primary_color, secondary_color)
        if isinstance(color, str) and color.strip()
    ]
    formatted_colors = "/".join(format_visual_attribute(color) for color in colors)
    formatted_garment_type = format_visual_attribute(garment_type)

    return (
        f"{formatted_colors} {formatted_garment_type}"
        if formatted_colors
        else formatted_garment_type
    )


def format_item_display_label(scanned_item: ScannedItem) -> str:
    """Format a saved wardrobe item label for suggestion text."""
    visual_attributes = scanned_item.visual_attributes
    if isinstance(visual_attributes, dict):
        visual_label = format_visual_attributes_label(visual_attributes)
        if visual_label is not None:
            return visual_label

    category, color = get_effective_item_attributes(scanned_item)
    if category and color:
        return f"{format_visual_attribute(color)} {format_visual_attribute(category)}"

    return DEFAULT_ITEM_LABEL


def is_complementary_item(scanned_item: ScannedItem, category: str) -> bool:
    """Return whether a saved item complements the scanned category."""
    item_category, _ = get_effective_item_attributes(scanned_item)
    return item_category in COMPLEMENTARY_CATEGORY_MAP.get(category, ())


async def find_wardrobe_pairing_suggestions(
    session: AsyncSession,
    current_user: User,
    category: str,
    exclude_item_id: uuid.UUID,
) -> list[ScannedItem]:
    """Find saved wardrobe items that complement a scanned item category."""
    result = await session.execute(
        select(ScannedItem)
        .where(
            ScannedItem.user_id == current_user.id,
            ScannedItem.saved_to_wardrobe.is_(True),
        )
        .order_by(ScannedItem.created_at.desc()),
    )
    saved_items = result.scalars().all()
    complementary_items = [
        scanned_item
        for scanned_item in saved_items
        if scanned_item.user_id == current_user.id
        and scanned_item.saved_to_wardrobe
        and scanned_item.id != exclude_item_id
        and is_complementary_item(scanned_item, category)
    ]

    return sorted(
        complementary_items,
        key=lambda scanned_item: scanned_item.created_at,
        reverse=True,
    )[:MAX_PAIRING_SUGGESTIONS]


def format_wardrobe_pairing_suggestion(
    scanned_item: ScannedItem,
    image_url: str,
) -> dict[str, str | None]:
    """Format one wardrobe-sourced pairing suggestion for the API."""
    label = format_item_display_label(scanned_item)
    return {
        "id": f"wardrobe-{scanned_item.id}",
        "suggestionText": f"Pairs with the {label} you saved.",
        "imageUrl": image_url,
    }
