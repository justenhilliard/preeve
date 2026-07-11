from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0002_seed_pairing_suggestions"
down_revision: str | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PAIRING_SUGGESTIONS = (
    ("top", "black", "Pair with dark wash jeans and white sneakers for an easy monochrome-adjacent look."),
    ("top", "white", "Layer under a navy blazer or tuck into olive chinos for a clean, versatile combo."),
    ("top", "navy", "Pair with tan chinos and brown leather shoes for a business-casual staple."),
    ("top", "olive", "Pair with black jeans and white sneakers for an easy neutral-on-neutral look."),
    ("top", "burgundy", "Pair with black trousers and black boots for a rich, cool-weather combo."),
    ("top", "tan", "Pair with navy trousers and brown loafers for a warm neutral pairing."),
    ("bottom", "black", "Pair with a white top and black boots for a simple, sharp silhouette."),
    ("bottom", "white", "Pair with a navy top and tan accessories for a crisp warm-weather look."),
    ("bottom", "navy", "Pair with a white top and brown belt and shoes for a classic business-casual base."),
    ("bottom", "olive", "Pair with a black top and white sneakers for an easy utilitarian look."),
    ("bottom", "burgundy", "Pair with a white or tan top and black shoes for a bold but balanced combo."),
    ("bottom", "tan", "Pair with a navy top and white sneakers for a relaxed warm-weather outfit."),
    ("dress", "black", "Add a tan or burgundy accessory to warm up the monochrome base."),
    ("dress", "white", "Pair with tan or brown accessories for a soft, warm-weather look."),
    ("dress", "navy", "Pair with black or tan shoes and a light accessory for versatility."),
    ("dress", "olive", "Pair with black or tan accessories for an easy neutral base."),
    ("dress", "burgundy", "Pair with black shoes and a simple accessory for a polished cool-weather look."),
    ("dress", "tan", "Pair with white or navy accessories for a soft, warm-toned outfit."),
    ("outerwear", "black", "Layer over almost anything — pairs cleanly with white, navy, or olive base pieces."),
    ("outerwear", "white", "Pairs well over navy or black base pieces for a crisp contrast."),
    ("outerwear", "navy", "A business-casual staple — pairs with white, tan, or olive base pieces."),
    ("outerwear", "olive", "Pairs well with black or white base pieces for an easy utility look."),
    ("outerwear", "burgundy", "Pairs well with black or tan base pieces for a rich cool-weather layer."),
    ("outerwear", "tan", "A versatile neutral layer — pairs with navy, white, or olive base pieces."),
    ("shoes", "black", "Goes with nearly everything — the safest neutral choice in your wardrobe."),
    ("shoes", "white", "Pairs well with casual bottoms in navy, olive, or tan for an easy everyday look."),
    ("shoes", "navy", "Pairs well with tan or white bottoms for a clean business-casual base."),
    ("shoes", "olive", "Pairs well with black or tan bottoms for a casual, grounded look."),
    ("shoes", "burgundy", "Pairs well with navy or tan bottoms for a polished, slightly bold look."),
    ("shoes", "tan", "A warm neutral that pairs with navy, olive, or white bottoms."),
    ("accessory", "black", "A safe neutral that pairs with almost any base outfit."),
    ("accessory", "white", "Adds a crisp contrast point to darker base outfits."),
    ("accessory", "navy", "Pairs well with tan, white, or olive base pieces for a business-casual finish."),
    ("accessory", "olive", "Adds an easy utility touch to black or tan base outfits."),
    ("accessory", "burgundy", "Adds a bold accent to black, tan, or navy base outfits."),
    ("accessory", "tan", "A warm neutral accent that pairs with navy or olive base outfits."),
)


def upgrade() -> None:
    pairing_suggestions = sa.table(
        "pairing_suggestions",
        sa.column("category", sa.String),
        sa.column("color", sa.String),
        sa.column("suggestion_text", sa.Text),
    )
    op.bulk_insert(
        pairing_suggestions,
        [
            {"category": category, "color": color, "suggestion_text": suggestion_text}
            for category, color, suggestion_text in PAIRING_SUGGESTIONS
        ],
    )


def downgrade() -> None:
    for category, color, suggestion_text in PAIRING_SUGGESTIONS:
        op.execute(
            sa.text(
                """
                DELETE FROM pairing_suggestions
                WHERE category = :category
                  AND color = :color
                  AND suggestion_text = :suggestion_text
                """
            ).bindparams(
                category=category,
                color=color,
                suggestion_text=suggestion_text,
            )
        )
