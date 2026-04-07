from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models.photo import Photo
from app.deps import CurrentUser, DB, site_role_checker
from app.schemas.photo import BatchUploadResponse, PhotoOut, PhotoUploadResponse
from app.services.photo_service import get_presigned_url, upload_to_minio

router = APIRouter(prefix="/sites/{site_id}/photos", tags=["photos"])

RequireViewer = Annotated[object, Depends(site_role_checker("viewer"))]
RequireEditor = Annotated[object, Depends(site_role_checker("editor"))]
RequireAdmin = Annotated[object, Depends(site_role_checker("admin"))]

_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/tiff"}


def _enrich_photo(photo: Photo) -> PhotoOut:
    out = PhotoOut.model_validate(photo)
    if photo.original_object_key:
        presigned = get_presigned_url(settings.minio_bucket_photos, photo.original_object_key)
        out.url = presigned
        out.original_url = presigned
    if photo.thumbnail_object_key:
        out.thumbnail_url = get_presigned_url(settings.minio_bucket_thumbnails, photo.thumbnail_object_key)
    return out


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

    # Enqueue Celery task
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
