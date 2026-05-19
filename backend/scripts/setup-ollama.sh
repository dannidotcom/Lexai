#!/bin/bash

# Script de setup des modèles Ollama
# Utilisation : ./setup-ollama.sh

set -e

echo "=== Setup Ollama Models ==="
echo ""

# Configuration
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
LLM_MODEL="${OLLAMA_LLM_MODEL:-mistral}"
EMBEDDING_MODEL="${OLLAMA_EMBEDDING_MODEL:-nomic-embed-text}"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Configuration:${NC}"
echo "  OLLAMA_HOST: $OLLAMA_HOST"
echo "  LLM_MODEL: $LLM_MODEL"
echo "  EMBEDDING_MODEL: $EMBEDDING_MODEL"
echo ""

# Test de connectivité
echo -e "${YELLOW}1. Vérification de la connexion à Ollama...${NC}"
if ! curl -s "$OLLAMA_HOST/api/tags" > /dev/null 2>&1; then
    echo -e "${RED}❌ Impossible de se connecter à Ollama sur $OLLAMA_HOST${NC}"
    echo "   Assurez-vous que Ollama est en cours d'exécution:"
    echo "   docker compose up ollama"
    exit 1
fi
echo -e "${GREEN}✓ Ollama est accessible${NC}"
echo ""

# Récupérer les modèles actuels
echo -e "${YELLOW}2. Modèles actuellement disponibles:${NC}"
MODELS=$(curl -s "$OLLAMA_HOST/api/tags" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || echo "")
if [ -z "$MODELS" ]; then
    echo "   Aucun modèle trouvé"
else
    echo "$MODELS" | sed 's/^/   - /'
fi
echo ""

# Télécharger le modèle LLM
echo -e "${YELLOW}3. Téléchargement du modèle LLM ($LLM_MODEL)...${NC}"
if echo "$MODELS" | grep -q "^$LLM_MODEL$"; then
    echo -e "${GREEN}✓ Modèle $LLM_MODEL déjà disponible${NC}"
else
    echo "   Téléchargement en cours... (cela peut prendre quelques minutes)"
    if docker exec lexia-ollama ollama pull "$LLM_MODEL"; then
        echo -e "${GREEN}✓ Modèle $LLM_MODEL téléchargé avec succès${NC}"
    else
        echo -e "${RED}❌ Erreur lors du téléchargement de $LLM_MODEL${NC}"
        exit 1
    fi
fi
echo ""

# Télécharger le modèle d'embedding
echo -e "${YELLOW}4. Téléchargement du modèle d'embedding ($EMBEDDING_MODEL)...${NC}"
if echo "$MODELS" | grep -q "^$EMBEDDING_MODEL$"; then
    echo -e "${GREEN}✓ Modèle $EMBEDDING_MODEL déjà disponible${NC}"
else
    echo "   Téléchargement en cours... (cela peut prendre quelques minutes)"
    if docker exec lexia-ollama ollama pull "$EMBEDDING_MODEL"; then
        echo -e "${GREEN}✓ Modèle $EMBEDDING_MODEL téléchargé avec succès${NC}"
    else
        echo -e "${RED}❌ Erreur lors du téléchargement de $EMBEDDING_MODEL${NC}"
        exit 1
    fi
fi
echo ""

# Test final
echo -e "${YELLOW}5. Vérification finale...${NC}"
FINAL_MODELS=$(curl -s "$OLLAMA_HOST/api/tags" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
if echo "$FINAL_MODELS" | grep -q "^$LLM_MODEL$" && echo "$FINAL_MODELS" | grep -q "^$EMBEDDING_MODEL$"; then
    echo -e "${GREEN}✓ Tous les modèles sont disponibles!${NC}"
    echo ""
    echo -e "${GREEN}=== Setup réussi ===${NC}"
    echo "Vous pouvez maintenant redémarrer le backend:"
    echo "  docker compose restart backend"
    exit 0
else
    echo -e "${RED}❌ Certains modèles sont manquants${NC}"
    exit 1
fi
