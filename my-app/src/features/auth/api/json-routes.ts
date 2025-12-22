import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import {
    createUser,
    findUserByEmail,
    findUserByUsername,
} from '../../users/core/userService.js'
import {
    createSession,
    deleteSession,
} from '../../../shared/auth/session-repo.js'
import { verifyPassword, SESSION_COOKIE_OPTIONS } from '../../../shared/auth/utils.js'
import { getSession as getBetterAuthSession, auth as betterAuthInstance } from '../../../shared/auth/index.js'
import { getAuthenticatedUser } from '../../../shared/auth/session.js'

const api = new Hono()

// POST /login - JSON login endpoint
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

// POST /register - JSON register endpoint
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

// POST /logout - JSON logout endpoint
api.post('/logout', async (c) => {
    try {
        // Handle Better Auth session (for OAuth users like Google)
        const betterAuthSession = await getBetterAuthSession(c.req.raw)
        if (betterAuthSession) {
            console.log('Better Auth session found, attempting sign-out...')
            try {
                await betterAuthInstance.api.signOut({ headers: c.req.raw.headers })
                console.log('Better Auth sign-out successful')
            } catch (error) {
                console.error('Better Auth sign-out error:', error)
                // Continue with legacy logout even if Better Auth sign-out fails
            }
        }

        // Handle legacy session (for email/password users)
        const sessionId = getCookie(c, 'session_id')
        if (sessionId) {
            try {
                await deleteSession(sessionId)
            } catch (error) {
                console.error('Legacy session deletion error:', error)
            }
        }

        // Clear legacy session cookie
        deleteCookie(c, 'session_id', { path: '/' })

        return c.json({ success: true, message: 'Logged out successfully' })
    } catch (error) {
        console.error('Logout error:', error)
        return c.json({ success: false, error: 'Failed to logout' }, 500)
    }
})

// GET /me - Get current user
api.get('/me', async (c) => {
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

export default api
