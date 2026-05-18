.PHONY: help build up down logs clean test install dev prod pull-models

# ==================== COLORS ====================
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m

# ==================== VARIABLES ====================
COMPOSE_FILE ?= docker-compose.yml
PROJECT_NAME ?= lexia
BACKEND_CONTAINER = lexia-backend
DB_CONTAINER = lexia-postgres
OLLAMA_CONTAINER = lexia-ollama

# ==================== HELP ====================
help:
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║           LexIA Backend - Makefile Commands                   ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)🚀 Démarrage$(NC)"
	@echo "  make up           → Démarrer les services"
	@echo "  make down         → Arrêter les services"
	@echo "  make restart      → Redémarrer les services"
	@echo "  make logs         → Voir les logs (Backend)"
	@echo ""
	@echo "$(YELLOW)🏗️  Développement$(NC)"
	@echo "  make dev          → Mode développement (hot reload)"
	@echo "  make shell        → Shell du conteneur backend"
	@echo "  make bash-db      → Shell PostgreSQL"
	@echo "  make test         → Lancer les tests"
	@echo "  make install      → Installer les dépendances"
	@echo ""
	@echo "$(RED)🧹 Nettoyage$(NC)"
	@echo "  make clean        → Arrêter et supprimer volumes"
	@echo "  make clean-images → Supprimer les images"
	@echo "  make reset        → Reset complet (données perdues !)"
	@echo ""
	@echo "$(BLUE)⚙️  Modèles Ollama$(NC)"
	@echo "  make pull-models  → Télécharger les modèles IA"
	@echo "  make list-models  → Lister les modèles"
	@echo ""
	@echo "$(BLUE)📊 Database$(NC)"
	@echo "  make backup       → Backup PostgreSQL"
	@echo "  make restore      → Restore PostgreSQL"
	@echo "  make psql         → Accéder à psql"
	@echo ""
	@echo "$(BLUE)🔧 Utilitaires$(NC)"
	@echo "  make health       → Vérifier la santé"
	@echo "  make ps           → État des conteneurs"
	@echo "  make build        → Rebuild les images"
	@echo "  make lint         → Linter le code"
	@echo "  make format       → Formater le code"
	@echo ""

# ==================== DÉMARRAGE ====================
up:
	@echo "$(GREEN)▶ Démarrage de LexIA...$(NC)"
	docker-compose -f $(COMPOSE_FILE) up -d
	@echo "$(GREEN)✓ Services démarrés$(NC)"
	@echo ""
	@echo "$(BLUE)Accès:$(NC)"
	@echo "  • API: http://localhost:8080"
	@echo "  • Docs: http://localhost:8080/docs"
	@echo "  • PgAdmin: http://localhost:5050/pgadmin"
	@echo "  • Qdrant: http://localhost:6333/dashboard"
	@echo ""

down:
	@echo "$(YELLOW)⊗ Arrêt de LexIA...$(NC)"
	docker-compose -f $(COMPOSE_FILE) down
	@echo "$(GREEN)✓ Services arrêtés$(NC)"

restart:
	@echo "$(YELLOW)↻ Redémarrage...$(NC)"
	docker-compose -f $(COMPOSE_FILE) restart
	@echo "$(GREEN)✓ Redémarrage effectué$(NC)"

# ==================== LOGS & STATUS ====================
logs:
	docker-compose -f $(COMPOSE_FILE) logs -f $(BACKEND_CONTAINER)

logs-all:
	docker-compose -f $(COMPOSE_FILE) logs -f

ps:
	@echo "$(BLUE)État des conteneurs:$(NC)"
	docker-compose -f $(COMPOSE_FILE) ps

health:
	@echo "$(BLUE)Vérification de la santé...$(NC)"
	@curl -s http://localhost:8080/api/health | jq . || echo "API indisponible"

# ==================== DÉVELOPPEMENT ====================
dev:
	@echo "$(GREEN)▶ Mode développement (hot reload)...$(NC)"
	docker-compose -f docker-compose-dev.yml up -d
	@echo "$(GREEN)✓ Mode dev activé (code auto-reload)$(NC)"
	docker-compose -f docker-compose-dev.yml logs -f $(BACKEND_CONTAINER)

shell:
	@echo "$(BLUE)→ Shell du backend$(NC)"
	docker exec -it $(BACKEND_CONTAINER) bash

bash-db:
	@echo "$(BLUE)→ Shell PostgreSQL$(NC)"
	docker exec -it $(DB_CONTAINER) psql -U lexia_user -d lexia_db

bash-ollama:
	@echo "$(BLUE)→ Shell Ollama$(NC)"
	docker exec -it $(OLLAMA_CONTAINER) bash

# ==================== MODÈLES OLLAMA ====================
pull-models:
	@echo "$(YELLOW)Téléchargement des modèles Ollama...$(NC)"
	docker exec -it $(OLLAMA_CONTAINER) ollama pull mistral
	docker exec -it $(OLLAMA_CONTAINER) ollama pull nomic-embed-text
	@echo "$(GREEN)✓ Modèles téléchargés$(NC)"

pull-models-llama2:
	@echo "$(YELLOW)Téléchargement de Llama2...$(NC)"
	docker exec -it $(OLLAMA_CONTAINER) ollama pull llama2
	@echo "$(GREEN)✓ Llama2 téléchargé$(NC)"

list-models:
	@echo "$(BLUE)Modèles disponibles:$(NC)"
	docker exec -it $(OLLAMA_CONTAINER) ollama list

# ==================== DATABASE ====================
backup:
	@echo "$(YELLOW)📦 Backup PostgreSQL...$(NC)"
	docker exec $(DB_CONTAINER) pg_dump -U lexia_user lexia_db > backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Backup créé$(NC)"

restore:
	@echo "$(RED)⚠ Restore PostgreSQL...$(NC)"
	@read -p "Fichier de backup: " backup_file; \
	docker exec -i $(DB_CONTAINER) psql -U lexia_user lexia_db < $$backup_file; \
	echo "$(GREEN)✓ Restore terminé$(NC)"

psql:
	docker exec -it $(DB_CONTAINER) psql -U lexia_user -d lexia_db

db-reset:
	@echo "$(RED)⚠ Suppression de la base de données...$(NC)"
	docker-compose -f $(COMPOSE_FILE) exec postgres dropdb -U lexia_user lexia_db
	docker-compose -f $(COMPOSE_FILE) exec postgres createdb -U lexia_user lexia_db
	@echo "$(GREEN)✓ Base réinitialisée$(NC)"

# ==================== BUILD & IMAGES ====================
build:
	@echo "$(YELLOW)🔨 Build des images...$(NC)"
	docker-compose -f $(COMPOSE_FILE) build
	@echo "$(GREEN)✓ Build terminé$(NC)"

build-no-cache:
	@echo "$(YELLOW)🔨 Build des images (sans cache)...$(NC)"
	docker-compose -f $(COMPOSE_FILE) build --no-cache
	@echo "$(GREEN)✓ Build terminé$(NC)"

# ==================== TESTS & LINT ====================
test:
	@echo "$(YELLOW)🧪 Lancement des tests...$(NC)"
	docker exec -it $(BACKEND_CONTAINER) pytest tests/ -v

test-coverage:
	@echo "$(YELLOW)🧪 Tests avec coverage...$(NC)"
	docker exec -it $(BACKEND_CONTAINER) pytest tests/ --cov=app --cov-report=html

lint:
	@echo "$(YELLOW)🔍 Linting du code...$(NC)"
	docker exec -it $(BACKEND_CONTAINER) pylint app/

format:
	@echo "$(YELLOW)✨ Formatage du code...$(NC)"
	docker exec -it $(BACKEND_CONTAINER) black app/
	docker exec -it $(BACKEND_CONTAINER) isort app/

install:
	@echo "$(YELLOW)📦 Installation des dépendances...$(NC)"
	docker exec -it $(BACKEND_CONTAINER) pip install -r app/requirements.txt

install-dev:
	@echo "$(YELLOW)📦 Installation des dépendances dev...$(NC)"
	docker exec -it $(BACKEND_CONTAINER) pip install -r app/requirements.txt pytest black isort pylint

# ==================== NETTOYAGE ====================
clean:
	@echo "$(RED)⊗ Arrêt et nettoyage...$(NC)"
	docker-compose -f $(COMPOSE_FILE) down -v
	@echo "$(GREEN)✓ Nettoyage complet$(NC)"

clean-logs:
	@echo "$(YELLOW)Suppression des logs...$(NC)"
	rm -rf logs/*
	@echo "$(GREEN)✓ Logs supprimés$(NC)"

clean-images:
	@echo "$(RED)⊗ Suppression des images...$(NC)"
	docker-compose -f $(COMPOSE_FILE) down --rmi all
	@echo "$(GREEN)✓ Images supprimées$(NC)"

reset:
	@echo "$(RED)⚠⚠⚠  ATTENTION: Reset complet - TOUTES LES DONNÉES SERONT PERDUES ⚠⚠⚠$(NC)"
	@read -p "Êtes-vous sûr? (y/n) " confirm; \
	if [ "$$confirm" = "y" ]; then \
		docker-compose -f $(COMPOSE_FILE) down -v --rmi all; \
		docker volume prune -f; \
		echo "$(GREEN)✓ Reset complet effectué$(NC)"; \
	else \
		echo "$(YELLOW)Annulé$(NC)"; \
	fi

# ==================== UTILITAIRES ====================
env:
	@echo "$(BLUE)Création du fichier .env...$(NC)"
	cp .env.example .env
	@echo "$(GREEN)✓ .env créé (à personnaliser)$(NC)"

info:
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║                    Informations Projet                         ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)Compose file:$(NC) $(COMPOSE_FILE)"
	@echo "$(GREEN)Project name:$(NC) $(PROJECT_NAME)"
	@echo ""
	@echo "$(BLUE)Services:$(NC)"
	@echo "  • PostgreSQL (5432)"
	@echo "  • Ollama (11434)"
	@echo "  • Qdrant (6333)"
	@echo "  • FastAPI Backend (8080)"
	@echo "  • PgAdmin (5050)"
	@echo ""

all: info
	@make help

# ==================== Shortcuts ====================
.DEFAULT_GOAL := help

u: up
d: down
l: logs
s: shell
h: health
c: clean
