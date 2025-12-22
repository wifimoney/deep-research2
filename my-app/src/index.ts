import "./instrument.js";
import { config } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env files - try multiple locations
const envPaths = [
  resolve(process.cwd(), '../.env'),           // Root project .env (when running from my-app/)
  resolve(process.cwd(), '.env'),               // my-app/.env
  resolve(__dirname, '../../.env'),             // Relative to compiled location
  resolve(__dirname, '../../../.env'),          // Root from compiled location
]

let loaded = false
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    const result = config({ path: envPath })
    if (result.parsed && Object.keys(result.parsed).length > 0) {
      console.log(`[dotenv] Loaded ${Object.keys(result.parsed).length} vars from ${envPath}`)
      loaded = true
      break
    }
  }
}

if (!loaded) {
  console.warn('[dotenv] No .env file found or loaded. Tried paths:', envPaths)
}
import { Hono } from 'hono'
import type { Context } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import * as Sentry from "@sentry/node"

// Feature Routes
import viewAuthRoutes from './features/auth/api/view-routes.js'
import jsonAuthRoutes from './features/auth/api/json-routes.js'
import chatRoutes from './features/agent/chat/api/routes.js'
import threadRoutes from './features/agent/threads/api/routes.js'
import memoryRoutes from './features/agent/memory/api/routes.js'
import dashboardRoutes from './features/dashboard/api/routes.js'

// Shared modules
import { requireAuth } from './shared/auth/middleware.js'
import { handleRequest } from './shared/auth/index.js'
import { closePool } from '@repo/db'
import { serverConfig } from './shared/mastra/config/config.js'
import { Dashboard } from './features/dashboard/ui/Dashboard.js'

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
app.on(['POST', 'GET', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], '/api/auth/*', async (c: Context) => {
  const pathname = new URL(c.req.url).pathname
  console.log('Better Auth route matched:', pathname, c.req.method)

  if (pathname === '/api/auth/error') {
    const errorParam = new URL(c.req.url).searchParams.get('error')
    console.error('Better Auth error page accessed:', errorParam)
    Sentry.captureMessage(`Better Auth error page accessed: ${errorParam}`, 'error')
    return c.redirect('/dashboard')
  }

  try {
    let response: Response
    try {
      response = await handleRequest(c.req.raw)
    } catch (handlerError) {
      console.error('❌ Better Auth handler threw an error:', handlerError)
      Sentry.captureException(handlerError)
      if (pathname.startsWith('/api/auth/callback/')) {
        return c.redirect('/dashboard')
      }
      throw handlerError
    }

    if (pathname.startsWith('/api/auth/callback/') && (response.status === 302 || response.status === 200)) {
      const setCookieHeaders = response.headers.getSetCookie()
      const redirectUrl = new URL('/dashboard', c.req.url)
      const redirectResponse = new Response(null, {
        status: 302,
        headers: { 'Location': redirectUrl.toString() },
      })
      setCookieHeaders.forEach(cookie => redirectResponse.headers.append('Set-Cookie', cookie))
      return redirectResponse
    }

    return response
  } catch (error) {
    console.error('❌ Better Auth handler error:', error)
    Sentry.captureException(error)
    return c.redirect('/dashboard')
  }
})

// Mount Feature Routes
app.route('/auth', viewAuthRoutes)
app.route('/api', jsonAuthRoutes)
app.route('/api/chat', chatRoutes)
app.route('/api/chat/threads', threadRoutes)
app.route('/api/agent/memory', memoryRoutes)
app.route('/api/dashboard', dashboardRoutes)

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

// Start server - use Bun if available, otherwise use Node.js server
const port = serverConfig.port

type ServerHandle =
  | { port: number; stop: () => void }
  | { port: number; close: () => void }

let server: ServerHandle
let actualPort = port

// Check if running in Bun runtime
const isBun = typeof (globalThis as any).Bun !== 'undefined'

if (isBun) {
  // Bun runtime
  const bunServer = (globalThis as any).Bun.serve({
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0',
  })
  actualPort = bunServer.port
  server = { port: actualPort, stop: () => bunServer.stop() }
} else {
  // Node.js runtime (tsx)
  const { serve } = await import('@hono/node-server')
  const nodeServer = serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    actualPort = info.port
    console.log(`Server is running on http://localhost:${actualPort}`)
    console.log(`Login: http://localhost:${actualPort}/auth/login`)
    console.log(`Register: http://localhost:${actualPort}/auth/register`)
    console.log(`Dashboard: http://localhost:${actualPort}/dashboard (protected)`)
  })
  server = { port: actualPort, close: () => nodeServer.close() }
}

if (!isBun) {
  // Node.js already logs in callback, skip here
} else {
  console.log(`Server is running on http://localhost:${actualPort}`)
  console.log(`Login: http://localhost:${actualPort}/auth/login`)
  console.log(`Register: http://localhost:${actualPort}/auth/register`)
  console.log(`Dashboard: http://localhost:${actualPort}/dashboard (protected)`)
}

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down gracefully...')

  // Close HTTP server first (stop accepting new connections)
  if ('stop' in server) {
    server.stop()
  } else {
    server.close()
  }

  // Close database pool
  await closePool()

  // Force exit after cleanup (handles any remaining Mastra connections)
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
