from __future__ import annotations

import hashlib
import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.db_models import AiSource, Chunk, Document, IngestionJob, SourceVersion, now_utc
from app.modules.rag_vecor_engine.chunk_service import build_chunks
from app.modules.rag_vecor_engine.vector_store import vector_store
from app.schemas.schemas import ChunkSchema, DocumentInputSchema, DocumentSchema
from app.shared.ollama_service import ollama_service


def _doc_to_schema(doc: Document, chunk_count: int) -> DocumentSchema:
    return DocumentSchema(
        id=doc.id,
        title=doc.title,
        source=doc.source,
        domain=doc.domain,
        subDomain=doc.sub_domain,
        documentType=doc.document_type,
        status=doc.status,
        chunkCount=chunk_count,
        createdAt=doc.created_at.isoformat(),
        updatedAt=doc.updated_at.isoformat(),
        url=doc.url,
        version=doc.version,
    )


def _chunk_to_schema(chunk: Chunk) -> ChunkSchema:
    return ChunkSchema(
        id=chunk.id,
        documentId=chunk.document_id,
        content=chunk.content,
        sectionPath=chunk.section_path,
        articleId=chunk.article_id,
        statutJuridique=chunk.statut_juridique,
        chunkIndex=chunk.chunk_index,
        embeddingGenerated=chunk.embedding_generated,
    )


class DocumentService:
    async def list_documents(
        self,
        db: AsyncSession,
        domain: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[DocumentSchema]:
        stmt = select(Document)
        if domain:
            stmt = stmt.where(Document.domain == domain)
        if status:
            stmt = stmt.where(Document.status == status)
        stmt = stmt.order_by(Document.created_at.desc()).offset(offset).limit(limit)

        docs = (await db.execute(stmt)).scalars().all()
        if not docs:
            return []

        doc_ids = [d.id for d in docs]
        chunk_rows = (
            await db.execute(
                select(Chunk.document_id, func.count(Chunk.id))
                .where(Chunk.document_id.in_(doc_ids))
                .group_by(Chunk.document_id)
            )
        ).all()
        chunk_counts = {doc_id: count for doc_id, count in chunk_rows}

        return [_doc_to_schema(d, chunk_counts.get(d.id, 0)) for d in docs]

    async def get_document(self, db: AsyncSession, doc_id: str) -> DocumentSchema | None:
        doc = await db.scalar(select(Document).where(Document.id == doc_id))
        if not doc:
            return None
        chunk_count = (await db.scalar(select(func.count(Chunk.id)).where(Chunk.document_id == doc_id))) or 0
        return _doc_to_schema(doc, chunk_count)

    async def get_chunks(self, db: AsyncSession, doc_id: str) -> list[ChunkSchema]:
        chunks = (await db.execute(select(Chunk).where(Chunk.document_id == doc_id).order_by(Chunk.chunk_index))).scalars().all()
        return [_chunk_to_schema(c) for c in chunks]

    async def ingest_document(self, db: AsyncSession, data: DocumentInputSchema) -> DocumentSchema:
        content_hash = hashlib.sha256(data.content.encode()).hexdigest()

        source_ref: AiSource | None = None
        ingestion_job: IngestionJob | None = None

        if data.sourceId:
            try:
                source_uuid = uuid.UUID(data.sourceId)
            except ValueError as exc:
                raise ValueError("Invalid sourceId format") from exc

            source_ref = await db.scalar(select(AiSource).where(AiSource.id == source_uuid))
            if not source_ref:
                raise ValueError("Unknown sourceId")

            ingestion_job = IngestionJob(source_id=source_ref.id, status="running")
            db.add(ingestion_job)
            await db.flush()

        existing = await db.scalar(select(Document).where(Document.content_hash == content_hash))
        if existing:
            logger.info("Document already exists (same hash)", doc_id=existing.id)

            if source_ref and ingestion_job:
                db.add(
                    SourceVersion(
                        source_id=source_ref.id,
                        version_hash=content_hash,
                        status="duplicate",
                        content_uri=data.url,
                        raw_text=data.content,
                        meta={
                            "document_id": existing.id,
                            "source": data.source,
                            "domain": data.domain,
                        },
                    )
                )
                self._mark_source_success(source_ref)
                ingestion_job.status = "completed"
                ingestion_job.ended_at = now_utc()
                await db.commit()

            existing_chunk_count = (await db.scalar(select(func.count(Chunk.id)).where(Chunk.document_id == existing.id))) or 0
            return _doc_to_schema(existing, existing_chunk_count)

        try:
            doc = Document(
                title=data.title,
                source=data.source,
                domain=data.domain,
                sub_domain=data.subDomain,
                document_type=data.documentType,
                status="indexing",
                url=data.url,
                version=data.version,
                content_hash=content_hash,
                metadata_=data.metadata or {},
            )
            db.add(doc)
            await db.flush()

            raw_chunks = build_chunks(
                content=data.content,
                document_id=doc.id,
                domain=data.domain,
                source=data.source,
                document_title=data.title,
                metadata=data.metadata or {},
            )

            chunk_objects: list[Chunk] = []
            for c in raw_chunks:
                chunk = Chunk(
                    document_id=doc.id,
                    content=c["content"],
                    section_path=c["section_path"],
                    article_id=c.get("article_id"),
                    statut_juridique=c["statut_juridique"],
                    chunk_index=c["chunk_index"],
                    embedding_generated=False,
                )
                db.add(chunk)
                chunk_objects.append(chunk)
            await db.flush()

            embedded_count = 0
            for chunk in chunk_objects:
                embedding = await ollama_service.generate_embedding(chunk.content)
                if embedding:
                    try:
                        qdrant_id = vector_store.upsert_chunk(
                            chunk_id=chunk.id,
                            embedding=embedding,
                            payload={
                                "chunk_id": chunk.id,
                                "document_id": doc.id,
                                "domain": data.domain,
                                "source": data.source,
                                "document_title": data.title,
                                "section_path": chunk.section_path,
                                "article_id": chunk.article_id,
                                "statut_juridique": chunk.statut_juridique,
                            },
                        )
                        chunk.qdrant_id = qdrant_id
                        chunk.embedding_generated = True
                        embedded_count += 1
                    except Exception as exc:
                        logger.warning("Failed to store embedding in Qdrant", error=str(exc))

            doc.status = "indexed"

            if source_ref and ingestion_job:
                db.add(
                    SourceVersion(
                        source_id=source_ref.id,
                        version_hash=content_hash,
                        status="valid",
                        content_uri=data.url,
                        raw_text=data.content,
                        meta={
                            "document_id": doc.id,
                            "source": data.source,
                            "domain": data.domain,
                        },
                    )
                )
                self._mark_source_success(source_ref)
                ingestion_job.status = "completed"
                ingestion_job.ended_at = now_utc()

            await db.commit()
            await db.refresh(doc)

            logger.info(
                "Document ingested",
                doc_id=doc.id,
                chunks=len(chunk_objects),
                embedded=embedded_count,
            )
            return _doc_to_schema(doc, len(chunk_objects))
        except Exception as exc:
            await db.rollback()

            if source_ref or ingestion_job:
                try:
                    if source_ref:
                        self._mark_source_failure(source_ref, str(exc))
                        db.add(source_ref)
                    if ingestion_job:
                        ingestion_job.status = "failed"
                        ingestion_job.ended_at = now_utc()
                        ingestion_job.error_message = str(exc)[:2000]
                        ingestion_job.retry_count = (ingestion_job.retry_count or 0) + 1
                        db.add(ingestion_job)
                    await db.commit()
                except Exception:
                    await db.rollback()

            raise

    async def delete_document(self, db: AsyncSession, doc_id: str) -> bool:
        doc = await db.scalar(select(Document).where(Document.id == doc_id))
        if not doc:
            return False

        chunk_ids = (await db.execute(select(Chunk.id).where(Chunk.document_id == doc_id))).scalars().all()
        if chunk_ids:
            try:
                vector_store.delete_by_chunk_ids(chunk_ids)
            except Exception as exc:
                logger.warning("Failed to delete from vector store", error=str(exc))

        await db.delete(doc)
        await db.commit()
        return True

    def _mark_source_success(self, source: AiSource) -> None:
        source.last_update_at = now_utc()
        source.last_update_status = "success"
        source.last_error_message = None
        source.consecutive_failures = 0

    def _mark_source_failure(self, source: AiSource, message: str) -> None:
        source.last_update_at = now_utc()
        source.last_update_status = "failed"
        source.last_error_message = message[:2000]
        source.consecutive_failures = (source.consecutive_failures or 0) + 1


document_service = DocumentService()


__all__ = ["DocumentService", "document_service"]
