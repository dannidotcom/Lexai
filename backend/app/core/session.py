from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class AuthBase(DeclarativeBase):
    pass


async_engine = create_async_engine(
    settings.async_database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    expire_on_commit=False,
    autoflush=False,
)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_auth_db() -> None:
    from app.models.auth import AuditLog, BlacklistedToken, EmailVerificationToken, PasswordResetToken, RefreshToken, User, UserSession

    async with async_engine.begin() as conn:
        await conn.run_sync(AuthBase.metadata.create_all)
