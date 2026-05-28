from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Iterable, List

from sqlalchemy.orm import Session as DBSession

from app.core.config import settings
from app.core.logging import logger
from app.models.db_models import AiRequestLog, Message, Session
from app.modules.ai_generation_engine.ollama_service import ollama_service
from app.modules.ai_generation_engine.prompt_service import PromptConfigurationError, ResolvedPromptConfiguration, prompt_service
from app.modules.rag_search_engine.rag_service import rag_service
from app.schemas.schemas import AiAnalyzeInputSchema, AiQueryInputSchema, AiResponseSchema, CitationSchema


class AIService:
    def _resolve_feature_id(self, feature_id: str | None, task_type: str) -> str:
        if feature_id and feature_id.strip():
            return feature_id.strip()
        return f"ai.{task_type}"

    def _resolve_prompt_configuration(self, db: DBSession, feature_id: str) -> ResolvedPromptConfiguration:
        return prompt_service.resolve_active_prompt(db, feature_id)

    def _build_prompt_values(
        self,
        *,
        question: str,
        context: str,
        task_type: str,
        domain: str | None,
        sub_domain: str | None,
        business_context: str | None,
        situation: str | None = None,
    ) -> dict[str, str]:
        return {
            "question": question,
            "context": context,
            "task_type": task_type,
            "domain": domain or "",
            "sub_domain": sub_domain or "",
            "business_context": business_context or "",
            "situation": situation or "",
        }

    def _calculate_confidence(self, sources_count: int, has_context: bool) -> float:
        if not has_context or sources_count == 0:
            return 0.0
        if sources_count >= 3:
            return 0.90
        if sources_count == 2:
            return 0.75
        return 0.60

    def _build_citations(self, sources: list) -> List[CitationSchema]:
        citations: List[CitationSchema] = []
        for item in sources:
            citations.append(
                CitationSchema(
                    documentId=item.documentId,
                    documentTitle=item.documentTitle,
                    source=item.source,
                    articleId=item.articleId,
                    sectionPath=item.sectionPath,
                    relevanceScore=round(getattr(item, "score", 0), 3),
                    excerpt=(item.content[:300] + "...") if len(item.content) > 300 else item.content,
                )
            )
        return citations

    def _serialize_sources(self, sources: Iterable) -> list[dict]:
        result: list[dict] = []
        for item in sources:
            result.append(
                {
                    "chunkId": item.chunkId,
                    "documentId": item.documentId,
                    "documentTitle": item.documentTitle,
                    "source": item.source,
                    "articleId": item.articleId,
                    "sectionPath": item.sectionPath,
                    "score": float(getattr(item, "score", 0)),
                    "domain": item.domain,
                }
            )
        return result

    def _build_knowledge_version(self, sources: Iterable) -> str | None:
        signatures: list[str] = []
        for item in sources:
            signatures.append(f"{item.documentId}:{item.chunkId}:{round(float(getattr(item, 'score', 0)), 6)}")
        if not signatures:
            return None
        digest = hashlib.sha256("|".join(signatures).encode("utf-8")).hexdigest()
        return digest

    def _log_request(
        self,
        *,
        db: DBSession,
        feature_id: str,
        domain: str,
        sub_domain: str | None,
        task_type: str,
        user_payload: dict,
        response_content: str,
        sources_used: list,
        prompt_version: int,
    ) -> None:
        try:
            db.add(
                AiRequestLog(
                    feature_id=feature_id,
                    domain=domain,
                    sub_domain=sub_domain,
                    task_type=task_type,
                    user_payload=user_payload,
                    response_content=response_content,
                    sources_used=self._serialize_sources(sources_used),
                    prompt_version=prompt_version,
                    knowledge_version=self._build_knowledge_version(sources_used),
                )
            )
            db.commit()
        except Exception as exc:
            logger.error("Failed to log AI request", feature_id=feature_id, error=str(exc))
            db.rollback()

    async def query(
        self,
        input_data: AiQueryInputSchema,
        db: DBSession,
    ) -> AiResponseSchema:
        task_type = input_data.taskType.value if hasattr(input_data.taskType, "value") else str(input_data.taskType)
        feature_id = self._resolve_feature_id(input_data.featureId, task_type)
        prompt_config = self._resolve_prompt_configuration(db, feature_id)

        context_result = await rag_service.get_context(
            query=input_data.question,
            db=db,
            domain=input_data.domain or prompt_config.domain,
            limit=input_data.limitSources or settings.max_chunks_per_search,
        )

        has_context = len(context_result.sources) > 0

        if not has_context:
            answer = "Je ne dispose pas d'informations suffisantes dans les sources officielles pour repondre a cette question."
            model_used = "fallback"
            citations = []
        else:
            prompt_values = self._build_prompt_values(
                question=input_data.question,
                context=context_result.context,
                task_type=task_type,
                domain=input_data.domain or prompt_config.domain,
                sub_domain=input_data.subDomain or prompt_config.sub_domain,
                business_context=input_data.businessContext,
            )
            prompt = prompt_service.render_user_prompt(prompt_config, prompt_values)

            try:
                answer = await ollama_service.generate_response(prompt, prompt_config.system_prompt)
                model_used = settings.ollama_llm_model

                if not answer or not answer.strip():
                    answer = "Reponse vide du modele."
                    model_used = "mistral_empty_response"

            except Exception as exc:
                logger.error("LLM error", feature_id=feature_id, error=str(exc))
                answer = "Erreur du moteur IA."
                model_used = "unavailable"

            citations = self._build_citations(context_result.sources)

        confidence = self._calculate_confidence(len(citations), has_context)
        response_domain = input_data.domain or prompt_config.domain

        response = AiResponseSchema(
            answer=answer,
            citations=citations,
            confidenceScore=confidence,
            domain=response_domain,
            taskType=task_type,
            generatedAt=datetime.now(timezone.utc).isoformat(),
            sessionId=input_data.sessionId,
            hasContext=has_context,
            modelUsed=model_used,
        )

        if input_data.sessionId:
            await self._save_exchange(
                db=db,
                session_id=input_data.sessionId,
                question=input_data.question,
                response=response,
            )

        self._log_request(
            db=db,
            feature_id=feature_id,
            domain=response_domain,
            sub_domain=input_data.subDomain or prompt_config.sub_domain,
            task_type=task_type,
            user_payload=input_data.model_dump(mode="json"),
            response_content=response.answer,
            sources_used=context_result.sources if has_context else [],
            prompt_version=prompt_config.prompt_version,
        )

        return response

    async def query_stream(
        self,
        input_data: AiQueryInputSchema,
        db: DBSession,
    ):
        import json

        task_type = input_data.taskType.value if hasattr(input_data.taskType, "value") else str(input_data.taskType)
        feature_id = self._resolve_feature_id(input_data.featureId, task_type)
        prompt_config = self._resolve_prompt_configuration(db, feature_id)

        context_result = await rag_service.get_context(
            query=input_data.question,
            db=db,
            domain=input_data.domain or prompt_config.domain,
            limit=input_data.limitSources or settings.max_chunks_per_search,
        )

        has_context = len(context_result.sources) > 0
        citations = self._build_citations(context_result.sources)
        confidence = self._calculate_confidence(len(citations), has_context)

        yield f"data: {json.dumps({'type': 'meta', 'citations': [c.model_dump() for c in citations], 'confidence': confidence})}\n\n"

        if not has_context:
            answer = "Je ne dispose pas d'informations suffisantes dans les sources officielles pour repondre a cette question."
            model_used = "fallback"
            yield f"data: {json.dumps({'type': 'chunk', 'text': answer})}\n\n"
        else:
            prompt_values = self._build_prompt_values(
                question=input_data.question,
                context=context_result.context,
                task_type=task_type,
                domain=input_data.domain or prompt_config.domain,
                sub_domain=input_data.subDomain or prompt_config.sub_domain,
                business_context=input_data.businessContext,
            )
            prompt = prompt_service.render_user_prompt(prompt_config, prompt_values)
            model_used = settings.ollama_llm_model
            answer = ""

            try:
                async for chunk in ollama_service.generate_response_stream(prompt, prompt_config.system_prompt):
                    answer += chunk
                    yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"

                if not answer.strip():
                    answer = "Reponse vide du modele."
                    model_used = "mistral_empty_response"
                    yield f"data: {json.dumps({'type': 'chunk', 'text': answer})}\n\n"

            except Exception as exc:
                logger.error("LLM stream error", feature_id=feature_id, error=str(exc))
                answer = "Erreur du moteur IA."
                model_used = "unavailable"
                yield f"data: {json.dumps({'type': 'chunk', 'text': answer})}\n\n"

        response_domain = input_data.domain or prompt_config.domain

        response = AiResponseSchema(
            answer=answer,
            citations=citations,
            confidenceScore=confidence,
            domain=response_domain,
            taskType=task_type,
            generatedAt=datetime.now(timezone.utc).isoformat(),
            sessionId=input_data.sessionId,
            hasContext=has_context,
            modelUsed=model_used,
        )

        if input_data.sessionId:
            await self._save_exchange(
                db=db,
                session_id=input_data.sessionId,
                question=input_data.question,
                response=response,
            )

        self._log_request(
            db=db,
            feature_id=feature_id,
            domain=response_domain,
            sub_domain=input_data.subDomain or prompt_config.sub_domain,
            task_type=task_type,
            user_payload=input_data.model_dump(mode="json"),
            response_content=response.answer,
            sources_used=context_result.sources if has_context else [],
            prompt_version=prompt_config.prompt_version,
        )

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    async def analyze(
        self,
        input_data: AiAnalyzeInputSchema,
        db: DBSession,
    ) -> AiResponseSchema:
        feature_id = self._resolve_feature_id(input_data.featureId, "analyze")
        prompt_config = self._resolve_prompt_configuration(db, feature_id)

        query_text = f"{input_data.question}\n{input_data.situation}"

        context_result = await rag_service.get_context(
            query=query_text,
            db=db,
            domain=input_data.domain or prompt_config.domain,
            limit=input_data.limitSources or settings.max_chunks_per_search,
        )

        min_score = 0.25
        filtered_sources = [s for s in context_result.sources if getattr(s, "score", 0) >= min_score]
        has_context = len(filtered_sources) > 0

        if not has_context:
            answer = "Je ne dispose pas d'informations suffisantes dans les sources officielles pour analyser cette situation."
            model_used = "fallback"
            citations = []
        else:
            context_text = "\n\n".join([s.content for s in filtered_sources])

            prompt_values = self._build_prompt_values(
                question=input_data.question,
                context=context_text,
                task_type="analyze",
                domain=input_data.domain or prompt_config.domain,
                sub_domain=input_data.subDomain or prompt_config.sub_domain,
                business_context=input_data.businessContext,
                situation=input_data.situation,
            )
            prompt = prompt_service.render_user_prompt(prompt_config, prompt_values)

            try:
                answer = await ollama_service.generate_response(prompt, prompt_config.system_prompt)
                model_used = settings.ollama_llm_model

                if not answer or not answer.strip():
                    answer = "Reponse vide du modele."
                    model_used = "mistral_empty_response"

            except Exception as exc:
                logger.error("Analyze error", feature_id=feature_id, error=str(exc))
                answer = "Erreur du moteur IA."
                model_used = "unavailable"

            citations = self._build_citations(filtered_sources)

        confidence = self._calculate_confidence(len(filtered_sources), has_context)
        response_domain = input_data.domain or prompt_config.domain

        response = AiResponseSchema(
            answer=answer,
            citations=citations,
            confidenceScore=confidence,
            domain=response_domain,
            taskType="analyze",
            generatedAt=datetime.now(timezone.utc).isoformat(),
            sessionId=input_data.sessionId,
            hasContext=has_context,
            modelUsed=model_used,
        )

        if input_data.sessionId:
            await self._save_exchange(
                db=db,
                session_id=input_data.sessionId,
                question=input_data.question,
                response=response,
            )

        self._log_request(
            db=db,
            feature_id=feature_id,
            domain=response_domain,
            sub_domain=input_data.subDomain or prompt_config.sub_domain,
            task_type="analyze",
            user_payload=input_data.model_dump(mode="json"),
            response_content=response.answer,
            sources_used=filtered_sources if has_context else [],
            prompt_version=prompt_config.prompt_version,
        )

        return response

    async def analyze_stream(
        self,
        input_data: AiAnalyzeInputSchema,
        db: DBSession,
    ):
        import json

        feature_id = self._resolve_feature_id(input_data.featureId, "analyze")
        prompt_config = self._resolve_prompt_configuration(db, feature_id)

        query_text = f"{input_data.question}\n{input_data.situation}"

        context_result = await rag_service.get_context(
            query=query_text,
            db=db,
            domain=input_data.domain or prompt_config.domain,
            limit=input_data.limitSources or settings.max_chunks_per_search,
        )

        min_score = 0.25
        filtered_sources = [s for s in context_result.sources if getattr(s, "score", 0) >= min_score]

        has_context = len(filtered_sources) > 0
        citations = self._build_citations(filtered_sources)
        confidence = self._calculate_confidence(len(filtered_sources), has_context)

        yield f"data: {json.dumps({'type': 'meta', 'citations': [c.model_dump() for c in citations], 'confidence': confidence})}\n\n"

        if not has_context:
            answer = "Je ne dispose pas d'informations suffisantes dans les sources officielles pour analyser cette situation."
            model_used = "fallback"
            yield f"data: {json.dumps({'type': 'chunk', 'text': answer})}\n\n"
        else:
            context_text = "\n\n".join([s.content for s in filtered_sources])

            prompt_values = self._build_prompt_values(
                question=input_data.question,
                context=context_text,
                task_type="analyze",
                domain=input_data.domain or prompt_config.domain,
                sub_domain=input_data.subDomain or prompt_config.sub_domain,
                business_context=input_data.businessContext,
                situation=input_data.situation,
            )
            prompt = prompt_service.render_user_prompt(prompt_config, prompt_values)
            model_used = settings.ollama_llm_model
            answer = ""

            try:
                async for chunk in ollama_service.generate_response_stream(prompt, prompt_config.system_prompt):
                    answer += chunk
                    yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"

                if not answer.strip():
                    answer = "Reponse vide du modele."
                    model_used = "mistral_empty_response"
                    yield f"data: {json.dumps({'type': 'chunk', 'text': answer})}\n\n"

            except Exception as exc:
                logger.error("Analyze stream error", feature_id=feature_id, error=str(exc))
                answer = "Erreur du moteur IA."
                model_used = "unavailable"
                yield f"data: {json.dumps({'type': 'chunk', 'text': answer})}\n\n"

        response_domain = input_data.domain or prompt_config.domain

        response = AiResponseSchema(
            answer=answer,
            citations=citations,
            confidenceScore=confidence,
            domain=response_domain,
            taskType="analyze",
            generatedAt=datetime.now(timezone.utc).isoformat(),
            sessionId=input_data.sessionId,
            hasContext=has_context,
            modelUsed=model_used,
        )

        if input_data.sessionId:
            await self._save_exchange(
                db=db,
                session_id=input_data.sessionId,
                question=input_data.question,
                response=response,
            )

        self._log_request(
            db=db,
            feature_id=feature_id,
            domain=response_domain,
            sub_domain=input_data.subDomain or prompt_config.sub_domain,
            task_type="analyze",
            user_payload=input_data.model_dump(mode="json"),
            response_content=response.answer,
            sources_used=filtered_sources if has_context else [],
            prompt_version=prompt_config.prompt_version,
        )

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    async def _save_exchange(
        self,
        db: DBSession,
        session_id: str,
        question: str,
        response: AiResponseSchema,
    ) -> None:
        try:
            session = db.query(Session).filter(Session.id == session_id).first()
            if not session:
                return

            db.add(
                Message(
                    session_id=session_id,
                    role="user",
                    content=question,
                    citations=[],
                )
            )

            db.add(
                Message(
                    session_id=session_id,
                    role="assistant",
                    content=response.answer,
                    citations=[c.model_dump() for c in response.citations],
                    confidence_score=response.confidenceScore,
                    model_used=response.modelUsed,
                )
            )

            db.commit()
        except Exception as exc:
            logger.error("Save exchange failed", error=str(exc))
            db.rollback()


ai_service = AIService()


__all__ = ["AIService", "PromptConfigurationError", "ai_service"]
