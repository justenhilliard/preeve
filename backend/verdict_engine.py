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
    preferred_fits: list[str]
    formality_preference: str | None


@dataclass(frozen=True)
class VerdictResult:
    verdict: str
    rationale: str


def format_preferred_colors(preferred_colors: list[str]) -> str:
    """Format preferred colors for rule-matrix rationale text."""
    return ", ".join(preferred_colors)


def format_preferred_fits(preferred_fits: list[str]) -> str:
    """Format preferred fits for rule-matrix rationale text."""
    return ", ".join(preferred_fits)


def format_formality_label(formality_value: str) -> str:
    """Format a stored formality enum value for human-readable rationale text."""
    return formality_value.replace("_", " ")


def resolve_implied_formality_label(category: str, formality_preference: str) -> str:
    """Choose the nearest compatible formality label for an incompatible category."""
    compatible_values = CATEGORY_FORMALITY_MAP[category]
    preference_index = FORMALITY_SCALE.index(formality_preference)

    # Formality can only fail for top/bottom with formal, or dress with
    # athleisure/casual. Outerwear, shoes, and accessory include every value
    # in the v1 coarse taxonomy.
    return min(
        compatible_values,
        key=lambda value: abs(FORMALITY_SCALE.index(value) - preference_index),
    )


@dataclass(frozen=True)
class VerdictSignal:
    name: str
    matches: bool
    matched_clause: str
    failed_clause: str


def join_clauses(clauses: list[str]) -> str:
    """Join rationale clauses into one readable sentence fragment."""
    if len(clauses) == 1:
        return clauses[0]

    if len(clauses) == 2:
        return f"{clauses[0]}, and {clauses[1]}"

    return f"{', '.join(clauses[:-1])}, and {clauses[-1]}"


def build_verdict_signals(
    category: str,
    color: str,
    fit: str | None,
    preferences: VerdictPreferences,
) -> list[VerdictSignal]:
    """Build applicable preference signals for the fixed verdict matrix."""
    signals: list[VerdictSignal] = []

    if preferences.preferred_colors:
        signals.append(
            VerdictSignal(
                name="color",
                matches=color in preferences.preferred_colors,
                matched_clause=f"{color} is in your preferred palette",
                failed_clause=(
                    f"{color} isn't in your preferred palette "
                    f"({format_preferred_colors(preferences.preferred_colors)})"
                ),
            ),
        )

    if preferences.preferred_fits and fit is not None:
        signals.append(
            VerdictSignal(
                name="fit",
                matches=fit in preferences.preferred_fits,
                matched_clause=f"this {fit} fit matches your style",
                failed_clause=(
                    f"this {fit} fit isn't among your preferred fits "
                    f"({format_preferred_fits(preferences.preferred_fits)})"
                ),
            ),
        )

    if preferences.formality_preference is not None:
        formality_preference = preferences.formality_preference
        formality_matches = formality_preference in CATEGORY_FORMALITY_MAP[category]
        implied_formality_label = resolve_implied_formality_label(
            category,
            formality_preference,
        )
        signals.append(
            VerdictSignal(
                name="formality",
                matches=formality_matches,
                matched_clause=(
                    f"{category} fits your "
                    f"{format_formality_label(formality_preference)} preference"
                ),
                failed_clause=(
                    f"{category} typically leans more toward "
                    f"{format_formality_label(implied_formality_label)} than "
                    f"your {format_formality_label(formality_preference)} "
                    "preference"
                ),
            ),
        )

    return signals


def compute_verdict(
    category: str,
    color: str,
    fit: str | None,
    preferences: VerdictPreferences,
) -> VerdictResult:
    """Compute a deterministic verdict and rationale from item attributes."""
    signals = build_verdict_signals(category, color, fit, preferences)

    if not signals:
        return VerdictResult(
            verdict="maybe",
            rationale="Set your style preferences to get a personalized verdict.",
        )

    matched_clauses = [
        signal.matched_clause
        for signal in signals
        if signal.matches
    ]
    failed_clauses = [
        signal.failed_clause
        for signal in signals
        if not signal.matches
    ]

    if not matched_clauses:
        return VerdictResult(
            verdict="skip",
            rationale=f"{join_clauses(failed_clauses)}.",
        )

    if not failed_clauses:
        return VerdictResult(
            verdict="buy",
            rationale=f"{join_clauses(matched_clauses)}.",
        )

    return VerdictResult(
        verdict="maybe",
        rationale=(
            f"{join_clauses(matched_clauses)}, but "
            f"{join_clauses(failed_clauses)}."
        ),
    )
