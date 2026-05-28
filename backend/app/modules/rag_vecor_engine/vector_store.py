from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    ScoredPoint,
    VectorParams,
)

from app.core.config import settings
from app.core.logging import logger

VECTOR_DIM = 768


class VectorStore:
    _client: Optional[QdrantClient] = None

    def _get_client(self) -> QdrantClient:
        if self._client is None:
            self._client = QdrantClient(
                host=settings.qdrant_host,
                port=settings.qdrant_port,
            )
            logger.info("Connected to Qdrant", host=settings.qdrant_host, port=settings.qdrant_port)
        return self._client

    def ensure_collection(self) -> None:
        client = self._get_client()
        existing = [c.name for c in client.get_collections().collections]
        if settings.qdrant_collection not in existing:
            client.create_collection(
                collection_name=settings.qdrant_collection,
                vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
            )
            logger.info("Created Qdrant collection", collection=settings.qdrant_collection)

    def upsert_chunk(
        self,
        chunk_id: str,
        embedding: List[float],
        payload: Dict[str, Any],
    ) -> str:
        client = self._get_client()
        self.ensure_collection()
        point_id = str(uuid.uuid4())
        client.upsert(
            collection_name=settings.qdrant_collection,
            points=[
                PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={**payload, "chunk_id": chunk_id},
                )
            ],
        )
        return point_id

    def search(
        self,
        query_vector: List[float],
        limit: int = 5,
        domain_filter: Optional[str] = None,
    ) -> List[ScoredPoint]:
        client = self._get_client()
        self.ensure_collection()

        query_filter = None
        if domain_filter:
            query_filter = Filter(must=[FieldCondition(key="domain", match=MatchValue(value=domain_filter))])

        try:
            results = client.search(
                collection_name=settings.qdrant_collection,
                query_vector=query_vector,
                limit=limit,
                query_filter=query_filter,
                with_payload=True,
            )
            return results
        except Exception as exc:
            logger.warning("Vector search failed", error=str(exc))
            return []

    def get_all_for_bm25(self, domain_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        client = self._get_client()
        self.ensure_collection()
        try:
            scroll_filter = None
            if domain_filter:
                scroll_filter = Filter(must=[FieldCondition(key="domain", match=MatchValue(value=domain_filter))])
            results, _ = client.scroll(
                collection_name=settings.qdrant_collection,
                scroll_filter=scroll_filter,
                limit=1000,
                with_payload=True,
                with_vectors=False,
            )
            return [r.payload for r in results if r.payload]
        except Exception as exc:
            logger.warning("BM25 fetch failed", error=str(exc))
            return []

    def delete_by_chunk_ids(self, chunk_ids: List[str]) -> None:
        client = self._get_client()
        self.ensure_collection()
        try:
            from qdrant_client.models import FilterSelector

            client.delete(
                collection_name=settings.qdrant_collection,
                points_selector=FilterSelector(
                    filter=Filter(
                        must=[FieldCondition(key="chunk_id", match=MatchValue(value=cid)) for cid in chunk_ids]
                    )
                ),
            )
        except Exception as exc:
            logger.warning("Vector deletion failed", error=str(exc))

    def count(self) -> int:
        client = self._get_client()
        self.ensure_collection()
        try:
            info = client.get_collection(settings.qdrant_collection)
            return info.points_count or 0
        except Exception:
            return 0


vector_store = VectorStore()


__all__ = ["VECTOR_DIM", "VectorStore", "vector_store"]
