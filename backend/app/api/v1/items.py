from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.audit import AuditLog
from app.db.models.item import Item, ItemFloorPlanPin, ItemPhoto
from app.db.models.location import Location
from app.db.models.movement import Movement
from app.db.models.user import User
from app.deps import CurrentUser, DB, site_role_checker
from app.schemas.item import (
    BulkOperation,
    ItemCreate,
    ItemFloorPlanPinInput,
    ItemMoveRequest,
    ItemOut,
    ItemSearchParams,
    ItemUpdate,
    PaginatedItems,
)
from app.schemas.movement import MovementOut
from app.api.v1.photos import _photo_url

router = APIRouter(prefix="/sites/{site_id}/items", tags=["items"])

RequireViewer = Annotated[object, Depends(site_role_checker("viewer"))]
RequireEditor = Annotated[object, Depends(site_role_checker("editor"))]
RequireAdmin = Annotated[object, Depends(site_role_checker("admin"))]

ARCHIVED_TAG = "__archived__"


def _photo_is_archived(photo) -> bool:
    return bool((photo.exif_data or {}).get("archived"))


async def _enrich_item(item: Item, db: AsyncSession) -> ItemOut:
    out = ItemOut.model_validate(item)
    out.is_verified = item.is_verified

    # Primary thumbnail URL
    if item.primary_photo_id:
        from app.db.models.photo import Photo
        photo_result = await db.execute(select(Photo).where(Photo.id == item.primary_photo_id))
        photo = photo_result.scalar_one_or_none()
        if photo and (photo.original_object_key or photo.thumbnail_object_key):
            if photo.thumbnail_object_key:
                out.primary_photo_url = f"/api/v1/sites/{photo.site_id}/photos/{photo.id}/thumbnail"
            else:
                out.primary_photo_url = _photo_url(photo.site_id, photo.id)

    # Location path — derived from the most recent linked photo's location.
    # Falls back to item.location_id if no photos are linked.
    from app.db.models.photo import Photo
    effective_location_id: str | None = None

    recent_photo_result = await db.execute(
        select(Photo.location_id)
        .join(ItemPhoto, ItemPhoto.photo_id == Photo.id)
        .where(
            ItemPhoto.item_id == item.id,
            Photo.deleted_at.is_(None),
            Photo.location_id.is_not(None),
        )
        .order_by(Photo.created_at.desc())
        .limit(1)
    )
    photo_location_id = recent_photo_result.scalar_one_or_none()
    effective_location_id = photo_location_id or item.location_id

    if effective_location_id:
        path_parts: list[str] = []
        current_id = effective_location_id
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

    pins_result = await db.execute(
        select(ItemFloorPlanPin)
        .where(ItemFloorPlanPin.item_id == item.id)
        .order_by(ItemFloorPlanPin.pin_index.asc())
    )
    out.pins = [pin for pin in pins_result.scalars().all()]

    return out


def _sync_legacy_floor_plan_fields(item: Item, pins: list[ItemFloorPlanPin]) -> None:
    if pins:
        item.floor_plan_x = pins[0].x
        item.floor_plan_y = pins[0].y
    else:
        item.floor_plan_x = None
        item.floor_plan_y = None


async def _apply_item_pins(
    db: AsyncSession,
    item: Item,
    pins: list[ItemFloorPlanPinInput],
) -> None:
    if len(pins) > item.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot place {len(pins)} pins for quantity {item.quantity}",
        )

    existing_result = await db.execute(
        select(ItemFloorPlanPin).where(ItemFloorPlanPin.item_id == item.id)
    )
    existing_pins = {pin.id: pin for pin in existing_result.scalars().all()}
    retained_ids: set[str] = set()
    ordered_pins: list[ItemFloorPlanPin] = []

    for index, pin_input in enumerate(pins):
        pin = existing_pins.get(pin_input.id) if pin_input.id else None
        if pin is None:
            pin = ItemFloorPlanPin(item_id=item.id, pin_index=index, x=pin_input.x, y=pin_input.y)
            db.add(pin)
        else:
            pin.pin_index = index
            pin.x = pin_input.x
            pin.y = pin_input.y
            retained_ids.add(pin.id)
        ordered_pins.append(pin)

    for pin_id, pin in existing_pins.items():
        if pin_id not in retained_ids:
            await db.delete(pin)

    _sync_legacy_floor_plan_fields(item, ordered_pins)


def _build_fts_query(params: ItemSearchParams, site_id: str):
    """Build the base SQLAlchemy select for item search."""
    q = select(Item).where(Item.site_id == site_id, Item.deleted_at.is_(None))
    if not params.include_archived:
        q = q.where(~Item.custom_tags.any(ARCHIVED_TAG))

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
    # Accept both "search" (frontend) and "q" (legacy)
    search: str | None = Query(default=None),
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    location_id: str | None = Query(default=None),
    owner_user_id: str | None = Query(default=None),
    condition: str | None = Query(default=None),
    # Accept both "is_verified" (frontend) and "verified" (legacy)
    is_verified: bool | None = Query(default=None),
    verified: bool | None = Query(default=None),
    tag: str | None = Query(default=None),
    item_type: str | None = Query(default=None),
    sort: str = Query(default="created_at_desc"),
    page: int = Query(default=1, ge=1),
    # Accept both "size" (frontend) and "per_page" (legacy)
    size: int | None = Query(default=None, ge=1, le=200),
    per_page: int = Query(default=50, ge=1, le=200),
    updated_since: datetime | None = Query(default=None),
    include_archived: bool = Query(default=False),
):
    # Merge aliases
    effective_q = search or q
    effective_verified = is_verified if is_verified is not None else verified
    effective_per_page = size if size is not None else per_page

    params = ItemSearchParams(
        q=effective_q,
        category=category,
        location_id=location_id,
        owner_user_id=owner_user_id,
        condition=condition,
        verified=effective_verified,
        tag=tag,
        item_type=item_type,
        sort=sort,
        page=page,
        per_page=effective_per_page,
        updated_since=updated_since,
        include_archived=include_archived,
    )

    base_q = _build_fts_query(params, site_id)

    count_result = await db.execute(
        select(func.count()).select_from(base_q.subquery())
    )
    total = count_result.scalar_one()

    paged_q = base_q.offset((page - 1) * effective_per_page).limit(effective_per_page)
    items_result = await db.execute(paged_q)
    items = items_result.scalars().all()

    enriched = [await _enrich_item(item, db) for item in items]
    pages = math.ceil(total / effective_per_page) if total > 0 else 1

    return PaginatedItems(items=enriched, total=total, page=page, size=effective_per_page, pages=pages)


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

    # Map frontend field names to DB column names
    item_data = data.model_dump(exclude={"name", "description", "pins"})
    item = Item(
        site_id=site_id,
        created_by=current_user.id,
        object_name=data.name,
        short_description=data.description,
        **item_data,
    )
    db.add(item)
    await db.flush()
    if data.pins is not None:
        await _apply_item_pins(db, item, data.pins)
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

    update_data = data.model_dump(exclude_unset=True, exclude={"name", "description", "pins"})
    for field, value in update_data.items():
        setattr(item, field, value)

    # Handle renamed fields
    if data.name is not None:
        item.object_name = data.name
    if data.description is not None:
        item.short_description = data.description
    if data.pins is not None:
        await _apply_item_pins(db, item, data.pins)
    elif data.quantity is not None:
        existing_pins_result = await db.execute(
            select(ItemFloorPlanPin)
            .where(ItemFloorPlanPin.item_id == item.id)
            .order_by(ItemFloorPlanPin.pin_index.asc())
        )
        existing_pins = existing_pins_result.scalars().all()
        if len(existing_pins) > item.quantity:
            for pin in existing_pins[item.quantity:]:
                await db.delete(pin)
            _sync_legacy_floor_plan_fields(item, existing_pins[: item.quantity])

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
                out.moved_by_display_name = user.display_name or user.email
        out_list.append(out)

    return out_list


@router.get("/{item_id}/photos")
async def get_item_photos(
    site_id: str,
    item_id: str,
    db: DB,
    _auth: RequireViewer,
):
    """Return all photos linked to this item via item_photos junction."""
    from app.db.models.photo import Photo
    from app.api.v1.photos import _photo_url

    item_result = await db.execute(
        select(Item).where(
            Item.id == item_id,
            Item.site_id == site_id,
            Item.deleted_at.is_(None),
        )
    )
    if not item_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Item not found")

    rows = await db.execute(
        select(Photo, ItemPhoto)
        .join(ItemPhoto, ItemPhoto.photo_id == Photo.id)
        .where(
            ItemPhoto.item_id == item_id,
            Photo.deleted_at.is_(None),
        )
        .order_by(ItemPhoto.is_primary.desc(), Photo.created_at.desc())
    )

    result = []
    for photo, item_photo in rows.all():
        if _photo_is_archived(photo):
            continue
        result.append({
            "photo_id": photo.id,
            "url": _photo_url(photo.site_id, photo.id),
            "thumbnail_url": (
                f"/api/v1/sites/{photo.site_id}/photos/{photo.id}/thumbnail"
                if photo.thumbnail_object_key
                else _photo_url(photo.site_id, photo.id)
            ),
            "is_primary": item_photo.is_primary,
            "annotation_bbox": item_photo.annotation_bbox,
        })

    return result


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
