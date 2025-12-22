import { Hono } from 'hono'
import { getAuthenticatedUser } from '../../../../shared/auth/session.js'
import {
    getWorkingMemory,
    clearWorkingMemory,
    addFinding,
    addInsight,
    setPhase,
    setWorkingMemory,
} from '../core/working-memory.js'

const memory = new Hono()

/**
 * GET week/:threadId/memory (Wait, original route was /state or just /memory?)
 * Original: GET /api/agent/threads/:threadId/memory
 * Since this router will be mounted at /api/agent/memory or something, I need to design the path.
 * In the new structure, I should probably expose it as /:threadId/state or similar.
 * 
 * Replicating original paths relative to this slice.
 * If I mount this router at /api/agent/memory
 * GET /:threadId -> returns memory
 * PUT /:threadId -> updates memory (key/value)
 * DELETE /:threadId -> clears memory
 * POST /:threadId/finding -> add finding
 * POST /:threadId/insight -> add insight
 * PUT /:threadId/phase -> set phase
 */

/**
 * GET /:threadId
 * Get working memory state for a thread
 */
memory.get('/:threadId', async (c) => {
    try {
        const user = await getAuthenticatedUser(c)
        if (!user) {
            return c.json({ success: false, error: 'Not authenticated' }, 401)
        }

        const threadId = c.req.param('threadId')
        const memState = await getWorkingMemory(user.id, threadId)

        return c.json({
            success: true,
            memory: memState,
        })
    } catch (error) {
        console.error('Get working memory error:', error)
        return c.json({ success: false, error: 'Failed to get working memory' }, 500)
    }
})

/**
 * PUT /:threadId
 * Update a working memory key-value pair
 * 
 * Body: { key: string, value: any }
 */
memory.put('/:threadId', async (c) => {
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

        await setWorkingMemory(user.id, threadId, key, value)

        return c.json({
            success: true,
        })
    } catch (error) {
        console.error('Update working memory error:', error)
        return c.json({ success: false, error: 'Failed to update working memory' }, 500)
    }
})

/**
 * DELETE /:threadId
 * Clear all working memory for a thread
 */
memory.delete('/:threadId', async (c) => {
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
 * POST /:threadId/finding
 * Add a finding to working memory
 * 
 * Body: { finding: string, source: string, relevance: string }
 */
memory.post('/:threadId/finding', async (c) => {
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
 * POST /:threadId/insight
 * Add an insight to working memory
 * 
 * Body: { insight: string }
 */
memory.post('/:threadId/insight', async (c) => {
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
 * PUT /:threadId/phase
 * Set the working memory phase
 * 
 * Body: { phase: 'initial' | 'follow-up' | 'analysis' | 'complete' }
 */
memory.put('/:threadId/phase', async (c) => {
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

export default memory
