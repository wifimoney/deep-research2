import "./instrument.js";
import 'dotenv/config'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import * as Sentry from "@sentry/node"
import authRoutes from './routes/auth.js'
import apiRoutes from './routes/api.js'
import { requireAuth } from './middleware/auth.js'
import { renderDashboard } from './views/auth.js'
import { handleRequest } from './auth/index.js'
import { closePool } from '@repo/db'
import { serverConfig } from './mastra/config/config.js'
import { Dashboard } from './components/Dashboard.js'

const app = new Hono()

// Base URL for redirects
const baseURL = process.env.BASE_URL || `http://localhost:${serverConfig.port}`

// Middleware
app.use('*', logger())
app.use('/api/*', cors({
  origin: ['http://localhost:3000'],
  credentials: true,
}))

// Global Error Handler
app.onError((err: Error, c: Context) => {
  console.error('❌ Global Error:', err)
  Sentry.captureException(err)
  return c.text('Internal Server Error', 500)
})

// Mount Better Auth handler for OAuth (must be before other /api routes)
// Better Auth handles routes like /api/auth/sign-in/google, /api/auth/callback/google, etc.
// Use app.on() to match the exact route pattern as shown in Better Auth docs
app.on(['POST', 'GET', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], '/api/auth/*', async (c: Context) => {
  const pathname = new URL(c.req.url).pathname
  console.log('Better Auth route matched:', pathname, c.req.method)

  // Intercept error page requests and redirect to login with helpful message
  if (pathname === '/api/auth/error') {
    const url = new URL(c.req.url)
    const errorParam = url.searchParams.get('error')
    const errorDescription = url.searchParams.get('error_description')
    
    console.error('Better Auth error page accessed:', errorParam)
    console.error('Error description:', errorDescription)
    
    Sentry.captureMessage(`Better Auth error page accessed: ${errorParam}`, {
      level: 'error',
      extra: {
        error: errorParam,
        description: errorDescription,
        fullUrl: c.req.url
      }
    })
    
    // Create a user-friendly error message
    let userMessage = 'Authentication failed. Please try again.'
    if (errorParam === 'access_denied') {
      userMessage = 'You denied access to your Google account. Please try again and grant the necessary permissions.'
    } else if (errorParam === 'invalid_request') {
      userMessage = 'Invalid authentication request. Please contact support if this persists.'
    } else if (errorDescription) {
      userMessage = `Authentication error: ${errorDescription}`
    }
    
    // Redirect to login with error message
    const loginUrl = new URL('/auth/login', c.req.url)
    loginUrl.searchParams.set('error', userMessage)
    return c.redirect(loginUrl.toString())
  }

  // Handle OAuth callback - ensure it redirects to dashboard
  if (pathname.startsWith('/api/auth/callback/')) {
    console.log('OAuth callback detected:', pathname)
    const url = new URL(c.req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    
    console.log('Callback query params:', {
      code: code ? 'present' : 'missing',
      state: state ? 'present' : 'missing',
      error: error || 'none',
    })
    
    // Check for missing required OAuth parameters
    if (!code && !error) {
      const errorMsg = 'OAuth callback missing required "code" parameter. This may indicate a misconfigured OAuth redirect URI or an incomplete OAuth flow.'
      console.error('❌', errorMsg)
      console.error('Full callback URL:', c.req.url)
      console.error('Expected redirect URI should be:', `${baseURL}/api/auth/callback/google`)
      Sentry.captureMessage(errorMsg, {
        level: 'error',
        extra: {
          pathname,
          fullUrl: c.req.url,
          hasCode: !!code,
          hasState: !!state,
          error: error || 'none',
          expectedRedirectUri: `${baseURL}/api/auth/callback/google`
        }
      })
    }
    
    if (!state && !error) {
      const errorMsg = 'OAuth callback missing "state" parameter. This is a security risk and indicates an OAuth flow issue.'
      console.error('❌', errorMsg)
      Sentry.captureMessage(errorMsg, {
        level: 'warning',
        extra: {
          pathname,
          fullUrl: c.req.url,
        }
      })
    }
  }

  try {
    // Wrap Better Auth handler to catch any errors
    let response: Response
    try {
      response = await handleRequest(c.req.raw)
    } catch (handlerError) {
      console.error('❌ Better Auth handler threw an error:', handlerError)
      Sentry.captureException(handlerError)
      if (handlerError instanceof Error) {
        console.error('Error message:', handlerError.message)
        console.error('Error stack:', handlerError.stack)
        
        // Check for common OAuth configuration errors
        if (handlerError.message.includes('redirect_uri_mismatch') || 
            handlerError.message.includes('redirect_uri')) {
          console.error('⚠️ REDIRECT URI MISMATCH DETECTED!')
          console.error('Expected redirect URI should be:', `${baseURL}/api/auth/callback/google`)
          console.error('Please verify this matches your Google OAuth Console configuration')
          Sentry.captureMessage('OAuth redirect URI mismatch detected', {
            level: 'error',
            extra: {
              error: handlerError.message,
              expectedUri: `${baseURL}/api/auth/callback/google`,
              baseURL,
              pathname
            }
          })
        }
      }
      // If it's a callback, redirect to login with error message
      if (pathname.startsWith('/api/auth/callback/')) {
        const loginUrl = new URL('/auth/login', c.req.url)
        loginUrl.searchParams.set('error', 'Google sign-in failed. Please try again or contact support.')
        return c.redirect(loginUrl.toString())
      }
      throw handlerError
    }

    console.log('Better Auth response status:', response.status, 'for path:', pathname)

    // If this is a callback, check for errors and log them
    if (pathname.startsWith('/api/auth/callback/')) {
      const location = response.headers.get('location')
      console.log('OAuth callback redirect location:', location)
      console.log('Response status:', response.status)

      // If redirecting to error page, log the error details
      if (location?.includes('/error')) {
        const locationUrl = new URL(location, c.req.url)
        const errorParam = locationUrl.searchParams.get('error')
        const errorDescription = locationUrl.searchParams.get('error_description')
        
        console.error('❌ OAuth callback error:', errorParam)
        console.error('Error description:', errorDescription)
        
        Sentry.captureMessage(`OAuth callback error redirect: ${errorParam}`, {
          level: 'error',
          extra: {
            error: errorParam,
            description: errorDescription,
            redirectLocation: location,
            callbackUrl: c.req.url
          }
        })

        // Try to get error details from response body
        try {
          const responseText = await response.clone().text()
          console.error('Error response body:', responseText.substring(0, 500))
        } catch (e) {
          console.error('Could not read error response body')
        }

        // Redirect to login with helpful error message instead of dashboard
        let userMessage = 'Google sign-in failed. Please try again.'
        if (errorParam === 'access_denied') {
          userMessage = 'You denied access to your Google account. Please grant the necessary permissions to continue.'
        } else if (errorParam === 'invalid_grant') {
          userMessage = 'Google authentication expired or was revoked. Please sign in again.'
        } else if (errorDescription) {
          userMessage = `Google sign-in error: ${errorDescription}`
        }
        
        const loginUrl = new URL('/auth/login', c.req.url)
        loginUrl.searchParams.set('error', userMessage)
        return c.redirect(loginUrl.toString())
      }

      // Success case - redirect to dashboard with cookies
      if (response.status === 302 || response.status === 200) {
        console.log('✅ OAuth callback successful, redirecting to dashboard')

        // Get all cookies from Better Auth response
        const setCookieHeaders = response.headers.getSetCookie()
        console.log('Better Auth cookies:', setCookieHeaders.length, 'cookies')
        setCookieHeaders.forEach((cookie, i) => {
          console.log(`  Cookie ${i + 1}:`, cookie.substring(0, 100))
        })

        // Create redirect response with all Better Auth cookies preserved
        const redirectUrl = new URL('/dashboard', c.req.url)
        const redirectResponse = new Response(null, {
          status: 302,
          headers: {
            'Location': redirectUrl.toString(),
          },
        })

        // Copy all Set-Cookie headers from Better Auth response
        setCookieHeaders.forEach(cookie => {
          redirectResponse.headers.append('Set-Cookie', cookie)
        })

        return redirectResponse
      }
    }

    // Check if response is an error page (status 500 or error in URL)
    if (response.status >= 500 || pathname.includes('/error')) {
      const responseText = await response.clone().text().catch(() => '')
      console.error('Better Auth error response:', responseText.substring(0, 500))

      if (responseText.includes('error') || response.status >= 500) {
        console.error('Better Auth returned error response, redirecting to dashboard')
        Sentry.captureMessage(`Better Auth returned error response ${response.status}: ${responseText.substring(0, 200)}`, 'error')
        return c.redirect('/dashboard')
      }
    }

    return response
  } catch (error) {
    console.error('❌ Better Auth handler error:', error)
    Sentry.captureException(error)
    if (error instanceof Error) {
      console.error('Error stack:', error.stack)
    }
    // On error, try to redirect to dashboard (user might be logged in)
    return c.redirect('/dashboard')
  }
})

// Mount auth routes at /auth (form-based)
app.route('/auth', authRoutes)

// Mount API routes at /api (JSON-based)
app.route('/api', apiRoutes)

// Protected routes
app.get('/dashboard', requireAuth, (c: Context) => {
  const user = c.get('user')
  return c.html(Dashboard({ username: user.username, email: user.email }))
})

// Root redirect
app.get('/', (c: Context) => {
  return c.redirect('/auth/login')
})

// Health check
app.get('/health', (c: Context) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server with Bun's native HTTP server
const port = serverConfig.port

const server = Bun.serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
})

console.log(`Server is running on http://localhost:${server.port}`)
console.log(`Login: http://localhost:${server.port}/auth/login`)
console.log(`Register: http://localhost:${server.port}/auth/register`)
console.log(`Dashboard: http://localhost:${server.port}/dashboard (protected)`)

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down gracefully...')

  // Close HTTP server first (stop accepting new connections)
  server.stop()

  // Close database pool
  await closePool()

  // Force exit after cleanup (handles any remaining Mastra connections)
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
