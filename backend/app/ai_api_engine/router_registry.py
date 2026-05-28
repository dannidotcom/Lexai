from fastapi import FastAPI

from app.ai_api_engine.api import health_router, stats_router
from app.modules.ai_generation_engine.api import ai_router, prompt_admin_router
from app.modules.auth_engine.api import admin_router, auth_router
from app.modules.php_ai_adpater.api import php_ai_adapter_router
from app.modules.rag_search_engine.api import rag_router
from app.modules.rag_vecor_engine.api import documents_router, pdf_upload_router


def register_routers(app: FastAPI) -> None:
    app.include_router(health_router, prefix="/api")
    app.include_router(auth_router, prefix="/api")
    app.include_router(admin_router, prefix="/api")
    app.include_router(documents_router, prefix="/api")
    app.include_router(rag_router, prefix="/api")
    app.include_router(ai_router, prefix="/api")
    app.include_router(prompt_admin_router, prefix="/api")
    app.include_router(stats_router, prefix="/api")
    app.include_router(pdf_upload_router, prefix="/api")
    app.include_router(php_ai_adapter_router, prefix="/api")
