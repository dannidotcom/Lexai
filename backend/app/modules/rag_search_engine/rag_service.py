from __future__ import annotations

from typing import List, Optional

from rank_bm25 import BM25Okapi
from sqlalchemy.orm import Session as DBSession

from app.core.logging import logger
from app.models.db_models import Chunk, Document
from backend.app.schemas.schemas import ContextResultSchema, SearchResultItemSchema, SearchResultSchema
from app.modules.rag_vecor_engine.infrastructure import vector_store
from app.shared.ollama_service import ollama_service


class RAGService:
    async def search(
        self,
        query: str,
        db: DBSession,
        domain: Optional[str] = None,
        sub_domain: Optional[str] = None,
        limit: int = 5,
        search_type: str = "hybrid",
    ) -> SearchResultSchema:
        items: List[SearchResultItemSchema] = []

        if search_type in ("vector", "hybrid"):
            vector_items = await self._vector_search(query, db, domain, limit)
            items.extend(vector_items)

        if search_type in ("bm25", "hybrid"):
            bm25_items = await self._bm25_search(query, db, domain, limit)
            if search_type == "hybrid":
                seen_ids = {i.chunkId for i in items}
                for item in bm25_items:
                    if item.chunkId not in seen_ids:
                        items.append(item)
                        seen_ids.add(item.chunkId)
            else:
                items = bm25_items

        items.sort(key=lambda x: x.score, reverse=True)
        items = items[:limit]

        return SearchResultSchema(
            items=items,
            totalFound=len(items),
            query=query,
            searchType=search_type,
        )

    async def get_context(
        self,
        query: str,
        db: DBSession,
        domain: Optional[str] = None,
        limit: int = 5,
    ) -> ContextResultSchema:
        search_result = await self.search(query, db, domain=domain, limit=limit, search_type="hybrid")
        context_parts = []
        for i, item in enumerate(search_result.items, 1):
            header = f"[Source {i}: {item.documentTitle} - {item.source}]"
            if item.articleId:
                header += f" Art. {item.articleId}"
            context_parts.append(f"{header}\n{item.content}")

        context = "\n\n---\n\n".join(context_parts)
        return ContextResultSchema(
            context=context,
            sources=search_result.items,
            query=query,
        )

    async def _vector_search(
        self,
        query: str,
        db: DBSession,
        domain: Optional[str] = None,
        limit: int = 5,
    ) -> List[SearchResultItemSchema]:
        embedding = await ollama_service.generate_embedding(query)
        if not embedding:
            logger.warning("No embedding generated, skipping vector search")
            return []

        scored = vector_store.search(embedding, limit=limit, domain_filter=domain)
        items = []
        for point in scored:
            payload = point.payload or {}
            chunk_id = payload.get("chunk_id", "")
            if not chunk_id:
                continue

            chunk = db.query(Chunk).filter(Chunk.id == chunk_id).first()
            if not chunk or not chunk.document:
                continue

            items.append(
                SearchResultItemSchema(
                    chunkId=chunk.id,
                    documentId=chunk.document_id,
                    documentTitle=chunk.document.title,
                    source=chunk.document.source,
                    content=chunk.content,
                    sectionPath=chunk.section_path,
                    articleId=chunk.article_id,
                    score=float(point.score),
                    domain=chunk.document.domain,
                )
            )
        return items

    async def _bm25_search(
        self,
        query: str,
        db: DBSession,
        domain: Optional[str] = None,
        limit: int = 5,
    ) -> List[SearchResultItemSchema]:
        query_db = db.query(Chunk).join(Document)
        if domain:
            query_db = query_db.filter(Document.domain == domain)
        query_db = query_db.filter(Chunk.statut_juridique.in_(["VIGUEUR", "VIGUEUR_ETEN"]))
        chunks = query_db.limit(500).all()

        if not chunks:
            return []

        tokenized = [c.content.lower().split() for c in chunks]
        bm25 = BM25Okapi(tokenized)
        query_tokens = query.lower().split()
        scores = bm25.get_scores(query_tokens)

        ranked = sorted(zip(chunks, scores), key=lambda x: x[1], reverse=True)[:limit]

        items = []
        for chunk, score in ranked:
            if score < 0.01:
                continue
            if not chunk.document:
                continue
            items.append(
                SearchResultItemSchema(
                    chunkId=chunk.id,
                    documentId=chunk.document_id,
                    documentTitle=chunk.document.title,
                    source=chunk.document.source,
                    content=chunk.content,
                    sectionPath=chunk.section_path,
                    articleId=chunk.article_id,
                    score=float(score),
                    domain=chunk.document.domain,
                )
            )
        return items


rag_service = RAGService()


__all__ = ["RAGService", "rag_service"]
