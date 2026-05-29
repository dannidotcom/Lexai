from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.db_models import Chunk, Document, Message, Session as SessionModel
from app.schemas.schemas import DashboardStatsSchema, DomainStatSchema
from app.shared.ollama_service import ollama_service

router = APIRouter(prefix="/stats", tags=["Statistics and Dashboard"])


@router.get("/dashboard", response_model=DashboardStatsSchema)
async def dashboard_stats(db: AsyncSession = Depends(get_db)):
    total_docs = (await db.scalar(select(func.count(Document.id)))) or 0
    total_chunks = (await db.scalar(select(func.count(Chunk.id)))) or 0
    total_embeddings = (await db.scalar(select(func.count(Chunk.id)).where(Chunk.embedding_generated.is_(True)))) or 0
    total_sessions = (await db.scalar(select(func.count(SessionModel.id)))) or 0
    total_queries = (await db.scalar(select(func.count(Message.id)).where(Message.role == "user"))) or 0

    domain_rows = (await db.execute(select(Document.domain, func.count(Document.id)).group_by(Document.domain))).all()
    docs_per_domain = {row[0]: row[1] for row in domain_rows}

    recent_docs = (await db.execute(select(Document).order_by(Document.created_at.desc()).limit(5))).scalars().all()
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

    indexed_count = (await db.scalar(select(func.count(Document.id)).where(Document.status == "indexed"))) or 0
    pending_count = (await db.scalar(select(func.count(Document.id)).where(Document.status == "pending"))) or 0
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
async def domain_stats(db: AsyncSession = Depends(get_db)):
    domain_docs = (await db.execute(select(Document.domain, func.count(Document.id)).group_by(Document.domain))).all()

    result = []
    for domain, doc_count in domain_docs:
        chunk_count = (await db.scalar(select(func.count(Chunk.id)).join(Document).where(Document.domain == domain))) or 0
        sources = (
            await db.execute(
                select(Document.source)
                .where(Document.domain == domain)
                .distinct()
            )
        ).scalars().all()
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
