import { query } from '../db/postgres.js'

/**
 * Working Memory Entry Type
 */
export interface WorkingMemoryEntry {
  id: string
  user_id: string
  thread_id: string
  key: string
  value: any
  created_at: Date
  updated_at: Date
}

/**
 * Working Memory State
 * Aggregated view of all key-value pairs for a user/thread
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
 * Get all working memory entries for a user and thread
 */
export async function getWorkingMemory(
  userId: string,
  threadId: string
): Promise<WorkingMemoryState> {
  const result = await query<WorkingMemoryEntry>(
    `SELECT id, user_id, thread_id, key, value, created_at, updated_at
     FROM working_memory
     WHERE user_id = $1 AND thread_id = $2`,
    [userId, threadId]
  )

  // Build state from key-value entries
  const state: WorkingMemoryState = {
    findings: [],
    insights: [],
    decisions: [],
    processedUrls: [],
    completedQueries: [],
    followUpQuestions: [],
    phase: 'initial',
    customData: {},
  }

  for (const entry of result.rows) {
    switch (entry.key) {
      case 'findings':
        state.findings = entry.value || []
        break
      case 'insights':
        state.insights = entry.value || []
        break
      case 'decisions':
        state.decisions = entry.value || []
        break
      case 'processedUrls':
        state.processedUrls = entry.value || []
        break
      case 'completedQueries':
        state.completedQueries = entry.value || []
        break
      case 'followUpQuestions':
        state.followUpQuestions = entry.value || []
        break
      case 'phase':
        state.phase = entry.value || 'initial'
        break
      default:
        state.customData[entry.key] = entry.value
    }
  }

  return state
}

/**
 * Set a working memory value (upsert)
 */
export async function setWorkingMemory(
  userId: string,
  threadId: string,
  key: string,
  value: any
): Promise<void> {
  await query(
    `INSERT INTO working_memory (user_id, thread_id, key, value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, thread_id, key)
     DO UPDATE SET value = $4, updated_at = NOW()`,
    [userId, threadId, key, JSON.stringify(value)]
  )
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
  await query(
    `DELETE FROM working_memory WHERE user_id = $1 AND thread_id = $2`,
    [userId, threadId]
  )
}

/**
 * Clear all working memory for a user
 */
export async function clearAllUserWorkingMemory(userId: string): Promise<void> {
  await query(
    `DELETE FROM working_memory WHERE user_id = $1`,
    [userId]
  )
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
