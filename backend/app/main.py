from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.core.database import init_db
from app.services.vector_store import vector_store
from app.routers import health, documents, rag, ai, stats
from app.routers import pdf_upload
from app.routers import php_ai_adapter


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(debug=settings.debug)
    logger.info("Starting LexIA API", version=settings.version)
    try:
        init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error("Database init failed", error=str(e))

    try:
        vector_store.ensure_collection()
        logger.info("Vector store ready")
    except Exception as e:
        logger.warning("Vector store init warning", error=str(e))

    yield
    logger.info("LexIA API shutting down")


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Moteur IA Juridique Souverain — RAG sur sources officielles françaises",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(rag.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(pdf_upload.router, prefix="/api")
app.include_router(php_ai_adapter.router, prefix="/api")
