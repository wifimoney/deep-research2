import { Memory } from '@mastra/memory';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { storage as memoryStorage, vector as memoryVector } from './storage.js';

// Re-export ensureStorageInitialized for convenience (used by services)
export { ensureStorageInitialized } from './storage.js';

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
 * 
 * NOTE: Storage and vector instances are shared from ./storage.ts
 * All modules use the same PostgreSQL database connection.
 */

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
  /** HNSW index configuration for optimal performance */
  indexConfig?: {
    type: 'hnsw';
    metric: 'dotproduct' | 'cosine' | 'euclidean';
    m?: number;
    efConstruction?: number;
  };
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
  // Ensure all required properties are present (topK and messageRange must be numbers, not undefined)
  let semanticRecallOptions: false | { 
    topK: number; 
    messageRange: number; 
    scope?: 'thread' | 'resource';
    indexConfig?: {
      type: 'hnsw';
      metric: 'dotproduct' | 'cosine' | 'euclidean';
      m?: number;
      efConstruction?: number;
    };
  };

  if (semanticRecall === false) {
    semanticRecallOptions = false;
  } else if (semanticRecall === true) {
    semanticRecallOptions = {
      topK: DEFAULT_SEMANTIC_RECALL.topK!,
      messageRange: DEFAULT_SEMANTIC_RECALL.messageRange!,
      scope: DEFAULT_SEMANTIC_RECALL.scope,
      indexConfig: {
        type: 'hnsw',
        metric: 'dotproduct',
        m: 16,
        efConstruction: 64,
      },
    };
  } else {
    // Custom config - merge with defaults, ensuring required properties are numbers
    semanticRecallOptions = {
      topK: semanticRecall.topK ?? DEFAULT_SEMANTIC_RECALL.topK!,
      messageRange: semanticRecall.messageRange ?? DEFAULT_SEMANTIC_RECALL.messageRange!,
      scope: semanticRecall.scope ?? DEFAULT_SEMANTIC_RECALL.scope,
      indexConfig: semanticRecall.indexConfig ?? {
        type: 'hnsw',
        metric: 'dotproduct',
        m: 16,
        efConstruction: 64,
      },
    };
  }

  return new Memory({
    storage: memoryStorage,
    vector: memoryVector,
    embedder: new ModelRouterEmbeddingModel('openai/text-embedding-3-small'),
    options: {
      lastMessages,
      semanticRecall: semanticRecallOptions,
      workingMemory: {
        enabled: true,
      },
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
  lastMessages: 15, // Reduced from 30 to prevent memory issues with large research tasks
  semanticRecall: {
    topK: 3, // Reduced from 5
    messageRange: 2, // Reduced from 3
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


// ============================================================================
// CHAPTER 7 WRAPPER FUNCTIONS
// ============================================================================
// These functions provide a Chapter 7-style API for direct memory operations.
// They wrap Mastra's storage layer for compatibility with the book's examples.

/**
 * Message type for storage operations
 */
export type StoredMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: Date;
};

/**
 * Add a message to a conversation thread
 * Chapter 7 equivalent: WorkingMemory.addMessage()
 *
 * @example
 * await addMessage('thread-123', 'user', 'What is Log4Shell?');
 * await addMessage('thread-123', 'assistant', 'Log4Shell is...');
 */
export async function addMessage(
  threadId: string,
  role: StoredMessage['role'],
  content: string
): Promise<string> {
  const id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Use Memory instance for proper API compatibility
  const memory = new Memory({
    storage: memoryStorage,
    vector: memoryVector,
    embedder: new ModelRouterEmbeddingModel('openai/text-embedding-3-small'),
  });

  // Save message using Memory's internal storage API
  await memoryStorage.saveMessages({
    messages: [
      {
        id,
        threadId,
        role,
        content,
        createdAt: new Date(),
        type: 'text',
      },
    ],
  });

  return id;
}

/**
 * Get recent messages from a conversation thread
 * Chapter 7 equivalent: WorkingMemory.getRecentMessages()
 *
 * @example
 * const messages = await getRecentMessages('thread-123', 10);
 */
export async function getRecentMessages(
  threadId: string,
  limit: number = 10
): Promise<StoredMessage[]> {
  // Use Memory instance for proper API compatibility
  const memory = new Memory({
    storage: memoryStorage,
    vector: memoryVector,
    embedder: new ModelRouterEmbeddingModel('openai/text-embedding-3-small'),
  });

  // Use Memory.query() which has the correct API
  const { uiMessages } = await memory.query({
    threadId,
    selectBy: {
      last: limit,
    },
  });

  return uiMessages.map((msg) => ({
    id: msg.id,
    role: msg.role as StoredMessage['role'],
    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    createdAt: msg.createdAt || new Date(),
  }));
}

/**
 * Get or create a conversation thread
 *
 * @example
 * const thread = await getOrCreateThread('thread-123', 'user-456');
 */
export async function getOrCreateThread(
  threadId: string,
  resourceId: string,
  title?: string
): Promise<{ id: string; resourceId: string; title?: string }> {
  // Try to get existing thread
  const existing = await memoryStorage.getThreadById({ threadId });

  if (existing) {
    return {
      id: existing.id,
      resourceId: existing.resourceId,
      title: existing.title,
    };
  }

  // Create new thread
  const thread = await memoryStorage.saveThread({
    thread: {
      id: threadId,
      resourceId,
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    },
  });

  return {
    id: thread.id,
    resourceId: thread.resourceId,
    title: thread.title,
  };
}

/**
 * Compile context for an agent prompt
 * Chapter 7 equivalent: WorkingMemory.compileContext()
 *
 * Combines recent messages with semantic search results.
 * Note: Semantic search is handled automatically by Mastra's Memory class
 * when using agent.generate(). This function is for manual context compilation.
 *
 * @example
 * const context = await compileContext('thread-123', 'What mitigations exist?');
 */
export async function compileContext(
  threadId: string,
  query: string,
  options: {
    recentLimit?: number;
  } = {}
): Promise<{
  threadId: string;
  query: string;
  recentMessages: StoredMessage[];
  contextString: string;
}> {
  const { recentLimit = 10 } = options;

  // Get recent messages
  const recentMessages = await getRecentMessages(threadId, recentLimit);

  // Build context string for prompt injection
  const contextString = recentMessages
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n\n');

  return {
    threadId,
    query,
    recentMessages,
    contextString,
  };
}

/**
 * Get all threads for a user/resource
 *
 * @example
 * const threads = await getThreadsByResource('user-123');
 */
export async function getThreadsByResource(
  resourceId: string,
  limit: number = 50
): Promise<Array<{ id: string; title?: string; createdAt: Date }>> {
  // Use Memory instance for proper API compatibility
  const memory = new Memory({
    storage: memoryStorage,
    vector: memoryVector,
    embedder: new ModelRouterEmbeddingModel('openai/text-embedding-3-small'),
  });

  // Use paginated version if limit is needed, otherwise use non-paginated
  let threads;
  if (limit <= 50) {
    // For small limits, use non-paginated version and slice
    threads = await memoryStorage.getThreadsByResourceId({ resourceId });
    threads = threads.slice(0, limit);
  } else {
    // For larger limits, use paginated version
    const result = await memory.getThreadsByResourceIdPaginated({
      resourceId,
      page: 0,
      perPage: limit,
    });
    threads = result.threads;
  }

  return threads.map((t) => ({
    id: t.id,
    title: t.title,
    createdAt: t.createdAt,
  }));
}
