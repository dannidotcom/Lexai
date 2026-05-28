from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session as DBSession

from app.core.config import settings
from app.core.logging import logger
from app.models.db_models import Message, Session
from backend.app.schemas.schemas import (
    AiAnalyzeInputSchema,
    AiQueryInputSchema,
    AiResponseSchema,
    CitationSchema,
)
from app.modules.ai_generation_engine.ollama_service import ollama_service
from app.modules.rag_search_engine.rag_service import rag_service

SYSTEM_PROMPT = """
            Tu es LexIA, un moteur d'intelligence artificielle juridique souverain.

            MISSION :
            Tu reponds exclusivement a partir des documents officiels fournis dans le contexte (RAG).

            REGLES ABSOLUES :
            - Reponds uniquement en francais.
            - Utilise uniquement les sources fournies.
            - Interdiction d'utiliser des connaissances externes.
            - Ne jamais inventer ou extrapoler.
            - Si information absente -> le dire explicitement.
            - Ne jamais donner de conseil juridique definitif.

            STRUCTURE OBLIGATOIRE :
            1. Reponse synthetique
            2. Analyse basee sur les sources
            3. Sources utilisees
        """


EXPLAIN_PROMPT = """
            Tu es LexIA, assistant juridique pedagogique.

            REGLES :
            - Utiliser uniquement les sources fournies
            - Repondre en francais
            - Simplifier sans deformer
            - Toujours citer les sources

            STRUCTURE :
            1. Explication simple
            2. Exemple concret
            3. Implications juridiques
            4. Sources
    """


ANALYZE_PROMPT = """
Tu es LexIA, moteur d'analyse juridique.

REGLES STRICTES :
- Reponds UNIQUEMENT en francais
- Utilise UNIQUEMENT les sources fournies
- Interdiction d'inventer ou completer
- Toute information absente doit etre explicitement signalee
- Analyse juridique structuree obligatoire
- Validation humaine obligatoire

STRUCTURE OBLIGATOIRE :
## Resume de la situation
## Analyse juridique
## Obligations applicables
## Risques ou non-conformites
## Zones d'incertitude
## Conclusion
## Sources utilisees
"""


class AIService:
    async def _build_prompt_with_context(
        self,
        question: str,
        context: str,
        task_type: str,
        situation: Optional[str] = None,
    ) -> str:
        base_rules = """
IMPORTANT :
- Reponds uniquement a partir des sources fournies
- Interdiction de connaissances externes
- Reponse en francais uniquement
- Si information absente -> le signaler explicitement
"""

        if task_type == "analyze" and situation:
            return f"""
{base_rules}

================ CONTEXTE ================
{context}

================ SITUATION ================
{situation}

================ QUESTION ================
{question}

Analyse juridique structuree basee uniquement sur les sources.
"""

        if task_type == "explain":
            return f"""
{base_rules}

================ CONTEXTE ================
{context}

================ CONCEPT ================
{question}

Explique de maniere simple et pedagogique.
"""

        return f"""
{base_rules}

================ CONTEXTE ================
{context}

================ QUESTION ================
{question}

Reponds uniquement a partir des sources.
"""

    def _get_system_prompt(self, task_type: str) -> str:
        if task_type == "explain":
            return EXPLAIN_PROMPT
        if task_type == "analyze":
            return ANALYZE_PROMPT
        return SYSTEM_PROMPT

    def _calculate_confidence(self, sources_count: int, has_context: bool) -> float:
        if not has_context or sources_count == 0:
            return 0.0
        if sources_count >= 3:
            return 0.90
        if sources_count == 2:
            return 0.75
        return 0.60

    def _build_citations(self, sources: list) -> List[CitationSchema]:
        citations = []
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

    async def query(
        self,
        input_data: AiQueryInputSchema,
        db: DBSession,
    ) -> AiResponseSchema:
        task_type = input_data.taskType.value if hasattr(input_data.taskType, "value") else str(input_data.taskType)

        context_result = await rag_service.get_context(
            query=input_data.question,
            db=db,
            domain=input_data.domain,
            limit=input_data.limitSources or settings.max_chunks_per_search,
        )

        has_context = len(context_result.sources) > 0

        if not has_context:
            answer = "Je ne dispose pas d'informations suffisantes dans les sources officielles pour repondre a cette question."
            model_used = "fallback"
            citations = []
        else:
            prompt = await self._build_prompt_with_context(
                question=input_data.question,
                context=context_result.context,
                task_type=task_type,
            )
            system_prompt = self._get_system_prompt(task_type)

            try:
                answer = await ollama_service.generate_response(prompt, system_prompt)
                model_used = settings.ollama_llm_model

                if not answer or not answer.strip():
                    answer = "Reponse vide du modele."
                    model_used = "mistral_empty_response"

            except Exception as exc:
                logger.error("LLM error", error=str(exc))
                answer = "Erreur du moteur IA."
                model_used = "unavailable"

            citations = self._build_citations(context_result.sources)

        confidence = self._calculate_confidence(len(citations), has_context)

        response = AiResponseSchema(
            answer=answer,
            citations=citations,
            confidenceScore=confidence,
            domain=input_data.domain,
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

        return response

    async def query_stream(
        self,
        input_data: AiQueryInputSchema,
        db: DBSession,
    ):
        import json

        task_type = input_data.taskType.value if hasattr(input_data.taskType, "value") else str(input_data.taskType)

        context_result = await rag_service.get_context(
            query=input_data.question,
            db=db,
            domain=input_data.domain,
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
            prompt = await self._build_prompt_with_context(
                question=input_data.question,
                context=context_result.context,
                task_type=task_type,
            )
            system_prompt = self._get_system_prompt(task_type)
            model_used = settings.ollama_llm_model
            answer = ""

            try:
                async for chunk in ollama_service.generate_response_stream(prompt, system_prompt):
                    answer += chunk
                    yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"

                if not answer.strip():
                    answer = "Reponse vide du modele."
                    model_used = "mistral_empty_response"
                    yield f"data: {json.dumps({'type': 'chunk', 'text': answer})}\n\n"

            except Exception as exc:
                logger.error("LLM stream error", error=str(exc))
                answer = "Erreur du moteur IA."
                model_used = "unavailable"
                yield f"data: {json.dumps({'type': 'chunk', 'text': answer})}\n\n"

        response = AiResponseSchema(
            answer=answer,
            citations=citations,
            confidenceScore=confidence,
            domain=input_data.domain,
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

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    async def analyze(
        self,
        input_data: AiAnalyzeInputSchema,
        db: DBSession,
    ) -> AiResponseSchema:
        query_text = f"{input_data.question}\n{input_data.situation}"

        context_result = await rag_service.get_context(
            query=query_text,
            db=db,
            domain=input_data.domain,
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

            prompt = await self._build_prompt_with_context(
                question=input_data.question,
                context=context_text,
                task_type="analyze",
                situation=input_data.situation,
            )

            try:
                answer = await ollama_service.generate_response(prompt, ANALYZE_PROMPT)
                model_used = settings.ollama_llm_model

                if not answer or not answer.strip():
                    answer = "Reponse vide du modele."
                    model_used = "mistral_empty_response"

            except Exception as exc:
                logger.error("Analyze error", error=str(exc))
                answer = "Erreur du moteur IA."
                model_used = "unavailable"

            citations = self._build_citations(filtered_sources)

        confidence = self._calculate_confidence(len(filtered_sources), has_context)

        response = AiResponseSchema(
            answer=answer,
            citations=citations,
            confidenceScore=confidence,
            domain=input_data.domain,
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

        return response

    async def analyze_stream(
        self,
        input_data: AiAnalyzeInputSchema,
        db: DBSession,
    ):
        import json

        query_text = f"{input_data.question}\n{input_data.situation}"

        context_result = await rag_service.get_context(
            query=query_text,
            db=db,
            domain=input_data.domain,
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

            prompt = await self._build_prompt_with_context(
                question=input_data.question,
                context=context_text,
                task_type="analyze",
                situation=input_data.situation,
            )
            model_used = settings.ollama_llm_model
            answer = ""

            try:
                async for chunk in ollama_service.generate_response_stream(prompt, ANALYZE_PROMPT):
                    answer += chunk
                    yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"

                if not answer.strip():
                    answer = "Reponse vide du modele."
                    model_used = "mistral_empty_response"
                    yield f"data: {json.dumps({'type': 'chunk', 'text': answer})}\n\n"

            except Exception as exc:
                logger.error("Analyze stream error", error=str(exc))
                answer = "Erreur du moteur IA."
                model_used = "unavailable"
                yield f"data: {json.dumps({'type': 'chunk', 'text': answer})}\n\n"

        response = AiResponseSchema(
            answer=answer,
            citations=citations,
            confidenceScore=confidence,
            domain=input_data.domain,
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


__all__ = ["AIService", "ai_service", "SYSTEM_PROMPT", "EXPLAIN_PROMPT", "ANALYZE_PROMPT"]
