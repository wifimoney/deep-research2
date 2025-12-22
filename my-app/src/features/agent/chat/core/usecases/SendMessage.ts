import { chatAgent } from '../../../agents/chatAgent.js'
import { apiKeysConfig } from '../../../../../shared/mastra/config/config.js'
import { getWorkingMemorySummary } from '../../../memory/core/usecases/GetWorkingMemorySummary.js'
import { getOrCreateThread } from '../../../threads/data/thread-repo.js'
import { storeMessage, updateThreadTimestamp, type Message } from '../../data/chat-repo.js'

export interface AgentResponse {
    userMessage: Message
    assistantMessage: Message
    threadId: string
    workingMemorySummary?: string
}

export async function sendMessage(
    userId: string,
    threadId: string,
    message: string,
    includeWorkingMemory = false,
    googleTokens?: any
): Promise<AgentResponse> {
    // Validation
    if (!apiKeysConfig.hasAiKey) {
        throw new Error('API key not configured.')
    }
    if (!userId || !threadId) throw new Error('userId and threadId are required')
    if (!message || message.trim().length === 0) throw new Error('Cannot send empty message')

    // Ensure thread exists
    await getOrCreateThread(threadId, userId)

    const now = new Date()

    // 1. Store User Message
    const userMsgId = await storeMessage(threadId, userId, 'user', message, now)

    // 2. Build Context (Working Memory)
    let enhancedMessage = message
    let workingMemorySummary: string | undefined

    if (includeWorkingMemory) {
        try {
            workingMemorySummary = await getWorkingMemorySummary(userId, threadId)
            if (workingMemorySummary && workingMemorySummary.trim().length > 50) {
                enhancedMessage = `${workingMemorySummary}\n\n---\n\nUser Message: ${message}`
            }
        } catch (err) {
            console.warn('[SendMessage] Failed to get working memory:', err)
        }
    }

    // 3. Generate Response
    let responseText = ''
    try {
        const response = await chatAgent.generateLegacy(enhancedMessage, {
            resourceId: userId,
            threadId: threadId,
            googleTokens,
        } as any)

        if (!response || !response.text) {
            throw new Error('AI agent returned an invalid response')
        }
        responseText = response.text
    } catch (error) {
        console.error(`[SendMessage] Error - `, error)
        throw new Error(`Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    const assistantCreatedAt = new Date()

    // 4. Store Assistant Message
    const assistantMsgId = await storeMessage(threadId, userId, 'assistant', responseText, assistantCreatedAt)

    // 5. Update Thread Timestamp
    await updateThreadTimestamp(threadId)

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
