from __future__ import annotations

import base64
import logging

import httpx

from app.ai.base_provider import (
    BaseAIProvider,
    DetectedObject,
    INVENTORY_DETECTION_PROMPT,
    extract_json_array,
    parse_detections,
)
from app.config import settings

logger = logging.getLogger(__name__)


class OllamaProvider(BaseAIProvider):
    def __init__(self) -> None:
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.model = settings.ollama_vision_model

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                if resp.status_code != 200:
                    return False
                data = resp.json()
                model_names = [m.get("name", "") for m in data.get("models", [])]
                base = self.model.split(":")[0]
                return any(
                    m == self.model or m.startswith(base + ":") or m == base
                    for m in model_names
                )
        except Exception:
            return False

    async def detect_objects(
        self,
        image_bytes: bytes,
        location_context: str | None = None,
    ) -> list[DetectedObject]:
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        loc_line = f"Location context: {location_context}" if location_context else ""
        prompt = INVENTORY_DETECTION_PROMPT.replace("{location_context}", loc_line)

        payload = {
            "model": self.model,
            "prompt": prompt,
            "images": [image_b64],
            "stream": False,
            "options": {"temperature": 0.1},
        }

        timeout = httpx.Timeout(
            connect=10.0,
            read=float(settings.ollama_timeout),
            write=30.0,
            pool=5.0,
        )
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(f"{self.base_url}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            raw_text = data.get("response", "")

        if not raw_text:
            logger.warning("OllamaProvider: empty response from model")
            return []

        raw_objects = extract_json_array(raw_text)
        if not raw_objects:
            logger.warning(
                "OllamaProvider: no objects parsed — raw response (first 500 chars): %.500s",
                raw_text,
            )
            return []

        results = parse_detections(
            raw_objects,
            max_objects=settings.ai_max_objects_per_photo,
            confidence_threshold=settings.ai_confidence_threshold,
        )
        logger.info("OllamaProvider: detected %d objects", len(results))
        return results
