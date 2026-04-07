from __future__ import annotations

import logging

from app.ai.base_provider import BaseAIProvider
from app.config import settings

logger = logging.getLogger(__name__)

_PROVIDER_MAP = {
    "ollama": "app.ai.providers.ollama_provider.OllamaProvider",
    "openai": "app.ai.providers.openai_provider.OpenAIProvider",
    "claude": "app.ai.providers.claude_provider.ClaudeProvider",
}


def _load_provider(name: str) -> BaseAIProvider | None:
    class_path = _PROVIDER_MAP.get(name)
    if not class_path:
        logger.warning("provider_factory: unknown provider '%s'", name)
        return None
    module_path, class_name = class_path.rsplit(".", 1)
    try:
        import importlib
        module = importlib.import_module(module_path)
        cls = getattr(module, class_name)
        return cls()
    except Exception as exc:
        logger.warning("provider_factory: failed to load provider '%s': %s", name, exc)
        return None


def get_provider() -> BaseAIProvider:
    """
    Return the first available provider in the configured fallback chain.

    Priority order:
    1. settings.ai_provider (primary)
    2. settings.ai_fallback_chain_list (ordered fallbacks)

    Each provider's is_available() is checked synchronously-by-proxy (sync wrapper).
    Falls back to OllamaProvider as ultimate default if nothing else is configured.
    """
    import asyncio

    chain = [settings.ai_provider] + [
        p for p in settings.ai_fallback_chain_list if p != settings.ai_provider
    ]

    for provider_name in chain:
        provider = _load_provider(provider_name)
        if provider is None:
            continue
        try:
            available = asyncio.run(provider.is_available())
        except RuntimeError:
            # Already inside an event loop — best-effort: assume available
            available = True
        if available:
            logger.info("provider_factory: using provider '%s'", provider_name)
            return provider
        logger.info("provider_factory: provider '%s' not available, trying next", provider_name)

    # Ultimate fallback: return Ollama provider regardless
    logger.warning("provider_factory: no provider available; defaulting to Ollama")
    from app.ai.providers.ollama_provider import OllamaProvider
    return OllamaProvider()
