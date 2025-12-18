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
import { dashboardAgent } from '../mastra/agents/dashboardAgent.js'
import { standardMemory as memory } from '../mastra/config/memory.js'
import { storage, ensureStorageInitialized } from '../mastra/config/storage.js'
import { getWorkingMemorySummary } from './workingMemoryService.js'
import { apiKeysConfig } from '../mastra/config/config.js'

// Re-export storage for direct access in getThreads
export { storage }

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

  let content = msg.content

  // Case 1: Direct string content
  if (typeof content === 'string') {
    // Check if it's a JSON string that needs parsing
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(content)
        if (typeof parsed === 'object') {
          // Recursively extract from parsed object
          return extractTextContent({ content: parsed })
        }
      } catch (e) {
        // Not valid JSON, use as-is
      }
    }
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

  // Validate inputs
  if (!userId) throw new Error('sendMessage: userId is required')
  if (!threadId) throw new Error('sendMessage: threadId is required')
  if (!message || message.trim().length === 0) throw new Error('sendMessage: Cannot send empty message')

  console.log(`[MemoryService] sendMessage called for thread ${threadId}, user ${userId}`)

  // Ensure storage is initialized
  try {
    await ensureStorageInitialized()
  } catch (error) {
    console.error('[MemoryService] Storage initialization failed:', error)
    throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Ensure thread exists (both in Mastra and Drizzle)
  try {
    await getOrCreateThread(threadId, userId)
  } catch (error) {
    console.error('[MemoryService] Thread creation failed:', error)
    throw new Error(`Failed to create or access thread: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  const now = new Date()
  const userMsgId = `msg-${Date.now()}-user`

  // 1. Store USER message in Mastra Memory
  try {
    console.log(`[MemoryService] Storing USER message in Mastra Memory...`)
    await storage.saveMessages({
      messages: [{
        id: userMsgId,
        threadId,
        resourceId: userId, // Required by Mastra storage
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: message }] },
        createdAt: now,
        type: 'text'
      }]
    })
    console.log(`[MemoryService] USER message stored in Mastra`)
  } catch (error) {
    console.error(`[MemoryService] Failed to store user message in Mastra:`, error)
  }

  // Build enhanced message with working memory
  let enhancedMessage = message
  let workingMemorySummary: string | undefined

  if (includeWorkingMemory) {
    try {
      workingMemorySummary = await getWorkingMemorySummary(userId, threadId)
      if (workingMemorySummary && workingMemorySummary.trim().length > 50) {
        enhancedMessage = `${workingMemorySummary}\n\n---\n\nUser Message: ${message}`
      }
    } catch (err) {
      console.warn('[MemoryService] Failed to get working memory:', err)
    }
  }

  // Generate response
  console.log(`[MemoryService] Generating response...`)
  let responseText = ''

  try {
    // We use generateLegacy but we ignore its internal storage side-effects since we do it manually
    // We pass threadId/resourceId just in case it helps retrieval
    const response = await chatAgent.generateLegacy(enhancedMessage, {
      resourceId: userId,
      threadId: threadId,
    })

    if (!response || !response.text) {
      throw new Error('AI agent returned an invalid response')
    }

    responseText = response.text
  } catch (error) {
    console.error(`[MemoryService] Error generating response:`, error)
    throw new Error(`Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  const assistantMsgId = `msg-${Date.now()}-assistant`
  const assistantCreatedAt = new Date()

  // 2. Store ASSISTANT message in Mastra Memory
  try {
    console.log(`[MemoryService] Storing ASSISTANT message in Mastra Memory...`)
    await storage.saveMessages({
      messages: [{
        id: assistantMsgId,
        threadId,
        resourceId: userId, // Required by Mastra storage
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: responseText }] },
        createdAt: assistantCreatedAt,
        type: 'text'
      }]
    })
    console.log(`[MemoryService] ASSISTANT message stored in Mastra`)
  } catch (error) {
    console.error(`[MemoryService] Failed to store assistant message in Mastra:`, error)
  }

  // Update thread timestamp
  try {
    await storage.updateThread({
      id: threadId,
      title: 'Chat', // We could refine this
      metadata: {},
    })
  } catch (e) {
    console.warn('[MemoryService] Failed to update thread timestamp:', e)
  }

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
      content: responseText,
      createdAt: assistantCreatedAt,
    },
    threadId,
    workingMemorySummary,
  }
}


/**
 * Send a message to the dashboard agent
 */
export async function sendDashboardMessage(
  userId: string,
  threadId: string,
  message: string
): Promise<AgentResponse> {
  // Check for required environment variables
  if (!apiKeysConfig.hasAiKey) {
    throw new Error('API key not configured. Please set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable in your .env file.')
  }

  // Validate inputs
  if (!userId) throw new Error('sendDashboardMessage: userId is required')
  if (!threadId) throw new Error('sendDashboardMessage: threadId is required')
  if (!message || message.trim().length === 0) throw new Error('sendDashboardMessage: Cannot send empty message')

  // Ensure storage is initialized
  await ensureStorageInitialized()

  // Ensure thread exists (both in Mastra and Drizzle)
  await getOrCreateThread(threadId, userId, 'Dashboard Chat')

  const now = new Date()
  const userMsgId = `msg-${Date.now()}-user`

  // 1. Store USER message in Mastra Memory
  try {
    await storage.saveMessages({
      messages: [{
        id: userMsgId,
        threadId,
        resourceId: userId, // Required by Mastra storage
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: message }] },
        createdAt: now,
        type: 'text'
      }]
    })
  } catch (error) {
    console.error(`[MemoryService] Failed to store user message in Mastra:`, error)
  }

  // Generate response
  let responseText = ''

  try {
    const response = await dashboardAgent.generate(message, {
      memory: {
        resource: userId,
        thread: threadId,
      },
    })

    if (!response || !response.text) {
      throw new Error('AI agent returned an invalid response')
    }

    responseText = response.text
  } catch (error) {
    console.error(`[MemoryService] Error generating response:`, error)
    throw new Error(`Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  const assistantMsgId = `msg-${Date.now()}-assistant`
  const assistantCreatedAt = new Date()

  // 2. Store ASSISTANT message in Mastra Memory
  try {
    await storage.saveMessages({
      messages: [{
        id: assistantMsgId,
        threadId,
        resourceId: userId, // Required by Mastra storage
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: responseText }] },
        createdAt: assistantCreatedAt,
        type: 'text'
      }]
    })
  } catch (error) {
    console.error(`[MemoryService] Failed to store assistant message in Mastra:`, error)
  }

  // Update thread timestamp
  try {
    await storage.updateThread({
      id: threadId,
      title: 'Dashboard Chat',
      metadata: {},
    })
  } catch (e: any) {
    console.warn('[MemoryService] Failed to update thread timestamp:', e)
  }

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
      content: responseText,
      createdAt: assistantCreatedAt,
    },
    threadId,
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

  const messagesMap = new Map<string, Message>()

  // 1. Mastra Memory (primary)
  if (messagesMap.size === 0) {
    try {
      const hasRecall = typeof (memory as any).recall === 'function'
      const hasQuery = typeof (memory as any).query === 'function'

      if (hasRecall || hasQuery) {
        // Use query/recall logic
        const result = hasQuery
          ? await (memory as any).query({ threadId, resourceId: userId, selectBy: { last: 50 } })
          : await (memory as any).recall({ threadId, resourceId: userId })

        const messages = result.messages || result.uiMessages || []
        console.log(`[MemoryService] Found ${messages.length} messages in Mastra`)

        messages.forEach((msg: any) => {
          if (!messagesMap.has(msg.id) && (msg.role === 'user' || msg.role === 'assistant')) {
            const content = extractTextContent(msg)
            if (content) {
              messagesMap.set(msg.id, {
                id: msg.id,
                role: msg.role as 'user' | 'assistant',
                content,
                createdAt: msg.createdAt || new Date()
              })
            }
          }
        })
      }
    } catch (error) {
      console.error(`[MemoryService] Error reading from Mastra:`, error)
    }
  }

  // Convert map to array and sort
  const finalMessages = Array.from(messagesMap.values()).sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  console.log(`[MemoryService] Returning ${finalMessages.length} combined messages`)
  return finalMessages
}

/**
 * Get all threads for a user
 */
export async function getThreads(userId: string): Promise<Thread[]> {
  await ensureStorageInitialized()

  try {
    // Beta storage API changed: try a set of possible methods
    const threads =
      (await (storage as any).getThreadsByResource?.({ resourceId: userId })) ??
      (await (storage as any).getThreads?.({ resourceId: userId })) ??
      (await (storage as any).listThreads?.({ resourceId: userId })) ??
      (await (storage as any).getThreadsByResourceId?.({ resourceId: userId })) ?? // legacy
      []

    // Ensure threads is an array before mapping
    if (!Array.isArray(threads)) {
      console.error(`[MemoryService] getThreads returned non-array:`, typeof threads, threads)
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

  // 1. Try to get existing thread from storage
  const existing = await storage.getThreadById({ threadId })

  if (existing) {
    return {
      id: existing.id,
      title: existing.title,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    }
  }

  // 2. Create thread through storage to ensure proper integration
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
  const threads = await getThreads(userId)

  if (!Array.isArray(threads)) {
    console.error(`[MemoryService] listThreadsByResource returned non-array:`, typeof threads)
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

