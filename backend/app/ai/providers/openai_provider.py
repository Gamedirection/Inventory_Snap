from __future__ import annotations

import base64
import json
import logging

from app.ai.base_provider import BaseAIProvider, BoundingBox, DetectedObject
from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are an inventory detection assistant. Analyze the provided image and return a JSON array "
    "of all distinct physical objects detected. Each object must have: object_name (string), "
    "short_description (string), category (string), brand (string|null), model (string|null), "
    "serial_numbers (array of strings), barcodes (array of strings), confidence_score (float 0-1), "
    "suggested_tags (array of strings), bounding_box ({x, y, width, height} normalized 0-1)."
)

USER_PROMPT_TEMPLATE = (
    "Detect all physical inventory items in this image.{location_hint} "
    "Return ONLY a valid JSON array with no extra text or markdown."
)

JSON_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "object_name": {"type": "string"},
            "short_description": {"type": "string"},
            "category": {"type": "string"},
            "brand": {"type": ["string", "null"]},
            "model": {"type": ["string", "null"]},
            "serial_numbers": {"type": "array", "items": {"type": "string"}},
            "barcodes": {"type": "array", "items": {"type": "string"}},
            "confidence_score": {"type": "number"},
            "suggested_tags": {"type": "array", "items": {"type": "string"}},
            "bounding_box": {
                "type": "object",
                "properties": {
                    "x": {"type": "number"},
                    "y": {"type": "number"},
                    "width": {"type": "number"},
                    "height": {"type": "number"},
                },
                "required": ["x", "y", "width", "height"],
            },
        },
        "required": ["object_name", "short_description", "category", "confidence_score", "bounding_box"],
    },
}


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
        location_hint = f" Location: {location_context}." if location_context else ""
        user_prompt = USER_PROMPT_TEMPLATE.format(location_hint=location_hint)

        try:
            response = await client.chat.completions.create(
                model=self.model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
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
            )
        except Exception as exc:
            logger.error("OpenAIProvider: API call failed: %s", exc)
            return []

        content = response.choices[0].message.content or ""
        try:
            parsed = json.loads(content)
            # Model may return {"items": [...]} or directly a list
            if isinstance(parsed, list):
                raw_list = parsed
            elif isinstance(parsed, dict):
                raw_list = parsed.get("items") or parsed.get("objects") or []
            else:
                raw_list = []
        except json.JSONDecodeError as e:
            logger.warning("OpenAIProvider: JSON parse error: %s", e)
            return []

        return _parse_response(raw_list[: settings.ai_max_objects_per_photo])
