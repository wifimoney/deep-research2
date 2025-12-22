import { getWorkingMemoryState, saveWorkingMemoryState } from '../../data/memory-repo.js'

export async function updateWorkingMemoryKey(
    userId: string,
    threadId: string,
    key: string,
    value: any
): Promise<void> {
    if (!threadId || !key) throw new Error('threadId and key are required')

    const state = await getWorkingMemoryState(userId, threadId)
    const updatedState = { ...state }

    switch (key) {
        case 'findings':
            updatedState.findings = value
            break
        case 'insights':
            updatedState.insights = value
            break
        case 'decisions':
            updatedState.decisions = value
            break
        case 'processedUrls':
            updatedState.processedUrls = value
            break
        case 'completedQueries':
            updatedState.completedQueries = value
            break
        case 'followUpQuestions':
            updatedState.followUpQuestions = value
            break
        case 'phase':
            updatedState.phase = value
            break
        default:
            updatedState.customData[key] = value
    }

    await saveWorkingMemoryState(threadId, updatedState)
}
