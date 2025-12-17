import { Hono } from 'hono'
import type { Context } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import {
  createUser,
  findUserByEmail,
  findUserByUsername,
  createSession,
  deleteSession,
  getSessionWithUser,
} from '../services/userService.js'
import { verifyPassword, SESSION_COOKIE_OPTIONS } from '../utils/auth.js'
import { getSession as getBetterAuthSession } from '../auth/index.js'
import { db, users } from '@repo/db'
import { eq } from 'drizzle-orm'
import {
  sendMessage,
  sendDashboardMessage,
  getHistory,
  getThreads,
  createThread,
  cleanupEmptyThreads,
} from '../services/memoryService.js'
import { googleService } from '../services/googleService.js'

const api = new Hono()

// POST /api/login - JSON login endpoint
api.post('/login', async (c: Context) => {
  try {
    const { email, password } = await c.req.json()

    // Validate input
    if (!email || !password) {
      return c.json({ success: false, error: 'Email and password are required' }, 400)
    }

    // Find user by email
    const user = await findUserByEmail(email)

    if (!user) {
      return c.json({ success: false, error: 'Invalid email or password' }, 401)
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash)

    if (!isValidPassword) {
      return c.json({ success: false, error: 'Invalid email or password' }, 401)
    }

    // Create session
    const sessionId = await createSession(user.id)

    // Set session cookie
    setCookie(c, 'session_id', sessionId, SESSION_COOKIE_OPTIONS)

    return c.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('API Login error:', error)
    return c.json({ success: false, error: 'An error occurred' }, 500)
  }
})

// POST /api/register - JSON register endpoint
api.post('/register', async (c: Context) => {
  try {
    const { username, email, password, confirmPassword } = await c.req.json()

    // Validate input
    if (!username || !email || !password || !confirmPassword) {
      return c.json({ success: false, error: 'All fields are required' }, 400)
    }

    // Validate username length
    if (username.length < 3 || username.length > 50) {
      return c.json({ success: false, error: 'Username must be between 3 and 50 characters' }, 400)
    }

    // Validate password length
    if (password.length < 8) {
      return c.json({ success: false, error: 'Password must be at least 8 characters' }, 400)
    }

    // Check password confirmation
    if (password !== confirmPassword) {
      return c.json({ success: false, error: 'Passwords do not match' }, 400)
    }

    // Check if email already exists
    const existingEmail = await findUserByEmail(email)
    if (existingEmail) {
      return c.json({ success: false, error: 'Email is already registered' }, 400)
    }

    // Check if username already exists
    const existingUsername = await findUserByUsername(username)
    if (existingUsername) {
      return c.json({ success: false, error: 'Username is already taken' }, 400)
    }

    // Create user
    const user = await createUser(username, email, password)

    // Create session
    const sessionId = await createSession(user.id)

    // Set session cookie
    setCookie(c, 'session_id', sessionId, SESSION_COOKIE_OPTIONS)

    return c.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('API Register error:', error)
    return c.json({ success: false, error: 'An error occurred' }, 500)
  }
})

// POST /api/logout - JSON logout endpoint
api.post('/logout', async (c: Context) => {
  const sessionId = getCookie(c, 'session_id')

  if (sessionId) {
    try {
      await deleteSession(sessionId)
    } catch (error) {
      console.error('API Logout error:', error)
    }
  }

  // Clear session cookie
  deleteCookie(c, 'session_id', { path: '/' })

  return c.json({ success: true })
})

// GET /api/me - Get current user
api.get('/me', async (c: Context) => {
  try {
    const user = await getAuthenticatedUser(c)

    if (!user) {
      return c.json({ authenticated: false, user: null })
    }

    return c.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('API Me error:', error)
    return c.json({ authenticated: false, user: null })
  }
})

// ============================================================================
// Chat API Endpoints
// ============================================================================

/**
 * Helper to get authenticated user from session
 * Checks both Better Auth sessions (OAuth) and legacy sessions (email/password)
 */
async function getAuthenticatedUser(c: Context) {
  // First check Better Auth session (for OAuth users like Google)
  try {
    const betterAuthSession = await getBetterAuthSession(c.req.raw)
    if (betterAuthSession?.user) {
      const userId = betterAuthSession.session?.userId || betterAuthSession.user?.id
      if (userId) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        })
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

// POST /api/chat - Send a message and get AI response
api.post('/chat', async (c: Context) => {
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) {
      return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const body = await c.req.json()
    let { threadId, message } = body

    if (!message) {
      return c.json({ success: false, error: 'message is required' }, 400)
    }

    // Generate threadId if not provided (User Requirement 3)
    if (!threadId) {
      threadId = `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }

    const result = await sendMessage(user.id, threadId, message)

    return c.json({
      success: true,
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
      threadId: result.threadId, // Ensure frontend gets the ID back
    })
  } catch (error) {
    console.error('Chat error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
    return c.json({ success: false, error: errorMessage }, 500)
  }
})

// GET /api/chat/history - Get conversation history for a thread
api.get('/chat/history', async (c: Context) => {
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
      messages: messages || [], // Ensure we always return an array
    })
  } catch (error) {
    console.error('Get history error:', error)
    // Fix infinite loop: Return empty array instead of error (User Requirement 6)
    return c.json({
      success: true,
      messages: []
    })
  }
})

// GET /api/chat/threads - List user's threads
api.get('/chat/threads', async (c: Context) => {
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) {
      return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const threads = await getThreads(user.id)

    return c.json({
      success: true,
      threads,
    })
  } catch (error) {
    console.error('Get threads error:', error)
    return c.json({ success: false, error: 'Failed to get threads' }, 500)
  }
})

// POST /api/chat/threads - Create a new thread
api.post('/chat/threads', async (c: Context) => {
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) {
      return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const { title } = await c.req.json().catch(() => ({}))

    const thread = await createThread(user.id, title)

    return c.json({
      success: true,
      thread,
    })
  } catch (error) {
    console.error('Create thread error:', error)
    return c.json({ success: false, error: 'Failed to create thread' }, 500)
  }
})

// POST /api/chat/cleanup - Clean up empty threads (one-time use)
api.post('/chat/cleanup', async (c: Context) => {
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) {
      return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const result = await cleanupEmptyThreads(user.id)

    return c.json({
      success: true,
      message: `Cleanup complete: deleted ${result.deleted} empty threads, kept ${result.kept} threads with messages`,
      ...result,
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return c.json({ success: false, error: 'Failed to cleanup threads' }, 500)
  }
})

// ============================================================================
// Dashboard API Endpoints
// ============================================================================

// GET /api/dashboard/gmail - List Gmail emails
api.get('/dashboard/gmail', async (c: Context) => {
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
    console.error('List Gmail error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to list emails'
    
    // Check if the error is about missing Google account
    if (errorMessage.includes('NO_GOOGLE_ACCOUNT') || errorMessage.includes('NO_ACCESS_TOKEN')) {
      // Extract user-friendly message (after the error code prefix)
      const friendlyMessage = errorMessage.split(': ')[1] || errorMessage
      return c.json({ 
        success: false, 
        error: friendlyMessage,
        requiresGoogleAuth: true 
      }, 401)
    }
    
    return c.json({ success: false, error: errorMessage }, 500)
  }
})

// GET /api/dashboard/contacts - List Google Contacts
api.get('/dashboard/contacts', async (c: Context) => {
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
    console.error('List Contacts error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to list contacts'
    
    // Check if the error is about missing Google account
    if (errorMessage.includes('NO_GOOGLE_ACCOUNT') || errorMessage.includes('NO_ACCESS_TOKEN')) {
      // Extract user-friendly message (after the error code prefix)
      const friendlyMessage = errorMessage.split(': ')[1] || errorMessage
      return c.json({ 
        success: false, 
        error: friendlyMessage,
        requiresGoogleAuth: true 
      }, 401)
    }
    
    return c.json({ success: false, error: errorMessage }, 500)
  }
})

// POST /api/dashboard/query - Natural language query about dashboard data
api.post('/dashboard/query', async (c: Context) => {
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

    const result = await sendDashboardMessage(user.id, activeThreadId, message)

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


export default api
