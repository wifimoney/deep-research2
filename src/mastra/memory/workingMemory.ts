/**
 * Working Memory System for Agents
 *
 * Provides short-term memory for agents to track:
 * - What they've learned during the current task
 * - What URLs/sources they've already processed
 * - Key findings and insights accumulated
 * - Follow-up questions generated
 * - Current research phase and progress
 */

interface WorkingMemoryEntry {
  timestamp: Date;
  type: 'finding' | 'url' | 'question' | 'insight' | 'decision' | 'phase';
  content: any;
  source?: string;
}

interface ResearchProgress {
  phase: 'initial' | 'follow-up' | 'analysis' | 'complete';
  completedQueries: string[];
  processedUrls: Set<string>;
  keyFindings: Array<{
    finding: string;
    source: string;
    relevance: string;
  }>;
  followUpQuestions: string[];
  insights: string[];
  decisions: Array<{
    decision: string;
    reasoning: string;
  }>;
}

export class WorkingMemory {
  private sessionId: string;
  private entries: WorkingMemoryEntry[] = [];
  private researchProgress: ResearchProgress;
  private startTime: Date;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.startTime = new Date();
    this.researchProgress = {
      phase: 'initial',
      completedQueries: [],
      processedUrls: new Set(),
      keyFindings: [],
      followUpQuestions: [],
      insights: [],
      decisions: [],
    };
  }

  /**
   * Add a new finding to working memory
   */
  addFinding(finding: string, source: string, relevance: string) {
    this.entries.push({
      timestamp: new Date(),
      type: 'finding',
      content: { finding, source, relevance },
      source,
    });

    this.researchProgress.keyFindings.push({ finding, source, relevance });
  }

  /**
   * Mark a URL as processed to avoid duplicates
   */
  markUrlProcessed(url: string) {
    this.entries.push({
      timestamp: new Date(),
      type: 'url',
      content: url,
    });

    this.researchProgress.processedUrls.add(url);
  }

  /**
   * Check if a URL has already been processed
   */
  isUrlProcessed(url: string): boolean {
    return this.researchProgress.processedUrls.has(url);
  }

  /**
   * Add a follow-up question
   */
  addFollowUpQuestion(question: string) {
    if (this.researchProgress.followUpQuestions.includes(question)) {
      return; // Avoid duplicates
    }

    this.entries.push({
      timestamp: new Date(),
      type: 'question',
      content: question,
    });

    this.researchProgress.followUpQuestions.push(question);
  }

  /**
   * Mark a query as completed
   */
  markQueryCompleted(query: string) {
    if (!this.researchProgress.completedQueries.includes(query)) {
      this.researchProgress.completedQueries.push(query);
    }
  }

  /**
   * Check if a query has been completed
   */
  isQueryCompleted(query: string): boolean {
    return this.researchProgress.completedQueries.includes(query);
  }

  /**
   * Add an insight
   */
  addInsight(insight: string) {
    this.entries.push({
      timestamp: new Date(),
      type: 'insight',
      content: insight,
    });

    this.researchProgress.insights.push(insight);
  }

  /**
   * Record a decision
   */
  recordDecision(decision: string, reasoning: string) {
    this.entries.push({
      timestamp: new Date(),
      type: 'decision',
      content: { decision, reasoning },
    });

    this.researchProgress.decisions.push({ decision, reasoning });
  }

  /**
   * Update research phase
   */
  setPhase(phase: ResearchProgress['phase']) {
    this.entries.push({
      timestamp: new Date(),
      type: 'phase',
      content: phase,
    });

    this.researchProgress.phase = phase;
  }

  /**
   * Get current research phase
   */
  getPhase(): ResearchProgress['phase'] {
    return this.researchProgress.phase;
  }

  /**
   * Get all processed URLs
   */
  getProcessedUrls(): string[] {
    return Array.from(this.researchProgress.processedUrls);
  }

  /**
   * Get all key findings
   */
  getFindings() {
    return this.researchProgress.keyFindings;
  }

  /**
   * Get all follow-up questions
   */
  getFollowUpQuestions(): string[] {
    return this.researchProgress.followUpQuestions;
  }

  /**
   * Get remaining follow-up questions (not yet searched)
   */
  getRemainingFollowUpQuestions(): string[] {
    return this.researchProgress.followUpQuestions.filter(
      (q) => !this.isQueryCompleted(q),
    );
  }

  /**
   * Get all insights
   */
  getInsights(): string[] {
    return this.researchProgress.insights;
  }

  /**
   * Get summary of current state for agent context
   */
  getSummary(): string {
    const duration = Math.floor((Date.now() - this.startTime.getTime()) / 1000);

    return `
=== WORKING MEMORY SUMMARY ===
Session: ${this.sessionId}
Phase: ${this.researchProgress.phase}
Duration: ${duration}s

Progress:
- Completed ${this.researchProgress.completedQueries.length} queries
- Processed ${this.researchProgress.processedUrls.size} URLs
- Found ${this.researchProgress.keyFindings.length} key findings
- Generated ${this.researchProgress.followUpQuestions.length} follow-up questions
- Accumulated ${this.researchProgress.insights.length} insights

Key Findings:
${this.researchProgress.keyFindings
      .slice(0, 5)
      .map((f, i) => `${i + 1}. ${f.finding.substring(0, 100)}...`)
      .join('\n')}

${this.researchProgress.followUpQuestions.length > 0 ? `
Follow-up Questions (${this.getRemainingFollowUpQuestions().length} remaining):
${this.getRemainingFollowUpQuestions()
        .slice(0, 3)
        .map((q, i) => `${i + 1}. ${q}`)
        .join('\n')}
` : ''}

Recent Insights:
${this.researchProgress.insights
      .slice(-3)
      .map((ins, i) => `${i + 1}. ${ins}`)
      .join('\n')}
`;
  }

  /**
   * Get detailed context for agent prompt injection
   */
  getContextForAgent(): string {
    return `
## YOUR WORKING MEMORY

You have been researching for ${Math.floor((Date.now() - this.startTime.getTime()) / 1000)} seconds.
Current Phase: ${this.researchProgress.phase}

### What You've Learned:
${this.researchProgress.keyFindings
      .map((f, i) => `${i + 1}. ${f.finding} (from ${f.source})`)
      .join('\n')}

### URLs Already Processed (${this.getProcessedUrls().length}):
${this.getProcessedUrls().slice(0, 10).join(', ')}
${this.getProcessedUrls().length > 10 ? '...' : ''}

### Queries Completed (${this.researchProgress.completedQueries.length}):
${this.researchProgress.completedQueries.join(', ')}

### Follow-up Questions to Explore (${this.getRemainingFollowUpQuestions().length}):
${this.getRemainingFollowUpQuestions()
      .map((q, i) => `${i + 1}. ${q}`)
      .join('\n')}

### Key Insights So Far:
${this.researchProgress.insights.map((ins, i) => `${i + 1}. ${ins}`).join('\n')}

**Remember:** Use this context to avoid repeating work and to build on what you've already learned.
`;
  }

  /**
   * Export complete state
   */
  export() {
    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      duration: Date.now() - this.startTime.getTime(),
      entries: this.entries,
      researchProgress: {
        ...this.researchProgress,
        processedUrls: Array.from(this.researchProgress.processedUrls),
      },
    };
  }

  /**
   * Clear working memory (use when starting new task)
   */
  clear() {
    this.entries = [];
    this.researchProgress = {
      phase: 'initial',
      completedQueries: [],
      processedUrls: new Set(),
      keyFindings: [],
      followUpQuestions: [],
      insights: [],
      decisions: [],
    };
    this.startTime = new Date();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      sessionId: this.sessionId,
      durationSeconds: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      totalEntries: this.entries.length,
      findings: this.researchProgress.keyFindings.length,
      urlsProcessed: this.researchProgress.processedUrls.size,
      queriesCompleted: this.researchProgress.completedQueries.length,
      followUpQuestions: this.researchProgress.followUpQuestions.length,
      insights: this.researchProgress.insights.length,
      decisions: this.researchProgress.decisions.length,
      currentPhase: this.researchProgress.phase,
    };
  }
}

// Global working memory store (in-memory for single process)
// For distributed systems, use Redis or similar
const activeWorkingMemories = new Map<string, WorkingMemory>();

/**
 * Get or create working memory for a session
 */
export function getWorkingMemory(sessionId: string): WorkingMemory {
  if (!activeWorkingMemories.has(sessionId)) {
    activeWorkingMemories.set(sessionId, new WorkingMemory(sessionId));
  }
  return activeWorkingMemories.get(sessionId)!;
}

/**
 * Clear working memory for a session
 */
export function clearWorkingMemory(sessionId: string): void {
  activeWorkingMemories.delete(sessionId);
}

/**
 * Get all active sessions
 */
export function getActiveSessions(): string[] {
  return Array.from(activeWorkingMemories.keys());
}

/**
 * Export all working memories (for debugging/analysis)
 */
export function exportAllWorkingMemories() {
  const exports: Record<string, any> = {};
  for (const [sessionId, memory] of activeWorkingMemories.entries()) {
    exports[sessionId] = memory.export();
  }
  return exports;
}
