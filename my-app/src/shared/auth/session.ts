import { getCookie } from 'hono/cookie'
import { eq } from 'drizzle-orm'
import { getSession as getBetterAuthSession } from './index.js'
import { db } from '../db/drizzle.js'
import { users } from '../db/schema.js'
import { getSessionWithUser } from './session-repo.js'

/**
 * Helper to get authenticated user from session
 * Checks both Better Auth sessions (OAuth) and legacy sessions (email/password)
 */
export async function getAuthenticatedUser(c: any) {
    // First check Better Auth session (for OAuth users like Google)
    try {
        const betterAuthSession = await getBetterAuthSession(c.req.raw)
        if (betterAuthSession?.user) {
            const userId = betterAuthSession.session?.userId || betterAuthSession.user?.id
            if (userId) {
                const user = await db.select().from(users).where(eq(users.id, userId)).then(results => results[0])
                if (user) {
                    // Use name from Better Auth if available, then database name, then username, then derive from email
                    const username = betterAuthSession.user.name || user.name || user.username || user.email?.split('@')[0] || 'User'

                    return {
                        id: user.id,
                        username,
                        email: user.email || betterAuthSession.user.email || '',
                    }
                }
            }
        }
    } catch (error) {
        // Better Auth session check failed, fall through to legacy session check
        console.error('Better Auth session check error in getAuthenticatedUser:', error)
    }

    // Fallback to legacy session check (for email/password users)
    const sessionId = getCookie(c, 'session_id')
    if (!sessionId) return null

    const session = await getSessionWithUser(sessionId)
    if (!session) return null

    return {
        id: session.user_id,
        username: session.username,
        email: session.email,
    }
}
