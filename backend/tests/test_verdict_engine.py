from verdict_engine import VerdictPreferences, VerdictResult, compute_verdict


def make_preferences(
    preferred_colors: list[str] | None = None,
    preferred_fits: list[str] | None = None,
    formality_preference: str | None = None,
) -> VerdictPreferences:
    """Build verdict preferences with concise test defaults."""
    return VerdictPreferences(
        preferred_colors=preferred_colors or [],
        preferred_fits=preferred_fits or [],
        formality_preference=formality_preference,
    )


def assert_verdict_result(
    result: VerdictResult,
    verdict: str,
    rationale: str,
) -> None:
    """Assert the persisted verdict fields without coupling every test to signals."""
    assert result.verdict == verdict
    assert result.rationale == rationale


def format_signal_summary(result: VerdictResult) -> list[dict[str, bool]]:
    return [
        {"name": signal.name, "matches": signal.matches}
        for signal in result.signals
    ]


def test_no_applicable_signals_returns_maybe() -> None:
    result = compute_verdict(
        category="top",
        color="blue",
        fit=None,
        preferences=make_preferences(),
    )

    assert_verdict_result(
        result,
        "maybe",
        "Set your style preferences to get a personalized verdict.",
    )


def test_all_applicable_signals_match_returns_buy() -> None:
    result = compute_verdict(
        category="top",
        color="blue",
        fit="slim",
        preferences=make_preferences(
            preferred_colors=["blue", "black"],
            preferred_fits=["slim", "tailored"],
            formality_preference="smart_casual",
        ),
    )

    assert_verdict_result(
        result,
        "buy",
        (
            "blue is in your preferred palette, this slim fit matches your "
            "style, and top fits your smart casual preference."
        ),
    )


def test_all_applicable_signals_fail_returns_skip() -> None:
    result = compute_verdict(
        category="dress",
        color="red",
        fit="slim",
        preferences=make_preferences(
            preferred_colors=["blue", "black"],
            preferred_fits=["relaxed", "oversized"],
            formality_preference="casual",
        ),
    )

    assert_verdict_result(
        result,
        "skip",
        (
            "red isn't in your preferred palette (blue, black), this slim fit "
            "isn't among your preferred fits (relaxed, oversized), and dress "
            "typically leans more toward smart casual than your casual "
            "preference."
        ),
    )


def test_color_match_and_fit_mismatch_returns_maybe() -> None:
    result = compute_verdict(
        category="shoes",
        color="black",
        fit="fitted",
        preferences=make_preferences(
            preferred_colors=["black"],
            preferred_fits=["relaxed"],
        ),
    )

    assert_verdict_result(
        result,
        "maybe",
        (
            "black is in your preferred palette, but this fitted fit isn't "
            "among your preferred fits (relaxed)."
        ),
    )


def test_color_mismatch_and_fit_match_returns_maybe() -> None:
    result = compute_verdict(
        category="bottom",
        color="tan",
        fit="baggy",
        preferences=make_preferences(
            preferred_colors=["blue", "navy"],
            preferred_fits=["baggy", "relaxed"],
        ),
    )

    assert_verdict_result(
        result,
        "maybe",
        (
            "this baggy fit matches your style, but tan isn't in your "
            "preferred palette (blue, navy)."
        ),
    )


def test_fit_without_preference_is_not_applicable() -> None:
    result = compute_verdict(
        category="top",
        color="blue",
        fit="slim",
        preferences=make_preferences(preferred_colors=["blue"]),
    )

    assert_verdict_result(
        result,
        "buy",
        "blue is in your preferred palette.",
    )


def test_missing_item_fit_is_not_applicable() -> None:
    result = compute_verdict(
        category="top",
        color="tan",
        fit=None,
        preferences=make_preferences(
            preferred_colors=["blue"],
            preferred_fits=["slim"],
            formality_preference="business_casual",
        ),
    )

    assert_verdict_result(
        result,
        "maybe",
        (
            "top fits your business casual preference, but tan isn't in your "
            "preferred palette (blue)."
        ),
    )


def test_formality_incompatible_color_match_returns_maybe() -> None:
    result = compute_verdict(
        category="dress",
        color="black",
        fit=None,
        preferences=make_preferences(
            preferred_colors=["black"],
            formality_preference="athleisure",
        ),
    )

    assert_verdict_result(
        result,
        "maybe",
        (
            "black is in your preferred palette, but dress typically leans "
            "more toward smart casual than your athleisure preference."
        ),
    )


def test_formality_only_match_returns_buy() -> None:
    result = compute_verdict(
        category="outerwear",
        color="orange",
        fit=None,
        preferences=make_preferences(formality_preference="formal"),
    )

    assert_verdict_result(
        result,
        "buy",
        "outerwear fits your formal preference.",
    )


def test_coarse_categories_never_fail_formality_signal() -> None:
    for category in ("outerwear", "shoes", "accessory"):
        for formality_preference in (
            "athleisure",
            "casual",
            "smart_casual",
            "business_casual",
            "formal",
        ):
            result = compute_verdict(
                category=category,
                color="black",
                fit=None,
                preferences=make_preferences(
                    preferred_colors=["black"],
                    formality_preference=formality_preference,
                ),
            )

            assert result.verdict == "buy"
            assert "typically leans more toward" not in result.rationale


def test_verdict_engine_is_deterministic() -> None:
    preferences = make_preferences(
        preferred_colors=["blue", "black"],
        preferred_fits=["tailored"],
        formality_preference="business_casual",
    )

    first_result = compute_verdict("top", "blue", "tailored", preferences)
    second_result = compute_verdict("top", "blue", "tailored", preferences)

    assert first_result == second_result
    assert first_result.rationale == second_result.rationale


def test_result_signals_include_only_applicable_signals() -> None:
    result = compute_verdict(
        category="top",
        color="blue",
        fit=None,
        preferences=make_preferences(
            preferred_colors=["blue"],
            preferred_fits=["slim"],
            formality_preference="formal",
        ),
    )

    assert format_signal_summary(result) == [
        {"name": "color", "matches": True},
        {"name": "formality", "matches": False},
    ]


def test_result_signals_include_color_fit_and_formality_matches() -> None:
    result = compute_verdict(
        category="bottom",
        color="tan",
        fit="relaxed",
        preferences=make_preferences(
            preferred_colors=["blue"],
            preferred_fits=["relaxed"],
            formality_preference="business_casual",
        ),
    )

    assert format_signal_summary(result) == [
        {"name": "color", "matches": False},
        {"name": "fit", "matches": True},
        {"name": "formality", "matches": True},
    ]
