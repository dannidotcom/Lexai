from __future__ import annotations
import httpx
from typing import List, Optional
from tenacity import retry, stop_after_attempt, wait_exponential
from app.core.config import settings
from app.core.logging import logger


class OllamaService:
    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.llm_model = settings.ollama_llm_model
        self.embedding_model = settings.ollama_embedding_model

    async def check_availability(self) -> dict:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                resp.raise_for_status()
                data = resp.json()
                models = [m["name"] for m in data.get("models", [])]
                return {
                    "available": True,
                    "models": models,
                    "embeddingModel": self.embedding_model,
                    "llmModel": self.llm_model,
                    "error": None,
                }
        except Exception as e:
            return {
                "available": False,
                "models": [],
                "embeddingModel": self.embedding_model,
                "llmModel": self.llm_model,
                "error": str(e),
            }

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={"model": self.embedding_model, "prompt": text},
                )
                resp.raise_for_status()
                data = resp.json()
                return data.get("embedding")
        except Exception as e:
            logger.warning("Embedding generation failed", error=str(e), model=self.embedding_model)
            return None

    async def generate_embeddings_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        results = []
        for text in texts:
            emb = await self.generate_embedding(text)
            results.append(emb)
        return results

    @retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=2, max=15))
    async def generate_response(self, prompt: str, system_prompt: str = "") -> str:
        try:
            # Utiliser l'endpoint /api/chat qui supporte le format messages
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            logger.info(f"Calling Ollama LLM", model=self.llm_model, endpoint="/api/chat")
            timeout = httpx.Timeout(
                connect=30.0,
                read=settings.ai_timeout_seconds,
                write=30.0,
                pool=30.0,
            )
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.llm_model,
                        "messages": messages,
                        "stream": False,
                        "keep_alive": "1h",
                        "options": {
                            "temperature": 0.1,
                            "num_predict": 512,
                            "num_ctx": 2048,
                        },
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                content = data.get("message", {}).get("content", "")
                
                if not content:
                    logger.warning(f"Empty response from Ollama", model=self.llm_model, response=data)
                
                return content
        except Exception as e:
            logger.error("LLM generation failed", error=str(e), model=self.llm_model, endpoint="/api/chat")
            raise

    async def generate_response_stream(self, prompt: str, system_prompt: str = ""):
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            logger.info(f"Calling Ollama LLM (Streaming)", model=self.llm_model, endpoint="/api/chat")
            timeout = httpx.Timeout(
                connect=30.0,
                read=settings.ai_timeout_seconds,
                write=30.0,
                pool=30.0,
            )
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.llm_model,
                        "messages": messages,
                        "stream": True,
                        "keep_alive": "1h",
                        "options": {
                            "temperature": 0.1,
                            "num_predict": 512,
                            "num_ctx": 2048,
                        },
                    },
                ) as resp:
                    resp.raise_for_status()
                    import json
                    async for chunk in resp.aiter_lines():
                        if not chunk:
                            continue
                        try:
                            data = json.loads(chunk)
                            content = data.get("message", {}).get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            logger.warning("Failed to decode chunk from Ollama", chunk=chunk)
        except Exception as e:
            logger.error("LLM streaming failed", error=str(e), model=self.llm_model, endpoint="/api/chat")
            raise

ollama_service = OllamaService()
