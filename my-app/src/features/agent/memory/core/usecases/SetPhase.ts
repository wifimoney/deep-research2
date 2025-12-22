import { updateWorkingMemoryKey } from './UpdateWorkingMemoryKey.js'

export async function setPhase(
    userId: string,
    threadId: string,
    phase: 'initial' | 'follow-up' | 'analysis' | 'complete'
): Promise<void> {
    await updateWorkingMemoryKey(userId, threadId, 'phase', phase)
}
