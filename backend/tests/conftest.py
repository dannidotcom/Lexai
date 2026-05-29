import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# Patch engines BEFORE any test modules import from session/database.
# This ensures all downstream imports get the NullPool engine.
import app.core.session  # noqa: E402
import app.core.database  # noqa: E402

_original_session_engine = app.core.session.async_engine
_original_session_factory = app.core.session.AsyncSessionLocal

_test_engine = create_async_engine(
    _original_session_engine.url,
    poolclass=NullPool,
)
_test_session_factory = async_sessionmaker(
    bind=_test_engine,
    expire_on_commit=False,
    autoflush=False,
)

app.core.session.async_engine = _test_engine
app.core.session.AsyncSessionLocal = _test_session_factory
app.core.database.async_engine = _test_engine
app.core.database.AsyncSessionLocal = _test_session_factory


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    from app.core.session import init_auth_db

    await init_auth_db()

    yield

    await _test_engine.dispose()
