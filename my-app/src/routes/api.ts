import { Hono } from 'hono'
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
import {
  sendMessage,
  getHistory,
  getThreads,
  createThread,
  cleanupEmptyThreads,
} from '../services/chatService.js'

const api = new Hono()

// POST /api/login - JSON login endpoint
api.post('/login', async (c) => {
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
api.post('/register', async (c) => {
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
api.post('/logout', async (c) => {
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
api.get('/me', async (c) => {
  const sessionId = getCookie(c, 'session_id')

  if (!sessionId) {
    return c.json({ authenticated: false, user: null })
  }

  try {
    const session = await getSessionWithUser(sessionId)

    if (!session) {
      return c.json({ authenticated: false, user: null })
    }

    return c.json({
      authenticated: true,
      user: {
        id: session.user_id,
        username: session.username,
        email: session.email,
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

// Helper to get authenticated user from session
async function getAuthenticatedUser(c: any) {
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
api.post('/chat', async (c) => {
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) {
      return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const { threadId, message } = await c.req.json()

    if (!threadId || !message) {
      return c.json({ success: false, error: 'threadId and message are required' }, 400)
    }

    const result = await sendMessage(user.id, threadId, message)

    return c.json({
      success: true,
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
    })
  } catch (error) {
    console.error('Chat error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
    return c.json({ success: false, error: errorMessage }, 500)
  }
})

// GET /api/chat/history - Get conversation history for a thread
api.get('/chat/history', async (c) => {
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

// GET /api/chat/threads - List user's threads
api.get('/chat/threads', async (c) => {
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
api.post('/chat/threads', async (c) => {
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
api.post('/chat/cleanup', async (c) => {
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

export default api
