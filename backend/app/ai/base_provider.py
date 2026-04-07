from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class BoundingBox:
    x: float
    y: float
    width: float
    height: float  # normalized 0-1


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
