from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class LocationCreate(BaseModel):
    name: str = Field(max_length=255)
    level: str = Field(pattern="^(floor|room|zone|shelf|container)$")
    parent_id: str | None = None
    description: str | None = None
    floor_plan_x: float | None = None
    floor_plan_y: float | None = None
    order_index: int = 0


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    floor_plan_x: float | None = None
    floor_plan_y: float | None = None
    order_index: int | None = None


class LocationOut(BaseModel):
    id: str
    site_id: str
    parent_id: str | None
    name: str
    level: str
    description: str | None
    floor_plan_x: float | None
    floor_plan_y: float | None
    order_index: int
    created_at: datetime
    # Computed
    item_count: int = 0
    children: list["LocationOut"] = []

    model_config = {"from_attributes": True}


class LocationReorder(BaseModel):
    items: list[dict]  # [{id: str, order_index: int}]


class FloorMapUpdate(BaseModel):
    vector_data: dict | None = None
    width: int | None = None
    height: int | None = None


class FloorMapOut(BaseModel):
    id: str
    location_id: str
    site_id: str
    image_url: str | None = None
    vector_data: dict | None
    width: int | None
    height: int | None
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}
