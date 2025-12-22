import { updateThreadTitle as updateTitleInRepo } from '../../data/thread-repo.js'
import type { Thread } from '../../data/thread-repo.js'

export async function updateThreadTitle(threadId: string, title: string): Promise<Thread> {
    if (!threadId || !title) throw new Error('threadId and title are required')
    return await updateTitleInRepo(threadId, title)
}
