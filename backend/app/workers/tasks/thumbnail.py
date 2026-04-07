from __future__ import annotations

import io
import logging

from celery import Task

from app.workers.celery_app import celery_app
from app.config import settings

logger = logging.getLogger(__name__)

MAX_SIZE = 600  # px


@celery_app.task(
    bind=True,
    name="app.workers.tasks.thumbnail.generate_thumbnail",
    max_retries=3,
    default_retry_delay=60,
)
def generate_thumbnail(self: Task, photo_id: str) -> None:
    """
    Load original image from MinIO, resize to max 600px, strip EXIF,
    save as JPEG quality 80 to thumbnails bucket, and update the Photo record.
    """
    from PIL import Image
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.db.models.photo import Photo
    from app.services.photo_service import download_from_minio, get_minio_client

    engine = create_engine(settings.database_url_sync, pool_pre_ping=True)

    with Session(engine) as session:
        photo = session.get(Photo, photo_id)
        if not photo:
            logger.warning("generate_thumbnail: photo %s not found", photo_id)
            return
        if not photo.original_object_key:
            logger.warning("generate_thumbnail: photo %s has no original_object_key", photo_id)
            return

        try:
            image_bytes = download_from_minio(settings.minio_bucket_photos, photo.original_object_key)
        except Exception as exc:
            logger.error("generate_thumbnail: failed to download photo %s: %s", photo_id, exc)
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

        try:
            img = Image.open(io.BytesIO(image_bytes))
            img = img.convert("RGB")

            # Resize preserving aspect ratio
            img.thumbnail((MAX_SIZE, MAX_SIZE), Image.LANCZOS)

            # Save without EXIF (Pillow strips EXIF when saving fresh without exif param)
            output = io.BytesIO()
            img.save(output, format="JPEG", quality=80, optimize=True)
            thumb_bytes = output.getvalue()
        except Exception as exc:
            logger.error("generate_thumbnail: failed to process image for photo %s: %s", photo_id, exc)
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

        # Derive thumbnail key from original key
        original_key = photo.original_object_key
        # e.g. original/site_id/photo_id/filename.jpg -> thumb_original/site_id/photo_id/filename.jpg
        thumb_key = "thumb_" + original_key

        try:
            s3 = get_minio_client()
            s3.put_object(
                Bucket=settings.minio_bucket_thumbnails,
                Key=thumb_key,
                Body=thumb_bytes,
                ContentType="image/jpeg",
            )
        except Exception as exc:
            logger.error("generate_thumbnail: failed to upload thumbnail for photo %s: %s", photo_id, exc)
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

        photo.thumbnail_object_key = thumb_key
        session.add(photo)
        session.commit()
        logger.info("generate_thumbnail: completed for photo %s -> %s", photo_id, thumb_key)
