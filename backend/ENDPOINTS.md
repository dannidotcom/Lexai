# Documentation des endpoints API

Ce document décrit les endpoints HTTP exposés par l'API FastAPI du backend LexIA, leur méthode, paramètres principaux, et l'action effectuée.

---

## Health

- **GET /healthz**
  - Description : Vérifie l'état de l'application (base de données, version, état du vector store).
  - Params : aucun
  - Réponse : `HealthStatusSchema` ({ status, version, database, vectorStore })
  - Effet : lecture seule, utile pour monitoring et healthchecks.

- **GET /ollama/status**
  - Description : Vérifie la disponibilité d'Ollama et retourne les modèles disponibles et la configuration d'embed/LLM.
  - Params : aucun
  - Réponse : `OllamaStatusSchema` ({ available, models, embeddingModel, llmModel, error })
  - Effet : lecture seule.

---

## Documents (`/api/documents`)

- **GET /api/documents**
  - Description : Liste les documents ingérés.
  - Query params : `domain` (optionnel), `status` (optionnel), `limit`, `offset`.
  - Réponse : `List[DocumentSchema]`
  - Effet : lecture seule.

- **POST /api/documents**
  - Description : Ingestion d'un document via JSON (champ `content` contenant le texte). Lance le pipeline : chunking → embeddings → indexation Qdrant.
  - Body : `DocumentInputSchema` (title, source, domain, documentType, content, metadata...)
  - Réponse : `DocumentSchema` (métadonnées du document ingéré)
  - Effet : crée en base un `Document`, crée les `Chunks`, génère embeddings via Ollama, upsert dans Qdrant.

- **POST /api/documents/ingest/legifrance**
  - Description : Endpoint spécialisé pour ingérer un JSON KALI (Légifrance). Parse la structure KALI et ingère par lots.
  - Body : `LegifranceIngestInputSchema` (kaliJson, batchBy)
  - Réponse : `LegifranceIngestResultSchema` (résumé de l'import : nombre de documents créés, total articles...)
  - Effet : parsing KALI → plusieurs appels internes d'ingestion de documents.

- **GET /api/documents/{id}**
  - Description : Récupère les métadonnées d'un document par son `id`.
  - Params : `id` (path)
  - Réponse : `DocumentSchema`
  - Effet : lecture seule.

- **DELETE /api/documents/{id}**
  - Description : Supprime un document et tous ses chunks. Supprime également les vecteurs correspondants dans Qdrant.
  - Params : `id` (path)
  - Réponse : HTTP 204 (no content) en cas de succès
  - Effet : suppression cascade en base + suppression des points dans Qdrant.

- **GET /api/documents/{id}/chunks**
  - Description : Récupère la liste des chunks (fragments) d'un document.
  - Params : `id` (path)
  - Réponse : `List[ChunkSchema]`
  - Effet : lecture seule.

- **POST /api/documents/upload-pdf**
  - Description : Upload d'un fichier PDF via multipart/form-data et ingestion automatique.
  - Form fields : `title`, `source`, `domain`, `documentType` (optionnel), `file` (PDF)
  - Réponse : `DocumentSchema` pour le document ingéré
  - Effet : extraction texte du PDF (pypdf) → appel à `ingest_document` (chunking → embeddings → indexation).

---

## RAG (`/api/rag`)

- **POST /api/rag/search**
  - Description : Recherche hybride (vectorielle + BM25) pour retourner les chunks les plus pertinents pour une requête.
  - Body : `SearchInputSchema` (query, domain, subDomain, limit, searchType)
  - Réponse : `SearchResultSchema` (items, totalFound, query, searchType)
  - Effet : calcule embedding de la requête, interroge Qdrant (et BM25), fusionne/rank les résultats.

- **POST /api/rag/context**
  - Description : Renvoie un contexte compilé (passages) utile pour la génération IA pour une requête donnée.
  - Body : `SearchInputSchema` (query, domain, limit...)
  - Réponse : `ContextResultSchema` (context, sources, query)
  - Effet : lecture/compilation de passages référents.

---

## AI (`/api/ai`)

- **POST /api/ai/query**
  - Description : Pose une question à LexIA. Construit le prompt avec le contexte RAG, appelle le LLM via Ollama et renvoie une réponse structurée avec citations et score de confiance.
  - Body : `AiQueryInputSchema` (question, domain, subDomain, sessionId, taskType)
  - Réponse : `AiResponseSchema` (answer, citations, confidenceScore, domain, taskType, generatedAt, ...)
  - Effet : lecture dans Qdrant, appel LLM, enregistrement optionnel du message dans la base.

- **POST /api/ai/explain**
  - Description : Mêmes étapes que `/ai/query` mais force `taskType=EXPLAIN` (vulgarisation du concept en langage simple).
  - Body : `AiQueryInputSchema` (question...)
  - Réponse : `AiResponseSchema`
  - Effet : même pipeline, prompts adaptés.

- **POST /api/ai/analyze**
  - Description : Analyse une situation (`situation` + `question`) en appliquant les règles d'analyse (RH/sociale). Force un prompt d'analyse.
  - Body : `AiAnalyzeInputSchema` (question, situation, domain...)
  - Réponse : `AiResponseSchema`
  - Effet : pipeline RAG + LLM, réponse structurée avec identification des risques et citations.

- **GET /api/ai/sessions**
  - Description : Liste les sessions d'utilisation (métadonnées)
  - Réponse : `List[SessionSchema]`
  - Effet : lecture seule.

- **POST /api/ai/sessions**
  - Description : Crée une nouvelle session (title, domain)
  - Body : `SessionInputSchema`
  - Réponse : `SessionSchema`
  - Effet : crée une ligne `Session` en base.

- **GET /api/ai/sessions/{sessionId}/messages**
  - Description : Récupère l'historique des messages d'une session donnée (avec citations si présentes).
  - Params : `sessionId` (path)
  - Réponse : `List[MessageSchema]`
  - Effet : lecture seule.

---

## PHP AI Adapter (`/adapter/ai`)

- **POST /adapter/ai/query**
  - Description : Point d'entree unique pour les appels PHP de question/reponse metier. Normalise la requete PHP, applique un timeout, transmet au moteur IA/RAG et renvoie une reponse standardisee.
  - Body : `domaine`, `sous_domaine`, `question`, `contexte_metier`, `type_tache`, `limite_sources`, `session_id`, `async_request`.
  - Reponse : `{ request_id, status, progression, success, response, error, created_at, completed_at }`.
  - Effet : appelle le pipeline IA existant derriere `/api/ai/query`; aucun module PHP ne doit appeler directement `/api/ai/*`.

- **POST /adapter/ai/analyze**
  - Description : Point d'entree unique pour les analyses PHP de document ou texte. Normalise le payload, transmet au moteur IA/RAG d'analyse et renvoie une analyse structuree.
  - Body : `domaine`, `sous_domaine`, `question`, `document` ou `texte`, `contexte_metier`, `limite_sources`, `session_id`, `async_request`.
  - Reponse : `{ request_id, status, progression, success, response, error, created_at, completed_at }`.
  - Effet : appelle le pipeline IA existant derriere `/api/ai/analyze`.

- **GET /adapter/ai/status/{request_id}**
  - Description : Suivi d'une requete PHP synchrone ou asynchrone creee par l'adapter.
  - Params : `request_id` (path)
  - Reponse : statut (`pending`, `running`, `completed`, `failed`, `timeout`), progression, reponse complete si disponible.
  - Effet : lecture du registre de suivi en memoire du backend.

---

## Stats (`/api/stats`)

- **GET /api/stats/dashboard**
  - Description : Retourne statistiques générales (nombre documents, chunks, embeddings, sessions, requêtes, statut Ollama, activité récente...)
  - Réponse : `DashboardStatsSchema`
  - Effet : lecture/agrégation en base et appel à Ollama status.

- **GET /api/stats/domains**
  - Description : Retourne statistiques par domaine (nombre de documents, chunks, sources)
  - Réponse : `List[DomainStatSchema]`
  - Effet : lecture/agrégation en base.

---

## Notes générales

- Tous les endpoints `POST` qui ingèrent des documents déclenchent le pipeline : parsing/chunking (`chunk_service`), génération d'embeddings (`ollama_service`), et upsert dans Qdrant (`vector_store`). Le modèle exact utilisé dépend de la configuration (`OLLAMA_EMBEDDING_MODEL`).
- Les réponses JSON suivent les schémas Pydantic définis dans `app/models/schemas.py`.
- Pour l'upload PDF (`/api/documents/upload-pdf`), l'API attend `multipart/form-data` avec `file` ayant `content-type: application/pdf`.
- Si vous souhaitez rendre l'ingestion non bloquante, envisager l'utilisation d'une file de tâches (Redis + RQ/Celery, ou RabbitMQ) et d'un worker séparé.

---

Fichier généré automatiquement par l'outil d'assistance — vérifier et ajuster si d'autres endpoints ont été ajoutés ou modifiés.
