-- ==================== Initialization Script PostgreSQL ====================
-- Ce script crée les tables et indices pour LexIA

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ==================== Table Documents ====================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    source VARCHAR(255),
    domain VARCHAR(100),
    subdomain VARCHAR(100),
    document_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, INDEXING, INDEXED, ERROR
    chunk_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    url VARCHAR(1000),
    version VARCHAR(50),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indices Documents
CREATE INDEX idx_documents_domain ON documents(domain);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX idx_documents_title_trgm ON documents USING gin(title gin_trgm_ops);

-- ==================== Table Chunks ====================
CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    section_path VARCHAR(500),  -- "Article 1 > Section A > Subsection 1"
    article_id VARCHAR(100),
    statut_juridique VARCHAR(50),
    chunk_index INT,
    embedding_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices Chunks
CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_section_path ON chunks(section_path);
CREATE INDEX idx_chunks_content_trgm ON chunks USING gin(content gin_trgm_ops);

-- ==================== Table Messages ====================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID,
    user_query TEXT,
    ai_response TEXT,
    task_type VARCHAR(50),  -- QUERY, EXPLAIN, ANALYZE
    confidence FLOAT DEFAULT 0.0,
    citations JSONB DEFAULT '[]'::jsonb,
    search_type VARCHAR(50),  -- VECTOR, HYBRID, BM25
    sources_count INT DEFAULT 0,
    latency_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices Messages
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_task_type ON messages(task_type);

-- ==================== Table Sessions ====================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(100),
    domain VARCHAR(100),
    messages_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indices Sessions
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);

-- ==================== Table Statistics ====================
CREATE TABLE IF NOT EXISTS statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value FLOAT,
    metric_label VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices Statistics
CREATE INDEX idx_statistics_metric_name ON statistics(metric_name);
CREATE INDEX idx_statistics_created_at ON statistics(created_at DESC);

-- ==================== Function: Update updated_at ====================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==================== Triggers ====================
-- Trigger pour documents
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour sessions
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================== Permissions ====================
-- (À adapter selon votre setup sécurité)
-- GRANT SELECT ON documents TO lexia_user;
-- GRANT INSERT, UPDATE, DELETE ON documents TO lexia_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lexia_user;

COMMIT;
