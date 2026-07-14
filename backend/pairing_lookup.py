from __future__ import annotations

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import PairingSuggestion

MAX_PAIRING_SUGGESTIONS = 2


async def find_pairing_suggestions(
    session: AsyncSession,
    category: str,
    color: str,
) -> list[PairingSuggestion]:
    """Find exact then broader fallback pairing suggestions for an item."""
    suggestions: list[PairingSuggestion] = []

    exact_result = await session.execute(
        select(PairingSuggestion)
        .where(
            PairingSuggestion.category == category,
            PairingSuggestion.color == color,
        )
        .limit(1),
    )
    exact_suggestion = exact_result.scalar_one_or_none()
    if exact_suggestion is not None:
        suggestions.append(exact_suggestion)

    if len(suggestions) >= MAX_PAIRING_SUGGESTIONS:
        return suggestions

    fallback_filters = [
        or_(
            and_(
                PairingSuggestion.category == category,
                PairingSuggestion.color != color,
            ),
            and_(
                PairingSuggestion.category != category,
                PairingSuggestion.color == color,
            ),
        ),
    ]
    if exact_suggestion is not None:
        fallback_filters.append(PairingSuggestion.id != exact_suggestion.id)

    fallback_result = await session.execute(
        select(PairingSuggestion)
        .where(*fallback_filters)
        .order_by(PairingSuggestion.category, PairingSuggestion.color)
        .limit(MAX_PAIRING_SUGGESTIONS - len(suggestions)),
    )
    suggestions.extend(fallback_result.scalars().all())

    return suggestions
