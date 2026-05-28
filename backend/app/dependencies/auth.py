import uuid

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth_engine.infrastructure import get_async_session
from app.models.auth import User, UserRole
from app.modules.auth_engine.infrastructure import AuditRepository, SessionRepository, TokenRepository, UserRepository, decode_token

bearer_scheme = HTTPBearer(auto_error=False)

ROLE_PERMISSIONS: dict[UserRole, set[str]] = {
    UserRole.USER: {"auth:me", "sessions:read", "sessions:revoke_own"},
    UserRole.ADMIN: {"auth:me", "sessions:read", "sessions:revoke_own", "admin:users:read", "admin:users:delete"},
    UserRole.CUSTOM: set(),
}


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    access_token: str | None = Cookie(default=None),
) -> User:
    token = credentials.credentials if credentials else access_token
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError("Invalid token type")
        user_id = uuid.UUID(str(payload["sub"]))
        session_id = uuid.UUID(str(payload["sid"]))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token") from exc

    if await TokenRepository(session).is_access_token_blacklisted(str(payload.get("jti", ""))):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Revoked access token")

    user = await UserRepository(session).get_by_id(user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing user")
    user_session = await SessionRepository(session).get_by_id(session_id)
    from app.modules.auth_engine.infrastructure import now_utc

    if not user_session or user_session.user_id != user.id or user_session.revoked_at is not None or user_session.expires_at <= now_utc():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing session")
    request.state.user = user
    request.state.session = user_session
    request.state.token_payload = payload
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return user


def require_permission(permission: str):
    async def dependency(
        request: Request,
        user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_async_session),
    ) -> User:
        if permission not in ROLE_PERMISSIONS.get(user.role, set()):
            await AuditRepository(session).log(
                event="permission_denied",
                status="blocked",
                user_id=user.id,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                metadata={"permission": permission, "path": request.url.path},
            )
            await session.commit()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
        await AuditRepository(session).log(
            event="sensitive_endpoint_access",
            status="success",
            user_id=user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            metadata={"permission": permission, "path": request.url.path},
        )
        await session.commit()
        return user

    return dependency
