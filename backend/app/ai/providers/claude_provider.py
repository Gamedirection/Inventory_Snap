from __future__ import annotations

import base64
import json
import logging

from app.ai.base_provider import BaseAIProvider, BoundingBox, DetectedObject
from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are an inventory detection assistant. When given an image, identify all distinct "
    "physical objects present. Return a JSON array where each element has: "
    "object_name, short_description, category, brand (or null), model (or null), "
    "serial_numbers (array), barcodes (array), confidence_score (0.0-1.0), "
    "suggested_tags (array), and bounding_box ({x, y, width, height} all normalized 0.0-1.0). "
    "Respond with only the JSON array and nothing else."
)


def _parse_response(raw_list: list[dict]) -> list[DetectedObject]:
    results: list[DetectedObject] = []
    for i, obj in enumerate(raw_list):
        bb = obj.get("bounding_box") or {}
        bbox = BoundingBox(
            x=float(bb.get("x", 0.0)),
            y=float(bb.get("y", 0.0)),
            width=float(bb.get("width", 1.0)),
            height=float(bb.get("height", 1.0)),
        )
        results.append(
            DetectedObject(
                bounding_box=bbox,
                object_name=str(obj.get("object_name") or "Unknown"),
                short_description=str(obj.get("short_description") or ""),
                category=str(obj.get("category") or "General"),
                brand=obj.get("brand") or None,
                model=obj.get("model") or None,
                serial_numbers=list(obj.get("serial_numbers") or []),
                barcodes=list(obj.get("barcodes") or []),
                confidence_score=float(obj.get("confidence_score") or 0.0),
                suggested_tags=list(obj.get("suggested_tags") or []),
                detection_index=i,
            )
        )
    return results


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

        user_content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": image_b64,
                },
            },
            {
                "type": "text",
                "text": (
                    f"Detect all physical inventory items in this image."
                    f"{' Location: ' + location_context + '.' if location_context else ''}"
                    " Return only a valid JSON array."
                ),
            },
        ]

        try:
            response = await client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_content}],
            )
        except Exception as exc:
            logger.error("ClaudeProvider: API call failed: %s", exc)
            return []

        content_block = response.content[0] if response.content else None
        raw_text = content_block.text if content_block and hasattr(content_block, "text") else ""

        # Strip markdown fences if present
        import re
        cleaned = re.sub(r"```(?:json)?", "", raw_text).strip().rstrip("`").strip()
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        if start == -1 or end == -1:
            logger.warning("ClaudeProvider: no JSON array found in response")
            return []

        try:
            raw_list = json.loads(cleaned[start: end + 1])
        except json.JSONDecodeError as e:
            logger.warning("ClaudeProvider: JSON parse error: %s", e)
            return []

        if not isinstance(raw_list, list):
            return []

        return _parse_response(raw_list[: settings.ai_max_objects_per_photo])
