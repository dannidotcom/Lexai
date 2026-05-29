from __future__ import annotations

from typing import Optional

from rank_bm25 import BM25Okapi
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.db_models import Chunk, Document
from app.modules.rag_vecor_engine.infrastructure import vector_store
from app.schemas.schemas import ContextResultSchema, SearchResultItemSchema, SearchResultSchema
from app.shared.ollama_service import ollama_service


class RAGService:
    async def search(
        self,
        query: str,
        db: AsyncSession,
        domain: Optional[str] = None,
        sub_domain: Optional[str] = None,
        limit: int = 5,
        search_type: str = "hybrid",
    ) -> SearchResultSchema:
        items: list[SearchResultItemSchema] = []

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
        db: AsyncSession,
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
        db: AsyncSession,
        domain: Optional[str] = None,
        limit: int = 5,
    ) -> list[SearchResultItemSchema]:
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

            row = (
                await db.execute(
                    select(Chunk, Document)
                    .join(Document, Document.id == Chunk.document_id)
                    .where(Chunk.id == chunk_id)
                )
            ).first()
            if not row:
                continue

            chunk, document = row
            items.append(
                SearchResultItemSchema(
                    chunkId=chunk.id,
                    documentId=chunk.document_id,
                    documentTitle=document.title,
                    source=document.source,
                    content=chunk.content,
                    sectionPath=chunk.section_path,
                    articleId=chunk.article_id,
                    score=float(point.score),
                    domain=document.domain,
                )
            )
        return items

    async def _bm25_search(
        self,
        query: str,
        db: AsyncSession,
        domain: Optional[str] = None,
        limit: int = 5,
    ) -> list[SearchResultItemSchema]:
        stmt = select(Chunk, Document).join(Document, Document.id == Chunk.document_id)
        if domain:
            stmt = stmt.where(Document.domain == domain)
        stmt = stmt.where(Chunk.statut_juridique.in_(["VIGUEUR", "VIGUEUR_ETEN"]))
        stmt = stmt.limit(500)

        rows = (await db.execute(stmt)).all()
        if not rows:
            return []

        pairs = [(row[0], row[1]) for row in rows]
        tokenized = [chunk.content.lower().split() for chunk, _ in pairs]
        bm25 = BM25Okapi(tokenized)
        query_tokens = query.lower().split()
        scores = bm25.get_scores(query_tokens)

        ranked = sorted(zip(pairs, scores), key=lambda x: x[1], reverse=True)[:limit]

        items = []
        for (chunk, document), score in ranked:
            if score < 0.01:
                continue
            items.append(
                SearchResultItemSchema(
                    chunkId=chunk.id,
                    documentId=chunk.document_id,
                    documentTitle=document.title,
                    source=document.source,
                    content=chunk.content,
                    sectionPath=chunk.section_path,
                    articleId=chunk.article_id,
                    score=float(score),
                    domain=document.domain,
                )
            )
        return items


rag_service = RAGService()


__all__ = ["RAGService", "rag_service"]
