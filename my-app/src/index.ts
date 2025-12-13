import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import authRoutes from './routes/auth.js'
import apiRoutes from './routes/api.js'
import { requireAuth } from './middleware/auth.js'
import { renderDashboard } from './views/auth.js'
import { closePool } from '../../src/db/postgres.js'
import { serverConfig } from '../../src/mastra/config/config.js'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('/api/*', cors({
  origin: ['http://localhost:3000'],
  credentials: true,
}))

// Mount auth routes at /auth (form-based)
app.route('/auth', authRoutes)

// Mount API routes at /api (JSON-based)
app.route('/api', apiRoutes)

// Protected routes
app.get('/dashboard', requireAuth, (c) => {
  const user = c.get('user')
  return c.html(renderDashboard(user.username, user.email))
})

// Root redirect
app.get('/', (c) => {
  return c.redirect('/auth/login')
})

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server
const port = serverConfig.port

const server = serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
  console.log(`Login: http://localhost:${info.port}/auth/login`)
  console.log(`Register: http://localhost:${info.port}/auth/register`)
  console.log(`Dashboard: http://localhost:${info.port}/dashboard (protected)`)
})

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down gracefully...')
  
  // Close HTTP server first (stop accepting new connections)
  server.close()
  
  // Close database pool
  await closePool()
  
  // Force exit after cleanup (handles any remaining Mastra connections)
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
