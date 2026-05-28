import uuid

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, require_permission
from app.models.auth import User
from app.modules.auth_engine.application import AuthService
from app.modules.auth_engine.infrastructure import get_async_session
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    SessionRead,
    TokenResponse,
    UserRead,
    VerifyEmailRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, request: Request, session: AsyncSession = Depends(get_async_session)) -> User:
    return await AuthService(session).register(payload, request)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_async_session),
) -> TokenResponse:
    return await AuthService(session).login(payload, request, response)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    access_token: str | None = Cookie(default=None),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> MessageResponse:
    bearer = request.headers.get("authorization", "")
    bearer_token = bearer.removeprefix("Bearer ").strip() if bearer.lower().startswith("bearer ") else None
    await AuthService(session).logout(refresh_token, request, response, user, bearer_token or access_token)
    return MessageResponse(message="Logged out")


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_async_session),
) -> TokenResponse:
    if not refresh_token:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
    return await AuthService(session).refresh(refresh_token, request, response)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(payload: ForgotPasswordRequest, request: Request, session: AsyncSession = Depends(get_async_session)) -> MessageResponse:
    await AuthService(session).forgot_password(payload, request)
    return MessageResponse(message="If the email exists, reset instructions have been sent")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(payload: ResetPasswordRequest, request: Request, session: AsyncSession = Depends(get_async_session)) -> MessageResponse:
    await AuthService(session).reset_password(payload, request)
    return MessageResponse(message="Password reset successful")


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(payload: VerifyEmailRequest, request: Request, session: AsyncSession = Depends(get_async_session)) -> MessageResponse:
    await AuthService(session).verify_email(payload, request)
    return MessageResponse(message="Email verified")


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(require_permission("auth:me"))) -> User:
    return user


@router.get("/sessions", response_model=list[SessionRead])
async def list_sessions(user: User = Depends(require_permission("sessions:read")), session: AsyncSession = Depends(get_async_session)) -> list:
    return await AuthService(session).list_sessions(user)


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
async def revoke_session(
    session_id: uuid.UUID,
    request: Request,
    user: User = Depends(require_permission("sessions:revoke_own")),
    session: AsyncSession = Depends(get_async_session),
) -> MessageResponse:
    await AuthService(session).revoke_session(user, session_id, request)
    return MessageResponse(message="Session revoked")


__all__ = ["router"]
