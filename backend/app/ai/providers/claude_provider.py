from __future__ import annotations

import base64
import logging

from app.ai.base_provider import (
    BaseAIProvider,
    DetectedObject,
    INVENTORY_DETECTION_PROMPT,
    extract_json_array,
    parse_detections,
)
from app.config import settings

logger = logging.getLogger(__name__)

_SYSTEM = (
    "You are an expert inventory cataloging assistant. "
    "You analyse images and return structured JSON describing every physical object "
    "suitable for an inventory management system. "
    "Always respond with ONLY a valid JSON array — no markdown, no prose."
)


class ClaudeProvider(BaseAIProvider):
    def __init__(self) -> None:
        self.api_key = settings.claude_api_key
        self.model = settings.claude_vision_model

    async def is_available(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    async def detect_objects(
        self,
        image_bytes: bytes,
        location_context: str | None = None,
    ) -> list[DetectedObject]:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        loc_line = f"Location context: {location_context}" if location_context else ""
        user_prompt = INVENTORY_DETECTION_PROMPT.replace("{location_context}", loc_line)

        # image_bytes are always JPEG after preprocessing in pipeline.py
        response = await client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": user_prompt},
                    ],
                }
            ],
        )
        # Let exceptions propagate so the Celery task can retry.

        content_block = response.content[0] if response.content else None
        raw_text = (
            content_block.text
            if content_block and hasattr(content_block, "text")
            else ""
        )

        if not raw_text.strip():
            logger.warning("ClaudeProvider: empty response from model")
            return []

        raw_objects = extract_json_array(raw_text)
        if not raw_objects:
            logger.warning(
                "ClaudeProvider: no objects parsed — raw response (first 500 chars): %.500s",
                raw_text,
            )
            return []

        results = parse_detections(
            raw_objects,
            max_objects=settings.ai_max_objects_per_photo,
            confidence_threshold=settings.ai_confidence_threshold,
        )
        logger.info("ClaudeProvider: detected %d objects", len(results))
        return results
