import { getWorkingMemoryState, saveWorkingMemoryState } from '../../data/memory-repo.js'

export async function addInsight(
    userId: string,
    threadId: string,
    insight: string
): Promise<void> {
    const state = await getWorkingMemoryState(userId, threadId)
    if (!state.insights.includes(insight)) {
        state.insights.push(insight)
        await saveWorkingMemoryState(threadId, state)
    }
}
