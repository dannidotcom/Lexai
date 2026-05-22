from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db, check_db
from app.core.config import settings
from app.models.schemas import HealthStatusSchema, OllamaStatusSchema
from app.services.ollama_service import ollama_service
from app.services.vector_store import vector_store

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
