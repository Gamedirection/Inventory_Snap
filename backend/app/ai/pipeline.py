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

    Args:
        image_bytes: Raw bytes of the image to analyze.
        location_hint: Optional location name/description to provide context to the AI.

    Returns:
        List of DetectedObject instances. Empty list on any failure.
    """
    from app.ai.provider_factory import get_provider

    try:
        provider = get_provider()
    except Exception as exc:
        logger.error("run_pipeline: failed to get provider: %s", exc)
        return []

    async def _run() -> list[DetectedObject]:
        return await provider.detect_objects(image_bytes, location_hint)

    try:
        return asyncio.run(_run())
    except RuntimeError as exc:
        # If we're somehow already inside an event loop (shouldn't happen in Celery),
        # create a new loop explicitly.
        logger.warning("run_pipeline: asyncio.run() failed (%s), trying new loop", exc)
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_run())
        except Exception as inner_exc:
            logger.error("run_pipeline: detection failed: %s", inner_exc)
            return []
        finally:
            loop.close()
    except Exception as exc:
        logger.error("run_pipeline: detection failed: %s", exc)
        return []
