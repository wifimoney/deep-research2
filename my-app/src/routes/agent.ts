import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { getSessionWithUser } from '../services/userService.js'
import {
  runAgent,
  getHistory,
  getThreads,
  createThread,
  deleteThread,
  updateThreadTitle,
  getThreadWorkingMemory,
  updateThreadWorkingMemory,
} from '../services/agentService.js'
import {
  clearWorkingMemory,
  addFinding,
  addInsight,
  setPhase,
} from '../services/workingMemoryService.js'

const agent = new Hono()

/**
 * Helper to get authenticated user from session
 */
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

// ============================================================================
// Chat/Agent Endpoints
// ============================================================================

/**
 * POST /api/agent/chat
 * Send a message to the agent and get a response
 * 
 * Body: { threadId: string, message: string, includeWorkingMemory?: boolean }
 */
agent.post('/chat', async (c) => {
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) {
      return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const { threadId, message, includeWorkingMemory = true } = await c.req.json()

    if (!threadId || !message) {
      return c.json({ success: false, error: 'threadId and message are required' }, 400)
    }

    const result = await runAgent(user.id, threadId, message, includeWorkingMemory)

    return c.json({
      success: true,
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
      threadId: result.threadId,
    })
  } catch (error) {
    console.error('Agent chat error:', error)
    return c.json({ success: false, error: 'Failed to run agent' }, 500)
  }
})

/**
 * GET /api/agent/history
 * Get conversation history for a thread
 * 
 * Query: threadId
 */
agent.get('/history', async (c) => {
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

// ============================================================================
// Thread Management Endpoints
// ============================================================================

/**
 * GET /api/agent/threads
 * List all threads for the authenticated user
 */
agent.get('/threads', async (c) => {
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

/**
 * POST /api/agent/threads
 * Create a new thread
 * 
 * Body: { title?: string }
 */
agent.post('/threads', async (c) => {
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

/**
 * GET /api/agent/threads/:threadId
 * Get a specific thread's details and messages
 */
agent.get('/threads/:threadId', async (c) => {
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) {
      return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const threadId = c.req.param('threadId')
    const messages = await getHistory(user.id, threadId)

    return c.json({
      success: true,
      threadId,
      messages,
    })
  } catch (error) {
    console.error('Get thread error:', error)
    return c.json({ success: false, error: 'Failed to get thread' }, 500)
  }
})

/**
 * PATCH /api/agent/threads/:threadId
 * Update thread title
 * 
 * Body: { title: string }
 */
agent.patch('/threads/:threadId', async (c) => {
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) {
      return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const threadId = c.req.param('threadId')
    const { title } = await c.req.json()

    if (!title) {
      return c.json({ success: false, error: 'title is required' }, 400)
    }

    const thread = await updateThreadTitle(threadId, title)

    return c.json({
      success: true,
      thread,
    })
  } catch (error) {
    console.error('Update thread error:', error)
    return c.json({ success: false, error: 'Failed to update thread' }, 500)
  }
})

/**
 * DELETE /api/agent/threads/:threadId
 * Delete a thread and its working memory
 */
agent.delete('/threads/:threadId', async (c) => {
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) {
      return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const threadId = c.req.param('threadId')
    await deleteThread(user.id, threadId)

    return c.json({
      success: true,
    })
  } catch (error) {
    console.error('Delete thread error:', error)
    return c.json({ success: false, error: 'Failed to delete thread' }, 500)
  }
})

// ============================================================================
// Working Memory Endpoints
// ============================================================================

/**
 * GET /api/agent/threads/:threadId/memory
 * Get working memory state for a thread
 */
agent.get('/threads/:threadId/memory', async (c) => {
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) {
      return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const threadId = c.req.param('threadId')
    const memory = await getThreadWorkingMemory(user.id, threadId)

    return c.json({
      success: true,
      memory,
    })
  } catch (error) {
    console.error('Get working memory error:', error)
    return c.json({ success: false, error: 'Failed to get working memory' }, 500)
  }
})

/**
 * PUT /api/agent/threads/:threadId/memory
 * Update a working memory key-value pair
 * 
 * Body: { key: string, value: any }
 */
agent.put('/threads/:threadId/memory', async (c) => {
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) {
      return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const threadId = c.req.param('threadId')
    const { key, value } = await c.req.json()

    if (!key) {
      return c.json({ success: false, error: 'key is required' }, 400)
    }

    await updateThreadWorkingMemory(user.id, threadId, key, value)

    return c.json({
      success: true,
    })
  } catch (error) {
    console.error('Update working memory error:', error)
    return c.json({ success: false, error: 'Failed to update working memory' }, 500)
  }
})

/**
 * DELETE /api/agent/threads/:threadId/memory
 * Clear all working memory for a thread
 */
agent.delete('/threads/:threadId/memory', async (c) => {
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) {
      return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const threadId = c.req.param('threadId')
    await clearWorkingMemory(user.id, threadId)

    return c.json({
      success: true,
    })
  } catch (error) {
    console.error('Clear working memory error:', error)
    return c.json({ success: false, error: 'Failed to clear working memory' }, 500)
  }
})

/**
 * POST /api/agent/threads/:threadId/memory/finding
 * Add a finding to working memory
 * 
 * Body: { finding: string, source: string, relevance: string }
 */
agent.post('/threads/:threadId/memory/finding', async (c) => {
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) {
      return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const threadId = c.req.param('threadId')
    const { finding, source, relevance } = await c.req.json()

    if (!finding || !source || !relevance) {
      return c.json({ success: false, error: 'finding, source, and relevance are required' }, 400)
    }

    await addFinding(user.id, threadId, finding, source, relevance)

    return c.json({
      success: true,
    })
  } catch (error) {
    console.error('Add finding error:', error)
    return c.json({ success: false, error: 'Failed to add finding' }, 500)
  }
})

/**
 * POST /api/agent/threads/:threadId/memory/insight
 * Add an insight to working memory
 * 
 * Body: { insight: string }
 */
agent.post('/threads/:threadId/memory/insight', async (c) => {
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) {
      return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const threadId = c.req.param('threadId')
    const { insight } = await c.req.json()

    if (!insight) {
      return c.json({ success: false, error: 'insight is required' }, 400)
    }

    await addInsight(user.id, threadId, insight)

    return c.json({
      success: true,
    })
  } catch (error) {
    console.error('Add insight error:', error)
    return c.json({ success: false, error: 'Failed to add insight' }, 500)
  }
})

/**
 * PUT /api/agent/threads/:threadId/memory/phase
 * Set the working memory phase
 * 
 * Body: { phase: 'initial' | 'follow-up' | 'analysis' | 'complete' }
 */
agent.put('/threads/:threadId/memory/phase', async (c) => {
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) {
      return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const threadId = c.req.param('threadId')
    const { phase } = await c.req.json()

    if (!phase || !['initial', 'follow-up', 'analysis', 'complete'].includes(phase)) {
      return c.json({ success: false, error: 'Valid phase is required' }, 400)
    }

    await setPhase(user.id, threadId, phase)

    return c.json({
      success: true,
    })
  } catch (error) {
    console.error('Set phase error:', error)
    return c.json({ success: false, error: 'Failed to set phase' }, 500)
  }
})

export default agent
