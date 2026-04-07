from __future__ import annotations

import base64
import json
import logging
import re

import httpx

from app.ai.base_provider import BaseAIProvider, BoundingBox, DetectedObject
from app.config import settings

logger = logging.getLogger(__name__)

DETECTION_PROMPT = """You are an inventory detection system. Analyze this image and identify all distinct physical objects.

For each object found, return a JSON array with objects containing these exact fields:
- object_name: string (concise name, e.g. "Dell Monitor", "Office Chair")
- short_description: string (1-2 sentence description)
- category: string (e.g. "Electronics", "Furniture", "Tools", "Appliances")
- brand: string or null
- model: string or null
- serial_numbers: array of strings (empty if not visible)
- barcodes: array of strings (empty if not visible)
- confidence_score: float between 0.0 and 1.0
- suggested_tags: array of strings (relevant keywords)
- bounding_box: object with x, y, width, height as floats 0.0-1.0 (normalized to image dimensions)

{location_context}

Respond ONLY with a valid JSON array. No markdown, no explanation outside the JSON.
Example: [{"object_name": "Laptop", "short_description": "A laptop computer.", "category": "Electronics", "brand": "Dell", "model": null, "serial_numbers": [], "barcodes": [], "confidence_score": 0.9, "suggested_tags": ["laptop", "computer"], "bounding_box": {"x": 0.1, "y": 0.1, "width": 0.3, "height": 0.4}}]
"""


def _extract_json_array(text: str) -> list[dict]:
    """Extract a JSON array from model output, handling markdown code fences."""
    # Strip markdown code fences
    cleaned = re.sub(r"```(?:json)?", "", text).strip()
    cleaned = cleaned.rstrip("`").strip()

    # Find first [ and last ]
    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start == -1 or end == -1:
        return []

    try:
        return json.loads(cleaned[start: end + 1])
    except json.JSONDecodeError as e:
        logger.warning("ollama_provider: JSON parse error: %s", e)
        return []


def _parse_objects(raw_objects: list[dict]) -> list[DetectedObject]:
    results: list[DetectedObject] = []
    for i, obj in enumerate(raw_objects):
        bb_data = obj.get("bounding_box") or {}
        bbox = BoundingBox(
            x=float(bb_data.get("x", 0.0)),
            y=float(bb_data.get("y", 0.0)),
            width=float(bb_data.get("width", 1.0)),
            height=float(bb_data.get("height", 1.0)),
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


class OllamaProvider(BaseAIProvider):
    def __init__(self) -> None:
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.model = settings.ollama_vision_model

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False

    async def detect_objects(
        self,
        image_bytes: bytes,
        location_context: str | None = None,
    ) -> list[DetectedObject]:
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        loc_line = f"Location context: {location_context}" if location_context else ""
        prompt = DETECTION_PROMPT.format(location_context=loc_line)

        payload = {
            "model": self.model,
            "prompt": prompt,
            "images": [image_b64],
            "stream": False,
            "options": {"temperature": 0.1},
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(f"{self.base_url}/api/generate", json=payload)
                resp.raise_for_status()
                data = resp.json()
                raw_text = data.get("response", "")
        except Exception as exc:
            logger.error("OllamaProvider: request failed: %s", exc)
            return []

        raw_objects = _extract_json_array(raw_text)
        if not raw_objects:
            logger.warning("OllamaProvider: no objects parsed from response")
            return []

        return _parse_objects(raw_objects[: settings.ai_max_objects_per_photo])
