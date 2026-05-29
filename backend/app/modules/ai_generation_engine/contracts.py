from collections.abc import AsyncIterator
from typing import Optional, Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.schemas import (
    AiAnalyzeInputSchema,
    AiQueryInputSchema,
    AiResponseSchema,
    CitationSchema,
    MessageSchema,
    SessionInputSchema,
    SessionSchema,
    TaskType,
)


class AIGenerationPort(Protocol):
    async def query(self, input_data: AiQueryInputSchema, db: AsyncSession) -> AiResponseSchema:
        ...

    async def analyze(self, input_data: AiAnalyzeInputSchema, db: AsyncSession) -> AiResponseSchema:
        ...


class AIGenerationStreamingPort(Protocol):
    async def query_stream(self, input_data: AiQueryInputSchema, db: AsyncSession) -> AsyncIterator[str]:
        ...

    async def analyze_stream(self, input_data: AiAnalyzeInputSchema, db: AsyncSession) -> AsyncIterator[str]:
        ...


__all__ = [
    "AiQueryInputSchema",
    "AiAnalyzeInputSchema",
    "AiResponseSchema",
    "CitationSchema",
    "TaskType",
    "SessionSchema",
    "SessionInputSchema",
    "MessageSchema",
    "AIGenerationPort",
    "AIGenerationStreamingPort",
]
