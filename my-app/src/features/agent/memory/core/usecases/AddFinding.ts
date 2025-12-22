import { getWorkingMemoryState, saveWorkingMemoryState } from '../../data/memory-repo.js'

export async function addFinding(
    userId: string,
    threadId: string,
    finding: string,
    source: string,
    relevance: string
): Promise<void> {
    const state = await getWorkingMemoryState(userId, threadId)
    state.findings.push({ finding, source, relevance })
    await saveWorkingMemoryState(threadId, state)
}
