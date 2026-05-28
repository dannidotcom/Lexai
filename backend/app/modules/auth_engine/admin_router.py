import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import require_permission
from app.models.auth import User, UserRole
from app.modules.auth_engine.infrastructure import (
    AuditRepository,
    SessionRepository,
    TokenRepository,
    UserRepository,
    get_async_session,
    hash_password,
)
from app.schemas.auth import AdminUserCreateRequest, AdminUserRead, AdminUserUpdateRequest, MessageResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


def _request_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    return forwarded.split(",")[0].strip() if forwarded else request.client.host if request.client else None


def _request_ua(request: Request) -> str | None:
    return request.headers.get("user-agent")


@router.get("/users", response_model=list[AdminUserRead])
async def list_users(_: User = Depends(require_permission("admin:users:read")), session: AsyncSession = Depends(get_async_session)) -> list[User]:
    return await UserRepository(session).list_users()


@router.post("/users", response_model=AdminUserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: AdminUserCreateRequest,
    request: Request,
    admin: User = Depends(require_permission("admin:users:create")),
    session: AsyncSession = Depends(get_async_session),
) -> User:
    repo = UserRepository(session)
    existing = await repo.get_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = await repo.create(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        is_active=payload.is_active,
        is_verified=payload.is_verified,
    )
    await AuditRepository(session).log(
        event="admin_create_user",
        status="success",
        user_id=admin.id,
        ip_address=_request_ip(request),
        user_agent=_request_ua(request),
        metadata={
            "created_user": str(user.id),
            "role": user.role.value,
            "is_active": user.is_active,
            "is_verified": user.is_verified,
        },
    )
    await session.commit()
    return user


@router.patch("/users/{id}", response_model=AdminUserRead)
async def update_user(
    id: uuid.UUID,
    payload: AdminUserUpdateRequest,
    request: Request,
    admin: User = Depends(require_permission("admin:users:update")),
    session: AsyncSession = Depends(get_async_session),
) -> User:
    repo = UserRepository(session)
    user = await repo.get_by_id(id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    fields = payload.model_fields_set
    changed_fields: list[str] = []
    revoke_sessions = False

    if "email" in fields and payload.email is not None:
        existing = await repo.get_by_email(payload.email)
        if existing and existing.id != user.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        normalized_email = payload.email.lower()
        if user.email != normalized_email:
            user.email = normalized_email
            changed_fields.append("email")

    if "full_name" in fields and user.full_name != payload.full_name:
        user.full_name = payload.full_name
        changed_fields.append("full_name")

    if "role" in fields and payload.role is not None:
        if user.id == admin.id and payload.role != UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admins cannot remove their own admin role")
        if user.role != payload.role:
            user.role = payload.role
            changed_fields.append("role")

    if "is_active" in fields and payload.is_active is not None:
        if user.id == admin.id and payload.is_active is False:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admins cannot deactivate themselves")
        if user.is_active != payload.is_active:
            user.is_active = payload.is_active
            changed_fields.append("is_active")
            if payload.is_active is False:
                revoke_sessions = True

    if "is_verified" in fields and payload.is_verified is not None and user.is_verified != payload.is_verified:
        user.is_verified = payload.is_verified
        changed_fields.append("is_verified")

    if "password" in fields and payload.password:
        user.hashed_password = hash_password(payload.password)
        changed_fields.append("password")
        revoke_sessions = True

    if not changed_fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    if revoke_sessions:
        await SessionRepository(session).revoke_all_for_user(user.id)
        await TokenRepository(session).revoke_user_refresh_tokens(user.id)

    await AuditRepository(session).log(
        event="admin_update_user",
        status="success",
        user_id=admin.id,
        ip_address=_request_ip(request),
        user_agent=_request_ua(request),
        metadata={"updated_user": str(user.id), "fields": changed_fields},
    )
    await session.commit()
    return user


@router.delete("/users/{id}", response_model=MessageResponse)
async def delete_user(
    id: uuid.UUID,
    admin: User = Depends(require_permission("admin:users:delete")),
    session: AsyncSession = Depends(get_async_session),
) -> MessageResponse:
    repo = UserRepository(session)
    user = await repo.get_by_id(id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admins cannot delete themselves")
    await TokenRepository(session).revoke_user_refresh_tokens(user.id)
    await repo.delete(user)
    await AuditRepository(session).log(event="admin_delete_user", status="success", user_id=admin.id, metadata={"deleted_user": str(id)})
    await session.commit()
    return MessageResponse(message="User deleted")


__all__ = ["router"]
