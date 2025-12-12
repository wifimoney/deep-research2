import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { renderLoginPage, renderRegisterPage } from '../views/auth.js'
import {
  createUser,
  findUserByEmail,
  findUserByUsername,
  createSession,
  deleteSession,
} from '../services/userService.js'
import { verifyPassword, SESSION_COOKIE_OPTIONS } from '../utils/auth.js'
import { redirectIfAuthenticated } from '../middleware/auth.js'

const auth = new Hono()

// GET /auth/login - Show login form
auth.get('/login', redirectIfAuthenticated, (c) => {
  return c.html(renderLoginPage())
})

// POST /auth/login - Handle login
auth.post('/login', async (c) => {
  const body = await c.req.parseBody()
  const email = body.email as string
  const password = body.password as string

  // Validate input
  if (!email || !password) {
    return c.html(renderLoginPage('Please fill in all fields.', undefined, undefined, email))
  }

  try {
    // Find user by email
    const user = await findUserByEmail(email)

    if (!user) {
      return c.html(renderLoginPage('Invalid email or password.', undefined, undefined, email))
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash)

    if (!isValidPassword) {
      return c.html(renderLoginPage('Invalid email or password.', undefined, undefined, email))
    }

    // Create session
    const sessionId = await createSession(user.id)

    // Set session cookie
    setCookie(c, 'session_id', sessionId, SESSION_COOKIE_OPTIONS)

    // Redirect to dashboard
    return c.redirect('/dashboard')
  } catch (error) {
    console.error('Login error:', error)
    return c.html(renderLoginPage('An error occurred. Please try again.', undefined, undefined, email))
  }
})

// GET /auth/register - Show register form
auth.get('/register', redirectIfAuthenticated, (c) => {
  return c.html(renderRegisterPage())
})

// POST /auth/register - Handle registration
auth.post('/register', async (c) => {
  const body = await c.req.parseBody()
  const username = body.username as string
  const email = body.email as string
  const password = body.password as string
  const confirmPassword = body.confirmPassword as string

  // Validate input
  if (!username || !email || !password || !confirmPassword) {
    return c.html(renderRegisterPage('Please fill in all fields.', undefined, username, email))
  }

  // Validate username length
  if (username.length < 3 || username.length > 50) {
    return c.html(renderRegisterPage('Username must be between 3 and 50 characters.', undefined, username, email))
  }

  // Validate password length
  if (password.length < 8) {
    return c.html(renderRegisterPage('Password must be at least 8 characters.', undefined, username, email))
  }

  // Check password confirmation
  if (password !== confirmPassword) {
    return c.html(renderRegisterPage('Passwords do not match.', undefined, username, email))
  }

  try {
    // Check if email already exists
    const existingEmail = await findUserByEmail(email)
    if (existingEmail) {
      return c.html(renderRegisterPage('Email is already registered.', undefined, username, email))
    }

    // Check if username already exists
    const existingUsername = await findUserByUsername(username)
    if (existingUsername) {
      return c.html(renderRegisterPage('Username is already taken.', undefined, username, email))
    }

    // Create user
    const user = await createUser(username, email, password)

    // Create session
    const sessionId = await createSession(user.id)

    // Set session cookie
    setCookie(c, 'session_id', sessionId, SESSION_COOKIE_OPTIONS)

    // Redirect to dashboard
    return c.redirect('/dashboard')
  } catch (error) {
    console.error('Registration error:', error)
    return c.html(renderRegisterPage('An error occurred. Please try again.', undefined, username, email))
  }
})

// POST /auth/logout - Handle logout
auth.post('/logout', async (c) => {
  const { getCookie } = await import('hono/cookie')
  const sessionId = getCookie(c, 'session_id')

  if (sessionId) {
    try {
      await deleteSession(sessionId)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Clear session cookie
  deleteCookie(c, 'session_id', { path: '/' })

  // Redirect to login
  return c.redirect('/auth/login')
})

export default auth
