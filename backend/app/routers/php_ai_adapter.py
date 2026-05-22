from fastapi import APIRouter, HTTPException

from app.services.php_ai_adapter import (
    AdapterResponse,
    PhpAiAnalyzeInput,
    PhpAiQueryInput,
    php_ai_adapter_service,
)


router = APIRouter(prefix="/adapter/ai", tags=["PHP AI Adapter"])


@router.post("/query", response_model=AdapterResponse)
async def adapter_ai_query(data: PhpAiQueryInput):
    return await php_ai_adapter_service.create_query(data)


@router.post("/analyze", response_model=AdapterResponse)
async def adapter_ai_analyze(data: PhpAiAnalyzeInput):
    return await php_ai_adapter_service.create_analyze(data)


@router.get("/status/{request_id}", response_model=AdapterResponse)
async def adapter_ai_status(request_id: str):
    status = await php_ai_adapter_service.get_status(request_id)
    if not status:
        raise HTTPException(status_code=404, detail="Request not found")
    return status
