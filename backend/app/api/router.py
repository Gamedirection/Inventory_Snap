from fastapi import APIRouter

from app.api.v1 import auth, export, items, locations, photos, review, sites

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/api/v1")
api_router.include_router(sites.router, prefix="/api/v1")
api_router.include_router(locations.router, prefix="/api/v1")
api_router.include_router(photos.router, prefix="/api/v1")
api_router.include_router(items.router, prefix="/api/v1")
api_router.include_router(review.router, prefix="/api/v1")
api_router.include_router(export.router, prefix="/api/v1")
