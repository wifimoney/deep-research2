import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { PostgresStore } from '@mastra/pg';
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
import {
  storeBreachIntelTool,
  retrieveBreachIntelTool,
  findSimilarThreatsTool,
} from './tools/ragTools';
import {
  getWorkingMemoryContextTool,
  workingMemoryEvaluateTool,
  workingMemoryExtractLearningsTool,
  workingMemoryWebSearchTool,
} from './tools/workingMemoryTools';

// Determine which storage backend to use based on DATABASE_URL
// If DATABASE_URL starts with 'postgresql://', use PostgresStore
// Otherwise, use LibSQLStore (supports file:, libsql:, etc.)
const databaseUrl = process.env.DATABASE_URL?.trim() || 'file:./storage.db';

let storage: LibSQLStore | PostgresStore;

if (databaseUrl && databaseUrl.startsWith('postgresql://')) {
  storage = new PostgresStore({
    connectionString: databaseUrl,
  });
} else {
  // Use LibSQLStore for file-based or LibSQL URLs
  storage = new LibSQLStore({
    url: databaseUrl,
  });
}

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
  tools: {
    storeBreachIntelTool,
    retrieveBreachIntelTool,
    findSimilarThreatsTool,
    workingMemoryWebSearchTool,
    workingMemoryEvaluateTool,
    workingMemoryExtractLearningsTool,
    getWorkingMemoryContextTool,
  },
  vectors: {
    breachIntelVector: breachIntelMemory.vectorStore,
  },
  workflows: {
    generateReportWorkflow,
    researchWorkflow,
    breachReportWorkflow,
  },
  observability: {
    default: {
      enabled: false, // Disabled to prevent "Invalid string length" errors with large telemetry payloads
    },
  },
});

// Initialize RAG collections at startup
initializeRAGCollections()
  .then(() => console.log('✅ RAG collections initialized'))
  .catch((err) => console.error('❌ RAG init failed', err));
