import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { getSessionWithUser, type SessionWithUser } from '../services/userService.js'
import { getSession as getBetterAuthSession } from '../auth/index.js'
import { db, users } from '@repo/db'
import { eq } from 'drizzle-orm'

// Extend Hono's context to include user
declare module 'hono' {
  interface ContextVariableMap {
    user: {
      id: string
      username: string
      email: string
    }
    session: SessionWithUser
  }
}

/**
 * Middleware to require authentication
 * Redirects to login page if not authenticated
 * Checks both Better Auth sessions and legacy sessions
 */
export async function requireAuth(c: Context, next: Next) {
  // First check Better Auth session
  try {
    // Log cookies for debugging
    const cookies = c.req.header('cookie')
    console.log('Request cookies:', cookies?.substring(0, 200)) // Log first 200 chars

    const betterAuthSession = await getBetterAuthSession(c.req.raw)
    console.log('Better Auth session check:', {
      hasSession: !!betterAuthSession,
      sessionUserId: betterAuthSession?.session?.userId,
      userId: betterAuthSession?.user?.id,
      userEmail: betterAuthSession?.user?.email,
      userName: betterAuthSession?.user?.name,
    })

    if (betterAuthSession && betterAuthSession.user) {
      // Get user ID from Better Auth session
      const userId = betterAuthSession.session?.userId || betterAuthSession.user?.id

      if (userId) {
        // Get user from database
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        })

        console.log('Found user in database:', { userId, email: user?.email, name: user?.name })

        if (user) {
          // Use name from Better Auth if available, then database name, then username, then derive from email
          const username = betterAuthSession.user.name || user.name || user.username || user.email?.split('@')[0] || 'User'

          c.set('user', {
            id: user.id,
            username,
            email: user.email || betterAuthSession.user.email || '',
          })
          console.log('User authenticated via Better Auth, proceeding to dashboard')
          await next()
          return
        } else {
          console.warn('Better Auth session found but user not in database:', userId)
        }
      }
    } else {
      console.log('No Better Auth session found')
    }
  } catch (error) {
    console.error('Better Auth session check error:', error)
    // Better Auth session check failed, try legacy session
  }

  // Fallback to legacy session check
  const sessionId = getCookie(c, 'session_id')

  if (!sessionId) {
    return c.redirect('/auth/login')
  }

  try {
    const session = await getSessionWithUser(sessionId)

    if (!session) {
      // Session expired or invalid
      return c.redirect('/auth/login')
    }

    // Attach user to context
    c.set('user', {
      id: session.user_id,
      username: session.username,
      email: session.email,
    })
    c.set('session', session)

    await next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return c.redirect('/auth/login')
  }
}

/**
 * Middleware to redirect authenticated users away from auth pages
 * (e.g., if logged in user visits /login, redirect to dashboard)
 * Checks both Better Auth sessions and legacy sessions
 */
export async function redirectIfAuthenticated(c: Context, next: Next) {
  // Check Better Auth session first
  try {
    const betterAuthSession = await getBetterAuthSession(c.req.raw)
    if (betterAuthSession) {
      return c.redirect('/dashboard')
    }
  } catch {
    // Better Auth session check failed, try legacy session
  }

  // Check legacy session
  const sessionId = getCookie(c, 'session_id')

  if (sessionId) {
    try {
      const session = await getSessionWithUser(sessionId)
      if (session) {
        return c.redirect('/dashboard')
      }
    } catch {
      // Session invalid, continue to auth page
    }
  }

  await next()
}

/**
 * Optional auth middleware - attaches user if authenticated but doesn't require it
 */
export async function optionalAuth(c: Context, next: Next) {
  const sessionId = getCookie(c, 'session_id')

  if (sessionId) {
    try {
      const session = await getSessionWithUser(sessionId)
      if (session) {
        c.set('user', {
          id: session.user_id,
          username: session.username,
          email: session.email,
        })
        c.set('session', session)
      }
    } catch {
      // Ignore errors, user just won't be set
    }
  }

  await next()
}
