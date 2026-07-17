from __future__ import annotations

from dataclasses import dataclass

FORMALITY_SCALE = (
    "athleisure",
    "casual",
    "smart_casual",
    "business_casual",
    "formal",
)

CATEGORY_FORMALITY_MAP = {
    "top": ("athleisure", "casual", "smart_casual", "business_casual"),
    "bottom": ("athleisure", "casual", "smart_casual", "business_casual"),
    "dress": ("smart_casual", "business_casual", "formal"),
    "outerwear": FORMALITY_SCALE,
    "shoes": FORMALITY_SCALE,
    "accessory": FORMALITY_SCALE,
}


@dataclass(frozen=True)
class VerdictPreferences:
    preferred_colors: list[str]
    formality_preference: str | None


@dataclass(frozen=True)
class VerdictResult:
    verdict: str
    rationale: str


def format_preferred_colors(preferred_colors: list[str]) -> str:
    """Format preferred colors for rule-matrix rationale text."""
    return ", ".join(preferred_colors)


def format_formality_label(formality_value: str) -> str:
    """Format a stored formality enum value for human-readable rationale text."""
    return formality_value.replace("_", " ")


def resolve_implied_formality_label(category: str, formality_preference: str) -> str:
    """Choose the nearest compatible formality label for an incompatible category."""
    compatible_values = CATEGORY_FORMALITY_MAP[category]
    preference_index = FORMALITY_SCALE.index(formality_preference)

    # Rule 2 can only fire for top/bottom with formal, or dress with
    # athleisure/casual. Outerwear, shoes, and accessory include every value
    # in the v1 coarse taxonomy, so this nearest-label path is unreachable
    # for them unless the locked CATEGORY_FORMALITY_MAP changes later.
    return min(
        compatible_values,
        key=lambda value: abs(FORMALITY_SCALE.index(value) - preference_index),
    )


def compute_verdict(
    category: str,
    color: str,
    preferences: VerdictPreferences,
) -> VerdictResult:
    """Compute a deterministic verdict and rationale from item attributes."""
    preferred_colors = preferences.preferred_colors
    formality_preference = preferences.formality_preference

    if not preferred_colors and formality_preference is None:
        return VerdictResult(
            verdict="maybe",
            rationale="Set your style preferences to get a personalized verdict.",
        )

    if preferred_colors and color not in preferred_colors:
        return VerdictResult(
            verdict="skip",
            rationale=(
                f"{color} isn't in your preferred palette "
                f"({format_preferred_colors(preferred_colors)})."
            ),
        )

    if (
        formality_preference is not None
        and formality_preference not in CATEGORY_FORMALITY_MAP[category]
    ):
        implied_formality_label = resolve_implied_formality_label(
            category,
            formality_preference,
        )
        return VerdictResult(
            verdict="maybe",
            rationale=(
                f"{color} matches your palette, but {category} typically "
                f"leans more toward {format_formality_label(implied_formality_label)} "
                f"than your {format_formality_label(formality_preference)} preference."
            ),
        )

    rationale = f"{color} is in your preferred palette."
    if formality_preference is not None:
        rationale = (
            f"{color} is in your preferred palette, and {category} fits "
            f"your {format_formality_label(formality_preference)} preference."
        )

    return VerdictResult(verdict="buy", rationale=rationale)
