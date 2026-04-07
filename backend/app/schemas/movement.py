from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class MovementOut(BaseModel):
    id: str
    item_id: str
    from_location_id: str | None
    to_location_id: str
    moved_by: str | None
    moved_at: datetime
    reason: str | None
    notes: str | None
    # Joined
    from_location_name: str | None = None
    to_location_name: str | None = None
    moved_by_display_name: str | None = None
    photo_thumbnail_url: str | None = None

    model_config = {"from_attributes": True}
