from fit_styling import compute_fit_styling_note
from models import FIT_VALUES


EXPECTED_FIT_NOTES = {
    "baggy": "Balance the volume with a fitted top or cropped layer.",
    "oversized": "Balance the relaxed volume with a slimmer-fit bottom.",
    "relaxed": "Pair with something fitted to keep the silhouette balanced.",
    "cropped": "Pairs well with a higher-rise bottom for balanced proportions.",
    "fitted": "Layer with something looser to avoid an overly tight overall look.",
    "slim": "Pairs cleanly with looser or relaxed pieces for contrast.",
    "tailored": "Keep the rest of the outfit clean and structured to match.",
    "straight": "A versatile base cut that works with fitted or relaxed pieces.",
}


def test_every_supported_fit_has_a_styling_note() -> None:
    assert set(EXPECTED_FIT_NOTES) == set(FIT_VALUES)

    for fit, expected_note in EXPECTED_FIT_NOTES.items():
        assert compute_fit_styling_note(fit) == expected_note


def test_null_fit_returns_no_styling_note() -> None:
    assert compute_fit_styling_note(None) is None
