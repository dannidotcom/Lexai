from __future__ import annotations
from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field
from enum import Enum


class DocumentStatus(str, Enum):
    PENDING = "pending"
    INDEXING = "indexing"
    INDEXED = "indexed"
    ERROR = "error"


class DocumentType(str, Enum):
    CODE = "code"
    CONVENTION = "convention"
    TEXTE = "texte"
    ANNEXE = "annexe"
    AVENANT = "avenant"
    TABLEAU = "tableau"
    CIRCULAIRE = "circulaire"
    AUTRE = "autre"


class StatutJuridique(str, Enum):
    VIGUEUR = "VIGUEUR"
    VIGUEUR_ETEN = "VIGUEUR_ETEN"
    ABROGE = "ABROGE"


class SearchType(str, Enum):
    VECTOR = "vector"
    HYBRID = "hybrid"
    BM25 = "bm25"


class TaskType(str, Enum):
    QUERY = "query"
    EXPLAIN = "explain"
    ANALYZE = "analyze"


class ChunkSchema(BaseModel):
    id: str
    documentId: str
    content: str
    sectionPath: str
    articleId: Optional[str] = None
    statutJuridique: str
    chunkIndex: int
    embeddingGenerated: bool

    class Config:
        from_attributes = True


class DocumentSchema(BaseModel):
    id: str
    title: str
    source: str
    domain: str
    subDomain: Optional[str] = None
    documentType: str
    status: str
    chunkCount: int
    createdAt: str
    updatedAt: str
    url: Optional[str] = None
    version: Optional[str] = None

    class Config:
        from_attributes = True


class DocumentInputSchema(BaseModel):
    title: str
    source: str
    domain: str
    subDomain: Optional[str] = None
    documentType: str
    content: str
    url: Optional[str] = None
    version: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class SearchInputSchema(BaseModel):
    query: str
    domain: Optional[str] = None
    subDomain: Optional[str] = None
    limit: int = Field(default=5, ge=1, le=20)
    searchType: SearchType = SearchType.HYBRID


class SearchResultItemSchema(BaseModel):
    chunkId: str
    documentId: str
    documentTitle: str
    source: str
    content: str
    sectionPath: str
    articleId: Optional[str] = None
    score: float
    domain: str


class SearchResultSchema(BaseModel):
    items: List[SearchResultItemSchema]
    totalFound: int
    query: str
    searchType: str


class ContextResultSchema(BaseModel):
    context: str
    sources: List[SearchResultItemSchema]
    query: str


class AiQueryInputSchema(BaseModel):
    question: str
    domain: Optional[str] = None
    subDomain: Optional[str] = None
    sessionId: Optional[str] = None
    taskType: TaskType = TaskType.QUERY
    limitSources: Optional[int] = Field(default=None, ge=1, le=20)


class AiAnalyzeInputSchema(BaseModel):
    question: str
    situation: str
    domain: Optional[str] = None
    subDomain: Optional[str] = None
    sessionId: Optional[str] = None
    limitSources: Optional[int] = Field(default=None, ge=1, le=20)


class CitationSchema(BaseModel):
    documentId: str
    documentTitle: str
    source: str
    articleId: Optional[str] = None
    sectionPath: str
    relevanceScore: float
    excerpt: str


class AiResponseSchema(BaseModel):
    answer: str
    citations: List[CitationSchema]
    confidenceScore: float
    domain: Optional[str] = None
    taskType: str
    generatedAt: str
    sessionId: Optional[str] = None
    hasContext: bool
    modelUsed: str


class SessionSchema(BaseModel):
    id: str
    title: str
    domain: Optional[str] = None
    messageCount: int
    createdAt: str
    updatedAt: str

    class Config:
        from_attributes = True


class SessionInputSchema(BaseModel):
    title: str
    domain: Optional[str] = None


class MessageSchema(BaseModel):
    id: str
    sessionId: str
    role: str
    content: str
    citations: List[CitationSchema] = []
    createdAt: str

    class Config:
        from_attributes = True


class DashboardStatsSchema(BaseModel):
    totalDocuments: int
    totalChunks: int
    totalEmbeddings: int
    totalSessions: int
    totalQueries: int
    documentsPerDomain: Dict[str, int]
    recentActivity: List[Dict[str, Any]]
    ollamaAvailable: bool
    indexingStatus: str


class DomainStatSchema(BaseModel):
    domain: str
    documentCount: int
    chunkCount: int
    sources: List[str]


class OllamaStatusSchema(BaseModel):
    available: bool
    models: List[str]
    embeddingModel: str
    llmModel: str
    error: Optional[str] = None


class LegifranceIngestInputSchema(BaseModel):
    kaliJson: Dict[str, Any] = Field(..., description="Raw KALI JSON from Légifrance API")
    batchBy: str = Field(default="section", pattern="^(section|full)$")


class LegifranceIngestResultSchema(BaseModel):
    kaliId: str
    conventionTitle: str
    jurisState: str
    documentsCreated: int
    totalArticles: int
    documents: List[DocumentSchema]


class HealthStatusSchema(BaseModel):
    status: str
    version: str = "1.0.0"
    database: str = "unknown"
    vectorStore: str = "unknown"
