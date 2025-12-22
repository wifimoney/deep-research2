import { storage, ensureStorageInitialized } from '../../../../shared/mastra/config/storage.js'
import { standardMemory as memory } from '../../../../shared/mastra/config/memory.js'

/**
 * Thread type for API responses
 */
export interface Thread {
    id: string
    title?: string
    createdAt: Date
    updatedAt: Date
}

/**
 * Get all threads for a user
 */
export async function getThreads(userId: string): Promise<Thread[]> {
    await ensureStorageInitialized()

    try {
        // Beta storage API changed: try a set of possible methods
        const threads =
            (await (storage as any).getThreadsByResource?.({ resourceId: userId })) ??
            (await (storage as any).getThreads?.({ resourceId: userId })) ??
            (await (storage as any).listThreads?.({ resourceId: userId })) ??
            (await (storage as any).getThreadsByResourceId?.({ resourceId: userId })) ?? // legacy
            []

        // Ensure threads is an array before mapping
        if (!Array.isArray(threads)) {
            console.error(`[MemoryService] getThreads returned non-array:`, typeof threads, threads)
            return []
        }

        console.log(`[MemoryService] Found ${threads.length} threads for user ${userId}`)

        // Map and sort threads by updatedAt descending (most recent first)
        const mappedThreads = threads
            .map((t: any) => ({
                id: t.id,
                title: t.title || 'New Chat',
                createdAt: t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt),
                updatedAt: t.updatedAt instanceof Date ? t.updatedAt : new Date(t.updatedAt || t.createdAt),
            }))
            .sort((a, b) => {
                // Sort by updatedAt descending (most recent first)
                const timeA = a.updatedAt.getTime()
                const timeB = b.updatedAt.getTime()
                return timeB - timeA
            })

        console.log(`[MemoryService] Returning ${mappedThreads.length} sorted threads`)
        return mappedThreads
    } catch (error) {
        console.error(`[MemoryService] Error getting threads:`, error)
        return []
    }
}

/**
 * Get or create a thread
 * Uses Memory instance methods to ensure thread is properly integrated with the memory system
 */
export async function getOrCreateThread(
    threadId: string,
    userId: string,
    title?: string
): Promise<Thread> {
    await ensureStorageInitialized()

    // 1. Try to get existing thread from storage
    const existing = await storage.getThreadById({ threadId })

    if (existing) {
        return {
            id: existing.id,
            title: existing.title,
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt,
        }
    }

    // 2. Create thread through storage to ensure proper integration
    const thread = await storage.saveThread({
        thread: {
            id: threadId,
            resourceId: userId,
            title: title || 'New Chat',
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    })

    return {
        id: thread.id,
        title: thread.title,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
    }
}

/**
 * Create a new thread
 */
export async function createThread(
    userId: string,
    title?: string
): Promise<Thread> {
    const threadId = `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    return getOrCreateThread(threadId, userId, title)
}

/**
 * Delete a thread and its working memory
 */
export async function deleteThread(
    userId: string,
    threadId: string
): Promise<void> {
    await ensureStorageInitialized()

    // Delete the thread from storage
    await storage.deleteThread({ threadId })

    // Also clear working memory for this thread
    const { clearWorkingMemory } = await import('../../memory/core/working-memory.js')
    await clearWorkingMemory(userId, threadId)
}

/**
 * Update thread title
 */
export async function updateThreadTitle(
    threadId: string,
    title: string
): Promise<Thread> {
    await ensureStorageInitialized()

    const existing = await storage.getThreadById({ threadId })
    if (!existing) {
        throw new Error(`Thread ${threadId} not found`)
    }

    await storage.updateThread({
        id: threadId,
        title,
        metadata: existing.metadata || {},
    })

    return {
        id: existing.id,
        title,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
    }
}

/**
 * Clean up empty threads for a user (threads with no messages)
 */
export async function cleanupEmptyThreads(userId: string): Promise<{ deleted: number; kept: number }> {
    await ensureStorageInitialized()

    // Get all threads for user
    const threads = await getThreads(userId)

    if (!Array.isArray(threads)) {
        console.error(`[MemoryService] listThreadsByResource returned non-array:`, typeof threads)
        return { deleted: 0, kept: 0 }
    }

    let deleted = 0
    let kept = 0

    for (const thread of threads) {
        try {
            // Check if thread has any messages using recall
            let hasMessages = false

            if (typeof (memory as any).recall === 'function') {
                const recallResult = await (memory as any).recall({
                    threadId: thread.id,
                    resourceId: userId,
                    query: '',
                })
                hasMessages = (recallResult.messages && recallResult.messages.length > 0)
            }

            if (!hasMessages) {
                // Delete empty thread
                await (memory as any).deleteThread({ threadId: thread.id })
                deleted++
                console.log(`[MemoryService] Deleted empty thread: ${thread.id}`)
            } else {
                kept++
            }
        } catch (err) {
            console.error(`[MemoryService] Error checking/deleting thread ${thread.id}:`, err)
            kept++ // Keep thread if we can't check it
        }
    }

    console.log(`[MemoryService] Cleanup complete: deleted ${deleted} empty threads, kept ${kept} threads with messages`)
    return { deleted, kept }
}
