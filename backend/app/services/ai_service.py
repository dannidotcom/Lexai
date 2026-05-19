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

# Service central d'IA : construction de prompts, gestion du RAG, appel du modèle LLM,
# calcul de la confiance et sauvegarde des échanges utilisateur/assistant.

SYSTEM_PROMPT = """
Tu es LexIA, un moteur d’intelligence artificielle juridique souverain.

MISSION :
Tu réponds exclusivement à partir des documents officiels fournis dans le contexte (RAG).
Tu es un outil d’aide à l’analyse juridique, pas une source de droit autonome.

RÈGLES ABSOLUES (NON NÉGOCIABLES) :
1. UTILISATION EXCLUSIVE DU CONTEXTE :
   - Tu dois répondre uniquement à partir des documents fournis dans le contexte.
   - Toute connaissance externe est strictement interdite.

2. INTERDICTION D’INVENTION :
   - Ne jamais inventer, compléter ou déduire une information absente du contexte.
   - Ne jamais extrapoler juridiquement.

3. ABSENCE D’INFORMATION :
   - Si l’information n’est pas dans les sources :
     → répondre exactement :
     "Je ne dispose pas d'informations suffisantes dans les sources officielles importées pour répondre à cette question."

4. SOURCING OBLIGATOIRE :
   - Toute réponse doit citer précisément les sources utilisées :
     (document, article, section, paragraphe si disponible).

5. NEUTRALITÉ TOTALE :
   - Aucune opinion personnelle.
   - Aucun conseil subjectif.

6. LANGUE :
   - Répondre exclusivement en français.

STRUCTURE DE RÉPONSE OBLIGATOIRE :
1. Réponse directe et synthétique
2. Développement juridique basé sur les sources
3. Références précises utilisées (obligatoire)
"""

# Prompt dédié aux explications claires et accessibles basées sur les mêmes règles de sourcing.
EXPLAIN_PROMPT = """
Tu es LexIA, un assistant juridique souverain spécialisé dans la vulgarisation du droit.

OBJECTIF :
Expliquer clairement un concept juridique à partir des documents fournis dans le contexte.

RÈGLES STRICTES :
1. Utiliser uniquement les sources présentes dans le contexte.
2. Interdiction d’ajouter des connaissances externes.
3. Simplifier sans déformer le sens juridique.
4. Traduire les règles en langage simple et concret.
5. Toujours citer les sources utilisées.

STRUCTURE DE RÉPONSE :
1. Explication simple du concept
2. Reformulation pratique (ce que cela signifie concrètement)
3. Implications juridiques principales
4. Sources utilisées
"""

# Prompt spécifique pour l'analyse de situations juridiques, avec règles strictes et validation humaine.
ANALYZE_PROMPT = """
Tu es LexIA, un moteur d’analyse juridique souverain spécialisé en droit social et RH.

OBJECTIF :
Analyser une situation à partir des textes officiels fournis dans le contexte et identifier les implications juridiques.

RÈGLES STRICTES :
1. Analyse exclusivement basée sur les documents fournis.
2. Interdiction d’utiliser des connaissances externes.
3. Ne jamais prendre de décision juridique finale.
4. Toujours signaler les zones d’incertitude.
5. Toute décision finale doit être validée par un humain.
6. Citer précisément les sources utilisées.

STRUCTURE DE RÉPONSE :
1. Résumé de la situation
2. Analyse juridique basée sur les textes
3. Obligations applicables
4. Risques ou non-conformités éventuelles
5. Points de vigilance / zones d’incertitude
6. Conclusion : rappel de la nécessité de validation humaine
7. Sources
"""

class AIService:
    # Classe de service qui construit les prompts et pilote les appels entre le RAG,
    # le moteur LLM et la base de données d'historique des sessions.
    async def _build_prompt_with_context(
        self,
        question: str,
        context: str,
        task_type: str,
        situation: Optional[str] = None,
    ) -> str:
        if task_type == "analyze" and situation:
            # Construction du prompt pour l'analyse de situation en incluant le contexte
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
            # Choisir le prompt système le plus adapté au type de tâche.
            return EXPLAIN_PROMPT
        elif task_type == "analyze":
            return ANALYZE_PROMPT
        # Par défaut, utiliser le prompt général pour les questions juridiques.
        return SYSTEM_PROMPT

    def _calculate_confidence(self, sources_count: int, has_context: bool) -> float:
        # Score de confiance basé sur la présence et le nombre de sources retournées.
        if not has_context or sources_count == 0:
            return 0.0
        if sources_count >= 3:
            return 0.90
        elif sources_count == 2:
            return 0.75
        return 0.60

    def _build_citations(self, sources: list) -> List[CitationSchema]:
        # Transforme les résultats de contexte en citations structurées pour l'API.
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

        # Recherche contextuelle via RAG en utilisant la question de l'utilisateur.
        context_result = await rag_service.get_context(
            query=input_data.question,
            db=db,
            domain=input_data.domain,
            limit=settings.max_chunks_per_search,
        )

        has_context = len(context_result.sources) > 0

        if not has_context:
            # Si aucun contexte n'est disponible, renvoyer une réponse de secours claire.
            answer = (
                "Je ne dispose pas d'informations suffisantes dans les sources officielles "
                "importées pour répondre à cette question. "
                "Veuillez vérifier que les documents réglementaires pertinents ont été importés."
            )
            model_used = "fallback"
        else:
            # Construire le prompt utilisateur + contexte et envoyer au moteur LLM.
            prompt = await self._build_prompt_with_context(
                question=input_data.question,
                context=context_result.context,
                task_type=task_type,
            )
            system_prompt = self._get_system_prompt(task_type)
            try:
                answer = await ollama_service.generate_response(prompt, system_prompt)
                model_used = settings.ollama_llm_model
                print(f"************+*+*+*+*+*+*+*+ MODEL UTILISE *******************: {model_used}")
                # Vérifier que la réponse n'est pas vide
                if not answer or not answer.strip():
                    logger.warning("LLM returned empty response", model=settings.ollama_llm_model)
                    answer = (
                        "Le moteur IA a retourné une réponse vide. "
                        "Veuillez vérifier que les modèles Ollama sont correctement déployés. "
                        "Voici les sources trouvées :\n\n" +
                        context_result.context[:2000]
                    )
                    model_used = "mistral_empty_response"
            except Exception as e:
                logger.error("LLM generation error", error=str(e), task_type=task_type)
                answer = ("Le moteur IA n'est pas disponible actuellement. "
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
        # Pour l'analyse, concaténer la question et la situation afin d'améliorer la recherche de contexte.
        query_text = f"{input_data.question}\n{input_data.situation}"

        context_result = await rag_service.get_context(
            query=query_text,
            db=db,
            domain=input_data.domain,
            limit=settings.max_chunks_per_search,
        )

        has_context = len(context_result.sources) > 0

        if not has_context:
            # Aucun contexte trouvé pour l'analyse : réponse de secours adaptée.
            answer = (
                "Je ne dispose pas d'informations suffisantes dans les sources officielles "
                "pour analyser cette situation. Veuillez vérifier que les documents pertinents sont importés."
            )
            model_used = "fallback"
        else:
            # Préparer le prompt d'analyse complet et interroger le modèle avec le prompt dédié.
            prompt = await self._build_prompt_with_context(
                question=input_data.question,
                context=context_result.context,
                task_type="analyze",
                situation=input_data.situation,
            )
            try:
                answer = await ollama_service.generate_response(prompt, ANALYZE_PROMPT)
                model_used = settings.ollama_llm_model
                
                # Vérifier que la réponse n'est pas vide
                if not answer or not answer.strip():
                    logger.warning("LLM returned empty response for analysis", model=settings.ollama_llm_model)
                    answer = (
                        "Le moteur IA a retourné une réponse vide. "
                        "Veuillez vérifier que les modèles Ollama sont correctement déployés. "
                        "Voici les sources trouvées :\n\n" +
                        context_result.context[:2000]
                    )
                    model_used = "mistral_empty_response"
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
        # Enregistre la conversation utilisateur / assistant dans la base de données.
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
