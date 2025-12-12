import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { PostgresStore, PgVector } from '@mastra/pg';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';

// Determine which storage backend to use based on DATABASE_URL
let databaseUrl = process.env.DATABASE_URL?.trim() || 'file:./storage.db';

// Fix malformed DATABASE_URL if it contains the key as part of the value
if (databaseUrl.startsWith('DATABASE_URL=')) {
  databaseUrl = databaseUrl.replace('DATABASE_URL=', '');
}

const isPostgres = databaseUrl.startsWith('postgresql://');

// Only add SSL for remote connections (not localhost/127.0.0.1)
const isLocalhost = databaseUrl.includes('@localhost') || databaseUrl.includes('@127.0.0.1');
if (isPostgres && !isLocalhost && !databaseUrl.includes('sslmode=')) {
  databaseUrl += databaseUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
}

// Initialize storage
let storage: LibSQLStore | PostgresStore;

if (isPostgres) {
  // @ts-expect-error - PostgresStore runtime requires 'id' but TypeScript types don't include it
  storage = new PostgresStore({
    id: 'agent-storage',
    connectionString: databaseUrl,
  });
} else {
  // Use LibSQLStore for file-based or LibSQL URLs
  storage = new LibSQLStore({
    url: databaseUrl,
  });
}

// Create vector store for Memory
let vector: LibSQLVector | PgVector;
if (isPostgres) {
  // @ts-expect-error - PgVector runtime requires 'id' but TypeScript types don't include it
  vector = new PgVector({ id: 'agent-vector', connectionString: databaseUrl });
} else {
  vector = new LibSQLVector({ connectionUrl: databaseUrl });
}

// Initialize storage - PostgresStore requires explicit init() when used directly
let initPromise: Promise<void> | null = null

async function ensureStorageInitialized() {
  // If already initialized or initialization in progress, wait for it
  if (initPromise) {
    return initPromise
  }
  
  // Create initialization promise
  initPromise = (async () => {
    if (isPostgres && 'init' in storage && typeof storage.init === 'function') {
      console.log('[Memory] Initializing PostgreSQL storage...')
      await storage.init()
      console.log('[Memory] PostgreSQL storage initialized')
    }
  })()
  
  try {
    await initPromise
  } catch (error) {
    console.error('[Memory] Failed to initialize storage:', error)
    // Reset promise so initialization can be retried
    initPromise = null
    throw error
  }
  
  return initPromise
}

// Start initialization on module load (don't await - let it happen in background)
ensureStorageInitialized().catch((error) => {
  console.error('[Memory] Background initialization failed:', error)
  // Will be retried on first use
})

/**
 * Semantic Recall Configuration
 * 
 * Semantic recall is RAG-based search that helps agents maintain context across
 * longer interactions when messages are no longer within recent conversation history.
 * 
 * How it works:
 * 1. New messages are used to query a vector DB for semantically similar messages
 * 2. After getting a response from the LLM, all new messages are inserted into the vector DB
 * 3. These can be recalled in later interactions for context
 * 
 * Configuration:
 * - topK: Number of semantically similar messages to retrieve (default: 3)
 * - messageRange: How much surrounding context to include with each match (default: 2)
 * - scope: Whether to search within the current thread or across all threads owned by a resource
 *   - 'thread': Search only within the current thread
 *   - 'resource': Search across all threads for this user (default)
 * 
 * PostgreSQL Index Optimization:
 * When using PostgreSQL, HNSW indexes provide better performance than IVFFlat,
 * especially with OpenAI embeddings which use inner product distance.
 */
const semanticRecallConfig = {
  topK: 3, // Retrieve 3 most semantically similar messages
  messageRange: 2, // Include 2 messages before and after each match
  scope: 'resource' as const, // Search across all threads for this user
  // PostgreSQL index optimization (only applied when using PostgreSQL)
  ...(isPostgres && {
    indexConfig: {
      type: 'hnsw' as const, // Use HNSW for better performance
      metric: 'dotproduct' as const, // Best for OpenAI embeddings
      m: 16, // Number of bi-directional links (default: 16)
      efConstruction: 64, // Size of candidate list during construction (default: 64)
    },
  }),
};

// Create Memory instance with semantic recall
// Using ModelRouterEmbeddingModel for better autocomplete support and automatic API key detection
const memory = new Memory({
  storage,
  vector,
  // Use ModelRouterEmbeddingModel for embeddings with autocomplete support
  // Automatically handles API key detection from environment variables (OPENAI_API_KEY)
  embedder: new ModelRouterEmbeddingModel('openai/text-embedding-3-small'),
  options: {
    lastMessages: 20, // Keep last 20 messages in immediate context
    semanticRecall: semanticRecallConfig,
    workingMemory: {
      enabled: true, // Enable working memory for session state tracking
    },
  },
});

export { memory, storage, vector, isPostgres, ensureStorageInitialized };
