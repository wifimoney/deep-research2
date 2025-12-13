import { Mastra } from '@mastra/core/mastra';
import { storage } from './config/storage.js';
import { researchWorkflow } from '../../template-agents/researchWorkflow';
import { learningExtractionAgent } from '../../template-agents/learningExtractionAgent';
import { evaluationAgent } from '../../template-agents/evaluationAgent';
import { reportAgent } from '../../template-agents/reportAgent';
import { researchAgent } from '../../template-agents/researchAgent';
import { webSummarizationAgent } from '../../template-agents/webSummarizationAgent';
import { breachIntelAgent } from './agents/breachIntelAgent';
import { ragEnhancedBreachIntelAgent } from './agents/ragEnhancedBreachIntelAgent';
import { webResearcherAgent } from './agents/webResearcherAgent';
import { reportFormatterAgent } from './agents/reportFormatterAgent';
import { workingMemoryResearchAgent } from './agents/workingMemoryResearchAgent';
import { generateReportWorkflow } from '../../template-agents/generateReportWorkflow';
import { breachReportWorkflow } from './workflows/breachReportWorkflow';
import { initializeRAGCollections, breachIntelMemory } from './config/rag';

/**
 * Mastra Instance
 * 
 * Uses shared storage from storage.ts - single PostgreSQL database.
 * All agents, workflows, memory, and RAG use the same database connection.
 */

export const mastra = new Mastra({
  storage,
  agents: {
    researchAgent,
    reportAgent,
    evaluationAgent,
    learningExtractionAgent,
    webSummarizationAgent,
    breachIntelAgent,
    ragEnhancedBreachIntelAgent,
    webResearcherAgent,
    reportFormatterAgent,
    workingMemoryResearchAgent,
  },
  vectors: {
    breachIntelVector: breachIntelMemory.vectorStore,
  },
  workflows: {
    generateReportWorkflow,
    researchWorkflow,
    breachReportWorkflow,
  },
  // Observability disabled - OpenTelemetry causes memory crashes with large payloads
  // TODO: Re-enable when Mastra adds payload truncation/limits to trace exporters
});

// Initialize RAG collections at startup
initializeRAGCollections()
  .then(() => console.log('✅ RAG collections initialized'))
  .catch((err) => console.error('❌ RAG init failed', err));
