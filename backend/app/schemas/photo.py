from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class PhotoOut(BaseModel):
    id: str
    site_id: str
    location_id: str | None
    # Both names: original_url (internal) and url (frontend-friendly alias)
    url: str | None = None
    original_url: str | None = None
    thumbnail_url: str | None = None
    captured_at: datetime | None
    file_size_bytes: int | None
    mime_type: str | None
    gps_latitude: float | None
    gps_longitude: float | None
    ai_status: str
    ai_provider: str | None
    ai_model: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PhotoUploadResponse(BaseModel):
    photo_id: str
    ai_status: str
    message: str = "Photo queued for AI processing"


class BatchUploadResponse(BaseModel):
    photos: list[PhotoUploadResponse]
    total: int
