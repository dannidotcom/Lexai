from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.ai_api_engine.lifespan import app_lifespan
from app.ai_api_engine.router_registry import register_routers
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.middleware.security import BruteForceMiddleware, SecurityHeadersMiddleware


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        description="Moteur IA Juridique Souverain - RAG sur sources officielles francaises",
        lifespan=app_lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.cors_origins == "*" else settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(BruteForceMiddleware)

    register_exception_handlers(app)
    register_routers(app)

    return app


app = create_app()
