import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { getSessionWithUser, type SessionWithUser } from '../services/userService.js'

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
 */
export async function requireAuth(c: Context, next: Next) {
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
 */
export async function redirectIfAuthenticated(c: Context, next: Next) {
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
