/**
 * Breach Report Workflow with Working Memory
 *
 * Combines breach intelligence reporting with working memory
 * for continuous context across research steps.
 */

import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { RAG_COLLECTIONS } from '../config/rag';
import { getWorkingMemory, clearWorkingMemory } from '../memory/workingMemory';

// Step 1: Get breach/CVE from user
const getTargetStep = createStep({
  id: 'get-target',
  inputSchema: z.object({}),
  outputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    sessionId: z.string(),
  }),
  resumeSchema: z.object({
    target: z.string(),
  }),
  suspendSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ resumeData, suspend }) => {
    if (resumeData) {
      const target = resumeData.target;
      const isCVE = /CVE-\d{4}-\d{4,}/i.test(target);
      const targetType: 'breach' | 'cve' | 'unknown' = isCVE ? 'cve' : 'breach';

      // Initialize working memory session
      const sessionId = `breach-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      console.log(`🧠 Initialized working memory session: ${sessionId}`);

      const workingMemory = getWorkingMemory(sessionId);
      workingMemory.setPhase('initial');

      return {
        target,
        targetType,
        sessionId,
      };
    }

    await suspend({
      message: 'Enter breach name or CVE ID (e.g., "SolarWinds breach" or "CVE-2023-12345"):',
    });

    return { target: '', targetType: 'unknown' as const, sessionId: '' };
  },
});

// Step 2: Web research with working memory
const webResearchStep = createStep({
  id: 'web-research',
  inputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    sessionId: z.string(),
  }),
  outputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    sessionId: z.string(),
    rawFindings: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { target, targetType, sessionId } = inputData;
    const agent = mastra.getAgent('webResearcherAgent');

    console.log(`🔬 Starting web research with working memory...`);

    const workingMemory = getWorkingMemory(sessionId);
    workingMemory.setPhase('follow-up');

    const prompt = `Research this ${targetType}: "${target}"

Session ID: ${sessionId}

Follow the complete research methodology to gather comprehensive information.
Track your findings and follow-up questions as you research.`;

    const result = await agent.generate(
      [{ role: 'user', content: prompt }],
      { maxSteps: 20 }
    );

    // Store findings in working memory
    workingMemory.addFinding(
      result.text.substring(0, 500),
      'webResearcherAgent',
      'primary research data'
    );

    const stats = workingMemory.getStats();
    console.log(`✓ Web research complete. Stats:`, stats);

    return {
      target,
      targetType,
      sessionId,
      rawFindings: result.text.substring(0, 50000), // Truncate to ~50KB to prevent memory issues
    };
  },
});

// Step 3: Intelligence analysis with working memory context
const intelAnalysisStep = createStep({
  id: 'intel-analysis',
  inputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    sessionId: z.string(),
    rawFindings: z.string(),
  }),
  outputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    sessionId: z.string(),
    structuredIntel: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { target, targetType, sessionId, rawFindings } = inputData;
    const agent = mastra.getAgent('breachIntelAgent');

    console.log(`🔍 Starting intelligence analysis with working memory context...`);

    const workingMemory = getWorkingMemory(sessionId);
    workingMemory.setPhase('analysis');

    // Get accumulated context from working memory
    const memoryContext = workingMemory.getContextForAgent();

    const prompt = `Analyze these research findings for "${target}":

${rawFindings}

Working Memory Context (accumulated research insights):
${memoryContext}

Provide comprehensive structured intelligence analysis including:
1. A concise summary
2. The attack chain step-by-step
3. Root cause analysis
4. What the attacker exploited
5. Impact and severity
6. Recommended mitigations
7. How an autonomous agent could detect or prevent this attack

Structure your response clearly with distinct sections.`;

    const result = await agent.generate(
      [{ role: 'user', content: prompt }],
      { maxSteps: 10 }
    );

    // Store analysis in working memory
    workingMemory.addFinding(
      result.text.substring(0, 500),
      'breachIntelAgent',
      'structured intelligence analysis'
    );

    return {
      target,
      targetType,
      sessionId,
      structuredIntel: result.text.substring(0, 50000), // Truncate to ~50KB to prevent memory issues
    };
  },
});

// Step 4: Report formatting with working memory context
const reportFormattingStep = createStep({
  id: 'report-formatting',
  inputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    sessionId: z.string(),
    structuredIntel: z.string(),
  }),
  outputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    sessionId: z.string(),
    finalReport: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { target, targetType, sessionId, structuredIntel } = inputData;
    const agent = mastra.getAgent('reportFormatterAgent');

    console.log(`📄 Generating report with working memory context...`);

    const workingMemory = getWorkingMemory(sessionId);
    workingMemory.setPhase('complete');

    // Get full context and stats from working memory
    const memoryContext = workingMemory.getContextForAgent();
    const stats = workingMemory.getStats();

    const prompt = `Generate a professional security intelligence report for "${target}":

${structuredIntel}

Working Memory Context (full research journey):
${memoryContext}

Research Statistics:
- Duration: ${stats.durationSeconds}s
- Findings: ${stats.findings}
- URLs Processed: ${stats.urlsProcessed}
- Queries Completed: ${stats.queriesCompleted}

Create a comprehensive, PDF-ready markdown report following the complete report structure and formatting standards.
Include a section reflecting the research journey and accumulated insights.`;

    const result = await agent.generate(
      [{ role: 'user', content: prompt }],
      { maxSteps: 5 }
    );

    // Store the finalized report in RAG for future retrieval
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tools = (mastra as any).tools;
      if (tools?.storeBreachIntelTool) {
        await tools.storeBreachIntelTool.execute({
          context: {
            collection: RAG_COLLECTIONS.BREACH_REPORTS,
            content: result.text,
            metadata: {
              identifier: target,
              type: targetType,
              source: 'workflow:breach-report',
              dateAdded: new Date().toISOString(),
              sessionId,
              researchStats: stats,
            },
          },
        });
        console.log(`✓ Report stored in RAG`);
      }
    } catch (err) {
      console.error('Failed to store report in RAG:', err);
    }

    return {
      target,
      targetType,
      sessionId,
      finalReport: result.text,
    };
  },
});

// Step 5: Cleanup working memory and archive
const cleanupWorkingMemoryStep = createStep({
  id: 'cleanup-working-memory',
  inputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    sessionId: z.string(),
    finalReport: z.string(),
  }),
  outputSchema: z.object({
    finalReport: z.string(),
    workingMemoryArchive: z.any(),
  }),
  execute: async ({ inputData }) => {
    const { sessionId, finalReport } = inputData;

    console.log(`🧹 Cleaning up working memory session: ${sessionId}`);

    const workingMemory = getWorkingMemory(sessionId);
    const memoryExport = workingMemory.export();

    const archive = {
      sessionId,
      exportedAt: new Date().toISOString(),
      data: memoryExport,
    };

    clearWorkingMemory(sessionId);

    console.log(`✓ Working memory cleared and archived`);

    return {
      finalReport,
      workingMemoryArchive: archive,
    };
  },
});

// Create workflow
export const breachReportWorkflow = createWorkflow({
  id: 'breach-report-workflow',
  inputSchema: z.object({}),
  outputSchema: z.object({
    finalReport: z.string(),
    workingMemoryArchive: z.any(),
  }),
  steps: [
    getTargetStep,
    webResearchStep,
    intelAnalysisStep,
    reportFormattingStep,
    cleanupWorkingMemoryStep,
  ],
});

breachReportWorkflow
  .then(getTargetStep)
  .then(webResearchStep)
  .then(intelAnalysisStep)
  .then(reportFormattingStep)
  .then(cleanupWorkingMemoryStep)
  .commit();
