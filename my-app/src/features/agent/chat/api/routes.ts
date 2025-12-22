import { Hono } from 'hono'
import { safeHandler } from '../../../../shared/api/safeHandler.js'
import { getAuthenticatedUser } from '../../../../shared/auth/session.js'
import { sendMessage } from '../core/usecases/SendMessage.js'
import { getHistory } from '../core/usecases/GetHistory.js'

const chat = new Hono()

// POST /
chat.post('/', safeHandler(async (c) => {
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
}))

// GET /history
chat.get('/history', safeHandler(async (c) => {
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
}))

export default chat
