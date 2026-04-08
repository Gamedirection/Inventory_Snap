from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models.item import Item, ItemPhoto
from app.db.models.location import Location
from app.db.models.photo import Photo
from app.deps import CurrentUser, DB, site_role_checker
from app.schemas.photo import (
    BatchUploadResponse,
    PhotoDetail,
    PhotoOut,
    PhotoPinCreate,
    PhotoPinOut,
    PhotoUpdate,
    PhotoUploadResponse,
)
from app.services.photo_service import get_presigned_url, upload_to_minio

router = APIRouter(prefix="/sites/{site_id}/photos", tags=["photos"])

RequireViewer = Annotated[object, Depends(site_role_checker("viewer"))]
RequireEditor = Annotated[object, Depends(site_role_checker("editor"))]
RequireAdmin = Annotated[object, Depends(site_role_checker("admin"))]

_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/tiff"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _enrich_photo(photo: Photo) -> PhotoOut:
    out = PhotoOut.model_validate(photo)
    if photo.original_object_key:
        presigned = get_presigned_url(settings.minio_bucket_photos, photo.original_object_key)
        out.url = presigned
        out.original_url = presigned
    if photo.thumbnail_object_key:
        out.thumbnail_url = get_presigned_url(settings.minio_bucket_thumbnails, photo.thumbnail_object_key)
    elif photo.original_object_key:
        # Thumbnail not yet generated — use original so images still appear
        out.thumbnail_url = out.url
    return out


async def _build_photo_detail(photo: Photo, db: AsyncSession) -> PhotoDetail:
    """Enrich a Photo with presigned URLs, pins, and location path."""
    base = _enrich_photo(photo)
    detail = PhotoDetail(**base.model_dump())

    # Build location path
    if photo.location_id:
        path_parts: list[str] = []
        cur_id = photo.location_id
        seen: set[str] = set()
        while cur_id and cur_id not in seen:
            seen.add(cur_id)
            loc_res = await db.execute(select(Location).where(Location.id == cur_id))
            loc = loc_res.scalar_one_or_none()
            if not loc:
                break
            path_parts.insert(0, loc.name)
            if len(path_parts) == 1:
                detail.location_name = loc.name
            cur_id = loc.parent_id
        detail.location_path = " > ".join(path_parts)

    # Fetch pinned items
    pins_res = await db.execute(
        select(ItemPhoto, Item)
        .join(Item, ItemPhoto.item_id == Item.id)
        .where(
            ItemPhoto.photo_id == photo.id,
            Item.deleted_at.is_(None),
        )
        .order_by(ItemPhoto.created_at.asc())
    )
    detail.pins = [
        PhotoPinOut(
            pin_id=ip.id,
            item_id=item.id,
            item_name=item.object_name or "Unknown",
            category=item.category,
            annotation_bbox=ip.annotation_bbox,
            is_primary=ip.is_primary,
        )
        for ip, item in pins_res.all()
    ]

    return detail


async def _upload_single(
    site_id: str,
    file: UploadFile,
    current_user,
    db: AsyncSession,
    location_id: str | None = None,
) -> Photo:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    photo_id = str(uuid.uuid4())
    safe_name = file.filename or "photo.jpg"
    object_key = f"original/{site_id}/{photo_id}/{safe_name}"
    content_type = file.content_type or "image/jpeg"

    upload_to_minio(settings.minio_bucket_photos, object_key, data, content_type)

    photo = Photo(
        id=photo_id,
        site_id=site_id,
        location_id=location_id,
        original_object_key=object_key,
        uploaded_by=current_user.id,
        file_size_bytes=len(data),
        mime_type=content_type,
        ai_status="pending",
    )
    db.add(photo)
    return photo


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("", response_model=PhotoUploadResponse, status_code=status.HTTP_201_CREATED)
@router.post("/upload", response_model=PhotoUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    site_id: str,
    file: UploadFile,
    db: DB,
    current_user: CurrentUser,
    _auth: RequireEditor,
    location_id: str | None = Query(default=None),
):
    photo = await _upload_single(site_id, file, current_user, db, location_id)
    await db.commit()
    await db.refresh(photo)

    from app.workers.tasks.ai_processing import process_photo
    task = process_photo.delay(photo.id)
    photo.celery_task_id = task.id
    await db.commit()

    return PhotoUploadResponse(photo_id=photo.id, ai_status=photo.ai_status)


@router.post("/upload/batch", response_model=BatchUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_photos_batch(
    site_id: str,
    files: list[UploadFile],
    db: DB,
    current_user: CurrentUser,
    _auth: RequireEditor,
    location_id: str | None = Query(default=None),
):
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 files per batch")

    responses: list[PhotoUploadResponse] = []
    for file in files:
        photo = await _upload_single(site_id, file, current_user, db, location_id)
        await db.flush()

        from app.workers.tasks.ai_processing import process_photo
        task = process_photo.delay(photo.id)
        photo.celery_task_id = task.id
        responses.append(PhotoUploadResponse(photo_id=photo.id, ai_status=photo.ai_status))

    await db.commit()
    return BatchUploadResponse(photos=responses, total=len(responses))


# ── List / get ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[PhotoOut])
async def list_photos(
    site_id: str,
    db: DB,
    _auth: RequireViewer,
    location_id: str | None = Query(default=None),
    ai_status: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
):
    q = select(Photo).where(Photo.site_id == site_id, Photo.deleted_at.is_(None))
    if location_id:
        q = q.where(Photo.location_id == location_id)
    if ai_status:
        q = q.where(Photo.ai_status == ai_status)
    if date_from:
        q = q.where(Photo.created_at >= date_from)
    if date_to:
        q = q.where(Photo.created_at <= date_to)

    q = q.order_by(Photo.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    photos = result.scalars().all()
    return [_enrich_photo(p) for p in photos]


@router.get("/{photo_id}", response_model=PhotoOut)
async def get_photo(
    site_id: str,
    photo_id: str,
    db: DB,
    _auth: RequireViewer,
):
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
    return _enrich_photo(photo)


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{photo_id}", response_model=PhotoOut)
async def update_photo(
    site_id: str,
    photo_id: str,
    body: PhotoUpdate,
    db: DB,
    _auth: RequireEditor,
):
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

    if body.location_id is not None:
        # Validate location belongs to this site
        if body.location_id:
            loc_res = await db.execute(
                select(Location).where(
                    Location.id == body.location_id,
                    Location.site_id == site_id,
                )
            )
            if not loc_res.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Location not found in this site")
        photo.location_id = body.location_id or None

    await db.commit()
    await db.refresh(photo)
    return _enrich_photo(photo)


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo(
    site_id: str,
    photo_id: str,
    db: DB,
    _auth: RequireEditor,
):
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

    photo.deleted_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/{photo_id}/reprocess", response_model=PhotoUploadResponse)
async def reprocess_photo(
    site_id: str,
    photo_id: str,
    db: DB,
    _auth: RequireAdmin,
):
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

    photo.ai_status = "pending"
    photo.ai_started_at = None
    photo.ai_completed_at = None

    from app.workers.tasks.ai_processing import process_photo
    task = process_photo.delay(photo.id)
    photo.celery_task_id = task.id
    await db.commit()

    return PhotoUploadResponse(photo_id=photo.id, ai_status=photo.ai_status)


# ── Pins (item ↔ photo linking) ───────────────────────────────────────────────

@router.get("/{photo_id}/detail", response_model=PhotoDetail)
async def get_photo_detail(
    site_id: str,
    photo_id: str,
    db: DB,
    _auth: RequireViewer,
):
    """Return a photo with all linked inventory item pins."""
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
    return await _build_photo_detail(photo, db)


@router.post("/{photo_id}/pins", response_model=PhotoDetail, status_code=status.HTTP_201_CREATED)
async def pin_item_to_photo(
    site_id: str,
    photo_id: str,
    body: PhotoPinCreate,
    db: DB,
    _auth: RequireEditor,
):
    """Pin an inventory item to a photo, optionally recording the bbox location."""
    photo_res = await db.execute(
        select(Photo).where(
            Photo.id == photo_id,
            Photo.site_id == site_id,
            Photo.deleted_at.is_(None),
        )
    )
    photo = photo_res.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    item_res = await db.execute(
        select(Item).where(
            Item.id == body.item_id,
            Item.site_id == site_id,
            Item.deleted_at.is_(None),
        )
    )
    item = item_res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Check if already pinned — update bbox instead of creating duplicate
    existing_res = await db.execute(
        select(ItemPhoto).where(
            ItemPhoto.photo_id == photo_id,
            ItemPhoto.item_id == body.item_id,
        )
    )
    existing = existing_res.scalar_one_or_none()

    if existing:
        if body.annotation_bbox is not None:
            existing.annotation_bbox = body.annotation_bbox
        if body.set_as_primary and not existing.is_primary:
            # Clear any existing primary flag for this item
            existing.is_primary = True
    else:
        ip = ItemPhoto(
            item_id=body.item_id,
            photo_id=photo_id,
            is_primary=body.set_as_primary,
            annotation_bbox=body.annotation_bbox,
        )
        db.add(ip)
        if body.set_as_primary and not item.primary_photo_id:
            item.primary_photo_id = photo_id

    await db.commit()
    return await _build_photo_detail(photo, db)


@router.delete("/{photo_id}/pins/{pin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unpin_item_from_photo(
    site_id: str,
    photo_id: str,
    pin_id: str,
    db: DB,
    _auth: RequireEditor,
):
    """Remove an item pin from a photo."""
    # Verify photo belongs to site
    photo_res = await db.execute(
        select(Photo).where(
            Photo.id == photo_id,
            Photo.site_id == site_id,
            Photo.deleted_at.is_(None),
        )
    )
    if not photo_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Photo not found")

    pin_res = await db.execute(
        select(ItemPhoto).where(
            ItemPhoto.id == pin_id,
            ItemPhoto.photo_id == photo_id,
        )
    )
    pin = pin_res.scalar_one_or_none()
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    await db.delete(pin)
    await db.commit()
