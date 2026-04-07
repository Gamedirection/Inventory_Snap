from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class ItemCreate(BaseModel):
    object_name: str = Field(max_length=255)
    short_description: str | None = None
    category: str | None = Field(default=None, max_length=100)
    brand: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=100)
    condition: str = Field(default="unknown", pattern="^(new|excellent|good|fair|poor|unknown)$")
    item_type: str = Field(default="unique", pattern="^(unique|bulk|grouped_set)$")
    location_id: str | None = None
    owner_user_id: str | None = None
    owner_contact_name: str | None = None
    quantity: int = Field(default=1, ge=1)
    serial_numbers: list[str] | None = None
    barcodes: list[str] | None = None
    purchase_date: date | None = None
    purchase_location: str | None = None
    purchase_price_cents: int | None = None
    estimated_value_cents: int | None = None
    currency_code: str = "USD"
    warranty_expires_at: date | None = None
    warranty_notes: str | None = None
    notes: str | None = None
    custom_tags: list[str] | None = None
    gps_latitude: float | None = None
    gps_longitude: float | None = None


class ItemUpdate(ItemCreate):
    object_name: str | None = Field(default=None, max_length=255)  # type: ignore[assignment]
    condition: str | None = Field(default=None, pattern="^(new|excellent|good|fair|poor|unknown)$")  # type: ignore[assignment]
    item_type: str | None = Field(default=None, pattern="^(unique|bulk|grouped_set)$")  # type: ignore[assignment]


class ItemOut(BaseModel):
    id: str
    site_id: str
    location_id: str | None
    item_type: str
    object_name: str
    short_description: str | None
    category: str | None
    brand: str | None
    model: str | None
    condition: str
    owner_user_id: str | None
    owner_contact_name: str | None
    quantity: int
    serial_numbers: list[str] | None
    barcodes: list[str] | None
    purchase_date: date | None
    purchase_location: str | None
    purchase_price_cents: int | None
    estimated_value_cents: int | None
    currency_code: str
    warranty_expires_at: date | None
    warranty_notes: str | None
    notes: str | None
    custom_tags: list[str] | None
    primary_photo_id: str | None
    gps_latitude: float | None
    gps_longitude: float | None
    confidence_score: float | None
    verification_count: int
    is_verified: bool
    created_by: str | None
    created_at: datetime
    updated_at: datetime | None
    sold_at: datetime | None
    lost_at: datetime | None
    deleted_at: datetime | None
    # Computed
    primary_thumbnail_url: str | None = None
    location_path: str | None = None

    model_config = {"from_attributes": True}


class ItemMoveRequest(BaseModel):
    to_location_id: str
    reason: str | None = None
    notes: str | None = None


class BulkOperation(BaseModel):
    item_ids: list[str]
    operation: str = Field(pattern="^(move|tag|assign_owner|delete)$")
    to_location_id: str | None = None
    tags: list[str] | None = None
    owner_user_id: str | None = None


class ItemSearchParams(BaseModel):
    q: str | None = None
    category: str | None = None
    location_id: str | None = None
    owner_user_id: str | None = None
    condition: str | None = None
    verified: bool | None = None
    tag: str | None = None
    item_type: str | None = None
    sort: str = "created_at_desc"
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=200)
    updated_since: datetime | None = None  # for offline delta sync


class PaginatedItems(BaseModel):
    items: list[ItemOut]
    total: int
    page: int
    per_page: int
    pages: int
