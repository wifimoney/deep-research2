import { getWorkingMemoryState, type WorkingMemoryState } from '../../data/memory-repo.js'

export async function getWorkingMemory(userId: string, threadId: string): Promise<WorkingMemoryState> {
    if (!threadId) throw new Error('threadId is required')
    return await getWorkingMemoryState(userId, threadId)
}
