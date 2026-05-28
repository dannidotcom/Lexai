from typing import Optional, Protocol

from app.modules.php_ai_adpater.php_ai_adapter_service import AdapterResponse, PhpAiAnalyzeInput, PhpAiQueryInput


class PhpAiAdapterPort(Protocol):
    async def create_query(self, data: PhpAiQueryInput) -> AdapterResponse:
        ...

    async def create_analyze(self, data: PhpAiAnalyzeInput) -> AdapterResponse:
        ...

    async def get_status(self, request_id: str) -> Optional[AdapterResponse]:
        ...


__all__ = [
    "PhpAiQueryInput",
    "PhpAiAnalyzeInput",
    "AdapterResponse",
    "PhpAiAdapterPort",
]
