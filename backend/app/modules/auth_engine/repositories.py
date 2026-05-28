import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import (
    AuditLog,
    BlacklistedToken,
    EmailVerificationToken,
    PasswordResetToken,
    RefreshToken,
    User,
    UserRole,
    UserSession,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email.lower()))
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return await self.session.get(User, user_id)

    async def create(
        self,
        *,
        email: str,
        hashed_password: str,
        full_name: str | None,
        role: UserRole = UserRole.USER,
        is_active: bool = True,
        is_verified: bool = False,
    ) -> User:
        user = User(
            email=email.lower(),
            hashed_password=hashed_password,
            full_name=full_name,
            role=role,
            is_active=is_active,
            is_verified=is_verified,
        )
        self.session.add(user)
        await self.session.flush()
        return user

    async def list_users(self) -> list[User]:
        result = await self.session.execute(select(User).order_by(User.created_at.desc()))
        return list(result.scalars().all())

    async def delete(self, user: User) -> None:
        await self.session.delete(user)


class TokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_refresh(
        self,
        *,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        token_hash: str,
        family_id: uuid.UUID,
        expires_at: datetime,
        user_agent: str | None,
        ip_address: str | None,
    ) -> RefreshToken:
        token = RefreshToken(
            user_id=user_id,
            session_id=session_id,
            token_hash=token_hash,
            family_id=family_id,
            expires_at=expires_at,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        self.session.add(token)
        await self.session.flush()
        return token

    async def get_refresh_by_hash(self, token_hash: str) -> RefreshToken | None:
        result = await self.session.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
        return result.scalar_one_or_none()

    async def revoke_refresh(self, token: RefreshToken, *, replaced_by: uuid.UUID | None = None) -> None:
        token.revoked_at = utcnow()
        token.replaced_by_token_id = replaced_by

    async def revoke_user_refresh_tokens(self, user_id: uuid.UUID) -> None:
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=utcnow())
        )

    async def revoke_session_refresh_tokens(self, session_id: uuid.UUID) -> None:
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.session_id == session_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=utcnow())
        )

    async def create_password_reset(self, *, user_id: uuid.UUID, token_hash: str, expires_at: datetime) -> PasswordResetToken:
        token = PasswordResetToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        self.session.add(token)
        await self.session.flush()
        return token

    async def get_password_reset(self, token_hash: str) -> PasswordResetToken | None:
        result = await self.session.execute(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash))
        return result.scalar_one_or_none()

    async def create_email_verification(self, *, user_id: uuid.UUID, token_hash: str, expires_at: datetime) -> EmailVerificationToken:
        token = EmailVerificationToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        self.session.add(token)
        await self.session.flush()
        return token

    async def get_email_verification(self, token_hash: str) -> EmailVerificationToken | None:
        result = await self.session.execute(select(EmailVerificationToken).where(EmailVerificationToken.token_hash == token_hash))
        return result.scalar_one_or_none()

    async def delete_expired_tokens(self) -> None:
        now = utcnow()
        for model in (RefreshToken, PasswordResetToken, EmailVerificationToken, BlacklistedToken):
            await self.session.execute(delete(model).where(model.expires_at < now))

    async def blacklist_access_token(self, *, jti: str, user_id: uuid.UUID | None, expires_at: datetime, reason: str) -> None:
        self.session.add(BlacklistedToken(jti=jti, user_id=user_id, expires_at=expires_at, reason=reason))

    async def is_access_token_blacklisted(self, jti: str) -> bool:
        result = await self.session.execute(select(BlacklistedToken.id).where(BlacklistedToken.jti == jti, BlacklistedToken.expires_at > utcnow()))
        return result.scalar_one_or_none() is not None


class SessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        session_key: str,
        refresh_family_id: uuid.UUID,
        expires_at: datetime,
        ip_address: str | None,
        user_agent: str | None,
        device_name: str | None,
    ) -> UserSession:
        user_session = UserSession(
            user_id=user_id,
            session_key=session_key,
            refresh_family_id=refresh_family_id,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
            device_name=device_name,
            last_seen_at=utcnow(),
        )
        self.session.add(user_session)
        await self.session.flush()
        return user_session

    async def get_by_id(self, session_id: uuid.UUID) -> UserSession | None:
        return await self.session.get(UserSession, session_id)

    async def list_active_for_user(self, user_id: uuid.UUID) -> list[UserSession]:
        result = await self.session.execute(
            select(UserSession)
            .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None), UserSession.expires_at > utcnow())
            .order_by(UserSession.last_seen_at.desc().nullslast(), UserSession.created_at.desc())
        )
        return list(result.scalars().all())

    async def touch(self, user_session: UserSession) -> None:
        user_session.last_seen_at = utcnow()

    async def revoke(self, user_session: UserSession) -> None:
        user_session.revoked_at = utcnow()

    async def revoke_all_for_user(self, user_id: uuid.UUID) -> None:
        await self.session.execute(
            update(UserSession)
            .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
            .values(revoked_at=utcnow())
        )


class AuditRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def log(
        self,
        *,
        event: str,
        status: str,
        user_id: uuid.UUID | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.session.add(
            AuditLog(
                user_id=user_id,
                event=event,
                status=status,
                ip_address=ip_address,
                user_agent=user_agent,
                metadata_=metadata or {},
            )
        )


__all__ = [
    "UserRepository",
    "TokenRepository",
    "SessionRepository",
    "AuditRepository",
]
