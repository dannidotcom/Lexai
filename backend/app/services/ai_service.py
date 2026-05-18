from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session as DBSession
from app.models.schemas import (
    AiResponseSchema, CitationSchema, AiQueryInputSchema, AiAnalyzeInputSchema
)
from app.models.db_models import Message, Session
from app.services.rag_service import rag_service
from app.services.ollama_service import ollama_service
from app.core.config import settings
from app.core.logging import logger

SYSTEM_PROMPT = """Tu es LexIA, un moteur IA juridique souverain.

RÈGLES ABSOLUES :
1. Tu réponds UNIQUEMENT à partir des documents officiels fournis dans le contexte.
2. Tu ne dois jamais inventer, extrapoler ou utiliser des connaissances externes.
3. Si le contexte ne contient pas l'information, tu réponds : "Je ne dispose pas d'informations suffisantes dans les sources officielles importées pour répondre à cette question."
4. Tu cites TOUJOURS les sources utilisées (article, section, document).
5. Tu es précis, factuel, et tu n'exprimes jamais d'opinion personnelle.
6. Tu répondras en français.

FORMAT DE RÉPONSE :
- Commence par la réponse directe.
- Développe avec les éléments réglementaires pertinents.
- Termine par les références utilisées.
"""

EXPLAIN_PROMPT = """Tu es LexIA, un moteur IA juridique souverain spécialisé dans la vulgarisation juridique.

RÈGLES :
1. Explique le concept ou la règle en langage clair et accessible, UNIQUEMENT à partir du contexte fourni.
2. Ne jamais inventer ni utiliser de connaissances externes.
3. Reformule les obligations de manière pratique.
4. Cite les sources.
5. Réponds en français.
"""

ANALYZE_PROMPT = """Tu es LexIA, un moteur IA juridique souverain spécialisé dans l'analyse RH et sociale.

RÈGLES :
1. Analyse la situation décrite UNIQUEMENT à partir des textes officiels fournis.
2. Compare la situation aux règles réglementaires.
3. Identifie les risques et obligations.
4. Ne prends jamais de décision autonome — signale les points de vigilance.
5. Mentionne que toute décision finale requiert validation humaine.
6. Cite les sources précisément.
7. Réponds en français.
"""


class AIService:
    async def _build_prompt_with_context(
        self,
        question: str,
        context: str,
        task_type: str,
        situation: Optional[str] = None,
    ) -> str:
        if task_type == "analyze" and situation:
            return f"""SITUATION À ANALYSER :
{situation}

QUESTION :
{question}

SOURCES OFFICIELLES DISPONIBLES :
{context}

Analyse la situation en te basant exclusivement sur ces sources officielles."""
        elif task_type == "explain":
            return f"""CONCEPT À EXPLIQUER :
{question}

SOURCES OFFICIELLES DISPONIBLES :
{context}

Explique ce concept en langage accessible, en citant les sources."""
        else:
            return f"""QUESTION :
{question}

SOURCES OFFICIELLES DISPONIBLES :
{context}

Réponds à cette question en te basant exclusivement sur ces sources officielles."""

    def _get_system_prompt(self, task_type: str) -> str:
        if task_type == "explain":
            return EXPLAIN_PROMPT
        elif task_type == "analyze":
            return ANALYZE_PROMPT
        return SYSTEM_PROMPT

    def _calculate_confidence(self, sources_count: int, has_context: bool) -> float:
        if not has_context or sources_count == 0:
            return 0.0
        if sources_count >= 3:
            return 0.90
        elif sources_count == 2:
            return 0.75
        return 0.60

    def _build_citations(self, sources: list) -> List[CitationSchema]:
        citations = []
        for item in sources:
            citations.append(CitationSchema(
                documentId=item.documentId,
                documentTitle=item.documentTitle,
                source=item.source,
                articleId=item.articleId,
                sectionPath=item.sectionPath,
                relevanceScore=round(item.score, 3),
                excerpt=item.content[:300] + "..." if len(item.content) > 300 else item.content,
            ))
        return citations

    async def query(
        self,
        input_data: AiQueryInputSchema,
        db: DBSession,
    ) -> AiResponseSchema:
        task_type = input_data.taskType.value if hasattr(input_data.taskType, 'value') else str(input_data.taskType)

        context_result = await rag_service.get_context(
            query=input_data.question,
            db=db,
            domain=input_data.domain,
            limit=settings.max_chunks_per_search,
        )

        has_context = len(context_result.sources) > 0

        if not has_context:
            answer = (
                "Je ne dispose pas d'informations suffisantes dans les sources officielles "
                "importées pour répondre à cette question. "
                "Veuillez vérifier que les documents réglementaires pertinents ont été importés."
            )
            model_used = "fallback"
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
            except Exception as e:
                logger.error("LLM generation error", error=str(e))
                answer = (
                    "Le moteur IA n'est pas disponible actuellement. "
                    "Voici les sources officielles trouvées :\n\n" +
                    context_result.context[:2000]
                )
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
            limit=settings.max_chunks_per_search,
        )

        has_context = len(context_result.sources) > 0

        if not has_context:
            answer = (
                "Je ne dispose pas d'informations suffisantes dans les sources officielles "
                "pour analyser cette situation. Veuillez vérifier que les documents pertinents sont importés."
            )
            model_used = "fallback"
        else:
            prompt = await self._build_prompt_with_context(
                question=input_data.question,
                context=context_result.context,
                task_type="analyze",
                situation=input_data.situation,
            )
            try:
                answer = await ollama_service.generate_response(prompt, ANALYZE_PROMPT)
                model_used = settings.ollama_llm_model
            except Exception as e:
                logger.error("LLM analysis error", error=str(e))
                answer = (
                    "Le moteur IA n'est pas disponible. Sources trouvées :\n\n" +
                    context_result.context[:2000]
                )
                model_used = "unavailable"

        citations = self._build_citations(context_result.sources)
        confidence = self._calculate_confidence(len(citations), has_context)

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

            user_msg = Message(
                session_id=session_id,
                role="user",
                content=question,
                citations=[],
            )
            db.add(user_msg)

            assistant_msg = Message(
                session_id=session_id,
                role="assistant",
                content=response.answer,
                citations=[c.model_dump() for c in response.citations],
                confidence_score=response.confidenceScore,
                model_used=response.modelUsed,
            )
            db.add(assistant_msg)
            db.commit()
        except Exception as e:
            logger.error("Failed to save conversation exchange", error=str(e))
            db.rollback()


ai_service = AIService()
