import { Hono } from 'hono'
import { getAuthenticatedUser } from '../../../../shared/auth/session.js'
import { getThreads, createThread, deleteThread, updateThreadTitle } from '../data/thread-repo.js'
import { getHistory } from '../../chat/core/chat-service.js'

const threads = new Hono()

/**
 * GET /
 * List all threads for the authenticated user
 */
threads.get('/', async (c) => {
    try {
        const user = await getAuthenticatedUser(c)
        if (!user) {
            return c.json({ success: false, error: 'Not authenticated' }, 401)
        }

        const threadList = await getThreads(user.id)

        return c.json({
            success: true,
            threads: threadList,
        })
    } catch (error) {
        console.error('Get threads error:', error)
        return c.json({ success: false, error: 'Failed to get threads' }, 500)
    }
})

/**
 * POST /
 * Create a new thread
 * 
 * Body: { title?: string }
 */
threads.post('/', async (c) => {
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
 * GET /:threadId
 * Get a specific thread's details and messages
 */
threads.get('/:threadId', async (c) => {
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
 * PATCH /:threadId
 * Update thread title
 * 
 * Body: { title: string }
 */
threads.patch('/:threadId', async (c) => {
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
 * DELETE /:threadId
 * Delete a thread and its working memory
 */
threads.delete('/:threadId', async (c) => {
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

export default threads
