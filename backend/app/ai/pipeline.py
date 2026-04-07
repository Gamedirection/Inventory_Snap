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
    Synchronous wrapper around the async AI provider for use in Celery tasks.

    Selects the best available provider via the provider factory and runs
    object detection. Uses asyncio.run() to bridge sync -> async.

    Raises on provider failure so the calling Celery task can retry.
    Returns an empty list only when the model genuinely found nothing.
    """
    from app.ai.provider_factory import get_provider

    provider = get_provider()  # raises if no provider can be built

    async def _run() -> list[DetectedObject]:
        return await provider.detect_objects(image_bytes, location_hint)

    try:
        return asyncio.run(_run())
    except RuntimeError as exc:
        # asyncio.run() raises RuntimeError if a loop is already running.
        # This shouldn't happen in Celery prefork workers, but handle it gracefully.
        logger.warning(
            "run_pipeline: asyncio.run() blocked (%s), retrying with new loop", exc
        )
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_run())
        finally:
            loop.close()
    # All other exceptions (httpx timeouts, HTTP errors, etc.) propagate to the task.
