import { Hono } from 'hono'
import { safeHandler } from '../../../../shared/api/safeHandler.js'
import { getAuthenticatedUser } from '../../../../shared/auth/session.js'
import { getWorkingMemory } from '../core/usecases/GetWorkingMemory.js'
import { updateWorkingMemoryKey } from '../core/usecases/UpdateWorkingMemoryKey.js'
import { clearWorkingMemory } from '../core/usecases/ClearMemory.js'
import { addFinding } from '../core/usecases/AddFinding.js'
import { addInsight } from '../core/usecases/AddInsight.js'
import { setPhase } from '../core/usecases/SetPhase.js'

const memory = new Hono()

// GET /:threadId
memory.get('/:threadId', safeHandler(async (c) => {
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
}))

// PUT /:threadId
memory.put('/:threadId', safeHandler(async (c) => {
    const user = await getAuthenticatedUser(c)
    if (!user) {
        return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const threadId = c.req.param('threadId')
    const { key, value } = await c.req.json()

    if (!key) {
        return c.json({ success: false, error: 'key is required' }, 400)
    }

    await updateWorkingMemoryKey(user.id, threadId, key, value)

    return c.json({
        success: true,
    })
}))

// DELETE /:threadId
memory.delete('/:threadId', safeHandler(async (c) => {
    const user = await getAuthenticatedUser(c)
    if (!user) {
        return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const threadId = c.req.param('threadId')
    await clearWorkingMemory(user.id, threadId)

    return c.json({
        success: true,
    })
}))

// POST /:threadId/finding
memory.post('/:threadId/finding', safeHandler(async (c) => {
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
}))

// POST /:threadId/insight
memory.post('/:threadId/insight', safeHandler(async (c) => {
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
}))

// PUT /:threadId/phase
memory.put('/:threadId/phase', safeHandler(async (c) => {
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
}))

export default memory
