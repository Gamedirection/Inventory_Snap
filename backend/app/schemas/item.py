from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class ItemFloorPlanPinInput(BaseModel):
    id: str | None = None
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class ItemFloorPlanPinOut(BaseModel):
    id: str
    pin_index: int
    x: float
    y: float

    model_config = {"from_attributes": True}


class ItemCreate(BaseModel):
    name: str = Field(max_length=255)
    description: str | None = None
    category: str | None = Field(default=None, max_length=100)
    brand: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=100)
    condition: str = Field(default="good")
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
    floor_plan_x: float | None = None
    floor_plan_y: float | None = None
    pins: list[ItemFloorPlanPinInput] | None = None


class ItemUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    category: str | None = None
    brand: str | None = None
    model: str | None = None
    condition: str | None = None
    item_type: str | None = None
    location_id: str | None = None
    owner_user_id: str | None = None
    owner_contact_name: str | None = None
    quantity: int | None = None
    serial_numbers: list[str] | None = None
    barcodes: list[str] | None = None
    purchase_date: date | None = None
    purchase_location: str | None = None
    purchase_price_cents: int | None = None
    estimated_value_cents: int | None = None
    currency_code: str | None = None
    warranty_expires_at: date | None = None
    warranty_notes: str | None = None
    notes: str | None = None
    custom_tags: list[str] | None = None
    gps_latitude: float | None = None
    gps_longitude: float | None = None
    floor_plan_x: float | None = None
    floor_plan_y: float | None = None
    pins: list[ItemFloorPlanPinInput] | None = None


class ItemOut(BaseModel):
    id: str
    site_id: str
    location_id: str | None
    item_type: str
    # Frontend-friendly aliases (backend DB uses object_name / short_description)
    name: str = Field(validation_alias="object_name")
    description: str | None = Field(None, validation_alias="short_description")
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
    floor_plan_x: float | None
    floor_plan_y: float | None
    confidence_score: float | None
    verification_count: int
    is_verified: bool
    created_by: str | None
    created_at: datetime
    updated_at: datetime | None
    sold_at: datetime | None
    lost_at: datetime | None
    deleted_at: datetime | None
    # Computed (populated by _enrich_item)
    primary_photo_url: str | None = None
    location_path: str | None = None
    pins: list[ItemFloorPlanPinOut] = []

    model_config = {"from_attributes": True, "populate_by_name": True}


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
    size: int  # frontend uses "size" not "per_page"
    pages: int
