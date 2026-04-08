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

# System instruction separate from the vision prompt
_SYSTEM = (
    "You are an expert inventory cataloging assistant. "
    "You analyse images and return structured JSON describing every physical object "
    "suitable for an inventory management system. "
    "Always respond with ONLY a valid JSON array — no markdown, no prose."
)


class OpenAIProvider(BaseAIProvider):
    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_vision_model

    async def is_available(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    async def detect_objects(
        self,
        image_bytes: bytes,
        location_context: str | None = None,
    ) -> list[DetectedObject]:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self.api_key)
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        loc_line = f"Location context: {location_context}" if location_context else ""
        user_prompt = INVENTORY_DETECTION_PROMPT.replace("{location_context}", loc_line)

        # image_bytes are always JPEG after preprocessing in pipeline.py
        response = await client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_b64}",
                                "detail": "high",
                            },
                        },
                        {"type": "text", "text": user_prompt},
                    ],
                },
            ],
            max_tokens=4096,
            temperature=0.1,
        )
        # Let exceptions propagate so the Celery task can retry.

        content = response.choices[0].message.content or ""
        if not content.strip():
            logger.warning("OpenAIProvider: empty response from model")
            return []

        # GPT-4o may return a top-level dict like {"items": [...]}
        # Try array extraction first; if that yields nothing try dict unwrap.
        raw_objects = extract_json_array(content)
        if not raw_objects:
            import json
            try:
                parsed = json.loads(content)
                if isinstance(parsed, dict):
                    raw_objects = (
                        parsed.get("items")
                        or parsed.get("objects")
                        or parsed.get("detections")
                        or []
                    )
            except Exception:
                pass

        if not raw_objects:
            logger.warning(
                "OpenAIProvider: no objects parsed — raw response (first 500 chars): %.500s",
                content,
            )
            return []

        results = parse_detections(
            raw_objects,
            max_objects=settings.ai_max_objects_per_photo,
            confidence_threshold=settings.ai_confidence_threshold,
        )
        logger.info("OpenAIProvider: detected %d objects", len(results))
        return results
