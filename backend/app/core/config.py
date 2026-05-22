import os
from typing import Any
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    app_name: str = "LexIA — Moteur IA Juridique Souverain"
    version: str = "1.0.0"
    debug: bool = False

    database_url: str = os.environ.get("DATABASE_URL", "")

    ollama_base_url: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_llm_model: str = os.environ.get("OLLAMA_LLM_MODEL", "mistral")
    ollama_embedding_model: str = os.environ.get("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")

    qdrant_host: str = os.environ.get("QDRANT_HOST", "localhost")
    qdrant_port: int = int(os.environ.get("QDRANT_PORT", "6333"))
    qdrant_collection: str = os.environ.get("QDRANT_COLLECTION", "lexia_chunks")

    chunk_size: int = 1000
    chunk_overlap: int = 200
    max_chunks_per_search: int = 5
    ai_timeout_seconds: int = 300

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: Any) -> Any:
        if isinstance(value, str) and value.strip().lower() in {"release", "prod", "production"}:
            return False
        return value

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
