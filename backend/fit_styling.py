from __future__ import annotations

from models import FIT_VALUES

FIT_STYLING_NOTES = {
    "baggy": "Balance the volume with a fitted top or cropped layer.",
    "oversized": "Balance the relaxed volume with a slimmer-fit bottom.",
    "relaxed": "Pair with something fitted to keep the silhouette balanced.",
    "cropped": "Pairs well with a higher-rise bottom for balanced proportions.",
    "fitted": "Layer with something looser to avoid an overly tight overall look.",
    "slim": "Pairs cleanly with looser or relaxed pieces for contrast.",
    "tailored": "Keep the rest of the outfit clean and structured to match.",
    "straight": "A versatile base cut that works with fitted or relaxed pieces.",
}


def compute_fit_styling_note(fit: str | None) -> str | None:
    """Return a deterministic styling note for a detected fit."""
    if fit is None:
        return None

    return FIT_STYLING_NOTES.get(fit)


def validate_fit_styling_notes() -> None:
    """Ensure every supported fit has exactly one deterministic note."""
    if set(FIT_STYLING_NOTES) != set(FIT_VALUES):
        raise RuntimeError("FIT_STYLING_NOTES must cover every FIT_VALUES entry.")
