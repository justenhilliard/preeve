from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATEGORY_VALUES = ("top", "bottom", "dress", "outerwear", "shoes", "accessory")
COLOR_VALUES = (
    "black",
    "white",
    "gray",
    "navy",
    "blue",
    "red",
    "green",
    "olive",
    "brown",
    "tan",
    "beige",
    "pink",
    "purple",
    "yellow",
    "orange",
    "burgundy",
    "multicolor",
)
FORMALITY_VALUES = (
    "athleisure",
    "casual",
    "smart_casual",
    "business_casual",
    "formal",
)
VERDICT_VALUES = ("buy", "maybe", "skip")


def check_values(column_name: str, values: tuple[str, ...]) -> str:
    quoted_values = ", ".join(f"'{value}'" for value in values)
    return f"{column_name} IN ({quoted_values})"


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("auth_provider_id", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("auth_provider_id", name="uq_users_auth_provider_id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    op.create_table(
        "preferences",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "preferred_colors",
            postgresql.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column(
            "preferred_fits",
            postgresql.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column("formality_preference", sa.String(length=20), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            f"formality_preference IS NULL OR {check_values('formality_preference', FORMALITY_VALUES)}",
            name="ck_preferences_formality_preference",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", name="uq_preferences_user_id"),
    )

    op.create_table(
        "scanned_items",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("photo_key", sa.String(length=512), nullable=False),
        sa.Column("detected_category", sa.String(length=20), nullable=True),
        sa.Column("detected_color", sa.String(length=20), nullable=True),
        sa.Column("corrected_category", sa.String(length=20), nullable=True),
        sa.Column("corrected_color", sa.String(length=20), nullable=True),
        sa.Column("verdict", sa.String(length=10), nullable=True),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("saved_to_wardrobe", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_favorited", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            f"detected_category IS NULL OR {check_values('detected_category', CATEGORY_VALUES)}",
            name="ck_scanned_items_detected_category",
        ),
        sa.CheckConstraint(
            f"detected_color IS NULL OR {check_values('detected_color', COLOR_VALUES)}",
            name="ck_scanned_items_detected_color",
        ),
        sa.CheckConstraint(
            f"corrected_category IS NULL OR {check_values('corrected_category', CATEGORY_VALUES)}",
            name="ck_scanned_items_corrected_category",
        ),
        sa.CheckConstraint(
            f"corrected_color IS NULL OR {check_values('corrected_color', COLOR_VALUES)}",
            name="ck_scanned_items_corrected_color",
        ),
        sa.CheckConstraint(
            f"verdict IS NULL OR {check_values('verdict', VERDICT_VALUES)}",
            name="ck_scanned_items_verdict",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "idx_scanned_items_wardrobe_log",
        "scanned_items",
        ["user_id", "saved_to_wardrobe", sa.text("created_at DESC")],
    )

    op.create_table(
        "pairing_suggestions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("color", sa.String(length=20), nullable=False),
        sa.Column("suggestion_text", sa.Text(), nullable=False),
        sa.Column("image_key", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            check_values("category", CATEGORY_VALUES),
            name="ck_pairing_suggestions_category",
        ),
        sa.CheckConstraint(
            check_values("color", COLOR_VALUES),
            name="ck_pairing_suggestions_color",
        ),
    )
    op.create_index(
        "idx_pairing_suggestions_lookup",
        "pairing_suggestions",
        ["category", "color"],
    )


def downgrade() -> None:
    op.drop_index("idx_pairing_suggestions_lookup", table_name="pairing_suggestions")
    op.drop_table("pairing_suggestions")
    op.drop_index("idx_scanned_items_wardrobe_log", table_name="scanned_items")
    op.drop_table("scanned_items")
    op.drop_table("preferences")
    op.drop_table("users")
