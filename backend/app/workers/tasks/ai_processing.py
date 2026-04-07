from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from celery import Task

from app.workers.celery_app import celery_app
from app.config import settings

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="app.workers.tasks.ai_processing.process_photo",
    max_retries=3,
    default_retry_delay=120,
)
def process_photo(self: Task, photo_id: str) -> None:
    """
    Run the AI detection pipeline on a photo:
    1. Load photo from DB, set ai_status=processing
    2. Download image bytes from MinIO
    3. Run AI pipeline to detect objects
    4. Persist ProposedItem rows
    5. Set ai_status=completed, publish SSE event to Redis
    On failure: set ai_status=failed, retry up to 3 times with exponential backoff.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    import redis

    from app.db.models.photo import Photo
    from app.db.models.proposed import ProposedItem
    from app.services.photo_service import download_from_minio

    engine = create_engine(settings.database_url_sync, pool_pre_ping=True)
    redis_client = redis.from_url(settings.redis_url, decode_responses=True)

    with Session(engine) as session:
        photo = session.get(Photo, photo_id)
        if not photo:
            logger.warning("process_photo: photo %s not found", photo_id)
            return

        # Mark as processing
        now = datetime.now(timezone.utc)
        photo.ai_status = "processing"
        photo.ai_started_at = now
        session.add(photo)
        session.commit()

        try:
            image_bytes = download_from_minio(settings.minio_bucket_photos, photo.original_object_key)
        except Exception as exc:
            logger.error("process_photo: failed to download image for photo %s: %s", photo_id, exc)
            photo.ai_status = "failed"
            session.add(photo)
            session.commit()
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

        try:
            from app.ai.pipeline import run_pipeline
            location_hint: str | None = None
            if photo.location_id:
                from app.db.models.location import Location
                loc = session.get(Location, photo.location_id)
                if loc:
                    location_hint = loc.name

            proposals = run_pipeline(image_bytes, location_hint)
        except Exception as exc:
            logger.error("process_photo: AI pipeline failed for photo %s: %s", photo_id, exc)
            photo.ai_status = "failed"
            session.add(photo)
            session.commit()
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

        # Persist proposals
        for proposal in proposals:
            pi = ProposedItem(
                photo_id=photo_id,
                detection_index=proposal.detection_index,
                bounding_box={
                    "x": proposal.bounding_box.x,
                    "y": proposal.bounding_box.y,
                    "width": proposal.bounding_box.width,
                    "height": proposal.bounding_box.height,
                } if proposal.bounding_box else None,
                object_name=proposal.object_name,
                short_description=proposal.short_description,
                category=proposal.category,
                brand=proposal.brand,
                model=proposal.model,
                serial_numbers=proposal.serial_numbers or [],
                barcodes=proposal.barcodes or [],
                confidence_score=proposal.confidence_score,
                ai_suggested_tags=proposal.suggested_tags or [],
                review_status="pending",
            )
            session.add(pi)

        completed_at = datetime.now(timezone.utc)
        photo.ai_status = "completed"
        photo.ai_completed_at = completed_at
        session.add(photo)
        session.commit()

        # Also trigger thumbnail generation
        from app.workers.tasks.thumbnail import generate_thumbnail
        generate_thumbnail.delay(photo_id)

        # Publish SSE event to Redis
        try:
            event_data = json.dumps({
                "event": "review_queue_updated",
                "photo_id": photo_id,
                "proposal_count": len(proposals),
            })
            channel = f"site:{photo.site_id}:events"
            redis_client.publish(channel, event_data)
        except Exception as exc:
            logger.warning("process_photo: failed to publish SSE event for photo %s: %s", photo_id, exc)

    logger.info("process_photo: completed for photo %s with %d proposals", photo_id, len(proposals))
