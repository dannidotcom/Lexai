from typing import Optional, Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.schemas import ContextResultSchema, SearchInputSchema, SearchResultSchema, SearchType


class SearchContextPort(Protocol):
    async def get_context(
        self,
        query: str,
        db: AsyncSession,
        domain: Optional[str] = None,
        limit: int = 5,
    ) -> ContextResultSchema:
        ...


class SearchEnginePort(Protocol):
    async def search(
        self,
        query: str,
        db: AsyncSession,
        domain: Optional[str] = None,
        sub_domain: Optional[str] = None,
        limit: int = 5,
        search_type: str = "hybrid",
    ) -> SearchResultSchema:
        ...


__all__ = [
    "SearchInputSchema",
    "SearchResultSchema",
    "ContextResultSchema",
    "SearchType",
    "SearchContextPort",
    "SearchEnginePort",
]
