from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ExportFilters(BaseModel):
    location_id: str | None = None
    owner_user_id: str | None = None
    category: str | None = None
    condition: str | None = None
    verified_only: bool = False
    min_value_cents: int | None = None
    max_value_cents: int | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    include_deleted: bool = False


class ExportJobCreate(BaseModel):
    format: str = Field(default="xlsx", pattern="^(csv|xlsx)$")
    filters: ExportFilters = ExportFilters()


class ExportJobOut(BaseModel):
    id: str
    site_id: str
    format: str
    status: str
    download_url: str | None = None
    error_message: str | None = None
    created_at: datetime
    expires_at: datetime | None

    model_config = {"from_attributes": True}
