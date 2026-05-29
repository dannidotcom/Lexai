# LexIA Backend

Backend FastAPI pour LexIA.

Le projet couvre:
- authentification securisee (JWT + refresh token opaque + sessions)
- ingestion documentaire juridique (JSON, PDF, Legifrance KALI)
- recherche RAG hybride (Qdrant + BM25)
- generation IA (query, explain, analyze, streaming)
- administration des prompts IA et adaptation pour integration PHP

## Stack

- Python 3.12
- FastAPI + Pydantic v2
- SQLAlchemy (sync pour RAG/AI, async pour auth)
- PostgreSQL
- Alembic (schema auth)
- Ollama (LLM + embeddings)
- Qdrant (vector store)
- rank-bm25 (recherche lexicale)
- Docker Compose + Nginx

## Architecture (resume)

- `app/ai_api_engine/`: creation app, middleware, router registry
- `app/modules/auth_engine/`: auth, sessions, RBAC, audit logs
- `app/modules/rag_vecor_engine/`: ingestion, chunking, PDF, Legifrance, indexation Qdrant
- `app/modules/rag_search_engine/`: recherche vectorielle, BM25, contexte RAG
- `app/modules/ai_generation_engine/`: generation IA, streaming SSE, prompts versionnes
- `app/modules/php_ai_adpater/`: endpoint unique pour modules PHP

## Demarrage rapide (Docker recommande)

Depuis `backend/`:

```bash
cp .env.example .env
docker compose up -d --build
docker exec -it lexia-backend python -m app.scripts.seed_prompt_data
```

Verifications:

```bash
curl http://localhost:8080/api/healthz
curl http://localhost:8080/api/ollama/status
```

URLs utiles:
- Frontend (via Nginx): `http://localhost`
- API via Nginx: `http://localhost/api/...`
- API directe backend: `http://localhost:8080/api/...`
- Swagger (direct backend): `http://localhost:8080/docs`
- PgAdmin: `http://localhost:5050/pgadmin`
- Qdrant dashboard: `http://localhost:6333/dashboard`

## Demarrage local (sans conteneur backend)

```bash
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
docker compose up -d postgres ollama qdrant
python -m app.scripts.seed_prompt_data
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

Important: pour ce mode, adaptez `DATABASE_URL` dans `.env` (ex: host `localhost` au lieu de `postgres`).

## Initialisation IA obligatoire

Les endpoints IA (`/api/ai/*` et `/api/adapter/ai/*`) s'appuient sur des prompts actifs en base.
Sur une base vide, lancez au moins une fois:

```bash
python -m app.scripts.seed_prompt_data
```

## Variables d'environnement principales

Copiez `.env.example` vers `.env` puis adaptez:

- `DATABASE_URL`: connexion PostgreSQL
- `SECRET_KEY`, `ALGORITHM`: signature JWT
- `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`
- `RESET_PASSWORD_TOKEN_EXPIRE_MINUTES`, `VERIFY_EMAIL_TOKEN_EXPIRE_MINUTES`
- `COOKIE_SECURE`, `COOKIE_DOMAIN`
- `FRONTEND_URL`, `CORS_ORIGINS`
- `BRUTE_FORCE_MAX_ATTEMPTS`, `BRUTE_FORCE_WINDOW_MINUTES`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- `OLLAMA_BASE_URL`, `OLLAMA_LLM_MODEL`, `OLLAMA_EMBEDDING_MODEL`
- `QDRANT_HOST`, `QDRANT_PORT`, `QDRANT_COLLECTION`
- `CHUNK_SIZE`, `CHUNK_OVERLAP`, `MAX_CHUNKS_PER_SEARCH`, `AI_TIMEOUT_SECONDS`

## Endpoints API (prefixe `/api`)

### Health / monitoring
- `GET /healthz`
- `GET /ollama/status`
- `GET /stats/dashboard`
- `GET /stats/domains`

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/verify-email`
- `GET /auth/me`
- `GET /auth/sessions`
- `DELETE /auth/sessions/{session_id}`

### Admin utilisateurs (role ADMIN)
- `GET /admin/users`
- `POST /admin/users`
- `PATCH /admin/users/{id}`
- `DELETE /admin/users/{id}`

### Admin prompts IA (role ADMIN)
- `GET|POST /ai/prompts/bases`
- `GET|PATCH|DELETE /ai/prompts/bases/{prompt_base_id}`
- `GET|POST /ai/prompts/templates`
- `GET|PATCH|DELETE /ai/prompts/templates/{template_id}`
- `GET|POST /ai/prompts/versions`
- `GET|PATCH|DELETE /ai/prompts/versions/{prompt_version_id}`

### Documents / ingestion
- `GET /documents`
- `POST /documents`
- `POST /documents/ingest/legifrance`
- `POST /documents/upload-pdf`
- `GET /documents/{id}`
- `GET /documents/{id}/chunks`
- `DELETE /documents/{id}`

### RAG
- `POST /rag/search`
- `POST /rag/context`

### AI
- `POST /ai/query`
- `POST /ai/query/stream`
- `POST /ai/explain`
- `POST /ai/explain/stream`
- `POST /ai/analyze`
- `POST /ai/analyze/stream`
- `GET /ai/sessions`
- `POST /ai/sessions`
- `GET /ai/sessions/{sessionId}/messages`

### Adapter PHP
- `POST /adapter/ai/query`
- `POST /adapter/ai/analyze`
- `GET /adapter/ai/status/{request_id}`

## Auth et securite

- Password policy forte (min 12 chars, maj/min/chiffre/special)
- Access token JWT + refresh token opaque avec rotation
- Revocation de session et blacklisting access token
- Audit logs auth et endpoints sensibles
- Middleware anti brute-force sur login/forgot-password
- Security headers et CORS configurables

## Tests

Local:

```bash
pytest
```

Dans Docker:

```bash
docker exec -it lexia-backend pytest tests/ -v
```

CI GitHub Actions:
- backend: installation deps, `alembic upgrade head`, `pytest`
- frontend: `npm ci`, `npm run typecheck`, `npm run build`

## Scripts utiles

- Seed prompts IA: `python -m app.scripts.seed_prompt_data`
- Ingestion PDF locale (`app/sources/**/*.pdf`): `python -m app.scripts.ingest_sources`

## Notes pratiques

- Le service email est no-op si `SMTP_HOST` est vide (warning log uniquement).
- Le suivi de statut dans l'adapter PHP est stocke en memoire (non persistant apres restart).
- Pour la production: HTTPS, `COOKIE_SECURE=true`, `SECRET_KEY` robuste, CORS strict, supervision externe.

## Ressources complementaires

- `ENDPOINTS.md`: detail des endpoints
- `QUICKSTART.md`: guide de demarrage rapide
- `explain.md`: architecture et pipelines detailles
- `postman_collection.json`: collection API
