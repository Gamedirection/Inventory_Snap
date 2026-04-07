from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.config import settings
from app.db.models.audit import AuditLog
from app.db.models.item import Item, ItemPhoto
from app.db.models.location import Location
from app.db.models.movement import Movement
from app.db.models.photo import Photo
from app.db.models.proposed import ProposedItem
from app.deps import CurrentUser, DB, site_role_checker
from app.schemas.review import (
    ApproveRequest,
    BulkReviewRequest,
    MergeRequest,
    ProposedItemEdit,
    ProposedItemOut,
    ReviewQueueItem,
    ReviewQueueResponse,
)
from app.services.photo_service import get_presigned_url

router = APIRouter(prefix="/sites/{site_id}/review", tags=["review"])

RequireViewer = Annotated[object, Depends(site_role_checker("viewer"))]
RequireEditor = Annotated[object, Depends(site_role_checker("editor"))]
RequireAdmin = Annotated[object, Depends(site_role_checker("admin"))]


async def _get_photo_or_404(db, site_id: str, photo_id: str) -> Photo:
    result = await db.execute(
        select(Photo).where(
            Photo.id == photo_id,
            Photo.site_id == site_id,
            Photo.deleted_at.is_(None),
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return photo


async def _get_proposal_or_404(db, photo_id: str, proposal_id: str) -> ProposedItem:
    result = await db.execute(
        select(ProposedItem).where(
            ProposedItem.id == proposal_id,
            ProposedItem.photo_id == photo_id,
        )
    )
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal


@router.get("/queue", response_model=ReviewQueueResponse)
async def get_review_queue(
    site_id: str,
    db: DB,
    _auth: RequireViewer,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
):
    # Photos that have at least one pending proposal
    subq = (
        select(ProposedItem.photo_id, func.count(ProposedItem.id).label("pending_count"))
        .where(ProposedItem.review_status == "pending")
        .group_by(ProposedItem.photo_id)
        .subquery()
    )
    q = (
        select(Photo, subq.c.pending_count)
        .join(subq, Photo.id == subq.c.photo_id)
        .where(Photo.site_id == site_id, Photo.deleted_at.is_(None))
        .order_by(Photo.created_at.desc())
    )

    count_q = select(func.count()).select_from(
        select(Photo.id)
        .join(subq, Photo.id == subq.c.photo_id)
        .where(Photo.site_id == site_id, Photo.deleted_at.is_(None))
        .subquery()
    )
    total_result = await db.execute(count_q)
    total = total_result.scalar_one()

    paged_q = q.offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(paged_q)).all()

    queue_items: list[ReviewQueueItem] = []
    for photo, pending_count in rows:
        thumbnail_url = None
        if photo.thumbnail_object_key:
            thumbnail_url = get_presigned_url(settings.minio_bucket_thumbnails, photo.thumbnail_object_key)

        location_name = None
        if photo.location_id:
            loc_result = await db.execute(select(Location).where(Location.id == photo.location_id))
            loc = loc_result.scalar_one_or_none()
            if loc:
                location_name = loc.name

        queue_items.append(
            ReviewQueueItem(
                photo_id=photo.id,
                thumbnail_url=thumbnail_url,
                location_id=photo.location_id,
                location_name=location_name,
                pending_count=pending_count,
                captured_at=photo.captured_at,
                ai_status=photo.ai_status,
            )
        )

    pages = math.ceil(total / per_page) if total > 0 else 1
    return ReviewQueueResponse(items=queue_items, total=total, page=page, per_page=per_page)


@router.get("/queue/count")
async def get_review_queue_count(
    site_id: str,
    db: DB,
    _auth: RequireViewer,
):
    subq = (
        select(ProposedItem.photo_id)
        .where(ProposedItem.review_status == "pending")
        .distinct()
        .subquery()
    )
    result = await db.execute(
        select(func.count()).select_from(
            select(Photo.id)
            .join(subq, Photo.id == subq.c.photo_id)
            .where(Photo.site_id == site_id, Photo.deleted_at.is_(None))
            .subquery()
        )
    )
    count = result.scalar_one()
    return {"count": count}


@router.get("/{photo_id}/proposals", response_model=list[ProposedItemOut])
async def list_proposals(
    site_id: str,
    photo_id: str,
    db: DB,
    _auth: RequireViewer,
):
    await _get_photo_or_404(db, site_id, photo_id)
    result = await db.execute(
        select(ProposedItem)
        .where(ProposedItem.photo_id == photo_id)
        .order_by(ProposedItem.detection_index)
    )
    return result.scalars().all()


@router.post("/{photo_id}/proposals/{proposal_id}/approve", response_model=ProposedItemOut)
async def approve_proposal(
    site_id: str,
    photo_id: str,
    proposal_id: str,
    data: ApproveRequest,
    db: DB,
    current_user: CurrentUser,
    _auth: RequireEditor,
):
    photo = await _get_photo_or_404(db, site_id, photo_id)
    proposal = await _get_proposal_or_404(db, photo_id, proposal_id)

    if proposal.review_status != "pending":
        raise HTTPException(status_code=400, detail="Proposal already reviewed")

    # Apply optional edits
    if data.edits:
        for field, value in data.edits.model_dump(exclude_unset=True).items():
            setattr(proposal, field, value)

    # Determine location
    location_id = data.location_id or photo.location_id

    # Create Item
    item = Item(
        site_id=site_id,
        location_id=location_id,
        object_name=proposal.object_name or "Unknown",
        short_description=proposal.short_description,
        category=proposal.category,
        brand=proposal.brand,
        model=proposal.model,
        serial_numbers=proposal.serial_numbers,
        barcodes=proposal.barcodes,
        confidence_score=proposal.confidence_score,
        custom_tags=proposal.ai_suggested_tags,
        source_proposed_item_id=proposal.id,
        created_by=current_user.id,
        verification_count=1,
    )
    db.add(item)
    await db.flush()

    # Create ItemPhoto link
    item_photo = ItemPhoto(
        item_id=item.id,
        photo_id=photo_id,
        proposed_item_id=proposal.id,
        is_primary=True,
    )
    item.primary_photo_id = photo_id
    db.add(item_photo)

    # Movement if location set
    if location_id:
        mv = Movement(
            item_id=item.id,
            from_location_id=None,
            to_location_id=location_id,
            moved_by=current_user.id,
            proposed_item_id=proposal.id,
            photo_evidence_id=photo_id,
            reason="initial_placement_from_review",
        )
        db.add(mv)

    # Update proposal
    now = datetime.now(timezone.utc)
    proposal.review_status = "approved"
    proposal.reviewed_by = current_user.id
    proposal.reviewed_at = now

    audit = AuditLog(
        site_id=site_id,
        actor_user_id=current_user.id,
        action="proposal.approved",
        resource_type="proposed_item",
        resource_id=proposal.id,
        after_state={"item_id": item.id},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(proposal)
    return proposal


@router.post("/{photo_id}/proposals/{proposal_id}/reject", response_model=ProposedItemOut)
async def reject_proposal(
    site_id: str,
    photo_id: str,
    proposal_id: str,
    db: DB,
    current_user: CurrentUser,
    _auth: RequireEditor,
):
    await _get_photo_or_404(db, site_id, photo_id)
    proposal = await _get_proposal_or_404(db, photo_id, proposal_id)

    if proposal.review_status != "pending":
        raise HTTPException(status_code=400, detail="Proposal already reviewed")

    now = datetime.now(timezone.utc)
    proposal.review_status = "rejected"
    proposal.reviewed_by = current_user.id
    proposal.reviewed_at = now

    audit = AuditLog(
        site_id=site_id,
        actor_user_id=current_user.id,
        action="proposal.rejected",
        resource_type="proposed_item",
        resource_id=proposal.id,
    )
    db.add(audit)
    await db.commit()
    await db.refresh(proposal)
    return proposal


@router.patch("/{photo_id}/proposals/{proposal_id}", response_model=ProposedItemOut)
async def edit_proposal(
    site_id: str,
    photo_id: str,
    proposal_id: str,
    data: ProposedItemEdit,
    db: DB,
    _auth: RequireEditor,
):
    await _get_photo_or_404(db, site_id, photo_id)
    proposal = await _get_proposal_or_404(db, photo_id, proposal_id)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(proposal, field, value)

    await db.commit()
    await db.refresh(proposal)
    return proposal


@router.post("/{photo_id}/proposals/{proposal_id}/merge", response_model=ProposedItemOut)
async def merge_proposal(
    site_id: str,
    photo_id: str,
    proposal_id: str,
    data: MergeRequest,
    db: DB,
    current_user: CurrentUser,
    _auth: RequireEditor,
):
    await _get_photo_or_404(db, site_id, photo_id)
    proposal = await _get_proposal_or_404(db, photo_id, proposal_id)

    if proposal.review_status != "pending":
        raise HTTPException(status_code=400, detail="Proposal already reviewed")

    # Load target item
    item_result = await db.execute(
        select(Item).where(
            Item.id == data.into_item_id,
            Item.site_id == site_id,
            Item.deleted_at.is_(None),
        )
    )
    target_item = item_result.scalar_one_or_none()
    if not target_item:
        raise HTTPException(status_code=404, detail="Target item not found")

    if data.increment_quantity:
        target_item.quantity += 1

    # Increment verification count
    target_item.verification_count += 1

    # Add ItemPhoto link
    item_photo = ItemPhoto(
        item_id=target_item.id,
        photo_id=photo_id,
        proposed_item_id=proposal.id,
        is_primary=False,
    )
    db.add(item_photo)

    now = datetime.now(timezone.utc)
    proposal.review_status = "merged"
    proposal.reviewed_by = current_user.id
    proposal.reviewed_at = now
    proposal.merged_into_item_id = data.into_item_id

    audit = AuditLog(
        site_id=site_id,
        actor_user_id=current_user.id,
        action="proposal.merged",
        resource_type="proposed_item",
        resource_id=proposal.id,
        after_state={"merged_into_item_id": data.into_item_id},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(proposal)
    return proposal


@router.post("/{photo_id}/bulk-review")
async def bulk_review(
    site_id: str,
    photo_id: str,
    data: BulkReviewRequest,
    db: DB,
    current_user: CurrentUser,
    _auth: RequireEditor,
):
    photo = await _get_photo_or_404(db, site_id, photo_id)
    now = datetime.now(timezone.utc)
    results = {"approved": 0, "rejected": 0, "merged": 0, "errors": []}

    # Approve
    for pid in data.approved:
        try:
            proposal = await _get_proposal_or_404(db, photo_id, pid)
            if proposal.review_status != "pending":
                continue
            location_id = photo.location_id
            item = Item(
                site_id=site_id,
                location_id=location_id,
                object_name=proposal.object_name or "Unknown",
                short_description=proposal.short_description,
                category=proposal.category,
                brand=proposal.brand,
                model=proposal.model,
                serial_numbers=proposal.serial_numbers,
                barcodes=proposal.barcodes,
                confidence_score=proposal.confidence_score,
                custom_tags=proposal.ai_suggested_tags,
                source_proposed_item_id=proposal.id,
                created_by=current_user.id,
                verification_count=1,
            )
            db.add(item)
            await db.flush()
            item_photo = ItemPhoto(
                item_id=item.id,
                photo_id=photo_id,
                proposed_item_id=proposal.id,
                is_primary=True,
            )
            item.primary_photo_id = photo_id
            db.add(item_photo)
            if location_id:
                mv = Movement(
                    item_id=item.id,
                    from_location_id=None,
                    to_location_id=location_id,
                    moved_by=current_user.id,
                    proposed_item_id=proposal.id,
                    photo_evidence_id=photo_id,
                    reason="initial_placement_from_bulk_review",
                )
                db.add(mv)
            proposal.review_status = "approved"
            proposal.reviewed_by = current_user.id
            proposal.reviewed_at = now
            results["approved"] += 1
        except Exception as e:
            results["errors"].append({"id": pid, "error": str(e)})

    # Reject
    for pid in data.rejected:
        try:
            proposal = await _get_proposal_or_404(db, photo_id, pid)
            if proposal.review_status != "pending":
                continue
            proposal.review_status = "rejected"
            proposal.reviewed_by = current_user.id
            proposal.reviewed_at = now
            results["rejected"] += 1
        except Exception as e:
            results["errors"].append({"id": pid, "error": str(e)})

    # Merges
    for merge in data.merges:
        pid = merge.get("id")
        into_item_id = merge.get("into_item_id")
        try:
            proposal = await _get_proposal_or_404(db, photo_id, pid)
            if proposal.review_status != "pending":
                continue
            item_result = await db.execute(
                select(Item).where(
                    Item.id == into_item_id,
                    Item.site_id == site_id,
                    Item.deleted_at.is_(None),
                )
            )
            target = item_result.scalar_one_or_none()
            if not target:
                results["errors"].append({"id": pid, "error": "Target item not found"})
                continue
            target.verification_count += 1
            item_photo = ItemPhoto(
                item_id=target.id,
                photo_id=photo_id,
                proposed_item_id=proposal.id,
                is_primary=False,
            )
            db.add(item_photo)
            proposal.review_status = "merged"
            proposal.reviewed_by = current_user.id
            proposal.reviewed_at = now
            proposal.merged_into_item_id = into_item_id
            results["merged"] += 1
        except Exception as e:
            results["errors"].append({"id": pid, "error": str(e)})

    audit = AuditLog(
        site_id=site_id,
        actor_user_id=current_user.id,
        action="photo.bulk_review",
        resource_type="photo",
        resource_id=photo_id,
        after_state=results,
    )
    db.add(audit)
    await db.commit()
    return results
