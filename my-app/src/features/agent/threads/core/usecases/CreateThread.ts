import { createThread as createThreadInRepo } from '../../data/thread-repo.js'
import type { Thread } from '../../data/thread-repo.js'

export async function createThread(userId: string, title?: string): Promise<Thread> {
    if (!userId) throw new Error('userId is required')
    // ID generation handles in repo helper for now, or we could move it here.
    // The repo generic `createThread` generates an ID.
    return await createThreadInRepo(userId, title)
}
