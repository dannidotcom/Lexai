import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import require_permission
from app.models.auth import User
from app.modules.auth_engine.infrastructure import AuditRepository, TokenRepository, UserRepository, get_async_session
from app.schemas.auth import AdminUserRead, MessageResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=list[AdminUserRead])
async def list_users(_: User = Depends(require_permission("admin:users:read")), session: AsyncSession = Depends(get_async_session)) -> list[User]:
    return await UserRepository(session).list_users()


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
