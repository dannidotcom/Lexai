# 📚 Explication détaillée de l'architecture LexIA

## Table des matières
1. [Concepts fondamentaux](#concepts-fondamentaux)
2. [Architecture globale](#architecture-globale)
3. [Flux de données](#flux-de-données)
4. [Composants détaillés](#composants-détaillés)
5. [Pipeline RAG](#pipeline-rag)
6. [Modèles IA](#modèles-ia)
7. [Base de données](#base-de-données)
8. [Gestion des erreurs](#gestion-des-erreurs)
9. [Performance et scalabilité](#performance-et-scalabilité)
10. [Guides pratiques](#guides-pratiques)

---

## Concepts fondamentaux

### 🎯 Qu'est-ce que le RAG ?

**RAG = Retrieval-Augmented Generation**

Sans RAG, un LLM répond uniquement à partir de son entraînement :
```
Question → LLM → Réponse (basée sur l'entraînement)
```

Avec RAG, on améliore la réponse en apportant du contexte pertinent :
```
Question → [Recherche documents] → LLM + Contexte → Réponse précise
```

**Avantages pour LexIA** :
- ✅ Réponses basées sur des sources officielles
- ✅ Citations précises des articles/sections
- ✅ Pas d'hallucinations (inventions du LLM)
- ✅ Mise à jour facile des sources (pas de réentraînement)

### 🔍 Recherche hybride

LexIA combine deux approches :

| Type | Méthode | Force | Faiblesse |
|------|---------|-------|----------|
| **BM25** | Lexicale (mots-clés) | Exact, rapide | Rigide, pas de synonymes |
| **Vectoriel** | Sémantique (embeddings) | Comprend le sens, flexible | Plus lent, moins exact |
| **Hybride** | Combinaison | Meilleur des deux mondes | Plus complexe |

**Exemple** :
- Requête : "congés annuels"
- BM25 : trouve textes avec "congés" ET "annuels"
- Vectoriel : trouve aussi "leave", "vacation" (sens similaire)
- Hybride : combine les deux

### 🧠 Embeddings

Un **embedding** = représentation vectorielle d'un texte dans un espace numérique

```
Texte: "Article 1: Les congés payés sont obligatoires"
     ↓
Embedding: [0.12, -0.45, 0.78, ..., 0.21]  (384 dimensions avec nomic-embed-text)
```

**Utilité** :
- Calculer la similarité entre textes
- Trouver les documents "proches" sémantiquement
- Réduire la dimensionnalité pour la recherche rapide

---

## Architecture globale

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                         │
│                   (chat, documents, search)                  │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/WebSocket
┌────────────────────────┴────────────────────────────────────┐
│                    FASTAPI Backend                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Routers (Endpoints HTTP)                  │   │
│  │  ├─ health.py        (healthcheck)                  │   │
│  │  ├─ documents.py     (CRUD documents)               │   │
│  │  ├─ rag.py           (recherche + contexte)         │   │
│  │  ├─ ai.py            (query/explain/analyze)        │   │
│  │  └─ stats.py         (métriques)                    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Services (Business Logic)                 │   │
│  │  ├─ rag_service        (recherche hybride)          │   │
│  │  ├─ ai_service         (génération réponses)        │   │
│  │  ├─ document_service   (ingestion + parsing)        │   │
│  │  ├─ chunk_service      (découpage + chunking)       │   │
│  │  ├─ vector_store       (gestion embeddings)         │   │
│  │  ├─ ollama_service     (communication Ollama)       │   │
│  │  └─ legifrance_parser  (parsing documents)          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Core (Config, DB, Logging)                   │   │
│  │  ├─ config.py      (settings, env vars)             │   │
│  │  ├─ database.py    (connexion PostgreSQL)           │   │
│  │  └─ logging.py     (structlog configuration)        │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
    ┌─────────┐         ┌──────────┐        ┌──────────┐
    │PostgreSQL         │ Qdrant    │       │ Ollama   │
    │ (Metadata)        │(Embeddings)       │  (LLM)   │
    └─────────┘         └──────────┘        └──────────┘
```

### Pile technologique

```yaml
Frontend:
  - React 18 + TypeScript
  - Vite (build tool)
  - Shadcn UI (composants)

Backend:
  - FastAPI (framework web)
  - Uvicorn (serveur ASGI)
  - SQLAlchemy (ORM)
  - Pydantic (validation)

IA & Search:
  - Ollama (LLM local)
  - langchain (orchestration RAG)
  - Qdrant (vector DB)
  - rank-bm25 (BM25 search)

Infrastructure:
  - PostgreSQL (données)
  - Docker + Docker Compose
```

---

## Flux de données

### 1️⃣ Flux d'ingestion de documents

```
Document (PDF/Texte)
    ↓
[1] Parser (legifrance_parser.py)
    └─→ Extraction titre, articles, sections
    └─→ Extraction métadonnées (date, version, etc.)
    ↓
[2] Chunking (chunk_service.py)
    └─→ Découpage en fragments intelligents (~1000 chars)
    └─→ Preservation du contexte (overlap 200 chars)
    ↓
[3] Embeddings (ollama_service.py)
    └─→ Génération via Ollama + nomic-embed-text
    ↓
[4] Stockage double
    ├─→ PostgreSQL: métadonnées (title, source, domain)
    ├─→ Qdrant: chunks + embeddings
    ↓
✅ Document indexé et searchable
```

**Exemple concret** :

```
Document: "Code du travail - Article 1: Les congés payés..."

Chunks créés:
  1. "Code du travail - Article 1: Les congés payés sont une obligation..."
  2. "...l'employeur doit..." 
  3. "...la durée minimale est..." 

Embeddings:
  Chunk 1 → [0.12, -0.45, 0.78, ...]  (384 dimensions)
  Chunk 2 → [0.34, 0.21, -0.15, ...]
  Chunk 3 → [-0.08, 0.67, 0.34, ...]

Storage:
  PostgreSQL: id=doc-001, title="Code du travail", domain="droit_du_travail"
  Qdrant: collection="lexia_chunks" avec chunks + embeddings
```

### 2️⃣ Flux de recherche RAG

```
Utilisateur: "Quels sont les droits aux congés ?"
    ↓
[1] Convertir en embedding
    └─→ Ollama génère embedding de la requête
    ↓
[2] Recherche hybride (rag_service.py)
    ├─→ BM25: "congés" + "droits" → [doc1, doc5, doc9]
    ├─→ Vectoriel: similarité sémantique → [doc1, doc3, doc7]
    └─→ Fusion + ranking → Top 5 résultats
    ↓
[3] Récupération du contexte
    └─→ Extraction des passages pertinents
    └─→ Compilation du contexte
    ↓
✅ Contexte prêt pour l'IA
```

### 3️⃣ Flux d'une requête IA (Query)

```
Utilisateur + Contexte RAG
    ↓
[1] Construction du prompt (ai_service.py)
    └─→ System prompt (règles absolues de LexIA)
    └─→ Contexte (documents pertinents)
    └─→ Question utilisateur
    ↓
[2] Appel à Ollama
    └─→ LLM génère réponse token par token
    └─→ Timeout: 120 secondes
    ↓
[3] Post-traitement
    └─→ Extraction des citations
    └─→ Calcul du score de confiance
    ├─→ 3+ sources → 0.90
    ├─→ 1-2 sources → 0.60
    └─→ Aucune source → 0.00
    ↓
[4] Réponse structurée
    ├─→ Réponse générale
    ├─→ Détails réglementaires
    ├─→ Citations précises
    └─→ Score de confiance
    ↓
✅ Réponse au frontend
```

**Exemple avec un vrai prompt** :

```
SYSTEM PROMPT (règles du LLM):
"Tu es LexIA, un moteur IA juridique souverain.
Tu réponds UNIQUEMENT à partir des documents fournis.
Tu cites TOUJOURS les sources.
Tu répondras en français."

USER PROMPT:
"QUESTION: Quel est le délai de préavis pour un licenciement ?

SOURCES OFFICIELLES DISPONIBLES:
Article L1231-1 du Code du Travail:
'Le salarié doit respecter un délai de préavis...'

Article L1232-1:
'Pour un licenciement, le délai de préavis est de:
- 15 jours pour les ouvriers/employés
- 1 mois pour les agents de maîtrise/cadres'"

LLM RESPONSE:
"Le délai de préavis varie selon la catégorie professionnelle:

1. Ouvriers et employés: 15 jours
   (Source: Article L1232-1 Code du Travail)

2. Agents de maîtrise et cadres: 1 mois
   (Source: Article L1232-1 Code du Travail)

Ce délai commence à courir à partir de la notification du licenciement."
```

---

## Composants détaillés

### 📦 Core Module

#### `config.py`
```python
# Gère toutes les configurations centralisées
- app_name, version, debug
- URLs des services externes (Ollama, Qdrant, PostgreSQL)
- Paramètres RAG (chunk_size, max_chunks_per_search)
- Paramètres IA (timeout, modèles)
- Chargé depuis .env
```

#### `database.py`
```python
# Gestion de la connexion PostgreSQL
- create_engine() → connexion SQLAlchemy
- SessionLocal → session pour les requêtes
- get_db() → dépendance FastAPI
- init_db() → initialisation tables au démarrage
```

#### `logging.py`
```python
# Logs structurés avec structlog
- Format JSON pour parsage facile
- Niveaux: DEBUG, INFO, WARNING, ERROR
- Contexte automatique (timestamps, modules)
```

### 🔄 Services Module

#### `rag_service.py` - Cœur du RAG
```python
class RAGService:
    async def search()           # Recherche hybride
    async def get_context()      # Récupère contexte pertinent
    async def rank_results()     # Classe les résultats
    
# Pipeline:
# 1. BM25 search
# 2. Vector search
# 3. Fusion des résultats
# 4. Ranking par score
# 5. Récupération des top N
```

**Exemple de recherche hybride** :

```python
# Requête: "congés payés obligatoires"

# BM25 score = (3 matches * 0.8) = 2.4
# "congés" + "payés" + "obligatoires" tous présents

# Vector similarity = 0.87 (cosine distance)
# Texte similaire sémantiquement

# Hybrid score = 0.7 * (BM25 + 1) + 0.3 * vector_sim
#              = 0.7 * 3.4 + 0.3 * 0.87
#              = 2.64
```

#### `ai_service.py` - Génération IA
```python
class AIService:
    async def query()       # Répondre à une question
    async def explain()     # Expliquer un concept
    async def analyze()     # Analyser une situation
    
# Chaque méthode:
# 1. Récupère le contexte RAG
# 2. Construit un prompt formaté
# 3. Appelle Ollama
# 4. Post-traite la réponse
# 5. Calcule le score de confiance
```

#### `document_service.py` - Gestion documents
```python
class DocumentService:
    async def ingest()          # Ingère un document
    async def get_document()    # Récupère métadonnées
    async def list_documents()  # Liste tous docs
    async def delete_document() # Supprime un doc
    
# Cycle de vie:
# PENDING → parsing, extraction
# INDEXING → chunking, embeddings
# INDEXED → searchable
# ERROR → si problème lors de l'indexation
```

#### `chunk_service.py` - Découpage intelligent
```python
class ChunkService:
    def chunk_text()        # Découpe avec overlap
    def preserve_context()  # Garde contexte du chunk
    def get_section_path()  # Trace le chemin (Articles→Sections)
    
# Paramètres:
# - chunk_size = 1000 chars (ex: 200 tokens)
# - chunk_overlap = 200 chars (contexte)
# - Préserve les limites de section
```

**Exemple de chunking** :

```
Document: "Article 1: Principes généraux... Article 2: Calcul des droits..."

Chunk 1 (1000 chars):
"Article 1: Principes généraux...
[contenu]...l'employeur..."

Chunk 2 (1000 chars, avec overlap):
"...l'employeur doit respecter...
[contenu du chunk 1 fin + contenu nouveau]
...Article 2: Calcul..."
```

#### `vector_store.py` - Gestion Qdrant
```python
class VectorStore:
    async def add_embeddings()      # Ajoute chunks à Qdrant
    async def search()              # Recherche vectorielle
    async def ensure_collection()   # Crée collection si besoin
    async def delete_by_document()  # Nettoie lors suppression
    
# Collection Qdrant:
# - Nom: "lexia_chunks"
# - Dimension: 384 (nomic-embed-text)
# - Payload: chunk_id, document_id, content, sectionPath
```

#### `ollama_service.py` - Intégration Ollama
```python
class OllamaService:
    async def generate_embedding()  # Crée embedding
    async def generate_text()       # Génère réponse LLM
    async def health()              # Vérifie Ollama UP
    
# Modèles utilisés:
# - LLM: "mistral" (default)
# - Embeddings: "nomic-embed-text" (default)
```

#### `legifrance_parser.py` - Parsing légifrance
```python
class LegifranParser:
    def parse_document()    # Extrait structure
    def extract_articles()  # Identifie articles
    def extract_metadata()  # Version, date, etc.
```

### 🛣️ Routers Module (Endpoints)

#### `health.py`
```
GET /api/health
└─→ { "status": "healthy", "version": "1.0.0" }
```

#### `documents.py`
```
POST   /api/documents/ingest     → ingère un document
GET    /api/documents/list       → liste les documents
GET    /api/documents/{id}       → détails d'un document
DELETE /api/documents/{id}       → supprime un document
GET    /api/documents/stats      → stats d'ingestion
```

#### `rag.py`
```
POST /api/rag/search         → recherche hybride
POST /api/rag/context        → récupère contexte
```

#### `ai.py`
```
POST /api/ai/query           → répondre à une question
POST /api/ai/explain         → expliquer un concept
POST /api/ai/analyze         → analyser une situation
GET  /api/ai/sessions        → historique sessions
```

#### `stats.py`
```
GET /api/stats/overview      → Vue d'ensemble
GET /api/stats/documents     → Stats documents
GET /api/stats/searches      → Stats recherches
GET /api/stats/ai-queries    → Stats requêtes IA
```

### 📊 Models Module

#### `schemas.py` - Pydantic Models (validation input/output)
```python
# Documents
DocumentSchema          # Output: métadonnées document
DocumentInputSchema     # Input: créer/ingérer document

# Recherche
SearchInputSchema       # Input: requête recherche
SearchResultSchema      # Output: résultats

# IA
AiQueryInputSchema      # Input: question
AiResponseSchema        # Output: réponse avec citations

# Enums
DocumentStatus          # PENDING, INDEXING, INDEXED, ERROR
DocumentType            # CODE, CONVENTION, TEXTE, etc.
SearchType              # VECTOR, HYBRID, BM25
TaskType                # QUERY, EXPLAIN, ANALYZE
```

#### `db_models.py` - SQLAlchemy Models (BD)
```python
class Document          # Table documents
class Chunk             # Table chunks (métadonnées)
class Message           # Table messages (historique)
class Session           # Table sessions (utilisateurs)
```

---

## Pipeline RAG

### Étape 1: Indexation (lors de l'ingestion)

```
┌─────────────────────────────────────────────┐
│  Document brut (PDF/texte)                  │
└────────────────┬────────────────────────────┘
                 │
         ┌───────▼────────┐
         │  1. Parser     │
         │ (legifrance)   │
         └───────┬────────┘
                 │
         ┌───────▼────────┐
         │ 2. Chunking    │  1000 chars
         │ (segments)     │  overlap 200
         └───────┬────────┘
                 │
    ┌────────────▼────────────┐
    │  Chunks enrichis        │
    │ - content               │
    │ - sectionPath (A1.S2)   │
    │ - chunkIndex (0, 1, 2) │
    └────────────┬────────────┘
                 │
         ┌───────▼────────────┐
         │ 3. Embeddings      │
         │ (Ollama)           │
         └───────┬────────────┘
                 │
    ┌────────────▼─────────────┐
    │  Storage double          │
    │                          │
    │  PostgreSQL:             │
    │  - Document metadata     │
    │  - Chunk references      │
    │                          │
    │  Qdrant:                 │
    │  - Chunks + embeddings   │
    │  - Payloads              │
    └────────────┬─────────────┘
                 │
            ✅ INDEXED
```

### Étape 2: Recherche et récupération de contexte

```
┌──────────────────────────┐
│ Requête utilisateur      │
│ "Congés payés obligatoires?" 
└──────────────┬───────────┘
               │
       ┌───────▼────────┐
       │ Embedding      │
       │ (Ollama)       │
       └───────┬────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼──────┐      ┌───────▼──────┐
│ BM25     │      │ Vectorial    │
│ Search   │      │ Search       │
│ (lexical)│      │ (semantic)   │
└───┬──────┘      └───────┬──────┘
    │                     │
    │  Results:           │  Results:
    │  - doc5 (0.92)      │  - doc1 (0.89)
    │  - doc2 (0.88)      │  - doc3 (0.85)
    │  - doc7 (0.76)      │  - doc5 (0.82)
    │
    └──────────┬──────────┘
               │
        ┌──────▼────────┐
        │ Fusion +      │
        │ Ranking       │
        │ (hybrid score)│
        └──────┬────────┘
               │
    ┌──────────▼──────────┐
    │ Top 5 Chunks       │
    │ 1. doc5 (0.85)     │
    │ 2. doc1 (0.80)     │
    │ 3. doc2 (0.78)     │
    │ 4. doc3 (0.76)     │
    │ 5. doc7 (0.74)     │
    └──────────┬──────────┘
               │
        ┌──────▼────────────────────┐
        │ Construction du contexte  │
        │ [Article 1: ...]          │
        │ [Article 2: ...]          │
        │ [Section: ...]            │
        └──────┬───────────────────┘
               │
              ✅ Context prêt pour l'IA
```

### Étape 3: Génération de réponse

```
┌────────────────────────────┐
│ Contexte + Question        │
└────────────┬───────────────┘
             │
    ┌────────▼────────┐
    │ Construction    │
    │ prompt complet  │
    └────────┬────────┘
             │
    ┌────────▼───────────────────────┐
    │ Ollama LLM                      │
    │ (Mistral par défaut)            │
    │                                 │
    │ System: "Tu es LexIA..."        │
    │ Context: "[Article 1...]        │
    │ Question: "Congés obligatoires?"│
    └────────┬───────────────────────┘
             │
    ┌────────▼──────────────────────┐
    │ Génération token par token     │
    │ (streaming possible)           │
    │ Max 120 secondes (timeout)     │
    └────────┬──────────────────────┘
             │
    ┌────────▼─────────────────┐
    │ Post-traitement          │
    │ - Extraction citations   │
    │ - Calcul confiance       │
    │ - Validation format      │
    └────────┬─────────────────┘
             │
    ┌────────▼──────────────────────┐
    │ Réponse structurée            │
    │ {                             │
    │   "answer": "Oui, obligatoire…"
    │   "citations": [              │
    │     "Article L1231-1"         │
    │   ],                          │
    │   "confidence": 0.95,         │
    │   "sources": 3                │
    │ }                             │
    └────────┬──────────────────────┘
             │
            ✅ Response au frontend
```

---

## Modèles IA

### LLM (Générateur de texte)

#### Mistral (recommandé)
```
Caractéristiques:
- Taille: 7B parameters
- Latence: ~2-5s par requête
- Qualité: Très bonne (expert)
- Français: ✅ Support excellent
- Coût compute: 🟢 Moyen

Meilleur pour: Production
Pull command: ollama pull mistral
```

#### Llama 2
```
Caractéristiques:
- Taille: 7B, 13B, 70B parameters
- Latence: 2-10s (dépend de la taille)
- Qualité: Très bonne
- Français: ✅ Correct
- Coût compute: 🟠 Élevé (sauf 7B)

Meilleur pour: Qualité maximum
Pull command: ollama pull llama2
```

### Embeddings

#### nomic-embed-text (recommandé)
```
Caractéristiques:
- Dimension: 384 (petit, rapide)
- Qualité: Excellente pour le français
- Latence: ~50-100ms
- Taille modèle: ~300 MB
- Spécialisé: Texte juridique

Meilleur pour: Production
Pull command: ollama pull nomic-embed-text
```

#### all-MiniLM-L6-v2
```
Caractéristiques:
- Dimension: 384
- Qualité: Bonne (généraliste)
- Latence: ~30-60ms
- Taille modèle: ~80 MB
- Spécialisé: Texte général

Meilleur pour: Développement
Pull command: ollama pull all-minilm
```

### Prompts systématiques

#### SYSTEM_PROMPT (Query)
```
Tu es LexIA, un moteur IA juridique souverain.

RÈGLES ABSOLUES:
1. Tu réponds UNIQUEMENT à partir des documents fournis
2. Ne jamais inventer, extrapoler ou utiliser connaissances externes
3. Si contexte insuffisant: "Je ne dispose pas d'informations…"
4. Citations TOUJOURS (article, section, document)
5. Précis, factuel, pas d'opinion personnelle
6. Français obligatoire

Contexte:
[Documents pertinents fournis ici]

Question utilisateur:
[La question]

Générée une réponse:
```

#### EXPLAIN_PROMPT
```
Tu es LexIA, expert en vulgarisation juridique.

RÈGLES:
1. Explique UNIQUEMENT à partir du contexte fourni
2. Langage clair et accessible
3. Pas d'inventions
4. Reformule pratiquement
5. Cite les sources
6. Français
```

#### ANALYZE_PROMPT
```
Tu es LexIA, expert en analyse RH/sociale.

RÈGLES:
1. Analyse UNIQUEMENT sur base des textes officiels
2. Compare situation aux règles réglementaires
3. Identifie risques et obligations
4. Ne prends JAMAIS de décision autonome
5. Signale les points de vigilance
6. Valeur humaine requise pour la décision finale
7. Citations précises
8. Français
```

---

## Base de données

### Schéma PostgreSQL

```sql
-- Documents ingérés
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    title VARCHAR NOT NULL,
    source VARCHAR,
    domain VARCHAR,
    subdomain VARCHAR,
    document_type VARCHAR,
    status VARCHAR,  -- PENDING, INDEXING, INDEXED, ERROR
    chunk_count INT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    url VARCHAR,
    version VARCHAR
);

-- Fragments de documents (métadonnées)
CREATE TABLE chunks (
    id UUID PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT,
    section_path VARCHAR,  -- "Article 1 > Section A"
    article_id VARCHAR,
    statut_juridique VARCHAR,
    chunk_index INT,
    embedding_generated BOOLEAN
);

-- Messages/conversations
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    session_id UUID,
    user_query TEXT,
    ai_response TEXT,
    confidence FLOAT,
    citations JSONB,
    created_at TIMESTAMP
);

-- Sessions utilisateur
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id VARCHAR,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Indices pour la performance

```sql
-- Recherche par document
CREATE INDEX idx_chunks_document_id ON chunks(document_id);

-- Recherche par domaine
CREATE INDEX idx_documents_domain ON documents(domain);

-- Recherche par statut
CREATE INDEX idx_documents_status ON documents(status);

-- Recherche par session
CREATE INDEX idx_messages_session_id ON messages(session_id);

-- Recherche par timestamp
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

### Requêtes courantes

```python
# Récupérer tous chunks d'un document
chunks = db.query(Chunk).filter(
    Chunk.document_id == doc_id
).order_by(Chunk.chunk_index).all()

# Statistiques
doc_count = db.query(Document).count()
chunk_count = db.query(Chunk).count()
indexed_count = db.query(Document).filter(
    Document.status == "INDEXED"
).count()

# Supprimer tous chunks d'un document (cascade)
db.query(Chunk).filter(Chunk.document_id == doc_id).delete()
db.delete(document)
db.commit()
```

---

## Gestion des erreurs

### Stratégies de gestion

#### 1. Timeout IA
```python
# Après 120 secondes sans réponse
try:
    response = await asyncio.wait_for(
        ollama_service.generate_text(prompt),
        timeout=120
    )
except asyncio.TimeoutError:
    return {
        "error": "Timeout: La requête a pris trop longtemps",
        "suggestions": [
            "Simplifiez votre question",
            "Réessayez ultérieurement"
        ]
    }
```

#### 2. Erreur Ollama non disponible
```python
try:
    await ollama_service.health()
except ConnectionError:
    return {
        "error": "Service IA indisponible",
        "status": 503
    }
```

#### 3. Contexte insuffisant
```python
if not context or len(context) < 100:
    logger.warning("Insufficient context for query")
    confidence = 0.0
    return {
        "answer": "Je ne dispose pas d'informations suffisantes…",
        "confidence": 0.0
    }
```

#### 4. Erreur d'indexation document
```python
try:
    # Indexer le document
    chunks = chunk_service.chunk_text(doc.content)
    embeddings = await ollama_service.generate_embeddings(chunks)
    await vector_store.add_embeddings(embeddings)
    doc.status = "INDEXED"
except Exception as e:
    logger.error("Indexing failed", error=str(e), doc_id=doc.id)
    doc.status = "ERROR"
    db.commit()
```

### Logging structuré

```python
# Exemple avec structlog
logger.info(
    "search_completed",
    query="congés payés",
    results_count=5,
    search_type="hybrid",
    latency_ms=245,
    confidence=0.87
)

# Output JSON:
{
  "event": "search_completed",
  "query": "congés payés",
  "results_count": 5,
  "search_type": "hybrid",
  "latency_ms": 245,
  "confidence": 0.87,
  "timestamp": "2026-05-18T14:30:45.123Z"
}
```

---

## Performance et scalabilité

### Optimisations actuelles

| Domaine | Optimisation | Effet |
|---------|-------------|--------|
| **Recherche** | Indices PostgreSQL + Qdrant | 10-100x plus rapide |
| **Embeddings** | Cache local Ollama | Pas de re-calcul |
| **API** | Async/await FastAPI | Concurrence 100+ requêtes |
| **Chunks** | Overlap intelligent | Moins de chunks |
| **Qdrant** | In-memory mode | Pas de disque |

### Benchmarks typiques

```
Action                          Temps        Détail
─────────────────────────────────────────────────────
Parser document (1MB)           2-5s         Extraction articles
Chunking (50 chunks)            0.5-1s       Découpage intelligent
Embeddings (50 chunks)          5-10s        Ollama nomic-embed
Recherche BM25 (1M chunks)      50-100ms     Index PostgreSQL
Recherche Vectorielle (1M)      200-500ms    Qdrant KNN
Génération réponse              2-5s         Ollama Mistral
Total: Query à Answer           1-2s         Avec cache
```

### Limitations actuelles

```
Limite                      Valeur      Impact
────────────────────────────────────────────────
Max chunk size              1000 chars  Contexte limité
Timeout IA                  120s        Requêtes complexes
Max results per search      10          Peut manquer résultats
Embedding dimension         384         Qdrant compact
Collection Qdrant           1 seule     Pas de partitionnement
```

### Scalabilité horizontale

Pour passer en production avec grosse charge:

```yaml
# Docker Compose scalable
services:
  backend:
    deploy:
      replicas: 3
    # Load balancing via nginx
  
  qdrant:
    deploy:
      replicas: 3
    # Cluster Qdrant
  
  postgres:
    deploy:
      replicas: 2
    # Primary-Replica
    
  ollama:
    deploy:
      replicas: 2
    # Load balancing
```

---

## Guides pratiques

### 🚀 Ajouter un nouveau type de document

```python
# 1. Ajouter l'enum dans schemas.py
class DocumentType(str, Enum):
    LEGI_LOIS = "legi_lois"
    JURISPRUDENCE = "jurisprudence"
    CONVENTIONS = "conventions"
    MON_NOUVEAU_TYPE = "mon_nouveau_type"  # ← NOUVEAU

# 2. Créer un parser spécifique
# services/my_parser.py
class MyDocumentParser:
    def parse(self, content: str):
        # Logique d'extraction personnalisée
        return parsed_data

# 3. Utiliser dans document_service.py
if doc.type == "mon_nouveau_type":
    parser = MyDocumentParser()
    extracted = parser.parse(content)
```

### 🔍 Ajouter une source de données

```python
# 1. Créer le fetcher
# services/fetchers/legigov_fetcher.py
class LegiGovFetcher:
    async def fetch_documents(self):
        # Requête API legigov.gouv.fr
        documents = [...]
        return documents

# 2. Intégrer dans document_service
async def import_legigov_documents():
    fetcher = LegiGovFetcher()
    docs = await fetcher.fetch_documents()
    
    for doc in docs:
        await self.ingest(doc)
```

### 🧠 Améliorer la qualité des réponses

```python
# 1. Affiner les prompts (ai_service.py)
SYSTEM_PROMPT = """
Tu es LexIA, expert en droit du travail...
[Contexte supplémentaire spécialisé]
"""

# 2. Augmenter le contexte (rag_service.py)
max_chunks_per_search=15  # Au lieu de 10

# 3. Meilleur modèle LLM
OLLAMA_LLM_MODEL=llama2  # Plus grand, meilleur

# 4. Embeddings spécialisés
OLLAMA_EMBEDDING_MODEL=legal-embeddings  # Juridique spécialisé
```

### 🔐 Implémenter l'authentification

```python
# 1. Ajouter JWT (main.py)
from fastapi.security import HTTPBearer
from fastapi_jwt import FastAPI_JWT

security = HTTPBearer()

@app.post("/api/auth/login")
async def login(credentials: LoginSchema):
    token = create_access_token(credentials.user_id)
    return {"access_token": token}

# 2. Protéger les endpoints
@router.post("/documents/ingest")
async def ingest(
    doc: DocumentInputSchema,
    user = Depends(security)
):
    # Vérifier que l'utilisateur est autorisé
    return await document_service.ingest(doc)
```

### 📊 Ajouter une métrique personnalisée

```python
# 1. Créer la métrique (services/metrics.py)
class MetricsService:
    def record_query_latency(self, latency_ms: float):
        # Envoyer à Prometheus/DataDog
        pass

# 2. Utiliser dans les services
start = time.time()
result = await rag_service.search(query)
latency = (time.time() - start) * 1000
metrics.record_query_latency(latency)
```

---

## Glossaire

| Terme | Définition |
|-------|-----------|
| **RAG** | Retrieval-Augmented Generation - ajouter contexte avant génération IA |
| **LLM** | Large Language Model - grand modèle de langage (Mistral, Llama) |
| **Embedding** | Représentation vectorielle d'un texte |
| **Qdrant** | Base de données vectorielle pour recherche sémantique |
| **BM25** | Algorithme de recherche lexicale par pertinence |
| **Hybrid** | Combinaison de BM25 + recherche vectorielle |
| **Chunk** | Fragment de document (≈1000 caractères) |
| **Vectorization** | Conversion de texte en embedding |
| **Tokenization** | Découpage de texte en tokens (mots) |
| **Confidence** | Score de confiance de la réponse (0-1) |
| **Citation** | Référence précise à la source (article, section) |
| **Hallucination** | Invention du LLM (pas une donnée réelle) |
| **Async** | Programmation asynchrone (non-bloquante) |
| **Middleware** | Couche intermédiaire (CORS dans FastAPI) |
| **ORM** | Object-Relational Mapping (SQLAlchemy) |

---

**Dernière mise à jour**: Mai 2026
