from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class PhotoOut(BaseModel):
    id: str
    site_id: str
    location_id: str | None
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
    archived: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class PhotoUploadResponse(BaseModel):
    photo_id: str
    ai_status: str
    message: str = "Photo queued for AI processing"


class BatchUploadResponse(BaseModel):
    photos: list[PhotoUploadResponse]
    total: int


class PhotoUpdate(BaseModel):
    """Fields the user can update on a photo."""
    location_id: str | None = None
    archived: bool | None = None


class PhotoPinOut(BaseModel):
    """An inventory item pinned to a specific location within a photo."""
    pin_id: str          # item_photos.id
    item_id: str
    item_name: str
    category: str | None
    annotation_bbox: dict | None  # {x, y, width, height} normalised 0-1
    is_primary: bool


class PhotoPinCreate(BaseModel):
    item_id: str
    annotation_bbox: dict | None = None  # {x, y, width, height} optional
    set_as_primary: bool = False


class PhotoDetail(PhotoOut):
    """Photo with all linked inventory item pins."""
    pins: list[PhotoPinOut] = []
    location_name: str | None = None
    location_path: str | None = None
