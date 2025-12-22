import { Hono } from 'hono'
import { safeHandler } from '../../../../shared/api/safeHandler.js'
import { getAuthenticatedUser } from '../../../../shared/auth/session.js'
import { getThreads } from '../core/usecases/GetThreads.js'
import { createThread } from '../core/usecases/CreateThread.js'
import { deleteThread } from '../core/usecases/DeleteThread.js'
import { updateThreadTitle } from '../core/usecases/UpdateThreadTitle.js'
import { getHistory } from '../../chat/core/usecases/GetHistory.js'

const threads = new Hono()

// GET /
threads.get('/', safeHandler(async (c) => {
    const user = await getAuthenticatedUser(c)
    if (!user) {
        return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const threadList = await getThreads(user.id)

    return c.json({
        success: true,
        threads: threadList,
    })
}))

// POST /
threads.post('/', safeHandler(async (c) => {
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
}))

// GET /:threadId
threads.get('/:threadId', safeHandler(async (c) => {
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
}))

// PATCH /:threadId
threads.patch('/:threadId', safeHandler(async (c) => {
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
}))

// DELETE /:threadId
threads.delete('/:threadId', safeHandler(async (c) => {
    const user = await getAuthenticatedUser(c)
    if (!user) {
        return c.json({ success: false, error: 'Not authenticated' }, 401)
    }

    const threadId = c.req.param('threadId')
    await deleteThread(user.id, threadId)

    return c.json({
        success: true,
    })
}))

export default threads
