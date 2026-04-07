from __future__ import annotations

import mimetypes
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.item import Item
from app.db.models.location import FloorMap, Location
from app.deps import CurrentUser, DB, site_role_checker
from app.schemas.location import (
    FloorMapOut,
    FloorMapUpdate,
    LocationCreate,
    LocationOut,
    LocationUpdate,
)
from app.services.photo_service import download_from_minio, get_minio_client, upload_to_minio
from app.config import settings

router = APIRouter(prefix="/sites/{site_id}/locations", tags=["locations"])

RequireEditor = Annotated[object, Depends(site_role_checker("editor"))]
RequireAdmin = Annotated[object, Depends(site_role_checker("admin"))]
RequireViewer = Annotated[object, Depends(site_role_checker("viewer"))]


def _build_tree(flat: list[Location], item_counts: dict[str, int]) -> list[LocationOut]:
    """Build a nested location tree from a flat list."""
    nodes: dict[str, LocationOut] = {}
    for loc in flat:
        out = LocationOut.model_validate(loc)
        out.item_count = item_counts.get(loc.id, 0)
        nodes[loc.id] = out

    roots: list[LocationOut] = []
    for loc in flat:
        node = nodes[loc.id]
        if loc.parent_id and loc.parent_id in nodes:
            nodes[loc.parent_id].children.append(node)
        else:
            roots.append(node)
    return roots


async def _get_item_counts(db: AsyncSession, site_id: str) -> dict[str, int]:
    result = await db.execute(
        select(Item.location_id, func.count(Item.id).label("cnt"))
        .where(Item.site_id == site_id, Item.deleted_at.is_(None))
        .group_by(Item.location_id)
    )
    return {row.location_id: row.cnt for row in result.fetchall() if row.location_id}


@router.get("", response_model=list[LocationOut])
async def get_location_tree(
    site_id: str,
    db: DB,
    _auth: RequireViewer,
):
    """Return full nested tree of locations for a site."""
    result = await db.execute(
        select(Location)
        .where(Location.site_id == site_id, Location.deleted_at.is_(None))
        .order_by(Location.order_index, Location.name)
    )
    flat = result.scalars().all()
    counts = await _get_item_counts(db, site_id)
    return _build_tree(list(flat), counts)


@router.get("/flat", response_model=list[LocationOut])
async def get_locations_flat(
    site_id: str,
    db: DB,
    _auth: RequireViewer,
):
    """Flat list with parent_id for efficient frontend rendering."""
    result = await db.execute(
        select(Location)
        .where(Location.site_id == site_id, Location.deleted_at.is_(None))
        .order_by(Location.order_index, Location.name)
    )
    flat = result.scalars().all()
    counts = await _get_item_counts(db, site_id)
    out = []
    for loc in flat:
        node = LocationOut.model_validate(loc)
        node.item_count = counts.get(loc.id, 0)
        out.append(node)
    return out


@router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
async def create_location(
    site_id: str,
    data: LocationCreate,
    db: DB,
    current_user: CurrentUser,
    _auth: RequireEditor,
):
    if data.parent_id:
        parent_result = await db.execute(
            select(Location).where(
                Location.id == data.parent_id,
                Location.site_id == site_id,
                Location.deleted_at.is_(None),
            )
        )
        parent = parent_result.scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent location not found")

    loc = Location(
        site_id=site_id,
        parent_id=data.parent_id,
        name=data.name,
        level=data.level,
        description=data.description,
        floor_plan_x=data.floor_plan_x,
        floor_plan_y=data.floor_plan_y,
        order_index=data.order_index,
        created_by=current_user.id,
    )
    db.add(loc)
    await db.commit()
    await db.refresh(loc)
    out = LocationOut.model_validate(loc)
    return out


@router.get("/{location_id}", response_model=LocationOut)
async def get_location(
    site_id: str,
    location_id: str,
    db: DB,
    _auth: RequireViewer,
):
    result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.site_id == site_id,
            Location.deleted_at.is_(None),
        )
    )
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    counts = await _get_item_counts(db, site_id)
    out = LocationOut.model_validate(loc)
    out.item_count = counts.get(location_id, 0)
    return out


@router.patch("/{location_id}", response_model=LocationOut)
async def update_location(
    site_id: str,
    location_id: str,
    data: LocationUpdate,
    db: DB,
    _auth: RequireEditor,
):
    result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.site_id == site_id,
            Location.deleted_at.is_(None),
        )
    )
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(loc, field, value)

    db.add(loc)
    await db.commit()
    await db.refresh(loc)
    out = LocationOut.model_validate(loc)
    return out


async def _soft_delete_recursive(db: AsyncSession, location_id: str, now) -> None:
    """Soft-delete a location and all its children recursively."""
    from datetime import datetime, timezone
    result = await db.execute(
        select(Location).where(
            Location.parent_id == location_id,
            Location.deleted_at.is_(None),
        )
    )
    children = result.scalars().all()
    for child in children:
        await _soft_delete_recursive(db, child.id, now)

    await db.execute(
        select(Location).where(Location.id == location_id)
    )
    child_result = await db.execute(select(Location).where(Location.id == location_id))
    loc = child_result.scalar_one_or_none()
    if loc:
        loc.deleted_at = now
        db.add(loc)


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    site_id: str,
    location_id: str,
    db: DB,
    _auth: RequireAdmin,
):
    from datetime import datetime, timezone

    result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.site_id == site_id,
            Location.deleted_at.is_(None),
        )
    )
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    now = datetime.now(timezone.utc)
    await _soft_delete_recursive(db, location_id, now)
    await db.commit()


@router.get("/{location_id}/map", response_model=FloorMapOut)
async def get_floor_map(
    site_id: str,
    location_id: str,
    db: DB,
    _auth: RequireViewer,
):
    result = await db.execute(
        select(FloorMap).where(
            FloorMap.location_id == location_id,
            FloorMap.site_id == site_id,
        )
    )
    floor_map = result.scalar_one_or_none()
    if not floor_map:
        raise HTTPException(status_code=404, detail="Floor map not found")

    image_url = None
    if floor_map.image_object_key:
        image_url = f"/api/v1/sites/{site_id}/locations/{location_id}/map/image"

    out = FloorMapOut.model_validate(floor_map)
    out.image_url = image_url
    return out


@router.get("/{location_id}/map/image")
async def get_floor_map_image(
    site_id: str,
    location_id: str,
    db: DB,
    _auth: RequireViewer,
):
    result = await db.execute(
        select(FloorMap).where(
            FloorMap.location_id == location_id,
            FloorMap.site_id == site_id,
        )
    )
    floor_map = result.scalar_one_or_none()
    if not floor_map or not floor_map.image_object_key:
        raise HTTPException(status_code=404, detail="Floor map image not found")

    image_bytes = download_from_minio(settings.minio_bucket_photos, floor_map.image_object_key)
    media_type = mimetypes.guess_type(floor_map.image_object_key)[0] or "application/octet-stream"
    return Response(content=image_bytes, media_type=media_type)


@router.put("/{location_id}/map/image", response_model=FloorMapOut)
async def upload_floor_plan_image(
    site_id: str,
    location_id: str,
    file: UploadFile,
    db: DB,
    current_user: CurrentUser,
    _auth: RequireEditor,
):
    # Ensure location exists
    loc_result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.site_id == site_id,
            Location.deleted_at.is_(None),
        )
    )
    if not loc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Location not found")

    safe_filename = file.filename or "floorplan.jpg"
    object_key = f"floormaps/{location_id}/{safe_filename}"
    data = await file.read()
    content_type = file.content_type or "application/octet-stream"

    upload_to_minio(settings.minio_bucket_photos, object_key, data, content_type)

    result = await db.execute(
        select(FloorMap).where(
            FloorMap.location_id == location_id,
            FloorMap.site_id == site_id,
        )
    )
    floor_map = result.scalar_one_or_none()
    if floor_map:
        floor_map.image_object_key = object_key
    else:
        floor_map = FloorMap(
            location_id=location_id,
            site_id=site_id,
            image_object_key=object_key,
            created_by=current_user.id,
        )
        db.add(floor_map)

    await db.commit()
    await db.refresh(floor_map)

    image_url = f"/api/v1/sites/{site_id}/locations/{location_id}/map/image"
    out = FloorMapOut.model_validate(floor_map)
    out.image_url = image_url
    return out


@router.put("/{location_id}/map/vector", response_model=FloorMapOut)
async def update_floor_map_vector(
    site_id: str,
    location_id: str,
    data: FloorMapUpdate,
    db: DB,
    current_user: CurrentUser,
    _auth: RequireEditor,
):
    # Ensure location exists
    loc_result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.site_id == site_id,
            Location.deleted_at.is_(None),
        )
    )
    if not loc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Location not found")

    result = await db.execute(
        select(FloorMap).where(
            FloorMap.location_id == location_id,
            FloorMap.site_id == site_id,
        )
    )
    floor_map = result.scalar_one_or_none()
    if floor_map:
        if data.vector_data is not None:
            floor_map.vector_data = data.vector_data
        if data.width is not None:
            floor_map.width = data.width
        if data.height is not None:
            floor_map.height = data.height
    else:
        floor_map = FloorMap(
            location_id=location_id,
            site_id=site_id,
            vector_data=data.vector_data,
            width=data.width,
            height=data.height,
            created_by=current_user.id,
        )
        db.add(floor_map)

    await db.commit()
    await db.refresh(floor_map)

    image_url = None
    if floor_map.image_object_key:
        image_url = f"/api/v1/sites/{site_id}/locations/{location_id}/map/image"

    out = FloorMapOut.model_validate(floor_map)
    out.image_url = image_url
    return out
