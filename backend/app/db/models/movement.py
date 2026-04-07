from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Movement(Base):
    __tablename__ = "movements"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_location_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("locations.id", ondelete="SET NULL")
    )
    to_location_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False
    )
    moved_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL")
    )
    moved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    reason: Mapped[str | None] = mapped_column(Text)
    photo_evidence_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("photos.id", ondelete="SET NULL")
    )
    proposed_item_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("proposed_items.id", ondelete="SET NULL")
    )
    notes: Mapped[str | None] = mapped_column(Text)

    item: Mapped["Item"] = relationship("Item", back_populates="movements")  # noqa: F821
