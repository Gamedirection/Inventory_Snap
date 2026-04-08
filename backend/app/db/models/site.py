from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Double, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

ROLE_CHOICES = ("owner", "admin", "editor", "viewer")


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Double)
    longitude: Mapped[float | None] = mapped_column(Double)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    icon_object_key: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    memberships: Mapped[list["SiteMembership"]] = relationship(
        "SiteMembership", back_populates="site", cascade="all, delete-orphan"
    )
    locations: Mapped[list["Location"]] = relationship(  # noqa: F821
        "Location", back_populates="site", cascade="all, delete-orphan"
    )


class SiteMembership(Base):
    __tablename__ = "site_memberships"
    __table_args__ = (UniqueConstraint("site_id", "user_id", name="uq_site_membership"),)

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()
    )
    site_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    invited_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL")
    )
    invite_token: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    invite_email: Mapped[str | None] = mapped_column(String(255))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    site: Mapped["Site"] = relationship("Site", back_populates="memberships")
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="site_memberships", foreign_keys=[user_id]
    )
