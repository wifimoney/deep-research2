/**
 * Unified Memory Service
 * 
 * Single source of truth for agent memory operations:
 * - Agent conversations (with/without working memory)
 * - Thread management
 * - Message history
 * - Used by agents, workflows, and chat/history endpoints
 */

import { chatAgent } from '../agents/chatAgent.js'
import { standardMemory as memory } from '../../../src/mastra/config/memory.js'
import { storage, ensureStorageInitialized } from '../../../src/mastra/config/storage.js'
import { getWorkingMemorySummary } from './workingMemoryService.js'
import { apiKeysConfig } from '../../../src/mastra/config/config.js'

/**
 * Message type for API responses
 */
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

/**
 * Thread type for API responses
 */
export interface Thread {
  id: string
  title?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Agent response type
 */
export interface AgentResponse {
  userMessage: Message
  assistantMessage: Message
  threadId: string
  workingMemorySummary?: string
}

/**
 * Extract text content from messages
 * Handles various formats from Memory, PostgreSQL storage, and fallback storage
 */
function extractTextContent(msg: any): string {
  // If msg itself is a string, return it
  if (typeof msg === 'string') {
    return msg
  }
  
  // Try msg.text first (some storage formats)
  if (msg.text && typeof msg.text === 'string') {
    return msg.text
  }
  
  const content = msg.content
  
  // Case 1: Direct string content
  if (typeof content === 'string') {
    return content
  }
  
  // Case 2: Content is null/undefined
  if (content == null) {
    // Try to get content from other fields
    if (msg.body && typeof msg.body === 'string') {
      return msg.body
    }
    if (msg.message && typeof msg.message === 'string') {
      return msg.message
    }
    return ''
  }
  
  // Case 3: Object with content.content string (our format + Memory format)
  if (typeof content === 'object' && typeof content.content === 'string') {
    return content.content
  }
  
  // Case 4: V2 format with format field (check before generic parts array)
  if (typeof content === 'object' && content.format === 2 && Array.isArray(content.parts)) {
    // Handle empty parts array - return empty string (valid empty message)
    if (content.parts.length === 0) {
      return ''
    }
    const extracted = content.parts
      .map((part: any) => {
        if (typeof part === 'string') return part
        if (part.type === 'text' && part.text) return part.text
        if (part.text) return part.text
        if (typeof part === 'object' && part.content) return part.content
        return ''
      })
      .filter(Boolean)
      .join('')
    return extracted
  }
  
  // Case 5: Object with parts array (generic, without format field)
  if (typeof content === 'object' && Array.isArray(content.parts)) {
    const text = content.parts
      .map((part: any) => {
        if (typeof part === 'string') return part
        if (part.type === 'text' && part.text) return part.text
        if (part.text) return part.text
        if (typeof part === 'object' && part.content) return part.content
        return ''
      })
      .filter(Boolean)
      .join('')
    if (text) return text
  }
  
  // Case 6: Parts array at top level
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === 'string') return part
        if (part.type === 'text' && part.text) return part.text
        if (part.text) return part.text
        if (typeof part === 'object' && part.content) return part.content
        return ''
      })
      .filter(Boolean)
      .join('')
  }
  
  // Case 7: content.text
  if (typeof content === 'object' && typeof content.text === 'string') {
    return content.text
  }
  
  // Case 8: PostgreSQL storage might store as JSON string
  if (typeof content === 'object' && typeof content.value === 'string') {
    try {
      const parsed = JSON.parse(content.value)
      if (typeof parsed === 'string') return parsed
      if (parsed.content && typeof parsed.content === 'string') return parsed.content
    } catch {
      // Not JSON, continue
    }
  }
  
  // Case 9: Check if content has a 'data' field (some storage formats)
  if (typeof content === 'object' && content.data) {
    if (typeof content.data === 'string') return content.data
    if (Array.isArray(content.data)) {
      return content.data
        .map((item: any) => {
          if (typeof item === 'string') return item
          if (item.text) return item.text
          return ''
        })
        .filter(Boolean)
        .join('')
    }
  }
  
  // Fallback: try to stringify, but avoid circular references
  if (typeof content === 'object') {
    try {
      const stringified = JSON.stringify(content)
      // If it's a very long JSON, it's probably not what we want
      if (stringified.length < 1000) {
        return stringified
      }
    } catch {
      // Circular reference or other error
    }
  }
  
  return String(content || '')
}

/**
 * Send a message and get AI response
 * 
 * Uses chatAgent.generateLegacy() which automatically:
 * 1. Retrieves conversation history via Memory
 * 2. Performs semantic recall to find relevant past messages
 * 3. Saves both user and assistant messages with embeddings
 * 
 * @param userId - The authenticated user's ID (used as resourceId for memory isolation)
 * @param threadId - The conversation thread ID
 * @param message - The user's message
 * @param includeWorkingMemory - Whether to include working memory context (default: false)
 */
export async function sendMessage(
  userId: string,
  threadId: string,
  message: string,
  includeWorkingMemory = false
): Promise<AgentResponse> {
  // Check for required environment variables
  if (!apiKeysConfig.hasAiKey) {
    throw new Error('API key not configured. Please set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable in your .env file.')
  }

  // Ensure storage is initialized
  try {
    await ensureStorageInitialized()
  } catch (error) {
    console.error('[MemoryService] Storage initialization failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Storage initialization failed'
    throw new Error(`Database connection failed: ${errorMessage}`)
  }

  // Ensure thread exists
  try {
    await getOrCreateThread(threadId, userId)
  } catch (error) {
    console.error('[MemoryService] Thread creation failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Thread creation failed'
    throw new Error(`Failed to create or access thread: ${errorMessage}`)
  }

  // Validate message is not empty
  if (!message || message.trim().length === 0) {
    throw new Error('Cannot send empty message')
  }

  // Build the message with optional working memory context
  let enhancedMessage = message
  let workingMemorySummary: string | undefined

  if (includeWorkingMemory) {
    workingMemorySummary = await getWorkingMemorySummary(userId, threadId)
    if (workingMemorySummary && workingMemorySummary.trim().length > 50) {
      enhancedMessage = `${workingMemorySummary}\n\n---\n\nUser Message: ${message}`
    }
  }

  // Verify thread exists and has resourceId before generating
  const thread = await storage.getThreadById({ threadId })
  if (!thread || !thread.resourceId) {
    throw new Error(`Thread ${threadId} not found or missing resourceId. Please ensure thread is created first.`)
  }

  console.log(`[MemoryService] Generating response for thread ${threadId}, resource ${userId}`)
  console.log(`[MemoryService] Using Mastra Memory - messages will be saved automatically with embeddings`)

  // Generate response using the agent with memory context
  // IMPORTANT: agent.generateLegacy() with threadId and resourceId automatically:
  // 1. Retrieves conversation history (last 20 messages) via Memory instance
  // 2. Performs semantic recall to find relevant past messages
  // 3. Saves both user and assistant messages to memory WITH embeddings
  // 4. The Memory instance handles all persistence and embedding generation
  //
  // The agent's Memory instance is configured with:
  // - storage: PostgresStore or LibSQLStore for persistence
  // - vector: PgVector or LibSQLVector for semantic search
  // - embedder: OpenAI text-embedding-3-small for embeddings
  // - semanticRecall: enabled with topK=3, messageRange=2, scope='resource'
  //
  // Using generateLegacy() because the model is AI SDK v4 compatible
  let response
  try {
    response = await chatAgent.generateLegacy(enhancedMessage, {
      resourceId: userId,
      threadId: threadId,
    })
  } catch (error) {
    console.error(`[MemoryService] Error generating response:`, error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(`Failed to generate AI response: ${errorMessage}`)
  }

  if (!response || !response.text) {
    console.error(`[MemoryService] Invalid response from agent:`, response)
    throw new Error('AI agent returned an invalid response')
  }

  console.log(`[MemoryService] Response generated by agent with Memory instance`)

  // Verify messages were saved by the agent's Memory instance
  // This confirms that agent.generateLegacy() properly persisted the messages
  try {
    const verifyResult = await (memory as any).recall({
      threadId,
      resourceId: userId,
      query: '',
    })
    const savedMessages = verifyResult.messages || []
    console.log(`[MemoryService] Memory verification: ${savedMessages.length} messages found in thread ${threadId}`)
    
    if (savedMessages.length === 0) {
      console.warn(`[MemoryService] WARNING: No messages found after generation. This may indicate agent.generateLegacy() did not save messages.`)
    }
  } catch (error) {
    console.error(`[MemoryService] Error verifying message persistence:`, error)
  }

  // Update thread timestamp
  await storage.updateThread({
    id: threadId,
    title: thread.title || 'Chat',
    metadata: thread.metadata || {},
  })

  const now = new Date()
  
  // Generate IDs for the response (these are for the API response, not the stored messages)
  // The actual messages are saved by the agent's Memory instance with its own IDs
  const userMsgId = `msg-${Date.now()}-user`
  const assistantMsgId = `msg-${Date.now()}-assistant`

  return {
    userMessage: {
      id: userMsgId,
      role: 'user',
      content: message,
      createdAt: now,
    },
    assistantMessage: {
      id: assistantMsgId,
      role: 'assistant',
      content: response.text,
      createdAt: now,
    },
    threadId,
    workingMemorySummary,
  }
}

/**
 * Get conversation history for a thread
 * Uses the shared Memory instance's recall method
 */
export async function getHistory(
  userId: string,
  threadId: string
): Promise<Message[]> {
  await ensureStorageInitialized()
  
  console.log(`[MemoryService] getHistory called - threadId: ${threadId}, userId: ${userId}`)
  
  try {
    // Use the shared memory instance's recall method
    const hasRecall = typeof (memory as any).recall === 'function'
    console.log(`[MemoryService] Memory.recall available: ${hasRecall}`)
    
    if (hasRecall) {
      try {
        console.log(`[MemoryService] Using Memory.recall()`)
        const result = await (memory as any).recall({
          threadId,
          resourceId: userId,
          query: '', // Empty query to get all messages
        })
        
        const messages = result.messages || result.uiMessages || []
        console.log(`[MemoryService] Memory.recall returned ${messages.length} messages`)
        
        const formattedMessages = messages
          .filter((msg: any) => msg.role === 'user' || msg.role === 'assistant')
          .map((msg: any) => {
            const extractedContent = extractTextContent(msg)
            if (extractedContent.length === 0) {
              const hasEmptyParts = msg.content?.format === 2 && Array.isArray(msg.content?.parts) && msg.content.parts.length === 0
              if (!hasEmptyParts) {
                console.log(`[MemoryService] Failed to extract content for ${msg.id}`)
              }
            }
            return {
              id: msg.id,
              role: msg.role as 'user' | 'assistant',
              content: extractedContent,
              createdAt: msg.createdAt || new Date(),
            }
          })
          .filter((msg: Message) => msg.content.length > 0)
        
        return formattedMessages
      } catch (recallError) {
        console.error(`[MemoryService] Memory.recall() failed:`, recallError)
        // Fall through to fallback
      }
    }
    
    // Fallback: Use memory's getThreadById to check if thread exists
    console.log(`[MemoryService] Using fallback method for history retrieval`)
    
    const thread = await (memory as any).getThreadById({ threadId })
    if (!thread) {
      console.log(`[MemoryService] Thread ${threadId} not found`)
      return []
    }
    
    console.warn(`[MemoryService] No message retrieval method available - recall failed`)
    return []
  } catch (error) {
    console.error(`[MemoryService] Error getting messages:`, error)
    return []
  }
}

/**
 * Get all threads for a user
 */
export async function getThreads(userId: string): Promise<Thread[]> {
  await ensureStorageInitialized()
  
  try {
    // Use Memory instance method - listThreadsByResourceId
    const result = await (memory as any).listThreadsByResourceId({ resourceId: userId })
    
    // The result may be an object with threads property or an array directly
    const threads = result?.threads || result
    
    // Ensure threads is an array before mapping
    if (!Array.isArray(threads)) {
      console.error(`[MemoryService] listThreadsByResourceId returned non-array:`, typeof result, result)
      return []
    }
    
    console.log(`[MemoryService] Found ${threads.length} threads for user ${userId}`)
    
    // Map and sort threads by updatedAt descending (most recent first)
    const mappedThreads = threads
      .map((t: any) => ({
        id: t.id,
        title: t.title || 'New Chat',
        createdAt: t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt),
        updatedAt: t.updatedAt instanceof Date ? t.updatedAt : new Date(t.updatedAt || t.createdAt),
      }))
      .sort((a, b) => {
        // Sort by updatedAt descending (most recent first)
        const timeA = a.updatedAt.getTime()
        const timeB = b.updatedAt.getTime()
        return timeB - timeA
      })
    
    console.log(`[MemoryService] Returning ${mappedThreads.length} sorted threads`)
    return mappedThreads
  } catch (error) {
    console.error(`[MemoryService] Error getting threads:`, error)
    return []
  }
}

/**
 * Get or create a thread
 * Uses Memory instance methods to ensure thread is properly integrated with the memory system
 */
export async function getOrCreateThread(
  threadId: string,
  userId: string,
  title?: string
): Promise<Thread> {
  await ensureStorageInitialized()
  
  // Try to get existing thread from storage
  const existing = await storage.getThreadById({ threadId })

  if (existing) {
    return {
      id: existing.id,
      title: existing.title,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    }
  }

  // Create thread through storage to ensure proper integration
  const thread = await storage.saveThread({
    thread: {
      id: threadId,
      resourceId: userId,
      title: title || 'New Chat',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  return {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  }
}

/**
 * Create a new thread
 */
export async function createThread(
  userId: string,
  title?: string
): Promise<Thread> {
  const threadId = `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  return getOrCreateThread(threadId, userId, title)
}

/**
 * Delete a thread and its working memory
 */
export async function deleteThread(
  userId: string,
  threadId: string
): Promise<void> {
  await ensureStorageInitialized()

  // Delete the thread from storage
  await storage.deleteThread({ threadId })

  // Also clear working memory for this thread
  const { clearWorkingMemory } = await import('./workingMemoryService.js')
  await clearWorkingMemory(userId, threadId)
}

/**
 * Update thread title
 */
export async function updateThreadTitle(
  threadId: string,
  title: string
): Promise<Thread> {
  await ensureStorageInitialized()

  const existing = await storage.getThreadById({ threadId })
  if (!existing) {
    throw new Error(`Thread ${threadId} not found`)
  }

  await storage.updateThread({
    id: threadId,
    title,
    metadata: existing.metadata || {},
  })

  return {
    id: existing.id,
    title,
    createdAt: existing.createdAt,
    updatedAt: new Date(),
  }
}

/**
 * Clean up empty threads for a user (threads with no messages)
 */
export async function cleanupEmptyThreads(userId: string): Promise<{ deleted: number; kept: number }> {
  await ensureStorageInitialized()
  
  // Get all threads for user
  const threads = await storage.getThreadsByResourceId({ resourceId: userId })
  
  if (!Array.isArray(threads)) {
    console.error(`[MemoryService] listThreadsByResourceId returned non-array:`, typeof threads)
    return { deleted: 0, kept: 0 }
  }
  
  let deleted = 0
  let kept = 0
  
  for (const thread of threads) {
    try {
      // Check if thread has any messages using recall
      let hasMessages = false
      
      if (typeof (memory as any).recall === 'function') {
        const recallResult = await (memory as any).recall({
          threadId: thread.id,
          resourceId: userId,
          query: '',
        })
        hasMessages = (recallResult.messages && recallResult.messages.length > 0)
      }
      
      if (!hasMessages) {
        // Delete empty thread
        await (memory as any).deleteThread({ threadId: thread.id })
        deleted++
        console.log(`[MemoryService] Deleted empty thread: ${thread.id}`)
      } else {
        kept++
      }
    } catch (err) {
      console.error(`[MemoryService] Error checking/deleting thread ${thread.id}:`, err)
      kept++ // Keep thread if we can't check it
    }
  }
  
  console.log(`[MemoryService] Cleanup complete: deleted ${deleted} empty threads, kept ${kept} threads with messages`)
  return { deleted, kept }
}

// Re-export for backward compatibility (will be removed after migration)
export type AgentMessage = Message
export type ChatMessage = Message
export type AgentThread = Thread
export type ChatThread = Thread

// Legacy function names for backward compatibility
export const runAgent = sendMessage

