from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ProposedItemOut(BaseModel):
    id: str
    photo_id: str
    detection_index: int
    bounding_box: dict | None
    object_name: str | None
    short_description: str | None
    category: str | None
    brand: str | None
    model: str | None
    serial_numbers: list[str] | None
    barcodes: list[str] | None
    confidence_score: float | None
    ai_suggested_tags: list[str] | None
    duplicate_of_proposed_id: str | None
    duplicate_of_item_id: str | None
    review_status: str
    reviewed_at: datetime | None
    merged_into_item_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProposedItemEdit(BaseModel):
    object_name: str | None = None
    short_description: str | None = None
    category: str | None = None
    brand: str | None = None
    model: str | None = None
    serial_numbers: list[str] | None = None
    barcodes: list[str] | None = None
    ai_suggested_tags: list[str] | None = None


class ApproveRequest(BaseModel):
    edits: ProposedItemEdit | None = None
    location_id: str | None = None  # override detected location


class MergeRequest(BaseModel):
    into_item_id: str
    increment_quantity: bool = False


class BulkReviewRequest(BaseModel):
    approved: list[str] = []    # proposed_item ids
    rejected: list[str] = []
    merges: list[dict] = []     # [{id: str, into_item_id: str}]


class ReviewQueueItem(BaseModel):
    photo_id: str
    thumbnail_url: str | None
    location_id: str | None
    location_name: str | None
    pending_count: int
    captured_at: datetime | None
    ai_status: str


class ReviewQueueResponse(BaseModel):
    items: list[ReviewQueueItem]
    total: int
    page: int
    per_page: int
