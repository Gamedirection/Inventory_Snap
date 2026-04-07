from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SiteCreate(BaseModel):
    name: str = Field(max_length=255)
    description: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    timezone: str = "UTC"


class SiteUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    timezone: str | None = None


class SiteOut(BaseModel):
    id: str
    name: str
    description: str | None
    address: str | None
    latitude: float | None
    longitude: float | None
    timezone: str
    created_by: str | None
    created_at: datetime
    updated_at: datetime | None
    # Computed
    role: str | None = None
    item_count: int = 0
    member_count: int = 0

    model_config = {"from_attributes": True}


class MemberInvite(BaseModel):
    email: str
    role: str = Field(pattern="^(admin|editor|viewer)$")


class MemberRoleUpdate(BaseModel):
    role: str = Field(pattern="^(owner|admin|editor|viewer)$")


class MemberOut(BaseModel):
    id: str
    site_id: str
    user_id: str
    role: str
    accepted_at: datetime | None
    created_at: datetime
    # Joined user info
    user_email: str | None = None
    user_display_name: str | None = None

    model_config = {"from_attributes": True}


class InviteAccept(BaseModel):
    token: str
