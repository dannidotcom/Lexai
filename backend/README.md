# 📜 LexIA — Moteur IA Juridique Souverain

> **Version 1.0.0** - Système RAG (Retrieval-Augmented Generation) pour analyse juridique basé sur sources officielles françaises

## 🎯 Vue d'ensemble

**LexIA** est un moteur IA juridique souverain qui combine :
- **RAG (Retrieval-Augmented Generation)** : récupère les documents pertinents avant de générer les réponses
- **LLM local (Ollama)** : utilise des modèles locaux (Mistral, Llama) pour garantir la souveraineté des données
- **Recherche hybride** : combine BM25 (recherche lexicale) et recherche vectorielle (embeddings)
- **Vector Store (Qdrant)** : stockage et recherche sémantique rapide des documents

### Cas d'usage
- ✅ Recherche dans la jurisprudence et codes juridiques
- ✅ Explication de concepts juridiques en langage simple
- ✅ Analyse de situations RH/sociales selon la réglementation
- ✅ Citations précises des sources officielles

---

## 🏗️ Architecture

### Stack technique
```
Frontend (React/TypeScript/Vite)
        ↓
FastAPI Backend (Python 3.11+)
        ↓
├── Ollama LLM (Mistral/Llama)
├── PostgreSQL (métadonnées documents)
└── Qdrant (vector store avec embeddings)
```

### Dossiers principaux
```
backend/
├── app/
│   ├── core/          # Configuration, DB, logging
│   ├── models/        # Schémas Pydantic et modèles SQLAlchemy
│   ├── routers/       # Endpoints FastAPI
│   ├── services/      # Logique métier (RAG, IA, documents)
│   ├── main.py        # Application FastAPI
│   ├── run.py         # Lanceur Uvicorn
│   └── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 🚀 Démarrage rapide

### Option 1 : Sans Docker (développement local)

#### Prérequis
- Python 3.11+
- PostgreSQL 13+
- Ollama installé localement
- Qdrant (peut être en mémoire)

#### Installation
```bash
cd backend

# 1. Créer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 2. Installer les dépendances
pip install -r app/requirements.txt

# 3. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# 4. Initialiser la base de données
# (automatique au démarrage)

# 5. Démarrer les services (dans des terminaux séparés)
# Terminal 1: Ollama
ollama serve

# Terminal 2: Qdrant
docker run -p 6333:6333 qdrant/qdrant:latest

# Terminal 3: Backend FastAPI
python app/run.py
```

**L'API sera disponible sur** `http://localhost:8080`

### Option 2 : Avec Docker (recommandé pour la production)

```bash
# 1. À la racine du projet
docker-compose up -d

# 2. Vérifier les services
docker-compose logs -f backend

# 3. L'API sera disponible sur http://localhost:8080
```

---

## 📡 API Endpoints

### Health Check
```bash
GET /api/health
```

### Documents
```bash
# Ingérer un document
POST /api/documents/ingest
Body: {
  "title": "Code du travail",
  "source": "legifrance.gouv.fr",
  "domain": "droit_du_travail",
  "documentType": "code",
  "content": "..."
}

# Lister les documents
GET /api/documents/list

# Récupérer un document
GET /api/documents/{documentId}

# Supprimer un document
DELETE /api/documents/{documentId}
```

### RAG - Recherche
```bash
# Recherche hybride/vectorielle/BM25
POST /api/rag/search
Body: {
  "query": "congés payés",
  "domain": "droit_du_travail",
  "limit": 5,
  "searchType": "hybrid"
}

# Récupérer le contexte pour une requête
POST /api/rag/context
Body: {
  "query": "durée du SMIC"
}
```

### AI - Requêtes avec IA
```bash
# Query : répondre à une question
POST /api/ai/query
Body: {
  "query": "Quel est le montant du SMIC ?",
  "domain": "droit_du_travail"
}

# Explain : expliquer un concept
POST /api/ai/explain
Body: {
  "query": "Qu'est-ce qu'une clause de non-concurrence ?"
}

# Analyze : analyser une situation
POST /api/ai/analyze
Body: {
  "situation": "Un salarié en CDI a été licencié sans cause réelle et sérieuse",
  "question": "Quels sont les droits du salarié ?"
}
```

### Stats
```bash
GET /api/stats/overview
GET /api/stats/documents
GET /api/stats/searches
```

---

## ⚙️ Configuration

### Variables d'environnement (.env)

```env
# FastAPI
DEBUG=false
PORT=8080

# Base de données PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/lexia_db

# Ollama (LLM local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_LLM_MODEL=mistral
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Qdrant (Vector Store)
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=lexia_chunks

# Chunking
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
MAX_CHUNKS_PER_SEARCH=10
AI_TIMEOUT_SECONDS=120
```

---

## 📚 Services principaux

### 1. **RAG Service** (`rag_service.py`)
- Recherche hybride (vectorielle + BM25)
- Récupération du contexte pertinent
- Ranking des résultats

### 2. **AI Service** (`ai_service.py`)
- Génération de réponses avec Ollama
- 3 modes : Query, Explain, Analyze
- Citations précises des sources
- Score de confiance

### 3. **Document Service** (`document_service.py`)
- Ingestion de documents
- Parsing et chunking intelligent
- Gestion du cycle de vie (PENDING → INDEXING → INDEXED)

### 4. **Vector Store** (`vector_store.py`)
- Intégration Qdrant
- Embeddings avec Ollama
- Requêtes sémantiques

### 5. **Ollama Service** (`ollama_service.py`)
- Communication avec Ollama
- Embeddings pour les documents
- Génération LLM avec prompts systématiques

### 6. **Chunk Service** (`chunk_service.py`)
- Découpage intelligent des documents
- Preservation du contexte juridique
- Metadata enrichie

### 7. **Legifrance Parser** (`legifrance_parser.py`)
- Parsing des documents légifrance.gouv.fr
- Extraction de structure (articles, sections)
- Extraction de métadonnées

---

## 🗄️ Base de données

### Tables principales
- **documents** : métadonnées des documents
- **chunks** : fragments de documents pour RAG
- **messages** : historique des conversations
- **sessions** : sessions utilisateur

### Migrations
```bash
# Créer une migration
alembic revision --autogenerate -m "description"

# Appliquer les migrations
alembic upgrade head
```

---

## 🔍 Modèles IA

### Générateur de texte (LLM)
- **Mistral** (recommandé, équilibre speed/qualité)
- **Llama 2** (plus grand, plus lent)
- **Neural Chat** (optimisé pour le dialogue)

### Embeddings
- **nomic-embed-text** (recommandé pour le français)
- **all-MiniLM-L6-v2** (universel, rapide)

### Pull des modèles Ollama
```bash
ollama pull mistral
ollama pull nomic-embed-text
```

---

## 🧪 Testing

```bash
# Tests unitaires
pytest tests/ -v

# Coverage
pytest tests/ --cov=app --cov-report=html

# Tests d'intégration
pytest tests/integration/ -v
```

---

## 📊 Monitoring

### Logs structurés
- Format JSON avec `structlog`
- Niveau DEBUG/INFO/WARNING/ERROR
- Traçabilité des requêtes

### Métriques disponibles
- Nombre de documents indexés
- Latence des requêtes RAG
- Scores de confiance IA
- Taux de timeout

---

## 🐳 Docker

### Build l'image
```bash
docker build -t lexia-backend:latest .
```

### Lancer avec docker-compose
```bash
docker-compose up -d
```

### Vérifier les logs
```bash
docker-compose logs -f backend
```

### Arrêter
```bash
docker-compose down
```

---

## 🔐 Sécurité

✅ **Implémenté**
- CORS configuré
- Validation Pydantic des inputs
- Timeout sur les requêtes IA
- Pas d'exposition de données externes

⚠️ **À implémenter**
- Authentification (JWT/OAuth)
- Rate limiting
- Chiffrement des données sensibles
- Audit logging

---

## 📝 Développement

### Structure du code
```
services/    → Logique métier (business logic)
routers/     → Endpoints HTTP
models/      → Schémas Pydantic et DB
core/        → Configuration, DB, logging
```

### Ajouter un endpoint
1. Créer le service dans `services/`
2. Créer le router dans `routers/`
3. Inclure le router dans `main.py`
4. Documenter l'endpoint en docstring

### Déboguer
```python
# Activer les logs DEBUG
import logging
logging.basicConfig(level=logging.DEBUG)
```

---

## 🤝 Contributing

1. Fork le repo
2. Créer une branche `feature/nom`
3. Commit avec messages clairs
4. Push et créer une Pull Request

---

## 📄 Licence

Propriétaire - Tous droits réservés

---

## 📧 Support

- 📧 Email : support@lexia.local
- 📱 Issues : Créer une issue sur GitLab
- 📚 Docs : Voir [explain.md](explain.md)

---

**Dernière mise à jour** : Mai 2026
