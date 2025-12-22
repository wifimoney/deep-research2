import { Hono } from 'hono'
import { getAuthenticatedUser } from '../../../../shared/auth/session.js'
import { sendMessage, getHistory } from '../core/chat-service.js'

const chat = new Hono()

/**
 * POST /
 * Send a message to the agent and get a response
 * 
 * Body: { threadId: string, message: string, includeWorkingMemory?: boolean }
 */
chat.post('/', async (c) => {
    try {
        const user = await getAuthenticatedUser(c)
        if (!user) {
            return c.json({ success: false, error: 'Not authenticated' }, 401)
        }

        const { threadId, message, includeWorkingMemory = true } = await c.req.json()

        if (!threadId || !message) {
            return c.json({ success: false, error: 'threadId and message are required' }, 400)
        }

        const result = await sendMessage(user.id, threadId, message, includeWorkingMemory)

        return c.json({
            success: true,
            userMessage: result.userMessage,
            assistantMessage: result.assistantMessage,
            threadId: result.threadId,
        })
    } catch (error) {
        console.error('Agent chat error:', error)
        return c.json({ success: false, error: 'Failed to run agent' }, 500)
    }
})

/**
 * GET /history
 * Get conversation history for a thread
 * 
 * Query: threadId
 */
chat.get('/history', async (c) => {
    try {
        const user = await getAuthenticatedUser(c)
        if (!user) {
            return c.json({ success: false, error: 'Not authenticated' }, 401)
        }

        const threadId = c.req.query('threadId')
        if (!threadId) {
            return c.json({ success: false, error: 'threadId is required' }, 400)
        }

        const messages = await getHistory(user.id, threadId)

        return c.json({
            success: true,
            messages,
        })
    } catch (error) {
        console.error('Get history error:', error)
        return c.json({ success: false, error: 'Failed to get history' }, 500)
    }
})

export default chat
