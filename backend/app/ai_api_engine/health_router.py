from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import check_db, get_db
from app.schemas.schemas import HealthStatusSchema, OllamaStatusSchema
from app.modules.rag_vecor_engine.infrastructure import vector_store
from app.shared.ollama_service import ollama_service

router = APIRouter(tags=["Health and Status"])


@router.get("/healthz", response_model=HealthStatusSchema)
def health_check(db: Session = Depends(get_db)):
    db_status = "ok" if check_db() else "error"
    try:
        vec_count = vector_store.count()
        vec_status = f"ok ({vec_count} vectors)"
    except Exception:
        vec_status = "unavailable"
    return HealthStatusSchema(
        status="ok",
        version=settings.version,
        database=db_status,
        vectorStore=vec_status,
    )


@router.get("/ollama/status", response_model=OllamaStatusSchema)
async def ollama_status():
    status = await ollama_service.check_availability()
    return OllamaStatusSchema(**status)


__all__ = ["router"]
