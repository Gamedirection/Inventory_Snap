from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.audit import AuditLog
from app.db.models.item import Item, ItemPhoto
from app.db.models.location import Location
from app.db.models.movement import Movement
from app.db.models.user import User
from app.deps import CurrentUser, DB, site_role_checker
from app.schemas.item import (
    BulkOperation,
    ItemCreate,
    ItemMoveRequest,
    ItemOut,
    ItemSearchParams,
    ItemUpdate,
    PaginatedItems,
)
from app.schemas.movement import MovementOut
from app.services.photo_service import get_presigned_url
from app.config import settings

router = APIRouter(prefix="/sites/{site_id}/items", tags=["items"])

RequireViewer = Annotated[object, Depends(site_role_checker("viewer"))]
RequireEditor = Annotated[object, Depends(site_role_checker("editor"))]
RequireAdmin = Annotated[object, Depends(site_role_checker("admin"))]


async def _enrich_item(item: Item, db: AsyncSession) -> ItemOut:
    out = ItemOut.model_validate(item)
    out.is_verified = item.is_verified

    # Primary thumbnail URL
    if item.primary_photo_id:
        from app.db.models.photo import Photo
        photo_result = await db.execute(select(Photo).where(Photo.id == item.primary_photo_id))
        photo = photo_result.scalar_one_or_none()
        if photo and photo.thumbnail_object_key:
            out.primary_thumbnail_url = get_presigned_url(
                settings.minio_bucket_thumbnails, photo.thumbnail_object_key
            )

    # Location path
    if item.location_id:
        path_parts: list[str] = []
        current_id = item.location_id
        seen: set[str] = set()
        while current_id and current_id not in seen:
            seen.add(current_id)
            loc_result = await db.execute(select(Location).where(Location.id == current_id))
            loc = loc_result.scalar_one_or_none()
            if not loc:
                break
            path_parts.insert(0, loc.name)
            current_id = loc.parent_id
        out.location_path = " > ".join(path_parts)

    return out


def _build_fts_query(params: ItemSearchParams, site_id: str):
    """Build the base SQLAlchemy select for item search."""
    q = select(Item).where(Item.site_id == site_id, Item.deleted_at.is_(None))

    if params.q:
        fts_expr = text(
            "to_tsvector('english', coalesce(items.object_name,'') || ' ' || "
            "coalesce(items.short_description,'') || ' ' || "
            "coalesce(items.brand,'') || ' ' || "
            "coalesce(items.model,'') || ' ' || "
            "coalesce(items.category,'') || ' ' || "
            "coalesce(items.notes,'')) @@ plainto_tsquery('english', :q)"
        ).bindparams(q=params.q)
        q = q.where(fts_expr)

    if params.category:
        q = q.where(Item.category == params.category)
    if params.location_id:
        q = q.where(Item.location_id == params.location_id)
    if params.owner_user_id:
        q = q.where(Item.owner_user_id == params.owner_user_id)
    if params.condition:
        q = q.where(Item.condition == params.condition)
    if params.item_type:
        q = q.where(Item.item_type == params.item_type)
    if params.tag:
        q = q.where(Item.custom_tags.any(params.tag))
    if params.verified is True:
        q = q.where(Item.verification_count >= 2)
    elif params.verified is False:
        q = q.where(Item.verification_count < 2)
    if params.updated_since:
        q = q.where(
            (Item.updated_at >= params.updated_since) | (Item.created_at >= params.updated_since)
        )

    sort_map = {
        "created_at_desc": Item.created_at.desc(),
        "created_at_asc": Item.created_at.asc(),
        "updated_at_desc": Item.updated_at.desc(),
        "name_asc": Item.object_name.asc(),
        "name_desc": Item.object_name.desc(),
    }
    order_col = sort_map.get(params.sort, Item.created_at.desc())
    q = q.order_by(order_col)

    return q


@router.get("", response_model=PaginatedItems)
async def search_items(
    site_id: str,
    db: DB,
    _auth: RequireViewer,
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    location_id: str | None = Query(default=None),
    owner_user_id: str | None = Query(default=None),
    condition: str | None = Query(default=None),
    verified: bool | None = Query(default=None),
    tag: str | None = Query(default=None),
    item_type: str | None = Query(default=None),
    sort: str = Query(default="created_at_desc"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    updated_since: datetime | None = Query(default=None),
):
    params = ItemSearchParams(
        q=q,
        category=category,
        location_id=location_id,
        owner_user_id=owner_user_id,
        condition=condition,
        verified=verified,
        tag=tag,
        item_type=item_type,
        sort=sort,
        page=page,
        per_page=per_page,
        updated_since=updated_since,
    )

    base_q = _build_fts_query(params, site_id)

    count_result = await db.execute(
        select(func.count()).select_from(base_q.subquery())
    )
    total = count_result.scalar_one()

    paged_q = base_q.offset((page - 1) * per_page).limit(per_page)
    items_result = await db.execute(paged_q)
    items = items_result.scalars().all()

    enriched = [await _enrich_item(item, db) for item in items]
    pages = math.ceil(total / per_page) if total > 0 else 1

    return PaginatedItems(items=enriched, total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
async def create_item(
    site_id: str,
    data: ItemCreate,
    db: DB,
    current_user: CurrentUser,
    _auth: RequireEditor,
):
    if data.location_id:
        loc_result = await db.execute(
            select(Location).where(
                Location.id == data.location_id,
                Location.site_id == site_id,
                Location.deleted_at.is_(None),
            )
        )
        if not loc_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Location not found")

    item = Item(
        site_id=site_id,
        created_by=current_user.id,
        **data.model_dump(),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return await _enrich_item(item, db)


@router.get("/{item_id}", response_model=ItemOut)
async def get_item(
    site_id: str,
    item_id: str,
    db: DB,
    _auth: RequireViewer,
):
    result = await db.execute(
        select(Item).where(
            Item.id == item_id,
            Item.site_id == site_id,
            Item.deleted_at.is_(None),
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return await _enrich_item(item, db)


@router.patch("/{item_id}", response_model=ItemOut)
async def update_item(
    site_id: str,
    item_id: str,
    data: ItemUpdate,
    db: DB,
    current_user: CurrentUser,
    _auth: RequireEditor,
):
    result = await db.execute(
        select(Item).where(
            Item.id == item_id,
            Item.site_id == site_id,
            Item.deleted_at.is_(None),
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    audit = AuditLog(
        site_id=site_id,
        actor_user_id=current_user.id,
        action="item.updated",
        resource_type="item",
        resource_id=item_id,
    )
    db.add(audit)
    await db.commit()
    await db.refresh(item)
    return await _enrich_item(item, db)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    site_id: str,
    item_id: str,
    db: DB,
    current_user: CurrentUser,
    _auth: RequireAdmin,
):
    result = await db.execute(
        select(Item).where(
            Item.id == item_id,
            Item.site_id == site_id,
            Item.deleted_at.is_(None),
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item.deleted_at = datetime.now(timezone.utc)
    audit = AuditLog(
        site_id=site_id,
        actor_user_id=current_user.id,
        action="item.deleted",
        resource_type="item",
        resource_id=item_id,
    )
    db.add(audit)
    await db.commit()


@router.post("/{item_id}/move", response_model=MovementOut)
async def move_item(
    site_id: str,
    item_id: str,
    data: ItemMoveRequest,
    db: DB,
    current_user: CurrentUser,
    _auth: RequireEditor,
):
    item_result = await db.execute(
        select(Item).where(
            Item.id == item_id,
            Item.site_id == site_id,
            Item.deleted_at.is_(None),
        )
    )
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    dest_result = await db.execute(
        select(Location).where(
            Location.id == data.to_location_id,
            Location.site_id == site_id,
            Location.deleted_at.is_(None),
        )
    )
    dest_loc = dest_result.scalar_one_or_none()
    if not dest_loc:
        raise HTTPException(status_code=404, detail="Destination location not found")

    old_location_id = item.location_id
    movement = Movement(
        item_id=item_id,
        from_location_id=old_location_id,
        to_location_id=data.to_location_id,
        moved_by=current_user.id,
        reason=data.reason,
        notes=data.notes,
    )
    item.location_id = data.to_location_id

    audit = AuditLog(
        site_id=site_id,
        actor_user_id=current_user.id,
        action="item.moved",
        resource_type="item",
        resource_id=item_id,
        before_state={"location_id": old_location_id},
        after_state={"location_id": data.to_location_id},
    )
    db.add(movement)
    db.add(audit)
    await db.commit()
    await db.refresh(movement)

    out = MovementOut.model_validate(movement)
    out.to_location_name = dest_loc.name

    if old_location_id:
        old_loc_result = await db.execute(select(Location).where(Location.id == old_location_id))
        old_loc = old_loc_result.scalar_one_or_none()
        if old_loc:
            out.from_location_name = old_loc.name

    user_result = await db.execute(select(User).where(User.id == current_user.id))
    user = user_result.scalar_one_or_none()
    if user:
        out.moved_by_display_name = user.display_name

    return out


@router.get("/{item_id}/movements", response_model=list[MovementOut])
async def get_item_movements(
    site_id: str,
    item_id: str,
    db: DB,
    _auth: RequireViewer,
):
    item_result = await db.execute(
        select(Item).where(
            Item.id == item_id,
            Item.site_id == site_id,
            Item.deleted_at.is_(None),
        )
    )
    if not item_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Item not found")

    result = await db.execute(
        select(Movement)
        .where(Movement.item_id == item_id)
        .order_by(Movement.moved_at.desc())
    )
    movements = result.scalars().all()

    out_list: list[MovementOut] = []
    for mv in movements:
        out = MovementOut.model_validate(mv)
        if mv.from_location_id:
            loc_result = await db.execute(select(Location).where(Location.id == mv.from_location_id))
            loc = loc_result.scalar_one_or_none()
            if loc:
                out.from_location_name = loc.name
        if mv.to_location_id:
            loc_result = await db.execute(select(Location).where(Location.id == mv.to_location_id))
            loc = loc_result.scalar_one_or_none()
            if loc:
                out.to_location_name = loc.name
        if mv.moved_by:
            user_result = await db.execute(select(User).where(User.id == mv.moved_by))
            user = user_result.scalar_one_or_none()
            if user:
                out.moved_by_display_name = user.display_name
        out_list.append(out)

    return out_list


@router.post("/bulk", status_code=status.HTTP_200_OK)
async def bulk_operation(
    site_id: str,
    data: BulkOperation,
    db: DB,
    current_user: CurrentUser,
    _auth: RequireEditor,
):
    result = await db.execute(
        select(Item).where(
            Item.id.in_(data.item_ids),
            Item.site_id == site_id,
            Item.deleted_at.is_(None),
        )
    )
    items = result.scalars().all()
    if not items:
        raise HTTPException(status_code=404, detail="No matching items found")

    now = datetime.now(timezone.utc)

    if data.operation == "move":
        if not data.to_location_id:
            raise HTTPException(status_code=400, detail="to_location_id required for move operation")
        dest_result = await db.execute(
            select(Location).where(
                Location.id == data.to_location_id,
                Location.site_id == site_id,
                Location.deleted_at.is_(None),
            )
        )
        if not dest_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Destination location not found")

        for item in items:
            mv = Movement(
                item_id=item.id,
                from_location_id=item.location_id,
                to_location_id=data.to_location_id,
                moved_by=current_user.id,
                reason="bulk_move",
            )
            item.location_id = data.to_location_id
            db.add(mv)

    elif data.operation == "tag":
        if not data.tags:
            raise HTTPException(status_code=400, detail="tags required for tag operation")
        for item in items:
            existing = list(item.custom_tags or [])
            for tag in data.tags:
                if tag not in existing:
                    existing.append(tag)
            item.custom_tags = existing

    elif data.operation == "assign_owner":
        for item in items:
            item.owner_user_id = data.owner_user_id

    elif data.operation == "delete":
        for item in items:
            item.deleted_at = now

    audit = AuditLog(
        site_id=site_id,
        actor_user_id=current_user.id,
        action=f"item.bulk_{data.operation}",
        resource_type="item",
        after_state={"item_ids": data.item_ids, "operation": data.operation},
    )
    db.add(audit)
    await db.commit()

    return {"affected": len(items), "operation": data.operation}
