import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { safeHandler } from '../../../shared/api/safeHandler.js'
import { loginUser } from '../core/usecases/LoginUser.js'
import { registerUser } from '../core/usecases/RegisterUser.js'
import { logoutUser } from '../core/usecases/LogoutUser.js'
import { getAuthenticatedUser } from '../../../shared/auth/session.js'
import { SESSION_COOKIE_OPTIONS } from '../../../shared/auth/utils.js'
import { getSession as getBetterAuthSession, auth as betterAuthInstance } from '../../../shared/auth/index.js'

const api = new Hono()

// POST /login
api.post('/login', safeHandler(async (c) => {
    const { email, password } = await c.req.json()

    // Call Use Case
    const result = await loginUser(email, password)

    if (!result.success) {
        return c.json({ success: false, error: result.error }, 401)
    }

    // Set cookie
    if (result.session_id) {
        setCookie(c, 'session_id', result.session_id, SESSION_COOKIE_OPTIONS)
    }

    return c.json({
        success: true,
        user: result.user,
    })
}))

// POST /register
api.post('/register', safeHandler(async (c) => {
    const { username, email, password, confirmPassword } = await c.req.json()

    // Validate input (Validation Layer)
    if (!username || !email || !password || !confirmPassword) {
        return c.json({ success: false, error: 'All fields are required' }, 400)
    }

    if (username.length < 3 || username.length > 50) {
        return c.json({ success: false, error: 'Username must be between 3 and 50 characters' }, 400)
    }

    if (password.length < 8) {
        return c.json({ success: false, error: 'Password must be at least 8 characters' }, 400)
    }

    if (password !== confirmPassword) {
        return c.json({ success: false, error: 'Passwords do not match' }, 400)
    }

    // Call Use Case
    const result = await registerUser(username, email, password)

    if (!result.success) {
        return c.json({ success: false, error: result.error }, 400)
    }

    // Set cookie
    if (result.session_id) {
        setCookie(c, 'session_id', result.session_id, SESSION_COOKIE_OPTIONS)
    }

    return c.json({
        success: true,
        user: result.user
    })
}))

// POST /logout
api.post('/logout', safeHandler(async (c) => {
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

    // Handle legacy session
    const sessionId = getCookie(c, 'session_id')
    if (sessionId) {
        await logoutUser(sessionId)
    }

    // Clear legacy session cookie
    deleteCookie(c, 'session_id', { path: '/' })

    return c.json({ success: true, message: 'Logged out successfully' })
}))

// GET /me
api.get('/me', safeHandler(async (c) => {
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
}))

export default api
