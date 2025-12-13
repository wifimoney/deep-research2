import { storage, ensureStorageInitialized } from '../../../src/mastra/config/storage.js'

/**
 * Working Memory State
 * Aggregated view of all key-value pairs for a user/thread
 * Stored in thread metadata using Mastra Memory
 */
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

/**
 * Get all working memory entries for a user and thread from thread metadata
 */
export async function getWorkingMemory(
  userId: string,
  threadId: string
): Promise<WorkingMemoryState> {
  await ensureStorageInitialized()

  // Get thread from Mastra Memory storage
  const thread = await storage.getThreadById({ threadId })
  
  if (!thread) {
    // Return default state if thread doesn't exist
    return {
      findings: [],
      insights: [],
      decisions: [],
      processedUrls: [],
      completedQueries: [],
      followUpQuestions: [],
      phase: 'initial',
      customData: {},
    }
  }

  // Extract working memory state from thread metadata
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

/**
 * Set a working memory value (upsert) in thread metadata
 */
export async function setWorkingMemory(
  userId: string,
  threadId: string,
  key: string,
  value: any
): Promise<void> {
  await ensureStorageInitialized()

  // Get current thread
  const thread = await storage.getThreadById({ threadId })
  if (!thread) {
    throw new Error(`Thread ${threadId} not found`)
  }

  // Get current working memory state
  const currentState = await getWorkingMemory(userId, threadId)

  // Update the specific key in working memory state
  const updatedState: WorkingMemoryState = { ...currentState }
  
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

  // Update thread metadata with new working memory state
  await storage.updateThread({
    id: threadId,
    title: thread.title || 'Chat',
    metadata: {
      ...thread.metadata,
      workingMemory: updatedState,
    },
  })
}

/**
 * Add a finding to working memory
 */
export async function addFinding(
  userId: string,
  threadId: string,
  finding: string,
  source: string,
  relevance: string
): Promise<void> {
  const state = await getWorkingMemory(userId, threadId)
  state.findings.push({ finding, source, relevance })
  await setWorkingMemory(userId, threadId, 'findings', state.findings)
}

/**
 * Add an insight to working memory
 */
export async function addInsight(
  userId: string,
  threadId: string,
  insight: string
): Promise<void> {
  const state = await getWorkingMemory(userId, threadId)
  if (!state.insights.includes(insight)) {
    state.insights.push(insight)
    await setWorkingMemory(userId, threadId, 'insights', state.insights)
  }
}

/**
 * Add a decision to working memory
 */
export async function addDecision(
  userId: string,
  threadId: string,
  decision: string,
  reasoning: string
): Promise<void> {
  const state = await getWorkingMemory(userId, threadId)
  state.decisions.push({ decision, reasoning })
  await setWorkingMemory(userId, threadId, 'decisions', state.decisions)
}

/**
 * Mark a URL as processed
 */
export async function markUrlProcessed(
  userId: string,
  threadId: string,
  url: string
): Promise<void> {
  const state = await getWorkingMemory(userId, threadId)
  if (!state.processedUrls.includes(url)) {
    state.processedUrls.push(url)
    await setWorkingMemory(userId, threadId, 'processedUrls', state.processedUrls)
  }
}

/**
 * Check if a URL has been processed
 */
export async function isUrlProcessed(
  userId: string,
  threadId: string,
  url: string
): Promise<boolean> {
  const state = await getWorkingMemory(userId, threadId)
  return state.processedUrls.includes(url)
}

/**
 * Mark a query as completed
 */
export async function markQueryCompleted(
  userId: string,
  threadId: string,
  queryText: string
): Promise<void> {
  const state = await getWorkingMemory(userId, threadId)
  if (!state.completedQueries.includes(queryText)) {
    state.completedQueries.push(queryText)
    await setWorkingMemory(userId, threadId, 'completedQueries', state.completedQueries)
  }
}

/**
 * Add a follow-up question
 */
export async function addFollowUpQuestion(
  userId: string,
  threadId: string,
  question: string
): Promise<void> {
  const state = await getWorkingMemory(userId, threadId)
  if (!state.followUpQuestions.includes(question)) {
    state.followUpQuestions.push(question)
    await setWorkingMemory(userId, threadId, 'followUpQuestions', state.followUpQuestions)
  }
}

/**
 * Set the current phase
 */
export async function setPhase(
  userId: string,
  threadId: string,
  phase: WorkingMemoryState['phase']
): Promise<void> {
  await setWorkingMemory(userId, threadId, 'phase', phase)
}

/**
 * Clear all working memory for a thread
 */
export async function clearWorkingMemory(
  userId: string,
  threadId: string
): Promise<void> {
  await ensureStorageInitialized()

  const thread = await storage.getThreadById({ threadId })
  if (!thread) {
    return // Thread doesn't exist, nothing to clear
  }

  // Remove working memory from metadata
  const metadata = { ...thread.metadata }
  delete metadata.workingMemory

  await storage.updateThread({
    id: threadId,
    title: thread.title || 'Chat',
    metadata,
  })
}

/**
 * Clear all working memory for a user (all threads)
 */
export async function clearAllUserWorkingMemory(userId: string): Promise<void> {
  await ensureStorageInitialized()

  // Get all threads for the user
  const threads = await storage.getThreadsByResourceId({ resourceId: userId })

  // Clear working memory from each thread
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

/**
 * Get a summary of working memory for agent context injection
 */
export async function getWorkingMemorySummary(
  userId: string,
  threadId: string
): Promise<string> {
  const state = await getWorkingMemory(userId, threadId)

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
