import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

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


def _check_values(column_name: str, values: tuple[str, ...]) -> str:
    quoted_values = ", ".join(f"'{value}'" for value in values)
    return f"{column_name} IN ({quoted_values})"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    auth_provider_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    preferences: Mapped["Preference"] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    scanned_items: Mapped[list["ScannedItem"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Preference(Base):
    __tablename__ = "preferences"
    __table_args__ = (
        CheckConstraint(
            "formality_preference IS NULL OR "
            f"{_check_values('formality_preference', FORMALITY_VALUES)}",
            name="ck_preferences_formality_preference",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    preferred_colors: Mapped[list[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
        server_default=text("'{}'"),
    )
    preferred_fits: Mapped[list[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
        server_default=text("'{}'"),
    )
    formality_preference: Mapped[str | None] = mapped_column(String(20), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    user: Mapped[User] = relationship(back_populates="preferences")


class ScannedItem(Base):
    __tablename__ = "scanned_items"
    __table_args__ = (
        CheckConstraint(
            f"detected_category IS NULL OR {_check_values('detected_category', CATEGORY_VALUES)}",
            name="ck_scanned_items_detected_category",
        ),
        CheckConstraint(
            f"detected_color IS NULL OR {_check_values('detected_color', COLOR_VALUES)}",
            name="ck_scanned_items_detected_color",
        ),
        CheckConstraint(
            f"corrected_category IS NULL OR {_check_values('corrected_category', CATEGORY_VALUES)}",
            name="ck_scanned_items_corrected_category",
        ),
        CheckConstraint(
            f"corrected_color IS NULL OR {_check_values('corrected_color', COLOR_VALUES)}",
            name="ck_scanned_items_corrected_color",
        ),
        CheckConstraint(
            f"verdict IS NULL OR {_check_values('verdict', VERDICT_VALUES)}",
            name="ck_scanned_items_verdict",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    photo_key: Mapped[str] = mapped_column(String(512), nullable=False)
    detected_category: Mapped[str | None] = mapped_column(String(20), nullable=True)
    detected_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    visual_attributes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    corrected_category: Mapped[str | None] = mapped_column(String(20), nullable=True)
    corrected_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    verdict: Mapped[str | None] = mapped_column(String(10), nullable=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    saved_to_wardrobe: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
    )
    is_favorited: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    user: Mapped[User] = relationship(back_populates="scanned_items")


class PairingSuggestion(Base):
    __tablename__ = "pairing_suggestions"
    __table_args__ = (
        CheckConstraint(
            _check_values("category", CATEGORY_VALUES),
            name="ck_pairing_suggestions_category",
        ),
        CheckConstraint(
            _check_values("color", COLOR_VALUES),
            name="ck_pairing_suggestions_color",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False)
    suggestion_text: Mapped[str] = mapped_column(Text, nullable=False)
    image_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
