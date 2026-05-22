from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schemas import SearchInputSchema, SearchResultSchema, ContextResultSchema
from app.services.rag_service import rag_service

router = APIRouter(prefix="/rag", tags=["RAG Search and Context"])


@router.post("/search", response_model=SearchResultSchema)
async def search(data: SearchInputSchema, db: Session = Depends(get_db)):
    return await rag_service.search(
        query=data.query,
        db=db,
        domain=data.domain,
        sub_domain=data.subDomain,
        limit=data.limit,
        search_type=data.searchType.value if hasattr(data.searchType, 'value') else str(data.searchType),
    )


@router.post("/context", response_model=ContextResultSchema)
async def get_context(data: SearchInputSchema, db: Session = Depends(get_db)):
    return await rag_service.get_context(
        query=data.query,
        db=db,
        domain=data.domain,
        limit=data.limit,
    )
