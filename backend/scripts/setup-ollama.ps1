# Script de setup des modèles Ollama pour Windows
# Utilisation : .\setup-ollama.ps1

param(
    [string]$OllamaHost = "http://localhost:11434",
    [string]$LlmModel = "mistral",
    [string]$EmbeddingModel = "nomic-embed-text"
)

Write-Host "=== Setup Ollama Models ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  OLLAMA_HOST: $OllamaHost"
Write-Host "  LLM_MODEL: $LlmModel"
Write-Host "  EMBEDDING_MODEL: $EmbeddingModel"
Write-Host ""

# Test de connectivité
Write-Host "1. Vérification de la connexion à Ollama..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$OllamaHost/api/tags" -ErrorAction Stop
    Write-Host "✓ Ollama est accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ Impossible de se connecter à Ollama sur $OllamaHost" -ForegroundColor Red
    Write-Host "   Assurez-vous que Ollama est en cours d'exécution:"
    Write-Host "   docker compose up ollama"
    exit 1
}
Write-Host ""

# Récupérer les modèles actuels
Write-Host "2. Modèles actuellement disponibles:" -ForegroundColor Yellow
$models = $response.models | ForEach-Object { $_.name }
if ($models.Count -eq 0) {
    Write-Host "   Aucun modèle trouvé"
} else {
    $models | ForEach-Object { Write-Host "   - $_" }
}
Write-Host ""

# Télécharger le modèle LLM
Write-Host "3. Téléchargement du modèle LLM ($LlmModel)..." -ForegroundColor Yellow
if ($models -contains $LlmModel) {
    Write-Host "✓ Modèle $LlmModel déjà disponible" -ForegroundColor Green
} else {
    Write-Host "   Téléchargement en cours... (cela peut prendre quelques minutes)"
    try {
        $output = docker exec lexia-ollama ollama pull $LlmModel 2>&1
        Write-Host "✓ Modèle $LlmModel téléchargé avec succès" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erreur lors du téléchargement de $LlmModel" -ForegroundColor Red
        Write-Host $_.Exception.Message
        exit 1
    }
}
Write-Host ""

# Télécharger le modèle d'embedding
Write-Host "4. Téléchargement du modèle d'embedding ($EmbeddingModel)..." -ForegroundColor Yellow
if ($models -contains $EmbeddingModel) {
    Write-Host "✓ Modèle $EmbeddingModel déjà disponible" -ForegroundColor Green
} else {
    Write-Host "   Téléchargement en cours... (cela peut prendre quelques minutes)"
    try {
        $output = docker exec lexia-ollama ollama pull $EmbeddingModel 2>&1
        Write-Host "✓ Modèle $EmbeddingModel téléchargé avec succès" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erreur lors du téléchargement de $EmbeddingModel" -ForegroundColor Red
        Write-Host $_.Exception.Message
        exit 1
    }
}
Write-Host ""

# Test final
Write-Host "5. Vérification finale..." -ForegroundColor Yellow
try {
    $finalResponse = Invoke-RestMethod -Uri "$OllamaHost/api/tags" -ErrorAction Stop
    $finalModels = $finalResponse.models | ForEach-Object { $_.name }
    
    if (($finalModels -contains $LlmModel) -and ($finalModels -contains $EmbeddingModel)) {
        Write-Host "✓ Tous les modèles sont disponibles!" -ForegroundColor Green
        Write-Host ""
        Write-Host "=== Setup réussi ===" -ForegroundColor Green
        Write-Host "Vous pouvez maintenant redémarrer le backend:"
        Write-Host "  docker compose restart backend"
        exit 0
    } else {
        Write-Host "❌ Certains modèles sont manquants" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors de la vérification finale" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}
