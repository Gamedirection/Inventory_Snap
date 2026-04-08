from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.site import SiteMembership
from app.db.models.user import User
from app.db.session import get_db
from app.services.auth_service import decode_token, get_user_by_id
from app.services.rbac_service import require_site_role

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    # Accept token via Authorization header OR ?token= query param (needed for <img> src)
    raw_token: str | None = None
    if credentials:
        raw_token = credentials.credentials
    elif (qp_token := request.query_params.get("token")):
        raw_token = qp_token

    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(raw_token)
        if payload.get("type") != "access":
            raise JWTError("Not an access token")
        user_id: str = payload["sub"]
    except (JWTError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


def site_role_checker(minimum_role: str):
    async def _check(
        site_id: str,
        current_user: CurrentUser,
        db: DB,
    ) -> SiteMembership:
        try:
            return await require_site_role(db, site_id, current_user.id, minimum_role)
        except PermissionError as e:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    return _check


def require_viewer(site_id: str, current_user: CurrentUser, db: DB):
    return site_role_checker("viewer")(site_id, current_user, db)


def require_editor(site_id: str, current_user: CurrentUser, db: DB):
    return site_role_checker("editor")(site_id, current_user, db)


def require_admin(site_id: str, current_user: CurrentUser, db: DB):
    return site_role_checker("admin")(site_id, current_user, db)


def require_owner(site_id: str, current_user: CurrentUser, db: DB):
    return site_role_checker("owner")(site_id, current_user, db)


def get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None
