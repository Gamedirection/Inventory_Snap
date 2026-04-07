from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, model_validator


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

    # Frontend-friendly computed fields
    ai_label: str | None = None
    ai_confidence: float | None = None
    ai_category: str | None = None
    status: str | None = None
    duplicate_of_id: str | None = None
    detected_objects: list[dict] = []
    proposed_fields: dict[str, Any] = {}

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def _compute_frontend_fields(self) -> "ProposedItemOut":
        self.ai_label = self.object_name
        self.ai_confidence = self.confidence_score or 0.0
        self.ai_category = self.category
        self.status = self.review_status
        self.duplicate_of_id = self.duplicate_of_proposed_id or self.duplicate_of_item_id

        # Build detected_objects from single bounding_box
        if self.bounding_box:
            self.detected_objects = [
                {
                    "id": self.id,
                    "label": self.object_name or "Object",
                    "confidence": self.confidence_score or 0.0,
                    "bbox": self.bounding_box,
                }
            ]

        # Build proposed_fields
        self.proposed_fields = {
            "name": self.object_name,
            "description": self.short_description,
            "category": self.category,
            "brand": self.brand,
            "model": self.model,
        }

        return self


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


class BulkAction(BaseModel):
    proposalId: str
    action: str  # 'approve' | 'reject'


class BulkActionRequest(BaseModel):
    actions: list[BulkAction]


class LocationInPhoto(BaseModel):
    id: str | None = None
    name: str
    path: str | None = None


class PhotoInQueue(BaseModel):
    id: str
    url: str
    thumbnail_url: str | None = None
    location: LocationInPhoto | None = None


class ReviewQueueItem(BaseModel):
    photo: PhotoInQueue
    proposals: list[ProposedItemOut]
    pending_count: int


class ReviewQueueResponse(BaseModel):
    items: list[ReviewQueueItem]
    total: int
    pending_count: int
