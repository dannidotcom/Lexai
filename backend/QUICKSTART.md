# 🚀 Quick Start Guide - LexIA Backend

## Démarrage ultra-rapide (< 5 min)

### 1️⃣ Configuration minimale

```bash
# À la racine du backend
cp .env.example .env

# Éditer .env si nécessaire (les valeurs par défaut fonctionnent)
```

### 2️⃣ Lancer avec Docker Compose

```bash
# Démarrer tous les services
docker-compose up -d

# Vérifier le statut
docker-compose ps

# Vérifier les logs
docker-compose logs -f backend
```

**✅ Prêt en ~1-2 minutes !**

---

## Accès aux services

| Service | URL | Login |
|---------|-----|-------|
| **API FastAPI** | http://localhost:8080 | - |
| **API Docs (Swagger)** | http://localhost:8080/docs | - |
| **API Docs (ReDoc)** | http://localhost:8080/redoc | - |
| **PgAdmin** | http://localhost:5050/pgadmin | admin@lexia.local / admin |
| **Qdrant Dashboard** | http://localhost:6333/dashboard | - |
| **Ollama API** | http://localhost:11434 | - |

---

## Test rapide de l'API

```bash
# 1. Health check
curl http://localhost:8080/api/health

# 2. Ingérer un document de test
curl -X POST http://localhost:8080/api/documents/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Code du Travail - Article 1",
    "source": "legifrance.gouv.fr",
    "domain": "droit_du_travail",
    "documentType": "code",
    "content": "Article 1: Les congés payés sont une obligation. L'\''employeur doit accorder au salarié au minimum 30 jours de congés par an."
  }'

# 3. Lancer une recherche
curl -X POST http://localhost:8080/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "congés payés",
    "limit": 5,
    "searchType": "hybrid"
  }'

# 4. Poser une question à l'IA
curl -X POST http://localhost:8080/api/ai/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Combien de jours de congés minimum ?"
  }'
```

---

## Commandes utiles

### Gestion des conteneurs

```bash
# Arrêter les services
docker-compose down

# Arrêter et supprimer les volumes (ATTENTION: données supprimées!)
docker-compose down -v

# Redémarrer un service spécifique
docker-compose restart backend

# Rebuild l'image backend
docker-compose build backend

# Voir les logs en temps réel
docker-compose logs -f backend

# Voir les logs avec limite
docker-compose logs --tail=50 backend

# Accéder au shell du conteneur backend
docker exec -it lexia-backend bash

# Accéder au shell de PostgreSQL
docker exec -it lexia-postgres psql -U lexia_user -d lexia_db
```

### Pull des modèles Ollama (optionnel)

```bash
# Accéder au conteneur Ollama
docker exec -it lexia-ollama ollama pull mistral
docker exec -it lexia-ollama ollama pull nomic-embed-text

# Vérifier les modèles disponibles
docker exec -it lexia-ollama ollama list
```

### Gestion des données PostgreSQL

```bash
# Backup la base de données
docker exec lexia-postgres pg_dump -U lexia_user lexia_db > backup.sql

# Restore une base de données
docker exec -i lexia-postgres psql -U lexia_user lexia_db < backup.sql

# Accéder à psql
docker exec -it lexia-postgres psql -U lexia_user -d lexia_db

# Requête SQL directe
docker exec -it lexia-postgres psql -U lexia_user -d lexia_db -c "SELECT * FROM documents;"
```

---

## Dépannage

### ❌ Backend ne démarre pas

**Symptôme**: `connection refused` sur PostgreSQL

**Solution**:
```bash
# Attendre que PostgreSQL soit prêt
docker-compose logs postgres

# Vérifier le health
docker-compose ps

# Restart les services
docker-compose restart
```

### ❌ Ollama timeout

**Symptôme**: `connection refused` sur Ollama

**Solution**:
```bash
# Vérifier que Ollama est en cours d'exécution
docker-compose logs ollama

# Peut prendre du temps au premier démarrage
docker exec -it lexia-ollama ollama list

# Si rien n'apparaît, pull les modèles
docker exec -it lexia-ollama ollama pull mistral
```

### ❌ Qdrant indisponible

**Symptôme**: Erreur d'indexation

**Solution**:
```bash
# Vérifier Qdrant
docker-compose logs qdrant

# Supprimer les données et recommencer
docker-compose down -v
docker-compose up -d
```

### ❌ Erreur de mémoire

**Symptôme**: `out of memory` ou service crash

**Solution**:
```bash
# Augmenter les limites dans docker-compose.yml
# Section deploy -> resources -> limits

# Ou réduire le modèle Ollama
OLLAMA_LLM_MODEL=neural-chat  # Plus petit que mistral
```

---

## Configuration personnalisée

### Changer le modèle LLM

**Option 1: Modèle plus petit (plus rapide)**
```bash
# Dans .env
OLLAMA_LLM_MODEL=neural-chat
```

**Option 2: Modèle plus grand (meilleur)**
```bash
# Dans .env
OLLAMA_LLM_MODEL=llama2

# Pull le modèle
docker exec -it lexia-ollama ollama pull llama2
```

### Augmenter la taille des chunks

```bash
# Dans .env
CHUNK_SIZE=2000  # Au lieu de 1000
CHUNK_OVERLAP=400
```

### Modifier la limite de résultats

```bash
# Dans .env
MAX_CHUNKS_PER_SEARCH=20  # Au lieu de 10
```

### Changer le timeout IA

```bash
# Dans .env
AI_TIMEOUT_SECONDS=180  # Au lieu de 120 (2 min au lieu de 1 min)
```

---

## Performance & Ressources

### Ressources requises

| Service | CPU | RAM | Stockage |
|---------|-----|-----|----------|
| PostgreSQL | 0.5 | 512 MB | 1 GB |
| Ollama | 1-2 | 4-8 GB | 5 GB |
| Qdrant | 0.5 | 1 GB | 2 GB |
| Backend | 0.5 | 512 MB | - |
| **Total** | **3-4** | **6-10 GB** | **~10 GB** |

### Optimiser pour les machines faibles

```yaml
# Dans docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
  
  ollama:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 2G
```

### Qdrant réel (recommandé)

Le backend utilise toujours le service Qdrant réel, pas une instance en mémoire volatile.

---

## Production Checklist

- [ ] Générer un `.env` avec des valeurs sécurisées
- [ ] Configurer le DNS/domaine
- [ ] Mettre en place un reverse proxy (Nginx)
- [ ] Implémenter HTTPS/SSL
- [ ] Activer l'authentification JWT
- [ ] Configurer un système de logs centralisé
- [ ] Mettre en place du monitoring
- [ ] Tester la haute disponibilité
- [ ] Implémenter du rate limiting
- [ ] Backuper régulièrement les données

---

## Documentation complète

- 📖 [README.md](README.md) - Vue d'ensemble du projet
- 📚 [explain.md](explain.md) - Architecture détaillée & guides
- 🐳 [Dockerfile](Dockerfile) - Configuration Docker
- 🔧 [docker-compose.yml](docker-compose.yml) - Orchestration
- ⚙️ [.env.example](.env.example) - Variables d'environnement

---

## Support

```bash
# Créer un issue
# Consultez la documentation: explain.md

# Vérifier les logs
docker-compose logs -f

# Tester la connectivité
curl http://localhost:8080/api/health
```

---

**Bon dev! 🚀**
