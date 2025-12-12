# Message Storage and Retrieval Analysis

## Overview
This document explains how messages are saved, their format, and how they are retrieved in the chat service.

---

## 1. How Messages Are Saved

### Primary Method: `Memory.saveMessages()`

Messages are saved using Mastra's `Memory.saveMessages()` API in `chatService.ts` (lines 233-254):

```typescript
await chatMemory.saveMessages({
  messages: [
    {
      id: userMsgId,              // Format: "msg-{timestamp}-user"
      threadId,                   // Conversation thread ID
      resourceId: thread.resourceId,  // User ID
      role: 'user',               // or 'assistant'
      content: message,           // Plain string format
      createdAt: new Date(),
      type: 'text',
    },
    // ... assistant message with same structure
  ],
})
```

**Key Points:**
- Messages are saved as **plain strings** in the `content` field
- The `Memory` class automatically:
  - Generates embeddings using `openai/text-embedding-3-small`
  - Stores the text content in the database
  - Stores the 1536-dimensional embedding vector for semantic search
- Both user and assistant messages are saved together in a single batch
- Messages are linked to a `threadId` (conversation) and `resourceId` (user)

---

## 2. Database Schema

### Storage Backend
The system supports two backends (determined by `DATABASE_URL`):
- **PostgreSQL** (`postgresql://...`) - Production
- **LibSQL** (`file:./...` or `libsql://...`) - Development

### Database Tables

#### `mastra_threads` (Conversations)
```sql
CREATE TABLE mastra_threads (
    id TEXT PRIMARY KEY,
    resource_id TEXT,          -- User identifier
    title TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
```

#### `mastra_messages` (Messages)
```sql
CREATE TABLE mastra_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,   -- References mastra_threads(id)
    role TEXT NOT NULL,        -- 'user', 'assistant', 'system', 'tool'
    content TEXT NOT NULL,     -- Plain text message content
    embedding vector(1536),    -- OpenAI embedding vector
    tokens INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE
)
```

**Key Features:**
- `content` is stored as **TEXT** (plain string)
- `embedding` is a **1536-dimensional vector** for semantic similarity search
- Vector index (IVFFlat or HNSW) enables fast similarity searches
- Messages are indexed by `thread_id` and `created_at` for efficient retrieval

---

## 3. Message Format

### When Saving (Input Format)
Messages are saved with this structure:
```typescript
{
  id: string,              // "msg-{timestamp}-{role}"
  threadId: string,        // Thread/conversation ID
  resourceId: string,      // User ID
  role: 'user' | 'assistant' | 'system' | 'tool',
  content: string,         // Plain text (not JSON)
  createdAt: Date,
  type: 'text'
}
```

### When Retrieved (Output Format)
Retrieved messages can have complex content structures that need extraction:

1. **Simple string format:**
   ```typescript
   { content: "Hello, how are you?" }
   ```

2. **Nested object format:**
   ```typescript
   { content: { content: "Hello, how are you?" } }
   ```

3. **Parts array format:**
   ```typescript
   { 
     content: { 
       parts: [
         { type: 'text', text: 'Hello, how are you?' }
       ]
     }
   }
   ```

The `extractTextContent()` function (lines 284-407) handles all these formats and extracts the plain text.

---

## 4. How Messages Are Retrieved

### Primary Method: `Memory.query()`

The system uses multiple fallback methods to retrieve messages:

#### Method 1: Semantic Recall (Primary)
```typescript
const result = await chatMemory.query({
  threadId,
  resourceId: userId,
  selectBy: {
    vectorSearchString: message,  // Uses current message for semantic search
  },
  threadConfig: {
    semanticRecall: {
      topK: 3,                    // Get top 3 similar messages
      messageRange: 2,            // Include 2 messages around each match
      scope: 'resource',          // Search across ALL threads for this user
    },
  },
})
```

**How it works:**
1. The current message is embedded using `openai/text-embedding-3-small`
2. Vector similarity search finds semantically similar messages
3. Results include the matched messages plus surrounding context (messageRange)
4. Scope `'resource'` searches across all threads for the user (not just current thread)
5. Returns: `{ messages: [...], uiMessages: [...] }`

#### Method 2: Recent Messages (Fallback)
If semantic recall fails, falls back to:
```typescript
const result = await chatMemory.query({
  threadId,
  resourceId: userId,
  selectBy: {
    last: 20,  // Get last 20 messages from current thread
  },
})
```

#### Method 3: Direct Storage Access (Fallback Chain)
If `Memory.query()` fails, the system tries:
1. `Memory.listMessages()` (if available)
2. `storage.stores.memory.listMessages()` (if available)
3. `storage.listMessages()` (PostgreSQL only, if available)

All fallbacks extract content using `extractTextContent()` to handle format variations.

---

## 5. Semantic Recall Details

### Configuration (in `getChatMemory()`)
```typescript
const memory = new Memory({
  storage: chatStorage,
  vector: chatVector,
  embedder: 'openai/text-embedding-3-small',
  options: {
    lastMessages: 20,              // Default: include last 20 messages
    semanticRecall: {
      topK: 3,                     // Number of similar messages to find
      messageRange: 2,             // Messages around each match to include
      scope: 'resource',           // 'thread' or 'resource' (all user threads)
    },
  },
})
```

### How Semantic Search Works
1. **During Save:** When `saveMessages()` is called:
   - Text content is embedded into a 1536-dimensional vector
   - Both text and vector are stored in `mastra_messages`

2. **During Query:** When `query()` with `vectorSearchString` is called:
   - The query string is embedded into the same vector space
   - Cosine similarity search finds the most similar message embeddings
   - Returns messages ranked by semantic similarity

3. **Vector Similarity Search:**
   ```sql
   -- Example query (simplified)
   SELECT id, content, 1 - (embedding <=> $query_embedding) AS similarity
   FROM mastra_messages
   WHERE resource_id = $userId
   ORDER BY embedding <=> $query_embedding
   LIMIT 3;
   ```

---

## 6. Message Flow Example

### Sending a Message
1. User sends: "What is Log4Shell?"
2. System retrieves context:
   - Uses current message for semantic search
   - Finds 3 similar messages from user's history (across all threads)
   - Gets last 20 messages from current thread
   - Combines both sets
3. LLM generates response using context
4. Both messages saved:
   ```typescript
   {
     id: "msg-1234567890-user",
     role: "user",
     content: "What is Log4Shell?",
     // ... (embeddings auto-generated)
   }
   {
     id: "msg-1234567891-assistant",
     role: "assistant",
     content: "Log4Shell is a critical vulnerability...",
     // ... (embeddings auto-generated)
   }
   ```

### Retrieving History
1. User requests conversation history
2. System queries: `Memory.query({ selectBy: { last: 100 } })`
3. Messages returned in various formats
4. `extractTextContent()` normalizes to plain strings
5. Returns simple format:
   ```typescript
   [
     {
       id: "msg-1234567890-user",
       role: "user",
       content: "What is Log4Shell?",
       createdAt: Date
     },
     // ...
   ]
   ```

---

## 7. Key Files

- **`my-app/src/services/chatService.ts`** - Main chat service implementation
  - `sendMessage()` - Saves messages (line 233)
  - `getHistory()` - Retrieves messages (line 412)
  - `extractTextContent()` - Content format extraction (line 284)

- **`src/mastra/config/memory.ts`** - Memory configuration and helper functions

- **`schema.sql`** - Database schema documentation

---

## 8. Important Notes

1. **Content Format:** Always saved as plain strings, but retrieved formats vary
2. **Embeddings:** Auto-generated by Mastra's Memory class using OpenAI embeddings
3. **Semantic Search:** Searches across all user threads when `scope: 'resource'`
4. **Fallback Chain:** Multiple retrieval methods ensure messages can always be found
5. **Thread Isolation:** Messages are linked to threads, but semantic search can cross threads for a user
6. **Vector Storage:** Embeddings are stored in PostgreSQL (pgvector) or LibSQL, enabling fast similarity search
