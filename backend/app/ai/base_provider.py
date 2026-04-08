from __future__ import annotations

import json
import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class BoundingBox:
    x: float
    y: float
    width: float
    height: float  # all normalised 0–1


@dataclass
class DetectedObject:
    bounding_box: BoundingBox
    object_name: str
    short_description: str
    category: str
    brand: str | None = None
    model: str | None = None
    serial_numbers: list[str] = field(default_factory=list)
    barcodes: list[str] = field(default_factory=list)
    confidence_score: float = 0.0
    suggested_tags: list[str] = field(default_factory=list)
    detection_index: int = 0


# ---------------------------------------------------------------------------
# Shared prompt — used by all three providers
# ---------------------------------------------------------------------------

INVENTORY_DETECTION_PROMPT = (
    "You are an inventory cataloging system. Analyze this image and identify every "
    "distinct, moveable physical object suitable for an inventory record.\n\n"
    "FOCUS ON: Electronics (computers, monitors, phones, cables, servers), "
    "furniture (desks, chairs, shelves, cabinets), tools and equipment, "
    "appliances, office supplies, containers with contents, and valuables.\n"
    "IGNORE: Walls, floors, ceilings, built-in fixtures, logos or graphics, people.\n\n"
    "For EACH detected object return a JSON object with EXACTLY these fields:\n"
    '  object_name       - concise name (e.g. "Dell 27-inch Monitor", "Office Chair")\n'
    "  short_description - 1-2 sentences including visible condition and notable features\n"
    "  category          - one of: Electronics | Furniture | Tools | Appliances | "
    "Equipment | Office Supplies | Containers | Valuables | Other\n"
    "  brand             - visible brand/manufacturer name, or null\n"
    "  model             - model number or name if visible, or null\n"
    "  serial_numbers    - array of any visible serial, asset tag, or ID sticker values "
    "(empty array if none visible)\n"
    "  barcodes          - array of any visible barcode or QR-code values "
    "(empty array if none visible)\n"
    "  confidence_score  - float 0.0 to 1.0 (your confidence in the identification)\n"
    "  suggested_tags    - array of lowercase search-friendly keywords\n"
    '  bounding_box      - {"x": float, "y": float, "width": float, "height": float} '
    "all normalised 0.0 to 1.0 relative to image dimensions\n\n"
    "{location_context}\n\n"
    "Example output (one item):\n"
    '[{"object_name": "Dell UltraSharp 27 Monitor", '
    '"short_description": "27-inch LCD monitor in good condition, mounted on a stand.", '
    '"category": "Electronics", "brand": "Dell", "model": "U2722D", '
    '"serial_numbers": ["CN0ABC123"], "barcodes": [], "confidence_score": 0.92, '
    '"suggested_tags": ["monitor", "display", "dell", "lcd"], '
    '"bounding_box": {"x": 0.1, "y": 0.05, "width": 0.4, "height": 0.6}}]\n\n'
    "Respond with ONLY the JSON array. No markdown fences, no explanation, no text "
    "before or after the array."
)


# ---------------------------------------------------------------------------
# Shared JSON extraction and parsing
# ---------------------------------------------------------------------------

def extract_json_array(text: str) -> list[dict]:
    """
    Extract a JSON array from model output.

    Handles:
    - Markdown code fences (```json … ```)
    - Trailing commas (common LLM error)
    - Prefix/suffix prose around the array
    """
    # Strip markdown fences (including leading whitespace before them)
    cleaned = re.sub(r"\s*```(?:json)?\s*", " ", text, flags=re.IGNORECASE).strip()
    cleaned = cleaned.strip("`").strip()

    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start == -1 or end == -1:
        return []

    array_str = cleaned[start: end + 1]

    # Strict parse first
    try:
        result = json.loads(array_str)
        return result if isinstance(result, list) else []
    except json.JSONDecodeError:
        pass

    # Fix trailing commas (e.g. [{"a": 1,}] or [1, 2,])
    fixed = re.sub(r",\s*([}\]])", r"\1", array_str)
    try:
        result = json.loads(fixed)
        return result if isinstance(result, list) else []
    except json.JSONDecodeError as exc:
        logger.warning("extract_json_array: JSON parse failed after cleanup: %s", exc)
        return []


def parse_detections(
    raw_list: list[dict],
    max_objects: int = 20,
    confidence_threshold: float = 0.0,
) -> list[DetectedObject]:
    """
    Convert raw dicts from model output to DetectedObject instances.

    - Clamps bounding box coordinates to [0, 1]
    - Filters by confidence threshold
    - Provides safe defaults for missing fields
    """
    results: list[DetectedObject] = []
    for i, obj in enumerate(raw_list):
        if len(results) >= max_objects:
            break

        try:
            confidence = float(obj.get("confidence_score") or 0.0)
        except (TypeError, ValueError):
            confidence = 0.0

        if confidence < confidence_threshold:
            continue

        bb = obj.get("bounding_box") or {}
        try:
            x = max(0.0, min(1.0, float(bb.get("x", 0.0))))
            y = max(0.0, min(1.0, float(bb.get("y", 0.0))))
            w = max(0.01, min(1.0 - x, float(bb.get("width", 1.0))))
            h = max(0.01, min(1.0 - y, float(bb.get("height", 1.0))))
        except (TypeError, ValueError):
            x, y, w, h = 0.0, 0.0, 1.0, 1.0

        serial_numbers = [str(s) for s in (obj.get("serial_numbers") or []) if s]
        barcodes = [str(b) for b in (obj.get("barcodes") or []) if b]
        suggested_tags = [str(t).lower() for t in (obj.get("suggested_tags") or []) if t]

        results.append(
            DetectedObject(
                bounding_box=BoundingBox(x=x, y=y, width=w, height=h),
                object_name=str(obj.get("object_name") or "Unknown Item"),
                short_description=str(obj.get("short_description") or ""),
                category=str(obj.get("category") or "Other"),
                brand=obj.get("brand") or None,
                model=obj.get("model") or None,
                serial_numbers=serial_numbers,
                barcodes=barcodes,
                confidence_score=confidence,
                suggested_tags=suggested_tags,
                detection_index=i,
            )
        )
    return results


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------

class BaseAIProvider(ABC):
    @abstractmethod
    async def detect_objects(
        self,
        image_bytes: bytes,
        location_context: str | None = None,
    ) -> list[DetectedObject]:
        """Detect objects in the given image and return structured results."""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """Check whether this provider is configured and reachable."""
        ...
