from __future__ import annotations

import json
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from app.api.router import api_router
from app.config import settings
from app.deps import bearer_scheme
from app.services.auth_service import decode_token


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title="Inventory Snap API",
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all API routes
app.include_router(api_router)


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "version": settings.app_version}


@app.get("/api/v1/sites/{site_id}/events", tags=["sse"])
async def site_events(
    site_id: str,
    token: str = Query(..., description="Bearer token (EventSource cannot set headers)"),
):
    """Server-Sent Events endpoint for real-time site notifications."""
    # Validate token manually (EventSource cannot send Authorization header)
    from jose import JWTError
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise JWTError("Not an access token")
    except (JWTError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    channel = f"site:{site_id}:events"

    async def event_generator() -> AsyncGenerator[dict, None]:
        redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(channel)
        try:
            # Send initial connected event
            yield {"event": "connected", "data": json.dumps({"site_id": site_id})}

            while True:
                try:
                    message = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=30.0)
                    if message and message.get("type") == "message":
                        raw = message.get("data", "{}")
                        try:
                            data = json.loads(raw)
                        except json.JSONDecodeError:
                            data = {"raw": raw}
                        event_type = data.pop("event", "notification")
                        yield {"event": event_type, "data": json.dumps(data)}
                    else:
                        # Heartbeat to keep connection alive
                        yield {"event": "heartbeat", "data": json.dumps({"ping": True})}
                except asyncio.TimeoutError:
                    yield {"event": "heartbeat", "data": json.dumps({"ping": True})}
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()
            await redis_client.aclose()

    return EventSourceResponse(event_generator())
