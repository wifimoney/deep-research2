import { getWorkingMemoryState } from '../../data/memory-repo.js'

export async function getWorkingMemorySummary(
    userId: string,
    threadId: string
): Promise<string> {
    const state = await getWorkingMemoryState(userId, threadId)

    const parts: string[] = []

    parts.push(`## Working Memory Summary`)
    parts.push(`Phase: ${state.phase}`)
    parts.push('')

    if (state.findings.length > 0) {
        parts.push(`### Key Findings (${state.findings.length}):`)
        state.findings.slice(-5).forEach((f, i) => {
            parts.push(`${i + 1}. ${f.finding.substring(0, 100)}... (${f.source})`)
        })
        parts.push('')
    }

    if (state.insights.length > 0) {
        parts.push(`### Insights (${state.insights.length}):`)
        state.insights.slice(-3).forEach((ins, i) => {
            parts.push(`${i + 1}. ${ins}`)
        })
        parts.push('')
    }

    if (state.processedUrls.length > 0) {
        parts.push(`### Processed URLs: ${state.processedUrls.length}`)
    }

    if (state.completedQueries.length > 0) {
        parts.push(`### Completed Queries: ${state.completedQueries.length}`)
    }

    if (state.followUpQuestions.length > 0) {
        const remaining = state.followUpQuestions.filter(
            q => !state.completedQueries.includes(q)
        )
        if (remaining.length > 0) {
            parts.push(`### Follow-up Questions (${remaining.length} remaining):`)
            remaining.slice(0, 3).forEach((q, i) => {
                parts.push(`${i + 1}. ${q}`)
            })
        }
    }

    return parts.join('\n')
}
