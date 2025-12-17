/**
 * Breach Report Workflow with Mastra Memory
 *
 * Combines breach intelligence reporting with Mastra Memory
 * for continuous context across research steps.
 */

import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { RAG_COLLECTIONS, breachIntelMemory } from '../config/rag';

/**
 * Retry wrapper with exponential backoff for rate-limited API calls
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 2000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err as Error;
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 429) {
        const waitTime = delayMs * (attempt + 1);
        console.log(`⏳ Rate limited, retrying in ${waitTime}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Smart truncation that preserves document structure
 */
function smartTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  // Find last complete section before limit
  const truncated = text.substring(0, maxLength);
  const lastSectionBreak = truncated.lastIndexOf('\n===');

  if (lastSectionBreak > maxLength * 0.5) {
    return truncated.substring(0, lastSectionBreak) + '\n\n[Content truncated due to length]';
  }

  // Fallback: truncate at last paragraph
  const lastParagraph = truncated.lastIndexOf('\n\n');
  if (lastParagraph > maxLength * 0.3) {
    return truncated.substring(0, lastParagraph) + '\n\n[Content truncated due to length]';
  }

  // Final fallback: truncate at last sentence
  const lastSentence = truncated.lastIndexOf('. ');
  if (lastSentence > maxLength * 0.5) {
    return truncated.substring(0, lastSentence + 1) + '\n\n[Content truncated due to length]';
  }

  return truncated + '\n\n[Content truncated due to length]';
}

// Step 1: Get breach/CVE from user
const getTargetStep = createStep({
  id: 'get-target',
  inputSchema: z.object({}),
  outputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    threadId: z.string(),
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

      // Generate thread ID for this workflow run
      const threadId = `breach-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      console.log(`🧠 Initialized workflow thread: ${threadId}`);

      return {
        target,
        targetType,
        threadId,
      };
    }

    await suspend({
      message: 'Enter breach name or CVE ID (e.g., "SolarWinds breach" or "CVE-2023-12345"):',
    });

    return { target: '', targetType: 'unknown' as const, threadId: '' };
  },
});

// Step 2: Web research with Mastra Memory
const webResearchStep = createStep({
  id: 'web-research',
  inputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    threadId: z.string(),
  }),
  outputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    threadId: z.string(),
    rawFindings: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { target, targetType, threadId } = inputData;
    const agent = mastra.getAgent('webResearcherAgent');

    console.log(`🔬 Starting web research with Mastra Memory...`);

    const prompt = `Research this ${targetType}: "${target}"

Follow the complete research methodology to gather comprehensive information.
Track your findings and follow-up questions as you research.
All your research will be preserved in memory for context in later steps.`;

    const result = await withRetry(
      () => agent.generate([{ role: 'user', content: prompt }], { 
        maxSteps: 20,
        threadId,
        resourceId: 'workflow', // Use a consistent resourceId for workflow runs
      }),
      3,
      2000
    );

    console.log(`✓ Web research complete. Findings length: ${result.text.length} chars`);

    return {
      target,
      targetType,
      threadId,
      rawFindings: smartTruncate(result.text, 50000),
    };
  },
});

// Step 3: Intelligence analysis with Mastra Memory context
const intelAnalysisStep = createStep({
  id: 'intel-analysis',
  inputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    threadId: z.string(),
    rawFindings: z.string(),
  }),
  outputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    threadId: z.string(),
    structuredIntel: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { target, targetType, threadId, rawFindings } = inputData;
    const agent = mastra.getAgent('breachIntelAgent');

    console.log(`🔍 Starting intelligence analysis with Mastra Memory context...`);

    const prompt = `Analyze these research findings for "${target}":

${rawFindings}

Note: Your conversation history from the previous research step is automatically available through memory.
Reference previous findings and build on the accumulated research insights.

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
      { 
        maxSteps: 10,
        threadId,
        resourceId: 'workflow', // Use same resourceId to access previous research
      }
    );

    return {
      target,
      targetType,
      threadId,
      structuredIntel: smartTruncate(result.text, 50000),
    };
  },
});

// Step 4: Report formatting with Mastra Memory context
const reportFormattingStep = createStep({
  id: 'report-formatting',
  inputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    threadId: z.string(),
    structuredIntel: z.string(),
  }),
  outputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    threadId: z.string(),
    finalReport: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { target, targetType, threadId, structuredIntel } = inputData;
    const agent = mastra.getAgent('reportFormatterAgent');

    console.log(`📄 Generating report with Mastra Memory context...`);

    const prompt = `Generate a professional security intelligence report for "${target}":

${structuredIntel}

Note: Your full conversation history from the research and analysis steps is automatically available through memory.
Reference the complete research journey and accumulated insights from previous steps.

Create a comprehensive, PDF-ready markdown report following the complete report structure and formatting standards.
Include a section reflecting the research journey and accumulated insights.`;

    const result = await agent.generate(
      [{ role: 'user', content: prompt }],
      { 
        maxSteps: 5,
        threadId,
        resourceId: 'workflow', // Use same resourceId to access full research history
      }
    );

    // Store the finalized report in RAG for future retrieval
    try {
      await breachIntelMemory.add({
        collection: RAG_COLLECTIONS.BREACH_REPORTS,
        documents: [
          {
            content: result.text,
            metadata: {
              identifier: target,
              type: targetType,
              source: 'workflow:breach-report',
              dateAdded: new Date().toISOString(),
              threadId,
            },
          },
        ],
      });
      console.log(`✓ Report stored in RAG`);
    } catch (err) {
      console.error('Failed to store report in RAG:', err);
    }

    // Save report to filesystem
    try {
      const reportsDir = join(process.cwd(), 'reports');
      await mkdir(reportsDir, { recursive: true });
      const filename = `${target.replace(/[^a-zA-Z0-9-]/g, '-')}-${Date.now()}.md`;
      const filepath = join(reportsDir, filename);
      await writeFile(filepath, result.text);
      console.log(`📄 Report saved to: ${filepath}`);
    } catch (err) {
      console.error('Failed to save report to filesystem:', err);
    }

    return {
      target,
      targetType,
      threadId,
      finalReport: result.text,
    };
  },
});

// Step 5: Workflow completion
const completionStep = createStep({
  id: 'completion',
  inputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
    threadId: z.string(),
    finalReport: z.string(),
  }),
  outputSchema: z.object({
    finalReport: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { threadId, finalReport } = inputData;

    console.log(`✓ Workflow complete. Thread: ${threadId}`);
    console.log(`✓ Report generated (${finalReport.length} chars)`);
    console.log(`✓ All conversation history preserved in Mastra Memory`);

    return {
      finalReport,
    };
  },
});

// Create workflow
export const breachReportWorkflow = createWorkflow({
  id: 'breach-report-workflow',
  inputSchema: z.object({}),
  outputSchema: z.object({
    finalReport: z.string(),
  }),
  steps: [
    getTargetStep,
    webResearchStep,
    intelAnalysisStep,
    reportFormattingStep,
    completionStep,
  ],
});

breachReportWorkflow
  .then(getTargetStep)
  .then(webResearchStep)
  .then(intelAnalysisStep)
  .then(reportFormattingStep)
  .then(completionStep)
  .commit();
