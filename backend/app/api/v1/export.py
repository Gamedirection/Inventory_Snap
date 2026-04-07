from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.config import settings
from app.db.models.export import ExportJob
from app.deps import CurrentUser, DB, site_role_checker
from app.schemas.export import ExportJobCreate, ExportJobOut
from app.services.photo_service import get_presigned_url

router = APIRouter(prefix="/sites/{site_id}/export", tags=["export"])

RequireViewer = Annotated[object, Depends(site_role_checker("viewer"))]
RequireEditor = Annotated[object, Depends(site_role_checker("editor"))]


def _enrich_job(job: ExportJob) -> ExportJobOut:
    out = ExportJobOut.model_validate(job)
    if job.status == "completed" and job.object_key:
        out.download_url = get_presigned_url(
            settings.minio_bucket_exports, job.object_key, expires=3600
        )
    return out


@router.post("", response_model=ExportJobOut, status_code=status.HTTP_201_CREATED)
async def create_export_job(
    site_id: str,
    data: ExportJobCreate,
    db: DB,
    current_user: CurrentUser,
    _auth: RequireViewer,
):
    job = ExportJob(
        site_id=site_id,
        requested_by=current_user.id,
        format=data.format,
        filters=data.filters.model_dump(),
        status="pending",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from app.workers.tasks.export_generation import generate_export
    task = generate_export.delay(job.id)
    job.celery_task_id = task.id
    await db.commit()

    return _enrich_job(job)


@router.get("/{job_id}", response_model=ExportJobOut)
async def get_export_job(
    site_id: str,
    job_id: str,
    db: DB,
    _auth: RequireViewer,
):
    result = await db.execute(
        select(ExportJob).where(
            ExportJob.id == job_id,
            ExportJob.site_id == site_id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    return _enrich_job(job)


@router.get("/{job_id}/download")
async def download_export(
    site_id: str,
    job_id: str,
    db: DB,
    _auth: RequireViewer,
):
    result = await db.execute(
        select(ExportJob).where(
            ExportJob.id == job_id,
            ExportJob.site_id == site_id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")

    if job.status != "completed" or not job.object_key:
        raise HTTPException(
            status_code=400,
            detail=f"Export not ready. Current status: {job.status}",
        )

    presigned_url = get_presigned_url(settings.minio_bucket_exports, job.object_key, expires=300)
    return RedirectResponse(url=presigned_url, status_code=status.HTTP_302_FOUND)
