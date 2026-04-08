from __future__ import annotations

import io
import logging

logger = logging.getLogger(__name__)

# Max dimension for AI input — balances detail vs. inference time/cost
_MAX_DIM = 1920
_JPEG_QUALITY = 88


def preprocess_for_ai(image_bytes: bytes) -> bytes:
    """
    Resize and normalise an image for AI processing:
      - Downsample to at most _MAX_DIM on the longest side (preserves aspect ratio)
      - Convert to RGB JPEG (strips alpha, EXIF, and ensures the provider
        receives a format it can actually decode — all three providers
        previously hardcoded 'image/jpeg' regardless of the real format)

    Returns JPEG bytes ready for base64-encoding.
    Raises on corrupt/unreadable image data.
    """
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGB")

    w, h = img.size
    if w > _MAX_DIM or h > _MAX_DIM:
        ratio = min(_MAX_DIM / w, _MAX_DIM / h)
        new_w, new_h = int(w * ratio), int(h * ratio)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        logger.debug("preprocess_for_ai: resized %dx%d → %dx%d", w, h, new_w, new_h)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=_JPEG_QUALITY, optimize=True)
    return buf.getvalue()
