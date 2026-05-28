from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.db_models import Chunk, Document, Message, Session as SessionModel
from backend.app.schemas.schemas import DashboardStatsSchema, DomainStatSchema
from app.modules.rag_vecor_engine.infrastructure import vector_store
from app.shared.ollama_service import ollama_service

router = APIRouter(prefix="/stats", tags=["Statistics and Dashboard"])


@router.get("/dashboard", response_model=DashboardStatsSchema)
async def dashboard_stats(db: Session = Depends(get_db)):
    total_docs = db.query(func.count(Document.id)).scalar() or 0
    total_chunks = db.query(func.count(Chunk.id)).scalar() or 0
    total_embeddings = db.query(func.count(Chunk.id)).filter(Chunk.embedding_generated == True).scalar() or 0
    total_sessions = db.query(func.count(SessionModel.id)).scalar() or 0
    total_queries = db.query(func.count(Message.id)).filter(Message.role == "user").scalar() or 0

    domain_rows = db.query(Document.domain, func.count(Document.id)).group_by(Document.domain).all()
    docs_per_domain = {row[0]: row[1] for row in domain_rows}

    recent_docs = db.query(Document).order_by(Document.created_at.desc()).limit(5).all()
    recent_activity = [
        {
            "type": "document",
            "id": d.id,
            "title": d.title,
            "source": d.source,
            "domain": d.domain,
            "status": d.status,
            "createdAt": d.created_at.isoformat(),
        }
        for d in recent_docs
    ]

    ollama_info = await ollama_service.check_availability()
    ollama_available = ollama_info["available"]

    indexed_count = db.query(func.count(Document.id)).filter(Document.status == "indexed").scalar() or 0
    pending_count = db.query(func.count(Document.id)).filter(Document.status == "pending").scalar() or 0
    if pending_count > 0:
        indexing_status = f"{pending_count} en attente"
    elif indexed_count > 0:
        indexing_status = f"{indexed_count} indexes"
    else:
        indexing_status = "Aucun document"

    return DashboardStatsSchema(
        totalDocuments=total_docs,
        totalChunks=total_chunks,
        totalEmbeddings=total_embeddings,
        totalSessions=total_sessions,
        totalQueries=total_queries,
        documentsPerDomain=docs_per_domain,
        recentActivity=recent_activity,
        ollamaAvailable=ollama_available,
        indexingStatus=indexing_status,
    )


@router.get("/domains", response_model=List[DomainStatSchema])
def domain_stats(db: Session = Depends(get_db)):
    domain_docs = db.query(Document.domain, func.count(Document.id)).group_by(Document.domain).all()
    result = []
    for domain, doc_count in domain_docs:
        chunk_count = db.query(func.count(Chunk.id)).join(Document).filter(Document.domain == domain).scalar() or 0
        sources = [
            row[0]
            for row in db.query(Document.source)
            .filter(Document.domain == domain)
            .distinct()
            .all()
        ]
        result.append(
            DomainStatSchema(
                domain=domain,
                documentCount=doc_count,
                chunkCount=chunk_count,
                sources=sources,
            )
        )
    return result


__all__ = ["router"]
