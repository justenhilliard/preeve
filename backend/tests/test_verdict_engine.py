from verdict_engine import VerdictPreferences, VerdictResult, compute_verdict


def test_onboarding_incomplete_returns_maybe() -> None:
    result = compute_verdict(
        category="top",
        color="blue",
        preferences=VerdictPreferences(
            preferred_colors=[],
            formality_preference=None,
        ),
    )

    assert result == VerdictResult(
        verdict="maybe",
        rationale="Set your style preferences to get a personalized verdict.",
    )


def test_rule_one_skips_color_outside_palette_before_formality() -> None:
    result = compute_verdict(
        category="dress",
        color="red",
        preferences=VerdictPreferences(
            preferred_colors=["blue", "black"],
            formality_preference="athleisure",
        ),
    )

    assert result == VerdictResult(
        verdict="skip",
        rationale="red isn't in your preferred palette (blue, black).",
    )


def test_rule_two_top_with_formal_preference_returns_maybe() -> None:
    result = compute_verdict(
        category="top",
        color="blue",
        preferences=VerdictPreferences(
            preferred_colors=["blue"],
            formality_preference="formal",
        ),
    )

    assert result == VerdictResult(
        verdict="maybe",
        rationale=(
            "blue matches your palette, but top typically leans more toward "
            "business_casual than your formal preference."
        ),
    )


def test_rule_two_bottom_with_formal_preference_returns_maybe() -> None:
    result = compute_verdict(
        category="bottom",
        color="navy",
        preferences=VerdictPreferences(
            preferred_colors=["navy"],
            formality_preference="formal",
        ),
    )

    assert result == VerdictResult(
        verdict="maybe",
        rationale=(
            "navy matches your palette, but bottom typically leans more toward "
            "business_casual than your formal preference."
        ),
    )


def test_rule_two_dress_with_athleisure_preference_returns_maybe() -> None:
    result = compute_verdict(
        category="dress",
        color="black",
        preferences=VerdictPreferences(
            preferred_colors=["black"],
            formality_preference="athleisure",
        ),
    )

    assert result == VerdictResult(
        verdict="maybe",
        rationale=(
            "black matches your palette, but dress typically leans more toward "
            "smart_casual than your athleisure preference."
        ),
    )


def test_rule_two_dress_with_casual_preference_returns_maybe() -> None:
    result = compute_verdict(
        category="dress",
        color="green",
        preferences=VerdictPreferences(
            preferred_colors=["green"],
            formality_preference="casual",
        ),
    )

    assert result == VerdictResult(
        verdict="maybe",
        rationale=(
            "green matches your palette, but dress typically leans more toward "
            "smart_casual than your casual preference."
        ),
    )


def test_rule_three_plain_buy_without_formality() -> None:
    result = compute_verdict(
        category="shoes",
        color="white",
        preferences=VerdictPreferences(
            preferred_colors=["white"],
            formality_preference=None,
        ),
    )

    assert result == VerdictResult(
        verdict="buy",
        rationale="white is in your preferred palette.",
    )


def test_rule_three_buy_appends_formality_clause() -> None:
    result = compute_verdict(
        category="top",
        color="olive",
        preferences=VerdictPreferences(
            preferred_colors=["olive"],
            formality_preference="smart_casual",
        ),
    )

    assert result == VerdictResult(
        verdict="buy",
        rationale=(
            "olive is in your preferred palette, and top fits your "
            "smart_casual preference."
        ),
    )


def test_coarse_categories_never_trigger_rule_two() -> None:
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
                preferences=VerdictPreferences(
                    preferred_colors=["black"],
                    formality_preference=formality_preference,
                ),
            )

            assert result.verdict == "buy"
            assert "typically leans more toward" not in result.rationale


def test_verdict_engine_is_deterministic() -> None:
    preferences = VerdictPreferences(
        preferred_colors=["blue", "black"],
        formality_preference="business_casual",
    )

    first_result = compute_verdict("top", "blue", preferences)
    second_result = compute_verdict("top", "blue", preferences)

    assert first_result == second_result
    assert first_result.rationale == second_result.rationale
