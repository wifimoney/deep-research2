-- PostgreSQL Schema Documentation for AI Agent Memory System
-- Based on "Principles of Building AI Agents" Chapter 7
--
-- NOTE: Mastra's PostgresStore and PgVector auto-create and manage these tables.
-- This file serves as documentation for the expected schema structure.
--
-- Requirements:
-- - PostgreSQL 14+ with pgvector extension
-- - Set DATABASE_URL=postgresql://user:pass@host:5432/dbname

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- CONVERSATIONS (mastra_threads)
-- ============================================================================
-- Stores conversation threads/sessions
CREATE TABLE IF NOT EXISTS mastra_threads (
    id TEXT PRIMARY KEY,
    resource_id TEXT,                    -- User/resource identifier
    title TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient user lookup
CREATE INDEX IF NOT EXISTS idx_threads_resource_id ON mastra_threads(resource_id);
CREATE INDEX IF NOT EXISTS idx_threads_created_at ON mastra_threads(created_at DESC);

-- ============================================================================
-- MESSAGES (mastra_messages)
-- ============================================================================
-- Stores individual messages with embeddings for semantic search
CREATE TABLE IF NOT EXISTS mastra_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES mastra_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL,                  -- 'user', 'assistant', 'system', 'tool'
    content TEXT NOT NULL,
    embedding vector(1536),              -- OpenAI text-embedding-3-small dimension
    tokens INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for conversation message retrieval
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON mastra_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON mastra_messages(created_at DESC);

-- IVFFlat index for fast vector similarity search
-- Lists parameter: sqrt(num_rows) is recommended, 100 is a good default
CREATE INDEX IF NOT EXISTS idx_messages_embedding ON mastra_messages 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Alternative: HNSW index (better performance for OpenAI embeddings)
-- Uncomment to use HNSW instead of IVFFlat:
-- CREATE INDEX IF NOT EXISTS idx_messages_embedding_hnsw ON mastra_messages 
-- USING hnsw (embedding vector_ip_ops) WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- ADDITIONAL MASTRA TABLES (auto-created)
-- ============================================================================
-- mastra_workflow_snapshot: Workflow state and execution data
-- mastra_evals: Evaluation results and metadata
-- mastra_traces: Telemetry and tracing data
-- mastra_scorers: Scoring and evaluation data
-- mastra_resources: Resource working memory data

-- ============================================================================
-- EXAMPLE QUERIES
-- ============================================================================

-- Get recent messages for a conversation
-- SELECT * FROM mastra_messages 
-- WHERE thread_id = 'conversation-123' 
-- ORDER BY created_at DESC 
-- LIMIT 10;

-- Semantic search for similar messages (requires embedding of query)
-- SELECT id, content, 1 - (embedding <=> $1) AS similarity
-- FROM mastra_messages
-- WHERE thread_id = 'conversation-123'
-- ORDER BY embedding <=> $1
-- LIMIT 5;

-- Get all conversations for a user
-- SELECT * FROM mastra_threads 
-- WHERE resource_id = 'user-123' 
-- ORDER BY updated_at DESC;
