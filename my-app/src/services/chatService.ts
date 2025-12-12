import { chatAgent } from '../agents/chatAgent.js'
import { memory, storage, ensureStorageInitialized } from '../config/memory.js'

/**
 * Message type for API responses
 */
export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

/**
 * Thread type for API responses
 */
export type ChatThread = {
  id: string
  title?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Extract text content from messages
 * Messages are stored with: { content: "text", parts: [{type:'text', text:'...'}] }
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
 * Uses chatAgent.generateLegacy() which automatically:
 * 1. Retrieves conversation history via Memory
 * 2. Performs semantic recall to find relevant past messages
 * 3. Saves both user and assistant messages with embeddings
 */
export async function sendMessage(
  userId: string,
  threadId: string,
  message: string
): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage }> {
  // Check for required environment variables
  if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error('API key not configured. Please set OPENROUTER_API_KEY environment variable in your .env file.')
  }

  // Ensure storage is initialized
  try {
    await ensureStorageInitialized()
  } catch (error) {
    console.error('[ChatService] Storage initialization failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Storage initialization failed'
    throw new Error(`Database connection failed: ${errorMessage}`)
  }

  // Ensure thread exists
  try {
    await getOrCreateThread(threadId, userId)
  } catch (error) {
    console.error('[ChatService] Thread creation failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Thread creation failed'
    throw new Error(`Failed to create or access thread: ${errorMessage}`)
  }

  // Validate message is not empty
  if (!message || message.trim().length === 0) {
    throw new Error('Cannot send empty message')
  }

  console.log(`[ChatService] Generating response for thread ${threadId}, resource ${userId}`)

  // Generate response using the agent with memory context
  // The agent will retrieve conversation history and perform semantic recall
  // But we'll manually save messages as plain strings to ensure proper storage
  // Using generateLegacy() because the model is AI SDK v4 compatible
  let response
  try {
    response = await chatAgent.generateLegacy(message, {
      resourceId: userId,
      threadId: threadId,
    })
  } catch (error) {
    console.error(`[ChatService] Error generating response:`, error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(`Failed to generate AI response: ${errorMessage}`)
  }

  if (!response || !response.text) {
    console.error(`[ChatService] Invalid response from agent:`, response)
    throw new Error('AI agent returned an invalid response')
  }

  console.log(`[ChatService] Response generated, saving messages as plain strings`)

  // Save messages as plain strings to ensure proper storage
  // This ensures messages are stored with actual text content, not empty format objects
  const userMsgId = `msg-${Date.now()}-user-${Math.random().toString(36).substring(2, 9)}`
  const assistantMsgId = `msg-${Date.now()}-assistant-${Math.random().toString(36).substring(2, 9)}`
  const now = new Date()

  try {
    // Save messages directly as plain strings using storage
    // This ensures content is stored as a string, not as a complex format object
    await storage.saveMessages({
      messages: [
        {
          id: userMsgId,
          threadId,
          role: 'user',
          content: message, // Save as plain string
          createdAt: now,
          type: 'text',
        },
        {
          id: assistantMsgId,
          threadId,
          role: 'assistant',
          content: response.text, // Save as plain string
          createdAt: now,
          type: 'text',
        },
      ],
    })

    console.log(`[ChatService] Messages saved successfully as plain strings`)
  } catch (saveError) {
    console.error(`[ChatService] Error saving messages:`, saveError)
    // Don't throw - the response was generated successfully, saving is secondary
  }

  // Update thread timestamp
  const thread = await storage.getThreadById({ threadId })
  if (thread) {
    await storage.updateThread({
      id: threadId,
      title: thread.title || 'Chat',
      metadata: thread.metadata || {},
    })
  }

  // Return the messages with the IDs we created
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
  }
}

/**
 * Get conversation history for a thread
 * Uses the shared Memory instance's recall method
 */
export async function getHistory(
  userId: string,
  threadId: string
): Promise<ChatMessage[]> {
  // Ensure storage is initialized
  await ensureStorageInitialized()
  
  console.log(`[ChatService] getHistory called - threadId: ${threadId}, userId: ${userId}`)
  
  try {
    // Use the shared memory instance's recall method
    const hasRecall = typeof (memory as any).recall === 'function'
    console.log(`[ChatService] Memory.recall available: ${hasRecall}`)
    
    if (hasRecall) {
      try {
        console.log(`[ChatService] Using Memory.recall()`)
        const result = await (memory as any).recall({
          threadId,
          resourceId: userId,
          query: '', // Empty query to get all messages
        })
        
        const messages = result.messages || result.uiMessages || []
        console.log(`[ChatService] Memory.recall returned ${messages.length} messages`)
        
        // Debug: log the raw message structure for first message
        if (messages.length > 0) {
          const firstMsg = messages[0]
          console.log(`[ChatService] First message structure:`, JSON.stringify({
            id: firstMsg.id,
            role: firstMsg.role,
            contentType: typeof firstMsg.content,
            contentKeys: firstMsg.content && typeof firstMsg.content === 'object' ? Object.keys(firstMsg.content) : null,
            contentSample: typeof firstMsg.content === 'string' 
              ? firstMsg.content.substring(0, 100) 
              : JSON.stringify(firstMsg.content).substring(0, 200)
          }, null, 2))
        }
        
        const formattedMessages = messages
          .filter((msg: any) => msg.role === 'user' || msg.role === 'assistant')
          .map((msg: any) => {
            const extractedContent = extractTextContent(msg)
            if (extractedContent.length === 0) {
              const hasEmptyParts = msg.content?.format === 2 && Array.isArray(msg.content?.parts) && msg.content.parts.length === 0
              if (hasEmptyParts) {
                console.log(`[ChatService] Message ${msg.id} has empty content (format: 2, parts: [])`)
              } else {
                console.log(`[ChatService] Failed to extract content for ${msg.id}:`, JSON.stringify(msg, null, 2))
              }
            }
            return {
              id: msg.id,
              role: msg.role as 'user' | 'assistant',
              content: extractedContent,
              createdAt: msg.createdAt || new Date(),
            }
          })
          .filter((msg: ChatMessage) => msg.content.length > 0)
        
        return formattedMessages
      } catch (recallError) {
        console.error(`[ChatService] Memory.recall() failed:`, recallError)
        // Fall through to fallback
      }
    }
    
    // Fallback: Use memory's getThreadById to check if thread exists
    console.log(`[ChatService] Using fallback method for history retrieval`)
    
    // Use memory's getThreadById
    const thread = await (memory as any).getThreadById({ threadId })
    if (!thread) {
      console.log(`[ChatService] Thread ${threadId} not found`)
      return []
    }
    
    console.warn(`[ChatService] No message retrieval method available - recall failed`)
    return []
  } catch (error) {
    console.error(`[ChatService] Error getting messages:`, error)
    return []
  }
}

/**
 * Get all threads for a user
 */
export async function getThreads(userId: string): Promise<ChatThread[]> {
  // Ensure storage is initialized
  await ensureStorageInitialized()
  
  try {
    // Use Memory instance method - listThreadsByResourceId (same as agentService)
    const result = await (memory as any).listThreadsByResourceId({ resourceId: userId })
    
    // The result may be an object with threads property or an array directly
    const threads = result?.threads || result
    
    // Ensure threads is an array before mapping
    if (!Array.isArray(threads)) {
      console.error(`[ChatService] listThreadsByResourceId returned non-array:`, typeof result, result)
      return []
    }
    
    console.log(`[ChatService] Found ${threads.length} threads for user ${userId}`)
    
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
    
    console.log(`[ChatService] Returning ${mappedThreads.length} sorted threads`)
    return mappedThreads
  } catch (error) {
    console.error(`[ChatService] Error getting threads:`, error)
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
): Promise<ChatThread> {
  // Ensure storage is initialized
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
): Promise<ChatThread> {
  const threadId = `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  return getOrCreateThread(threadId, userId, title)
}

/**
 * Delete a thread
 */
export async function deleteThread(threadId: string): Promise<void> {
  // Ensure storage is initialized
  await ensureStorageInitialized()
  
  await storage.deleteThread({ threadId })
}

/**
 * Clean up empty threads for a user (threads with no messages)
 */
export async function cleanupEmptyThreads(userId: string): Promise<{ deleted: number; kept: number }> {
  // Ensure storage is initialized
  await ensureStorageInitialized()
  
  // Get all threads for user
  const threads = await storage.getThreadsByResourceId({ resourceId: userId })
  
  if (!Array.isArray(threads)) {
    console.error(`[ChatService] listThreadsByResourceId returned non-array:`, typeof threads)
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
        console.log(`[ChatService] Deleted empty thread: ${thread.id}`)
      } else {
        kept++
      }
    } catch (err) {
      console.error(`[ChatService] Error checking/deleting thread ${thread.id}:`, err)
      kept++ // Keep thread if we can't check it
    }
  }
  
  console.log(`[ChatService] Cleanup complete: deleted ${deleted} empty threads, kept ${kept} threads with messages`)
  return { deleted, kept }
}
