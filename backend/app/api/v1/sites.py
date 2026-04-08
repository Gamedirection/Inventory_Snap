from __future__ import annotations

import mimetypes
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models.item import Item
from app.db.models.site import Site, SiteMembership
from app.db.models.user import User
from app.deps import CurrentUser, DB, site_role_checker
from app.schemas.site import (
    InviteAccept,
    MemberInvite,
    MemberOut,
    MemberRoleUpdate,
    SiteCreate,
    SiteOut,
    SiteUpdate,
)
from app.services.photo_service import download_from_minio, upload_to_minio
from app.services.rbac_service import get_membership

router = APIRouter(prefix="/sites", tags=["sites"])

require_admin = site_role_checker("admin")
require_editor = site_role_checker("editor")
require_viewer = site_role_checker("viewer")
require_owner = site_role_checker("owner")


def _icon_fields(site: Site) -> tuple[str | None, str | None]:
    """Returns (icon_url, icon_preset) from icon_object_key."""
    key = site.icon_object_key
    if not key:
        return None, None
    if key.startswith("preset:"):
        return None, key[len("preset:"):]
    return f"/api/v1/sites/{site.id}/icon", None


@router.get("/", response_model=list[SiteOut])
async def list_sites(current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Site, SiteMembership.role)
        .join(SiteMembership, SiteMembership.site_id == Site.id)
        .where(
            SiteMembership.user_id == current_user.id,
            SiteMembership.accepted_at != None,  # noqa: E711
            Site.deleted_at == None,  # noqa: E711
        )
        .order_by(Site.created_at.desc())
    )
    rows = result.all()
    sites_out = []
    for site, role in rows:
        s = SiteOut.model_validate(site)
        s.role = role
        s.icon_url, s.icon_preset = _icon_fields(site)

        # item_count
        item_count_result = await db.execute(
            select(func.count(Item.id)).where(
                Item.site_id == site.id, Item.deleted_at.is_(None)
            )
        )
        s.item_count = item_count_result.scalar_one() or 0

        # member_count
        member_count_result = await db.execute(
            select(func.count(SiteMembership.id)).where(
                SiteMembership.site_id == site.id,
                SiteMembership.accepted_at != None,  # noqa: E711
            )
        )
        s.member_count = member_count_result.scalar_one() or 0

        sites_out.append(s)
    return sites_out


@router.post("/", response_model=SiteOut, status_code=status.HTTP_201_CREATED)
async def create_site(data: SiteCreate, current_user: CurrentUser, db: DB):
    site = Site(**data.model_dump(), created_by=current_user.id)
    db.add(site)
    await db.flush()
    # Add creator as owner
    membership = SiteMembership(
        site_id=site.id,
        user_id=current_user.id,
        role="owner",
        accepted_at=datetime.now(timezone.utc),
    )
    db.add(membership)
    await db.commit()
    await db.refresh(site)
    out = SiteOut.model_validate(site)
    out.role = "owner"
    out.icon_url, out.icon_preset = _icon_fields(site)
    return out


@router.get("/{site_id}", response_model=SiteOut)
async def get_site(site_id: str, current_user: CurrentUser, db: DB, _=Depends(require_viewer)):
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.deleted_at == None)  # noqa: E711
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    membership = await get_membership(db, site_id, current_user.id)
    out = SiteOut.model_validate(site)
    out.role = membership.role if membership else None
    out.icon_url, out.icon_preset = _icon_fields(site)
    return out


@router.patch("/{site_id}", response_model=SiteOut)
async def update_site(
    site_id: str, data: SiteUpdate, current_user: CurrentUser, db: DB, _=Depends(require_admin)
):
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.deleted_at == None)  # noqa: E711
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(site, field, value)
    db.add(site)
    await db.commit()
    await db.refresh(site)
    membership = await get_membership(db, site_id, current_user.id)
    out = SiteOut.model_validate(site)
    out.role = membership.role if membership else None
    out.icon_url, out.icon_preset = _icon_fields(site)
    return out


@router.delete("/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_site(
    site_id: str, current_user: CurrentUser, db: DB, _=Depends(require_owner)
):
    result = await db.execute(select(Site).where(Site.id == site_id))
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    site.deleted_at = datetime.now(timezone.utc)
    db.add(site)
    await db.commit()


@router.put("/{site_id}/icon", response_model=SiteOut)
async def upload_site_icon(
    site_id: str,
    file: UploadFile,
    db: DB,
    current_user: CurrentUser,
    _auth=Depends(require_admin),
):
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.deleted_at.is_(None))
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    safe_filename = file.filename or "icon.jpg"
    object_key = f"site-icons/{site_id}/{safe_filename}"
    data = await file.read()
    content_type = file.content_type or "image/jpeg"

    upload_to_minio(settings.minio_bucket_photos, object_key, data, content_type)

    site.icon_object_key = object_key
    db.add(site)
    await db.commit()
    await db.refresh(site)

    membership = await get_membership(db, site_id, current_user.id)
    out = SiteOut.model_validate(site)
    out.role = membership.role if membership else None
    out.icon_url, out.icon_preset = _icon_fields(site)
    return out


@router.get("/{site_id}/icon")
async def get_site_icon(
    site_id: str,
    db: DB,
    _auth=Depends(require_viewer),
):
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.deleted_at.is_(None))
    )
    site = result.scalar_one_or_none()
    if not site or not site.icon_object_key or site.icon_object_key.startswith("preset:"):
        raise HTTPException(status_code=404, detail="No custom icon set for this site")

    data = download_from_minio(settings.minio_bucket_photos, site.icon_object_key)
    media_type = mimetypes.guess_type(site.icon_object_key)[0] or "image/jpeg"
    return Response(content=data, media_type=media_type)


@router.put("/{site_id}/icon/preset", response_model=SiteOut)
async def set_site_icon_preset(
    site_id: str,
    db: DB,
    current_user: CurrentUser,
    _auth=Depends(require_admin),
    preset: str = Body(embed=True),
):
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.deleted_at.is_(None))
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    site.icon_object_key = f"preset:{preset}"
    db.add(site)
    await db.commit()
    await db.refresh(site)
    membership = await get_membership(db, site_id, current_user.id)
    out = SiteOut.model_validate(site)
    out.role = membership.role if membership else None
    out.icon_url, out.icon_preset = _icon_fields(site)
    return out


@router.delete("/{site_id}/icon", status_code=status.HTTP_204_NO_CONTENT)
async def delete_site_icon(
    site_id: str,
    db: DB,
    _auth=Depends(require_admin),
):
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.deleted_at.is_(None))
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    site.icon_object_key = None
    db.add(site)
    await db.commit()


@router.get("/{site_id}/members", response_model=list[MemberOut])
async def list_members(
    site_id: str, current_user: CurrentUser, db: DB, _=Depends(require_viewer)
):
    result = await db.execute(
        select(SiteMembership, User)
        .join(User, User.id == SiteMembership.user_id, isouter=True)
        .where(SiteMembership.site_id == site_id)
        .order_by(SiteMembership.created_at)
    )
    rows = result.all()
    out = []
    for membership, user in rows:
        m = MemberOut.model_validate(membership)
        if user:
            m.user_email = user.email
            m.user_display_name = user.display_name
        out.append(m)
    return out


@router.post("/{site_id}/members/invite", response_model=dict)
async def invite_member(
    site_id: str,
    data: MemberInvite,
    current_user: CurrentUser,
    db: DB,
    _=Depends(require_admin),
):
    invite_token = secrets.token_urlsafe(32)
    # Check if user already exists
    user_result = await db.execute(select(User).where(User.email == data.email.lower()))
    existing_user = user_result.scalar_one_or_none()

    if existing_user:
        # Check if already member
        existing_member = await get_membership(db, site_id, existing_user.id)
        if existing_member:
            raise HTTPException(status_code=400, detail="User is already a member")

    membership = SiteMembership(
        site_id=site_id,
        user_id=existing_user.id if existing_user else None,
        role=data.role,
        invited_by=current_user.id,
        invite_token=invite_token,
        invite_email=data.email.lower(),
        # If user exists, don't auto-accept - still need to accept invite
    )
    db.add(membership)
    await db.commit()
    return {"invite_token": invite_token, "message": f"Invitation sent to {data.email}"}


@router.post("/members/accept", response_model=MemberOut)
async def accept_invite(data: InviteAccept, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(SiteMembership).where(SiteMembership.invite_token == data.token)
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Invalid invite token")
    if membership.accepted_at:
        raise HTTPException(status_code=400, detail="Invite already accepted")
    membership.user_id = current_user.id
    membership.accepted_at = datetime.now(timezone.utc)
    membership.invite_token = None
    db.add(membership)
    await db.commit()
    await db.refresh(membership)
    return membership


@router.patch("/{site_id}/members/{user_id}", response_model=MemberOut)
async def update_member_role(
    site_id: str,
    user_id: str,
    data: MemberRoleUpdate,
    current_user: CurrentUser,
    db: DB,
    _=Depends(require_admin),
):
    membership = await get_membership(db, site_id, user_id)
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")
    if membership.role == "owner" and data.role != "owner":
        raise HTTPException(status_code=400, detail="Cannot demote the owner")
    membership.role = data.role
    db.add(membership)
    await db.commit()
    await db.refresh(membership)
    return membership


@router.delete("/{site_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    site_id: str,
    user_id: str,
    current_user: CurrentUser,
    db: DB,
    _=Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    membership = await get_membership(db, site_id, user_id)
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")
    if membership.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the owner")
    await db.delete(membership)
    await db.commit()
