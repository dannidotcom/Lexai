# Optimisation de la latence du LLM

Le projet utilise actuellement le modèle `mistral` via Ollama avec une API synchrone. Cela signifie que le backend attend que la réponse entière soit générée avant de l'envoyer au frontend, ce qui donne une impression de forte latence.

## User Review Required

> [!IMPORTANT]
> Avez-vous une carte graphique (GPU) Nvidia sur la machine où tourne Docker ? 
> L'activation du GPU pour Ollama est l'optimisation la plus impactante pour la vitesse de génération, mais nécessite une petite modification du `docker-compose.yml`.

> [!WARNING]
> La mise en place du streaming va modifier la façon dont le frontend interagit avec l'API. J'utiliserai l'API `fetch` standard du navigateur pour lire le flux, ce qui contournera en partie le client API généré (`@workspace/api-client-react`) pour ces requêtes spécifiques. Êtes-vous d'accord avec cette approche ?

## Proposed Changes

### 1. Configuration Ollama (Backend)
Nous allons optimiser les paramètres passés à Ollama pour améliorer les temps de réponse bruts.

#### [MODIFY] backend/app/services/ollama_service.py
- Ajout de l'option `keep_alive: "1h"` pour éviter que le modèle ne soit déchargé de la mémoire entre les requêtes (ce qui cause une latence initiale importante).
- Suppression du paramètre codé en dur `"num_thread": 8` pour laisser Ollama optimiser automatiquement selon votre processeur, ou le rendre configurable.
- Création d'une nouvelle méthode `generate_response_stream` qui utilise `stream: True` et `httpx` pour renvoyer un générateur (stream) des fragments (chunks) de réponse.

### 2. Implémentation du Streaming (Backend)
Nous allons ajouter des points d'entrée (endpoints) permettant de renvoyer la réponse au fur et à mesure de sa génération.

#### [MODIFY] backend/app/services/ai_service.py
- Ajout d'une méthode `query_stream` et `analyze_stream` qui exécutera le RAG, préparera le prompt, appellera `ollama_service.generate_response_stream`, et construira des événements SSE (Server-Sent Events) contenant les fragments de texte et les citations.

#### [MODIFY] backend/app/routers/ai.py
- Création des routes `/ai/query/stream` (et autres) qui utiliseront `StreamingResponse` de FastAPI.

### 3. Gestion du Streaming (Frontend)
Nous allons mettre à jour l'interface utilisateur pour afficher les mots un par un au lieu d'attendre la fin.

#### [MODIFY] frontend/src/pages/chat.tsx
- Remplacement de l'appel `mutateAsync` (synchrone) par un appel `fetch` natif gérant les flux (streams) pour les tâches de type LLM.
- Mise à jour de l'état `pendingMessages` en temps réel pour créer l'effet "machine à écrire".

### 4. (Optionnel) Activation GPU dans Docker
Si vous avez un GPU Nvidia, nous pouvons modifier le Docker Compose.

#### [MODIFY] backend/docker-compose.yml
- Décommenter / Ajouter les `reservations: devices` pour le conteneur `ollama`.

## Verification Plan

### Manual Verification
1. Lancer l'application avec `docker-compose up -d --build`.
2. Poser une question dans le chat.
3. Vérifier que la réponse s'affiche mot par mot (streaming).
4. Vérifier que la latence initiale (Time-To-First-Token) est réduite.
5. Vérifier que les citations sont toujours correctement affichées à la fin de la génération.
