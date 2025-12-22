import { deleteThread as deleteThreadInRepo } from '../../data/thread-repo.js'
import { clearWorkingMemory } from '../../../memory/core/usecases/ClearMemory.js'

export async function deleteThread(userId: string, threadId: string): Promise<void> {
    if (!userId || !threadId) throw new Error('userId and threadId are required')

    // 1. Delete thread from storage
    await deleteThreadInRepo(userId, threadId)

    // 2. Clear working memory (Cross-slice coordination)
    await clearWorkingMemory(userId, threadId)
}
