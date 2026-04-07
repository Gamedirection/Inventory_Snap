from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.site import SiteMembership

ROLE_HIERARCHY = {"owner": 4, "admin": 3, "editor": 2, "viewer": 1}


def role_level(role: str) -> int:
    return ROLE_HIERARCHY.get(role, 0)


async def get_membership(
    db: AsyncSession, site_id: str, user_id: str
) -> SiteMembership | None:
    result = await db.execute(
        select(SiteMembership).where(
            SiteMembership.site_id == site_id,
            SiteMembership.user_id == user_id,
            SiteMembership.accepted_at != None,  # noqa: E711
        )
    )
    return result.scalar_one_or_none()


async def require_site_role(
    db: AsyncSession, site_id: str, user_id: str, minimum_role: str
) -> SiteMembership:
    """Raises PermissionError if user doesn't have minimum_role on site."""
    membership = await get_membership(db, site_id, user_id)
    if not membership:
        raise PermissionError("Not a member of this site")
    if role_level(membership.role) < role_level(minimum_role):
        raise PermissionError(f"Requires {minimum_role} role or higher")
    return membership


async def is_superuser(user) -> bool:
    return user.is_superuser
