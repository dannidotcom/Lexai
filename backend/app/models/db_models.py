import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Integer, Boolean, DateTime, JSON, Float, ForeignKey, Index, func
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


def now_utc():
    return datetime.now(timezone.utc)


class Document(Base):
    __tablename__ = "rag_documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(500), nullable=False)
    source = Column(String(200), nullable=False)
    domain = Column(String(100), nullable=False)
    sub_domain = Column(String(100), nullable=True)
    document_type = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    url = Column(Text, nullable=True)
    version = Column(String(50), nullable=True)
    content_hash = Column(String(64), nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_rag_documents_domain", "domain"),
        Index("ix_rag_documents_status", "status"),
        Index("ix_rag_documents_source", "source"),
    )

    @property
    def chunk_count(self) -> int:
        return len(self.chunks) if self.chunks else 0


class Chunk(Base):
    __tablename__ = "rag_chunks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("rag_documents.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    section_path = Column(String(500), nullable=False, default="")
    article_id = Column(String(200), nullable=True)
    statut_juridique = Column(String(50), nullable=False, default="VIGUEUR")
    chunk_index = Column(Integer, nullable=False, default=0)
    embedding_generated = Column(Boolean, nullable=False, default=False)
    qdrant_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    document = relationship("Document", back_populates="chunks")

    __table_args__ = (
        Index("ix_rag_chunks_document_id", "document_id"),
        Index("ix_rag_chunks_statut", "statut_juridique"),
        Index("ix_rag_chunks_embedding", "embedding_generated"),
    )


class Session(Base):
    __tablename__ = "ai_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(500), nullable=False)
    domain = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan", order_by="Message.created_at")

    @property
    def message_count(self) -> int:
        return len(self.messages) if self.messages else 0


class Message(Base):
    __tablename__ = "ai_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("ai_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    citations = Column(JSON, nullable=True, default=list)
    confidence_score = Column(Float, nullable=True)
    model_used = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    session = relationship("Session", back_populates="messages")

    __table_args__ = (
        Index("ix_ai_messages_session_id", "session_id"),
    )


class AiSource(Base):
    __tablename__ = "ai_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain = Column(String(80), index=True, nullable=False)
    sub_domain = Column(String(120), nullable=True)
    name = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=True)
    source_type = Column(String(120), nullable=True)
    url = Column(Text, nullable=False)
    official_api_url = Column(Text, nullable=True)
    collection_mode = Column(String(40), nullable=False, default="html")
    frequency = Column(String(40), nullable=False, default="daily")
    priority = Column(Integer, nullable=False, default=100)
    status = Column(String(40), nullable=False, default="active")
    last_update_at = Column(DateTime(timezone=True), nullable=True)
    last_update_status = Column(String(40), nullable=True)
    last_error_message = Column(Text, nullable=True)
    consecutive_failures = Column(Integer, nullable=False, default=0)
    comment = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    versions = relationship("SourceVersion", back_populates="source", cascade="all, delete-orphan")
    ingestion_jobs = relationship("IngestionJob", back_populates="source", cascade="all, delete-orphan")


class SourceVersion(Base):
    __tablename__ = "source_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(UUID(as_uuid=True), ForeignKey("ai_sources.id", ondelete="CASCADE"), index=True, nullable=False)
    version_hash = Column(String(128), index=True, nullable=False)
    collected_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status = Column(String(40), nullable=False, default="valid")
    content_uri = Column(Text, nullable=True)
    raw_text = Column(Text, nullable=False)
    meta = Column("metadata", JSONB, nullable=False, default=dict)

    source = relationship("AiSource", back_populates="versions")


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(UUID(as_uuid=True), ForeignKey("ai_sources.id", ondelete="CASCADE"), index=True, nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(40), nullable=False, default="running")
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)

    source = relationship("AiSource", back_populates="ingestion_jobs")


class PromptBase(Base):
    __tablename__ = "prompt_bases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content = Column(Text, nullable=False)
    version = Column(Integer, nullable=False)
    status = Column(String(40), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    prompt_versions = relationship("PromptVersion", back_populates="prompt_base")


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    feature_id = Column(String(120), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    domain = Column(String(80), index=True, nullable=False)
    sub_domain = Column(String(120), nullable=True)
    task_type = Column(String(80), nullable=False)
    expected_format = Column(Text, nullable=False)
    business_rules = Column(Text, nullable=True)
    template_content = Column(Text, nullable=False)
    version = Column(Integer, nullable=False)
    status = Column(String(40), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    prompt_versions = relationship("PromptVersion", back_populates="template")
    features = relationship("AiFeatureRegistry", back_populates="template")


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    feature_id = Column(String(120), ForeignKey("ai_feature_registry.feature_id", ondelete="CASCADE"), index=True, nullable=False)
    prompt_base_id = Column(UUID(as_uuid=True), ForeignKey("prompt_bases.id", ondelete="CASCADE"), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("prompt_templates.id", ondelete="CASCADE"), nullable=False)
    system_prompt = Column(Text, nullable=False)
    user_prompt_template = Column(Text, nullable=False)
    version = Column(Integer, nullable=False)
    status = Column(String(40), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    feature = relationship("AiFeatureRegistry", back_populates="prompt_versions")
    prompt_base = relationship("PromptBase", back_populates="prompt_versions")
    template = relationship("PromptTemplate", back_populates="prompt_versions")


class AiFeatureRegistry(Base):
    __tablename__ = "ai_feature_registry"

    feature_id = Column(String(120), primary_key=True)
    module_php = Column(String(120), nullable=False)
    domain = Column(String(80), index=True, nullable=False)
    sub_domain = Column(String(120), nullable=True)
    task_type = Column(String(80), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("prompt_templates.id", ondelete="RESTRICT"), nullable=False)
    mode = Column(String(20), nullable=False, default="sync")
    risk_level = Column(String(40), nullable=False, default="high")
    enabled = Column(Boolean, nullable=False, default=True)
    required_permissions = Column(JSONB, nullable=False, default=list)

    template = relationship("PromptTemplate", back_populates="features")
    prompt_versions = relationship("PromptVersion", back_populates="feature", cascade="all, delete-orphan")


class AiRequestLog(Base):
    __tablename__ = "ai_request_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    feature_id = Column(String(120), index=True, nullable=False)
    domain = Column(String(80), index=True, nullable=False)
    sub_domain = Column(String(120), nullable=True)
    task_type = Column(String(80), nullable=True)
    user_payload = Column(JSONB, nullable=False, default=dict)
    response_content = Column(Text, nullable=True)
    sources_used = Column(JSONB, nullable=False, default=list)
    prompt_version = Column(Integer, nullable=True)
    knowledge_version = Column(String(128), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
