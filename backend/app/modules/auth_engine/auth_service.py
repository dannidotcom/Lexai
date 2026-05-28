import uuid
from datetime import timedelta

from fastapi import HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.auth import User
from app.modules.auth_engine.email_service import email_service
from app.modules.auth_engine.repositories import AuditRepository, SessionRepository, TokenRepository, UserRepository
from app.modules.auth_engine.security import (
    create_access_token,
    decode_token,
    generate_opaque_token,
    hash_password,
    hash_token,
    now_utc,
    verify_password,
)
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserRead,
    VerifyEmailRequest,
)

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)
        self.tokens = TokenRepository(session)
        self.sessions = SessionRepository(session)
        self.audit = AuditRepository(session)

    async def register(self, payload: RegisterRequest, request: Request) -> User:
        existing = await self.users.get_by_email(payload.email)
        if existing:
            await self.audit.log(event="register", status="duplicate", ip_address=self._ip(request), metadata={"email": payload.email})
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        user = await self.users.create(
            email=payload.email,
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name,
        )
        raw_token = generate_opaque_token()
        await self.tokens.create_email_verification(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=now_utc() + timedelta(minutes=settings.verify_email_token_expire_minutes),
        )
        await self.audit.log(event="register", status="success", user_id=user.id, ip_address=self._ip(request), user_agent=self._ua(request))
        await self.session.commit()
        await email_service.send_verification_email(email=user.email, token=raw_token)
        return user

    async def login(self, payload: LoginRequest, request: Request, response: Response) -> TokenResponse:
        user = await self.users.get_by_email(payload.email)
        if not user or not verify_password(payload.password, user.hashed_password):
            await self.audit.log(event="login", status="failed", ip_address=self._ip(request), user_agent=self._ua(request), metadata={"email": payload.email})
            await self.session.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive account")
        if not user.is_verified:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email is not verified")

        user_session = await self._create_user_session(user, request)
        token_response = await self._issue_token_pair(user, request, user_session.id, user_session.refresh_family_id)
        user.last_login_at = now_utc()
        await self.audit.log(event="login", status="success", user_id=user.id, ip_address=self._ip(request), user_agent=self._ua(request))
        await self.session.commit()
        self._set_auth_cookies(response, token_response.access_token, token_response.refresh_token)
        return token_response

    async def refresh(self, refresh_token: str, request: Request, response: Response) -> TokenResponse:
        db_token = await self.tokens.get_refresh_by_hash(hash_token(refresh_token))
        if not db_token or db_token.revoked_at is not None or db_token.expires_at <= now_utc():
            if db_token:
                session = await self.sessions.get_by_id(db_token.session_id)
                if session:
                    await self.sessions.revoke(session)
                await self.tokens.revoke_user_refresh_tokens(db_token.user_id)
                await self.audit.log(event="refresh_reuse", status="blocked", user_id=db_token.user_id, ip_address=self._ip(request))
                await self.session.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        user = await self.users.get_by_id(db_token.user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user")
        user_session = await self.sessions.get_by_id(db_token.session_id)
        if (
            not user_session
            or user_session.user_id != user.id
            or user_session.revoked_at is not None
            or user_session.expires_at <= now_utc()
            or user_session.refresh_family_id != db_token.family_id
        ):
            await self.tokens.revoke_user_refresh_tokens(user.id)
            await self.audit.log(event="refresh_session_mismatch", status="blocked", user_id=user.id, ip_address=self._ip(request))
            await self.session.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

        await self.sessions.touch(user_session)
        token_response = await self._issue_token_pair(user, request, user_session.id, db_token.family_id)
        new_db_token = await self.tokens.get_refresh_by_hash(hash_token(token_response.refresh_token))
        await self.tokens.revoke_refresh(db_token, replaced_by=new_db_token.id if new_db_token else None)
        await self.audit.log(event="refresh", status="success", user_id=user.id, ip_address=self._ip(request), user_agent=self._ua(request))
        await self.session.commit()
        self._set_auth_cookies(response, token_response.access_token, token_response.refresh_token)
        return token_response

    async def logout(
        self,
        refresh_token: str | None,
        request: Request,
        response: Response,
        user: User | None = None,
        access_token: str | None = None,
    ) -> None:
        access_payload = None
        if access_token:
            try:
                access_payload = decode_token(access_token)
                if access_payload.get("type") == "access" and access_payload.get("jti") and access_payload.get("exp"):
                    await self.tokens.blacklist_access_token(
                        jti=str(access_payload["jti"]),
                        user_id=user.id if user else None,
                        expires_at=now_utc() + timedelta(seconds=max(1, int(access_payload["exp"]) - int(now_utc().timestamp()))),
                        reason="logout",
                    )
            except ValueError:
                pass
        if refresh_token:
            db_token = await self.tokens.get_refresh_by_hash(hash_token(refresh_token))
            if db_token and db_token.revoked_at is None:
                await self.tokens.revoke_refresh(db_token)
                user_session = await self.sessions.get_by_id(db_token.session_id)
                if user_session:
                    await self.sessions.revoke(user_session)
                await self.audit.log(event="logout", status="success", user_id=db_token.user_id, ip_address=self._ip(request))
        elif user:
            sid = access_payload.get("sid") if access_payload else None
            if sid:
                user_session = await self.sessions.get_by_id(uuid.UUID(str(sid)))
                if user_session and user_session.user_id == user.id:
                    await self.sessions.revoke(user_session)
                    await self.tokens.revoke_session_refresh_tokens(user_session.id)
                    await self.audit.log(event="logout_session", status="success", user_id=user.id, ip_address=self._ip(request), metadata={"session_id": str(user_session.id)})
            else:
                await self.sessions.revoke_all_for_user(user.id)
                await self.tokens.revoke_user_refresh_tokens(user.id)
                await self.audit.log(event="logout_all", status="success", user_id=user.id, ip_address=self._ip(request))
        await self.session.commit()
        self._clear_auth_cookies(response)

    async def list_sessions(self, user: User) -> list:
        return await self.sessions.list_active_for_user(user.id)

    async def revoke_session(self, user: User, session_id: uuid.UUID, request: Request) -> None:
        user_session = await self.sessions.get_by_id(session_id)
        if not user_session or user_session.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        await self.sessions.revoke(user_session)
        await self.tokens.revoke_session_refresh_tokens(user_session.id)
        await self.audit.log(event="revoke_session", status="success", user_id=user.id, ip_address=self._ip(request), metadata={"session_id": str(session_id)})
        await self.session.commit()

    async def forgot_password(self, payload: ForgotPasswordRequest, request: Request) -> None:
        user = await self.users.get_by_email(payload.email)
        if user:
            raw_token = generate_opaque_token()
            await self.tokens.create_password_reset(
                user_id=user.id,
                token_hash=hash_token(raw_token),
                expires_at=now_utc() + timedelta(minutes=settings.reset_password_token_expire_minutes),
            )
            await self.audit.log(event="forgot_password", status="issued", user_id=user.id, ip_address=self._ip(request))
            await self.session.commit()
            await email_service.send_password_reset_email(email=user.email, token=raw_token)
            return
        await self.audit.log(event="forgot_password", status="unknown_email", ip_address=self._ip(request), metadata={"email": payload.email})
        await self.session.commit()

    async def reset_password(self, payload: ResetPasswordRequest, request: Request) -> None:
        token = await self.tokens.get_password_reset(hash_token(payload.token))
        if not token or token.used_at is not None or token.expires_at <= now_utc():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
        user = await self.users.get_by_id(token.user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")
        user.hashed_password = hash_password(payload.password)
        token.used_at = now_utc()
        await self.sessions.revoke_all_for_user(user.id)
        await self.tokens.revoke_user_refresh_tokens(user.id)
        await self.audit.log(event="reset_password", status="success", user_id=user.id, ip_address=self._ip(request))
        await self.audit.log(event="change_password", status="success", user_id=user.id, ip_address=self._ip(request))
        await self.session.commit()

    async def verify_email(self, payload: VerifyEmailRequest, request: Request) -> None:
        token = await self.tokens.get_email_verification(hash_token(payload.token))
        if not token or token.used_at is not None or token.expires_at <= now_utc():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")
        user = await self.users.get_by_id(token.user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token")
        user.is_verified = True
        token.used_at = now_utc()
        await self.audit.log(event="verify_email", status="success", user_id=user.id, ip_address=self._ip(request))
        await self.session.commit()

    async def _create_user_session(self, user: User, request: Request):
        family_id = uuid.uuid4()
        return await self.sessions.create(
            user_id=user.id,
            session_key=generate_opaque_token()[:64],
            refresh_family_id=family_id,
            expires_at=now_utc() + timedelta(days=settings.refresh_token_expire_days),
            ip_address=self._ip(request),
            user_agent=self._ua(request),
            device_name=self._device_name(request),
        )

    async def _issue_token_pair(self, user: User, request: Request, session_id: uuid.UUID, family_id: uuid.UUID) -> TokenResponse:
        access = create_access_token(user.id, user.role.value, user.email, session_id)
        refresh = generate_opaque_token()
        await self.tokens.create_refresh(
            user_id=user.id,
            session_id=session_id,
            token_hash=hash_token(refresh),
            family_id=family_id,
            expires_at=now_utc() + timedelta(days=settings.refresh_token_expire_days),
            user_agent=self._ua(request),
            ip_address=self._ip(request),
        )
        return TokenResponse(access_token=access, refresh_token=refresh, user=UserRead.model_validate(user), session_id=session_id)

    def _set_auth_cookies(self, response: Response, access: str, refresh: str) -> None:
        response.set_cookie(
            ACCESS_COOKIE,
            access,
            max_age=settings.access_token_expire_minutes * 60,
            httponly=True,
            secure=settings.cookie_secure,
            samesite="lax",
            domain=settings.cookie_domain,
            path="/",
        )
        response.set_cookie(
            REFRESH_COOKIE,
            refresh,
            max_age=settings.refresh_token_expire_days * 86400,
            httponly=True,
            secure=settings.cookie_secure,
            samesite="lax",
            domain=settings.cookie_domain,
            path="/api/auth",
        )

    def _clear_auth_cookies(self, response: Response) -> None:
        response.delete_cookie(ACCESS_COOKIE, domain=settings.cookie_domain, path="/")
        response.delete_cookie(REFRESH_COOKIE, domain=settings.cookie_domain, path="/api/auth")

    def _ip(self, request: Request) -> str | None:
        forwarded = request.headers.get("x-forwarded-for")
        return forwarded.split(",")[0].strip() if forwarded else request.client.host if request.client else None

    def _ua(self, request: Request) -> str | None:
        return request.headers.get("user-agent")

    def _device_name(self, request: Request) -> str | None:
        user_agent = self._ua(request)
        if not user_agent:
            return None
        return user_agent[:120]


__all__ = ["AuthService", "ACCESS_COOKIE", "REFRESH_COOKIE"]
