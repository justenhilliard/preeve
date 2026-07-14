import asyncio
import uuid

from models import PairingSuggestion
from pairing_lookup import find_pairing_suggestions


class FakeScalarResult:
    def __init__(self, suggestions: list[PairingSuggestion]) -> None:
        self.suggestions = suggestions

    def scalar_one_or_none(self) -> PairingSuggestion | None:
        return self.suggestions[0] if self.suggestions else None

    def scalars(self) -> "FakeScalarResult":
        return self

    def all(self) -> list[PairingSuggestion]:
        return self.suggestions


class FakeSession:
    def __init__(self, results: list[list[PairingSuggestion]]) -> None:
        self.results = results

    async def execute(self, _statement) -> FakeScalarResult:
        return FakeScalarResult(self.results.pop(0))


def make_suggestion(
    category: str,
    color: str,
    suggestion_text: str,
) -> PairingSuggestion:
    suggestion = PairingSuggestion(
        id=uuid.uuid4(),
        category=category,
        color=color,
        suggestion_text=suggestion_text,
        image_key=None,
    )
    return suggestion


def test_exact_match_is_first_suggestion() -> None:
    exact_suggestion = make_suggestion("top", "black", "Exact match.")
    fallback_suggestion = make_suggestion("accessory", "black", "Fallback match.")
    session = FakeSession([[exact_suggestion], [fallback_suggestion]])

    suggestions = asyncio.run(find_pairing_suggestions(session, "top", "black"))

    assert suggestions == [exact_suggestion, fallback_suggestion]


def test_fallback_can_return_one_suggestion_without_exact_match() -> None:
    fallback_suggestion = make_suggestion("top", "black", "Fallback match.")
    session = FakeSession([[], [fallback_suggestion]])

    suggestions = asyncio.run(find_pairing_suggestions(session, "top", "red"))

    assert suggestions == [fallback_suggestion]


def test_no_match_returns_empty_list() -> None:
    session = FakeSession([[], []])

    suggestions = asyncio.run(find_pairing_suggestions(session, "top", "red"))

    assert suggestions == []
