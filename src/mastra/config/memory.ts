import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { PostgresStore, PgVector } from '@mastra/pg';

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
 * Performance considerations:
 * - Enable for agents that need long-term context retention
 * - Disable for performance-sensitive applications (e.g., realtime audio)
 * - Disable when recent conversation history provides sufficient context
 *
 * Database support:
 * - PostgreSQL: Set DATABASE_URL to postgresql://... for production
 * - LibSQL: Set DATABASE_URL to file:./... for local development
 */

// Determine which storage backend to use based on DATABASE_URL
// If DATABASE_URL starts with 'postgresql://', use PostgresStore + PgVector
// Otherwise, use LibSQLStore + LibSQLVector (supports file:, libsql:, etc.)
const databaseUrl = process.env.DATABASE_URL?.trim() || 'file:./memory-storage.db';
const isPostgres = databaseUrl.startsWith('postgresql://');

// Shared storage and vector instances for all memory
let memoryStorage: LibSQLStore | PostgresStore;
let memoryVector: LibSQLVector | PgVector;

if (isPostgres) {
  // PostgreSQL for production deployments
  memoryStorage = new PostgresStore({
    connectionString: databaseUrl,
  });
  memoryVector = new PgVector({
    connectionString: databaseUrl,
  });
} else {
  // LibSQL for local development
  memoryStorage = new LibSQLStore({
    url: databaseUrl,
  });
  memoryVector = new LibSQLVector({
    connectionUrl: databaseUrl,
  });
}

/**
 * Semantic recall configuration options
 */
export type SemanticRecallConfig = {
  /** Number of semantically similar messages to retrieve (default: 3) */
  topK?: number;
  /** Number of messages before/after each match to include as context (default: 2) */
  messageRange?: number;
  /** Search scope: 'resource' for all threads owned by user, 'thread' for current thread only */
  scope?: 'resource' | 'thread';
};

/**
 * Memory configuration options
 */
export type MemoryConfig = {
  /** Number of recent messages to include (default: 20) */
  lastMessages?: number;
  /** Enable/disable semantic recall, or provide custom config */
  semanticRecall?: boolean | SemanticRecallConfig;
};

/**
 * Default semantic recall configuration
 * - topK: 3 most similar messages
 * - messageRange: 2 messages of context before/after
 * - scope: 'resource' to search across all user threads
 */
const DEFAULT_SEMANTIC_RECALL: SemanticRecallConfig = {
  topK: 3,
  messageRange: 2,
  scope: 'resource',
};

/**
 * Creates a Memory instance with configurable semantic recall
 *
 * @example
 * // With semantic recall enabled (default settings)
 * const memory = createMemory({ semanticRecall: true });
 *
 * @example
 * // With semantic recall disabled (for performance-sensitive use)
 * const memory = createMemory({ semanticRecall: false });
 *
 * @example
 * // With custom semantic recall configuration
 * const memory = createMemory({
 *   semanticRecall: {
 *     topK: 5,
 *     messageRange: 3,
 *     scope: 'thread',
 *   }
 * });
 */
export function createMemory(config: MemoryConfig = {}): Memory {
  const { lastMessages = 20, semanticRecall = true } = config;

  // Build semantic recall options
  let semanticRecallOptions: false | SemanticRecallConfig;

  if (semanticRecall === false) {
    semanticRecallOptions = false;
  } else if (semanticRecall === true) {
    semanticRecallOptions = DEFAULT_SEMANTIC_RECALL;
  } else {
    // Custom config - merge with defaults
    semanticRecallOptions = {
      ...DEFAULT_SEMANTIC_RECALL,
      ...semanticRecall,
    };
  }

  return new Memory({
    storage: memoryStorage,
    vector: memoryVector,
    // Use model router for embeddings with autocomplete support
    embedder: 'openai/text-embedding-3-small',
    options: {
      lastMessages,
      semanticRecall: semanticRecallOptions,
    },
  });
}

/**
 * Pre-configured memory instances for different use cases
 */

/**
 * Standard memory with semantic recall enabled
 * Best for: General-purpose agents that benefit from long-term context
 */
export const standardMemory = createMemory({
  lastMessages: 20,
  semanticRecall: true,
});

/**
 * Memory optimized for research agents with broader recall
 * Best for: Research agents that need to recall information across sessions
 */
export const researchMemory = createMemory({
  lastMessages: 30,
  semanticRecall: {
    topK: 5,
    messageRange: 3,
    scope: 'resource',
  },
});

/**
 * Memory optimized for analysis agents (security, breach intel)
 * Best for: Agents that need deep context about specific incidents
 */
export const analysisMemory = createMemory({
  lastMessages: 25,
  semanticRecall: {
    topK: 4,
    messageRange: 2,
    scope: 'resource',
  },
});

/**
 * Lightweight memory without semantic recall
 * Best for: Performance-sensitive applications, realtime interactions,
 * or when recent conversation history is sufficient
 */
export const lightweightMemory = createMemory({
  lastMessages: 10,
  semanticRecall: false,
});

/**
 * Export shared instances for direct use
 */
export { memoryStorage, memoryVector };
