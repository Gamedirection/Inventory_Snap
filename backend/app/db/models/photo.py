from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Double, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

AI_STATUS_CHOICES = ("pending", "processing", "completed", "failed", "skipped")


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    site_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True
    )
    location_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("locations.id", ondelete="SET NULL"), index=True
    )
    original_object_key: Mapped[str] = mapped_column(Text, nullable=False)
    thumbnail_object_key: Mapped[str | None] = mapped_column(Text)
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    uploaded_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL")
    )
    upload_ip: Mapped[str | None] = mapped_column(INET)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    mime_type: Mapped[str | None] = mapped_column(String(50))
    exif_data: Mapped[dict | None] = mapped_column(JSONB)
    gps_latitude: Mapped[float | None] = mapped_column(Double)
    gps_longitude: Mapped[float | None] = mapped_column(Double)

    # AI processing
    ai_status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    ai_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ai_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ai_provider: Mapped[str | None] = mapped_column(String(50))
    ai_model: Mapped[str | None] = mapped_column(String(100))
    ai_raw_response: Mapped[dict | None] = mapped_column(JSONB)
    celery_task_id: Mapped[str | None] = mapped_column(String(255))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    proposed_items: Mapped[list["ProposedItem"]] = relationship(  # noqa: F821
        "ProposedItem", back_populates="photo", cascade="all, delete-orphan"
    )
    item_photos: Mapped[list["ItemPhoto"]] = relationship(  # noqa: F821
        "ItemPhoto", back_populates="photo"
    )
