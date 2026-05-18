import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Integer, Boolean, DateTime, JSON, Float, ForeignKey, Index
)
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
