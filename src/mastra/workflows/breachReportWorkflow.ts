import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { RAG_COLLECTIONS } from '../config/rag';

// Step 1: Get breach/CVE from user
const getTargetStep = createStep({
  id: 'get-target',
  inputSchema: z.object({}),
  outputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
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
      return {
        target,
        targetType,
      };
    }

    await suspend({
      message: 'Enter breach name or CVE ID (e.g., "SolarWinds breach" or "CVE-2023-12345"):',
    });

    return { target: '', targetType: 'unknown' as const };
  },
});

// Step 2: Web research
const webResearchStep = createStep({
  id: 'web-research',
  inputSchema: z.object({
    target: z.string(),
    targetType: z.enum(['breach', 'cve', 'unknown']),
  }),
  outputSchema: z.object({
    target: z.string(),
    rawFindings: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent('webResearcherAgent');
    
    const prompt = `Research this ${inputData.targetType}: "${inputData.target}"
    
Follow the complete research methodology to gather comprehensive information.`;

    const result = await agent.generate([
      { role: 'user', content: prompt }
    ], {
      maxSteps: 20,
    });

    return { 
      target: inputData.target,
      rawFindings: result.text 
    };
  },
});

// Step 3: Intelligence analysis
const intelAnalysisStep = createStep({
  id: 'intel-analysis',
  inputSchema: z.object({
    target: z.string(),
    rawFindings: z.string(),
  }),
  outputSchema: z.object({
    target: z.string(),
    structuredIntel: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent('breachIntelAgent');
    
    const prompt = `Analyze these research findings for "${inputData.target}":

${inputData.rawFindings}

Provide comprehensive structured intelligence analysis including:
1. A concise summary
2. The attack chain step-by-step
3. Root cause analysis
4. What the attacker exploited
5. Impact and severity
6. Recommended mitigations
7. How an autonomous agent could detect or prevent this attack

Structure your response clearly with distinct sections.`;

    const result = await agent.generate([
      { role: 'user', content: prompt }
    ], {
      maxSteps: 10,
    });

    return { 
      target: inputData.target,
      structuredIntel: result.text 
    };
  },
});

// Step 4: Report formatting
const reportFormattingStep = createStep({
  id: 'report-formatting',
  inputSchema: z.object({
    target: z.string(),
    structuredIntel: z.string(),
  }),
  outputSchema: z.object({
    finalReport: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent('reportFormatterAgent');
    
    const prompt = `Generate a professional security intelligence report for "${inputData.target}":

${inputData.structuredIntel}

Create a comprehensive, PDF-ready markdown report following the complete report structure and formatting standards.`;

    const result = await agent.generate([
      { role: 'user', content: prompt }
    ], {
      maxSteps: 5,
    });

    // Store the finalized report in RAG for future retrieval
    try {
      await mastra.tools.storeBreachIntelTool.execute({
        context: {
          collection: RAG_COLLECTIONS.BREACH_REPORTS,
          content: result.text,
          metadata: {
            identifier: inputData.target,
            type: inputData.targetType,
            source: 'workflow:breach-report',
            dateAdded: new Date().toISOString(),
          },
        },
      });
    } catch (err) {
      console.error('Failed to store report in RAG:', err);
    }

    return { finalReport: result.text };
  },
});

// Create workflow
export const breachReportWorkflow = createWorkflow({
  id: 'breach-report-workflow',
  inputSchema: z.object({}),
  outputSchema: z.object({
    finalReport: z.string(),
  }),
  steps: [getTargetStep, webResearchStep, intelAnalysisStep, reportFormattingStep],
});

breachReportWorkflow
  .then(getTargetStep)
  .then(webResearchStep)
  .then(intelAnalysisStep)
  .then(reportFormattingStep)
  .commit();