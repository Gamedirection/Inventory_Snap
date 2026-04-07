from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Double,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

ITEM_TYPE_CHOICES = ("unique", "bulk", "grouped_set")
CONDITION_CHOICES = ("new", "excellent", "good", "fair", "poor", "unknown")


class Item(Base):
    __tablename__ = "items"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    site_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True
    )
    location_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("locations.id", ondelete="SET NULL"), index=True
    )

    item_type: Mapped[str] = mapped_column(String(20), default="unique", nullable=False)
    object_name: Mapped[str] = mapped_column(String(255), nullable=False)
    short_description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100), index=True)
    brand: Mapped[str | None] = mapped_column(String(100))
    model: Mapped[str | None] = mapped_column(String(100))
    condition: Mapped[str] = mapped_column(String(20), default="unknown", nullable=False)

    # Ownership
    owner_user_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    owner_contact_name: Mapped[str | None] = mapped_column(String(255))

    # Quantity
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Identification
    serial_numbers: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    barcodes: Mapped[list[str] | None] = mapped_column(ARRAY(String))

    # Purchase info
    purchase_date: Mapped[date | None] = mapped_column(Date)
    purchase_location: Mapped[str | None] = mapped_column(String(255))
    purchase_price_cents: Mapped[int | None] = mapped_column(Integer)
    estimated_value_cents: Mapped[int | None] = mapped_column(Integer)
    currency_code: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)

    # Warranty
    warranty_expires_at: Mapped[date | None] = mapped_column(Date)
    warranty_notes: Mapped[str | None] = mapped_column(Text)

    # Notes and tags
    notes: Mapped[str | None] = mapped_column(Text)
    custom_tags: Mapped[list[str] | None] = mapped_column(ARRAY(String))

    # Photos
    primary_photo_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("photos.id", ondelete="SET NULL")
    )

    # GPS
    gps_latitude: Mapped[float | None] = mapped_column(Double)
    gps_longitude: Mapped[float | None] = mapped_column(Double)

    # Verification (double-log)
    confidence_score: Mapped[float | None] = mapped_column(Double)
    verification_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Source
    source_proposed_item_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("proposed_items.id", ondelete="SET NULL")
    )

    # Lifecycle
    created_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    sold_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lost_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    item_photos: Mapped[list["ItemPhoto"]] = relationship(
        "ItemPhoto", back_populates="item", cascade="all, delete-orphan"
    )
    documents: Mapped[list["ItemDocument"]] = relationship(
        "ItemDocument", back_populates="item", cascade="all, delete-orphan"
    )
    movements: Mapped[list["Movement"]] = relationship(  # noqa: F821
        "Movement", back_populates="item", cascade="all, delete-orphan"
    )

    @property
    def is_verified(self) -> bool:
        return self.verification_count >= 2


class ItemPhoto(Base):
    __tablename__ = "item_photos"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    photo_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("photos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    proposed_item_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("proposed_items.id", ondelete="SET NULL")
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    item: Mapped["Item"] = relationship("Item", back_populates="item_photos")
    photo: Mapped["Photo"] = relationship("Photo", back_populates="item_photos")  # noqa: F821


class ItemDocument(Base):
    __tablename__ = "item_documents"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    object_key: Mapped[str] = mapped_column(Text, nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255))
    document_type: Mapped[str] = mapped_column(String(20), default="other", nullable=False)
    uploaded_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    item: Mapped["Item"] = relationship("Item", back_populates="documents")
