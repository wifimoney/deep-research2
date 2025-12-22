import { dashboardAgent } from '../../../../dashboard/core/dashboard-agent.js'
import { apiKeysConfig } from '../../../../../shared/mastra/config/config.js'
import { getOrCreateThread } from '../../../threads/data/thread-repo.js'
import { ensureStorageInitialized, storage } from '../../../../../shared/mastra/config/storage.js'
import type { AgentResponse } from './SendMessage.js'

export async function sendDashboardMessage(
    userId: string,
    threadId: string,
    message: string,
    googleTokens?: any
): Promise<AgentResponse> {
    // Validate inputs
    if (!apiKeysConfig.hasAiKey) {
        throw new Error('API key not configured.')
    }
    if (!userId) throw new Error('userId is required')
    if (!threadId) throw new Error('threadId is required')
    if (!message || message.trim().length === 0) throw new Error('Cannot send empty message')

    // Ensure storage is initialized
    await ensureStorageInitialized()

    // Ensure thread exists
    await getOrCreateThread(threadId, userId, 'Dashboard Chat')

    const now = new Date()
    const userMsgId = `msg-${Date.now()}-user`

    // 1. Store USER message
    try {
        await storage.saveMessages({
            messages: [{
                id: userMsgId,
                threadId,
                resourceId: userId,
                role: 'user',
                content: { format: 2, parts: [{ type: 'text', text: message }] },
                createdAt: now,
                type: 'text'
            }]
        })
    } catch (error) {
        console.error(`[DashboardMessage] Failed to store user message:`, error)
    }

    // 2. Generate response
    let responseText = ''
    try {
        const promptWithContext = `${message}\n\n[System Note] Current User ID: ${userId}`;
        const response = await dashboardAgent.generate(promptWithContext, {
            resourceId: userId,
            threadId: threadId,
            googleTokens,
        } as any)

        if (!response || !response.text) {
            throw new Error('AI agent returned an invalid response')
        }
        responseText = response.text
    } catch (error) {
        console.error(`[DashboardMessage] Error generating response:`, error)
        throw new Error(`Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    const assistantMsgId = `msg-${Date.now()}-assistant`
    const assistantCreatedAt = new Date()

    // 3. Store ASSISTANT message
    try {
        await storage.saveMessages({
            messages: [{
                id: assistantMsgId,
                threadId,
                resourceId: userId,
                role: 'assistant',
                content: { format: 2, parts: [{ type: 'text', text: responseText }] },
                createdAt: assistantCreatedAt,
                type: 'text'
            }]
        })
    } catch (error) {
        console.error(`[DashboardMessage] Failed to store assistant message:`, error)
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
