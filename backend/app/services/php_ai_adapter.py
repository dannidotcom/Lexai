from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging import logger
from app.models.schemas import (
    AiAnalyzeInputSchema,
    AiQueryInputSchema,
    AiResponseSchema,
    TaskType,
)
from app.services.ai_service import ai_service


class PhpAiQueryInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    domaine: Optional[str] = Field(default=None, alias="domain")
    sous_domaine: Optional[str] = Field(default=None, alias="subDomain")
    question: str
    contexte_metier: Optional[str] = Field(default=None, alias="businessContext")
    type_tache: TaskType = Field(default=TaskType.QUERY, alias="taskType")
    limite_sources: Optional[int] = Field(default=None, ge=1, le=20, alias="limitSources")
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    async_request: bool = Field(default=False, alias="asyncRequest")

    @field_validator("type_tache", mode="before")
    @classmethod
    def normalize_task_type(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value

        normalized = value.strip().lower()
        mapping = {
            "question": TaskType.QUERY,
            "requete": TaskType.QUERY,
            "recherche": TaskType.QUERY,
            "query": TaskType.QUERY,
            "explication": TaskType.EXPLAIN,
            "explain": TaskType.EXPLAIN,
            "analyse": TaskType.ANALYZE,
            "analyze": TaskType.ANALYZE,
        }
        return mapping.get(normalized, value)


class PhpAiAnalyzeInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    domaine: Optional[str] = Field(default=None, alias="domain")
    sous_domaine: Optional[str] = Field(default=None, alias="subDomain")
    question: str = "Analyse le document ou le texte fourni."
    document: Optional[str] = None
    texte: Optional[str] = Field(default=None, alias="text")
    contexte_metier: Optional[str] = Field(default=None, alias="businessContext")
    limite_sources: Optional[int] = Field(default=None, ge=1, le=20, alias="limitSources")
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    async_request: bool = Field(default=False, alias="asyncRequest")


class AdapterResponse(BaseModel):
    request_id: str
    status: str
    progression: int
    success: bool
    response: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    created_at: str
    completed_at: Optional[str] = None


class PhpAiAdapterService:
    def __init__(self) -> None:
        self._requests: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def create_query(self, data: PhpAiQueryInput) -> AdapterResponse:
        request_id = await self._create_request("query")
        if data.async_request:
            asyncio.create_task(self._run_query(request_id, data))
            return self._response_from_state(await self._get_state(request_id))

        await self._run_query(request_id, data)
        return self._response_from_state(await self._get_state(request_id))

    async def create_analyze(self, data: PhpAiAnalyzeInput) -> AdapterResponse:
        request_id = await self._create_request("analyze")
        if data.async_request:
            asyncio.create_task(self._run_analyze(request_id, data))
            return self._response_from_state(await self._get_state(request_id))

        await self._run_analyze(request_id, data)
        return self._response_from_state(await self._get_state(request_id))

    async def get_status(self, request_id: str) -> Optional[AdapterResponse]:
        state = await self._get_state(request_id)
        if not state:
            return None
        return self._response_from_state(state)

    async def _run_query(self, request_id: str, data: PhpAiQueryInput) -> None:
        await self._update_request(request_id, status="running", progression=20)
        db = SessionLocal()
        try:
            ai_input = AiQueryInputSchema(
                question=self._question_with_business_context(data.question, data.contexte_metier),
                domain=data.domaine,
                subDomain=data.sous_domaine,
                sessionId=data.session_id,
                taskType=data.type_tache,
                limitSources=data.limite_sources,
            )
            result = await asyncio.wait_for(
                ai_service.query(ai_input, db),
                timeout=settings.ai_timeout_seconds,
            )
            await self._complete_request(request_id, result)
        except asyncio.TimeoutError:
            await self._fail_request(request_id, "timeout", "Le moteur IA n'a pas repondu dans le delai imparti.")
        except Exception as exc:
            logger.error("PHP AI adapter query failed", request_id=request_id, error=str(exc))
            await self._fail_request(request_id, "ai_error", str(exc))
        finally:
            db.close()

    async def _run_analyze(self, request_id: str, data: PhpAiAnalyzeInput) -> None:
        await self._update_request(request_id, status="running", progression=20)
        db = SessionLocal()
        try:
            situation = data.document or data.texte
            if not situation:
                raise ValueError("Le champ 'document' ou 'texte' est obligatoire pour l'analyse.")

            if data.contexte_metier:
                situation = f"Contexte metier:\n{data.contexte_metier}\n\nDocument ou texte:\n{situation}"

            ai_input = AiAnalyzeInputSchema(
                question=data.question,
                situation=situation,
                domain=data.domaine,
                subDomain=data.sous_domaine,
                sessionId=data.session_id,
                limitSources=data.limite_sources,
            )
            result = await asyncio.wait_for(
                ai_service.analyze(ai_input, db),
                timeout=settings.ai_timeout_seconds,
            )
            await self._complete_request(request_id, result)
        except asyncio.TimeoutError:
            await self._fail_request(request_id, "timeout", "Le moteur IA n'a pas repondu dans le delai imparti.")
        except Exception as exc:
            logger.error("PHP AI adapter analyze failed", request_id=request_id, error=str(exc))
            await self._fail_request(request_id, "ai_error", str(exc))
        finally:
            db.close()

    async def _create_request(self, operation: str) -> str:
        request_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        async with self._lock:
            self._requests[request_id] = {
                "request_id": request_id,
                "operation": operation,
                "status": "pending",
                "progression": 0,
                "success": False,
                "response": None,
                "error": None,
                "created_at": now,
                "completed_at": None,
            }
        return request_id

    async def _update_request(self, request_id: str, **updates: Any) -> None:
        async with self._lock:
            self._requests[request_id].update(updates)

    async def _complete_request(self, request_id: str, result: AiResponseSchema) -> None:
        await self._update_request(
            request_id,
            status="completed",
            progression=100,
            success=True,
            response=self._standardize_ai_response(result),
            completed_at=datetime.now(timezone.utc).isoformat(),
        )

    async def _fail_request(self, request_id: str, code: str, message: str) -> None:
        status = "timeout" if code == "timeout" else "failed"
        await self._update_request(
            request_id,
            status=status,
            progression=100,
            success=False,
            error={"code": code, "message": message},
            completed_at=datetime.now(timezone.utc).isoformat(),
        )

    async def _get_state(self, request_id: str) -> Optional[Dict[str, Any]]:
        async with self._lock:
            state = self._requests.get(request_id)
            return dict(state) if state else None

    def _response_from_state(self, state: Dict[str, Any]) -> AdapterResponse:
        return AdapterResponse(**state)

    def _question_with_business_context(self, question: str, business_context: Optional[str]) -> str:
        if not business_context:
            return question
        return f"Contexte metier:\n{business_context}\n\nQuestion:\n{question}"

    def _standardize_ai_response(self, response: AiResponseSchema) -> Dict[str, Any]:
        return {
            "reponse": response.answer, 
            "citations": [citation.model_dump() for citation in response.citations],
            "score_confiance": response.confidenceScore,
            "domaine": response.domain,
            "type_tache": response.taskType,
            "date_generation": response.generatedAt,
            "session_id": response.sessionId,
            "contexte_trouve": response.hasContext,
            "modele_utilise": response.modelUsed,
        }


php_ai_adapter_service = PhpAiAdapterService()
