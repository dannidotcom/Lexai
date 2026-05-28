from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.core.database import init_db
from app.core.logging import logger, setup_logging
from app.modules.auth_engine.infrastructure import init_auth_db
from app.modules.rag_vecor_engine.infrastructure import vector_store


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    setup_logging(debug=settings.debug)
    logger.info("Starting LexIA API", version=settings.version)

    try:
        init_db()
        logger.info("Database initialized")
    except Exception as exc:
        logger.error("Database init failed", error=str(exc))

    try:
        await init_auth_db()
        logger.info("Auth database initialized")
    except Exception as exc:
        logger.error("Auth database init failed", error=str(exc))

    try:
        vector_store.ensure_collection()
        logger.info("Vector store ready")
    except Exception as exc:
        logger.warning("Vector store init warning", error=str(exc))

    yield

    logger.info("LexIA API shutting down")
