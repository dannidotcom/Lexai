from __future__ import annotations
import hashlib
from typing import List, Optional
from sqlalchemy.orm import Session as DBSession
from app.models.db_models import Document, Chunk
from app.models.schemas import DocumentInputSchema, DocumentSchema, ChunkSchema
from app.services.chunk_service import build_chunks
from app.services.ollama_service import ollama_service
from app.services.vector_store import vector_store
from app.core.logging import logger


def _doc_to_schema(doc: Document) -> DocumentSchema:
    chunk_count = len(doc.chunks) if doc.chunks is not None else 0
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
    def list_documents(
        self,
        db: DBSession,
        domain: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[DocumentSchema]:
        q = db.query(Document)
        if domain:
            q = q.filter(Document.domain == domain)
        if status:
            q = q.filter(Document.status == status)
        docs = q.order_by(Document.created_at.desc()).offset(offset).limit(limit).all()
        return [_doc_to_schema(d) for d in docs]

    def get_document(self, db: DBSession, doc_id: str) -> Optional[DocumentSchema]:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return None
        return _doc_to_schema(doc)

    def get_chunks(self, db: DBSession, doc_id: str) -> List[ChunkSchema]:
        chunks = db.query(Chunk).filter(Chunk.document_id == doc_id).order_by(Chunk.chunk_index).all()
        return [_chunk_to_schema(c) for c in chunks]

    async def ingest_document(self, db: DBSession, data: DocumentInputSchema) -> DocumentSchema:
        content_hash = hashlib.sha256(data.content.encode()).hexdigest()

        existing = db.query(Document).filter(Document.content_hash == content_hash).first()
        if existing:
            logger.info("Document already exists (same hash)", doc_id=existing.id)
            return _doc_to_schema(existing)

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
        db.flush()

        raw_chunks = build_chunks(
            content=data.content,
            document_id=doc.id,
            domain=data.domain,
            source=data.source,
            document_title=data.title,
            metadata=data.metadata or {},
        )

        chunk_objects = []
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
            chunk_objects.append((chunk, c))
        db.flush()

        embedded_count = 0
        for chunk, meta in chunk_objects:
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
                except Exception as e:
                    logger.warning("Failed to store embedding in Qdrant", error=str(e))

        doc.status = "indexed"
        db.commit()
        db.refresh(doc)

        logger.info(
            "Document ingested",
            doc_id=doc.id,
            chunks=len(chunk_objects),
            embedded=embedded_count,
        )
        return _doc_to_schema(doc)

    def delete_document(self, db: DBSession, doc_id: str) -> bool:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return False

        chunk_ids = [c.id for c in doc.chunks]
        if chunk_ids:
            try:
                vector_store.delete_by_chunk_ids(chunk_ids)
            except Exception as e:
                logger.warning("Failed to delete from vector store", error=str(e))

        db.delete(doc)
        db.commit()
        return True


document_service = DocumentService()
