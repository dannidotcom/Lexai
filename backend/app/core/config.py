import os
from typing import Any
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    app_name: str = "LexIA — Moteur IA Juridique Souverain"
    version: str = "1.0.0"
    debug: bool = False

    database_url: str = os.environ.get("DATABASE_URL", "")
    secret_key: str = os.environ.get("SECRET_KEY", "change-me-in-production")
    algorithm: str = os.environ.get("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    refresh_token_expire_days: int = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "14"))
    reset_password_token_expire_minutes: int = int(os.environ.get("RESET_PASSWORD_TOKEN_EXPIRE_MINUTES", "30"))
    verify_email_token_expire_minutes: int = int(os.environ.get("VERIFY_EMAIL_TOKEN_EXPIRE_MINUTES", "1440"))
    cookie_secure: bool = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
    cookie_domain: str | None = os.environ.get("COOKIE_DOMAIN") or None
    frontend_url: str = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    cors_origins: str = os.environ.get("CORS_ORIGINS", "*")
    brute_force_max_attempts: int = int(os.environ.get("BRUTE_FORCE_MAX_ATTEMPTS", "5"))
    brute_force_window_minutes: int = int(os.environ.get("BRUTE_FORCE_WINDOW_MINUTES", "15"))

    smtp_host: str = os.environ.get("SMTP_HOST", "")
    smtp_port: int = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user: str = os.environ.get("SMTP_USER", "")
    smtp_password: str = os.environ.get("SMTP_PASSWORD", "")
    smtp_from: str = os.environ.get("SMTP_FROM", "security@localhost")
    print(f"SMTP Configuration: host={smtp_host}, port={smtp_port}, user={smtp_user}, from={smtp_from}, password={smtp_password}")
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

    @property
    def async_database_url(self) -> str:
        if self.database_url.startswith("postgresql+asyncpg://"):
            return self.database_url
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return self.database_url

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

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
