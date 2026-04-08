from __future__ import annotations

import asyncio
import logging

from app.ai.base_provider import DetectedObject

logger = logging.getLogger(__name__)


def run_pipeline(
    image_bytes: bytes,
    location_hint: str | None = None,
) -> list[DetectedObject]:
    """
    Synchronous entry point for the AI detection pipeline (called from Celery tasks).

    Steps:
      1. Preprocess image — resize to max 1920px, convert to JPEG
      2. Select best available provider via the provider factory
      3. Run object detection (async, bridged via asyncio.run)

    Raises on provider failure so the calling Celery task can retry.
    Returns an empty list only when the model genuinely found nothing.
    """
    from app.ai.image_utils import preprocess_for_ai
    from app.ai.provider_factory import get_provider

    try:
        image_bytes = preprocess_for_ai(image_bytes)
    except Exception as exc:
        logger.error(
            "run_pipeline: image preprocessing failed (%s): %s",
            type(exc).__name__,
            exc,
        )
        raise  # corrupt image — task should mark as failed and not retry

    provider = get_provider()  # raises if no provider can be instantiated

    async def _run() -> list[DetectedObject]:
        return await provider.detect_objects(image_bytes, location_hint)

    try:
        return asyncio.run(_run())
    except RuntimeError as exc:
        # asyncio.run() raises RuntimeError if a loop is already running.
        # Shouldn't happen in Celery prefork workers, but handle gracefully.
        logger.warning(
            "run_pipeline: asyncio.run() blocked (%s), retrying with new loop", exc
        )
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_run())
        finally:
            loop.close()
    # All other exceptions propagate to the task for retry handling.
