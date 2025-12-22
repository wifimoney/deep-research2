import { getThreads as fetchThreads } from '../../data/thread-repo.js'
import type { Thread } from '../../data/thread-repo.js'

export async function getThreads(userId: string): Promise<Thread[]> {
    if (!userId) throw new Error('userId is required')
    return await fetchThreads(userId)
}
