import { Hono } from 'hono'
import { getAuthenticatedUser } from '../../../shared/auth/session.js'
import { db } from '../../../shared/db/drizzle.js'
import { oauthAccounts } from '../../../shared/db/schema.js'
import { eq, and } from 'drizzle-orm'
import { googleService } from '../../integrations/google/core/google-service.js'
import { sendDashboardMessage } from '../../agent/chat/core/chat-service.js'

const dashboard = new Hono()

// GET /gmail - List Gmail emails
dashboard.get('/gmail', async (c: any) => {
    try {
        const user = await getAuthenticatedUser(c)
        if (!user) {
            return c.json({ success: false, error: 'Not authenticated' }, 401)
        }

        const query = c.req.query('q')
        const maxResults = Number(c.req.query('maxResults')) || 10

        const messages = await googleService.listGmail(user.id, query, maxResults)

        return c.json({
            success: true,
            messages,
        })
    } catch (error) {
        console.error('='.repeat(60))
        console.error('List Gmail error:', error)
        if (error instanceof Error) {
            console.error('Error message:', error.message)
            console.error('Error stack:', error.stack)
            // Check for 403/scope errors
            if (error.message.includes('403') || error.message.includes('insufficient') || error.message.includes('scope')) {
                console.error('⚠️  SCOPE ERROR DETECTED: OAuth token missing Gmail scopes!')
                console.error('   Solution: Re-authenticate with Google to get new token with gmail.readonly scope')
            }
        }
        console.error('='.repeat(60))
        const errorMessage = error instanceof Error ? error.message : 'Failed to list emails'
        return c.json({ success: false, error: errorMessage }, 500)
    }
})

// GET /contacts - List Google Contacts
dashboard.get('/contacts', async (c: any) => {
    try {
        const user = await getAuthenticatedUser(c)
        if (!user) {
            return c.json({ success: false, error: 'Not authenticated' }, 401)
        }

        const maxResults = Number(c.req.query('maxResults')) || 20

        const contacts = await googleService.listContacts(user.id, maxResults)

        return c.json({
            success: true,
            contacts,
        })
    } catch (error) {
        console.error('='.repeat(60))
        console.error('List Contacts error:', error)
        if (error instanceof Error) {
            console.error('Error message:', error.message)
            console.error('Error stack:', error.stack)
            // Check for 403/scope errors
            if (error.message.includes('403') || error.message.includes('insufficient') || error.message.includes('scope')) {
                console.error('⚠️  SCOPE ERROR DETECTED: OAuth token missing Contacts scopes!')
                console.error('   Solution: Re-authenticate with Google to get new token with contacts.readonly scope')
            }
        }
        console.error('='.repeat(60))
        const errorMessage = error instanceof Error ? error.message : 'Failed to list contacts'
        return c.json({ success: false, error: errorMessage }, 500)
    }
})

// POST /query - Natural language query about dashboard data
dashboard.post('/query', async (c: any) => {
    try {
        const user = await getAuthenticatedUser(c)
        if (!user) {
            return c.json({ success: false, error: 'Not authenticated' }, 401)
        }

        const { message, threadId } = await c.req.json()

        if (!message) {
            return c.json({ success: false, error: 'message is required' }, 400)
        }

        // Use provided threadId or create a new one
        // Note: We use a distinct prefix 'dash-' but it's just a string convention
        const activeThreadId = threadId || `dash-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

        // Fetch Google OAuth tokens
        console.log(`[Dashboard] Fetching Google tokens for user ${user.id}...`)
        // Using simple query via Drizzle (db.select().from()...) might be safer if query builder is not setup
        // But existing code used db.query.oauthAccounts.findFirst
        // Assuming db is correctly imported from shared/db/drizzle.js which has schema

        // Using query builder syntax
        const googleTokens = await db.query.oauthAccounts.findFirst({
            where: and(
                eq(oauthAccounts.userId, user.id),
                eq(oauthAccounts.providerId, 'google')
            )
        })

        if (googleTokens) {
            console.log('[Dashboard] ✅ Found Google tokens:', {
                hasAccessToken: !!googleTokens.accessToken,
                hasRefreshToken: !!googleTokens.refreshToken,
                expiresAt: googleTokens.accessTokenExpiresAt
            })
        } else {
            console.warn(`[Dashboard] ❌ No Google tokens found for user ${user.id}`)
        }

        const result = await sendDashboardMessage(user.id, activeThreadId, message, googleTokens)

        return c.json({
            success: true,
            userMessage: result.userMessage,
            assistantMessage: result.assistantMessage,
            threadId: result.threadId,
        })
    } catch (error) {
        console.error('Dashboard query error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to process query'
        return c.json({ success: false, error: errorMessage }, 500)
    }
})

export default dashboard
