import { clearWorkingMemory as clearRepoMemory } from '../../data/memory-repo.js'

export async function clearWorkingMemory(userId: string, threadId: string): Promise<void> {
    await clearRepoMemory(userId, threadId)
}
