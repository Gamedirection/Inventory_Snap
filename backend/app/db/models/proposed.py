from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Double, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

REVIEW_STATUS_CHOICES = ("pending", "approved", "rejected", "merged")


class ProposedItem(Base):
    __tablename__ = "proposed_items"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    photo_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("photos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    detection_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bounding_box: Mapped[dict | None] = mapped_column(JSONB)  # {x,y,width,height} normalized 0-1

    # Detected fields
    object_name: Mapped[str | None] = mapped_column(String(255))
    short_description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100))
    brand: Mapped[str | None] = mapped_column(String(100))
    model: Mapped[str | None] = mapped_column(String(100))
    serial_numbers: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    barcodes: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    confidence_score: Mapped[float | None] = mapped_column(Double)
    ai_suggested_tags: Mapped[list[str] | None] = mapped_column(ARRAY(String))

    # Duplicate detection
    duplicate_of_proposed_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("proposed_items.id", ondelete="SET NULL")
    )
    duplicate_of_item_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("items.id", ondelete="SET NULL")
    )

    # Review
    review_status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, index=True
    )
    reviewed_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    merged_into_item_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("items.id", ondelete="SET NULL")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    photo: Mapped["Photo"] = relationship("Photo", back_populates="proposed_items")  # noqa: F821
