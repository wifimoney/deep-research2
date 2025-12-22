import { storage, ensureStorageInitialized } from '../../../../shared/mastra/config/storage.js'

export interface WorkingMemoryState {
    findings: Array<{ finding: string; source: string; relevance: string }>
    insights: string[]
    decisions: Array<{ decision: string; reasoning: string }>
    processedUrls: string[]
    completedQueries: string[]
    followUpQuestions: string[]
    phase: 'initial' | 'follow-up' | 'analysis' | 'complete'
    customData: Record<string, any>
}

// Default state
export const DEFAULT_MEMORY_STATE: WorkingMemoryState = {
    findings: [],
    insights: [],
    decisions: [],
    processedUrls: [],
    completedQueries: [],
    followUpQuestions: [],
    phase: 'initial',
    customData: {},
}

export async function getWorkingMemoryState(
    userId: string,
    threadId: string
): Promise<WorkingMemoryState> {
    await ensureStorageInitialized()
    const thread = await storage.getThreadById({ threadId })

    if (!thread) {
        return { ...DEFAULT_MEMORY_STATE }
    }

    const metadata = thread.metadata || {}
    const wmData = (metadata.workingMemory || {}) as Partial<WorkingMemoryState>

    return {
        findings: wmData.findings || [],
        insights: wmData.insights || [],
        decisions: wmData.decisions || [],
        processedUrls: wmData.processedUrls || [],
        completedQueries: wmData.completedQueries || [],
        followUpQuestions: wmData.followUpQuestions || [],
        phase: wmData.phase || 'initial',
        customData: wmData.customData || {},
    }
}

export async function saveWorkingMemoryState(
    threadId: string,
    state: WorkingMemoryState
): Promise<void> {
    await ensureStorageInitialized()
    const thread = await storage.getThreadById({ threadId })

    if (!thread) {
        throw new Error(`Thread ${threadId} not found`)
    }

    await storage.updateThread({
        id: threadId,
        title: thread.title || 'Chat',
        metadata: {
            ...thread.metadata,
            workingMemory: state,
        },
    })
}

export async function clearWorkingMemory(
    userId: string,
    threadId: string
): Promise<void> {
    await ensureStorageInitialized()
    const thread = await storage.getThreadById({ threadId })
    if (!thread) return

    const metadata = { ...thread.metadata }
    delete metadata.workingMemory

    await storage.updateThread({
        id: threadId,
        title: thread.title || 'Chat',
        metadata,
    })
}

export async function clearAllUserWorkingMemory(userId: string): Promise<void> {
    await ensureStorageInitialized()

    // Get all threads for the user
    const result = await storage.listThreadsByResourceId({ resourceId: userId })

    // Handle various return types
    const threads = (Array.isArray(result) ? result : (result as any)?.threads || []) as any[]

    for (const thread of threads) {
        const metadata = { ...thread.metadata }
        delete metadata.workingMemory

        await storage.updateThread({
            id: thread.id,
            title: thread.title || 'Chat',
            metadata,
        })
    }
}
