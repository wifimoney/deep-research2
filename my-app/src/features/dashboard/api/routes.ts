import { Hono } from 'hono'
import { safeHandler } from '../../../shared/api/safeHandler.js'
import { getAuthenticatedUser } from '../../../shared/auth/session.js'
import { listGmail } from '../../integrations/google/core/usecases/ListGmail.js'
import { listContacts } from '../../integrations/google/core/usecases/ListContacts.js'
import { sendDashboardMessage } from '../../agent/chat/core/usecases/SendDashboardMessage.js'
import { getGoogleTokensForUser } from '../core/usecases/GetGoogleTokensForUser.js'

const dashboard = new Hono()

// GET /gmail
dashboard.get('/gmail', safeHandler(async (c: any) => {
    const user = await getAuthenticatedUser(c)
    if (!user) {
        return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const query = c.req.query('q')
    const maxResults = Number(c.req.query('maxResults')) || 10

    const messages = await listGmail(user.id, query, maxResults)

    return c.json({
        success: true,
        messages,
    })
}))

// GET /contacts
dashboard.get('/contacts', safeHandler(async (c: any) => {
    const user = await getAuthenticatedUser(c)
    if (!user) {
        return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const maxResults = Number(c.req.query('maxResults')) || 20

    const contacts = await listContacts(user.id, maxResults)

    return c.json({
        success: true,
        contacts,
    })
}))

// POST /query
dashboard.post('/query', safeHandler(async (c: any) => {
    const user = await getAuthenticatedUser(c)
    if (!user) {
        return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const { message, threadId } = await c.req.json()

    if (!message) {
        return c.json({ success: false, error: 'message is required' }, 400)
    }

    const activeThreadId = threadId || `dash-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    console.log(`[Dashboard] Fetching Google tokens for user ${user.id}...`)
    const googleTokens = await getGoogleTokensForUser(user.id)

    const result = await sendDashboardMessage(user.id, activeThreadId, message, googleTokens)

    return c.json({
        success: true,
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage,
        threadId: result.threadId,
    })
}))

export default dashboard

