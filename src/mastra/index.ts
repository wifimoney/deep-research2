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

// Determine which storage backend to use based on DATABASE_URL
// If DATABASE_URL starts with 'postgresql://', use PostgresStore
// Otherwise, use LibSQLStore (supports file:, libsql:, etc.)
let databaseUrl = process.env.DATABASE_URL?.trim() || 'file:./storage.db';

// Fix malformed DATABASE_URL if it contains the key as part of the value
if (databaseUrl.startsWith('DATABASE_URL=')) {
  databaseUrl = databaseUrl.replace('DATABASE_URL=', '');
}

const isPostgres = databaseUrl.startsWith('postgresql://');

// Only add SSL for remote connections (not localhost/127.0.0.1)
const isLocalhost = databaseUrl.includes('@localhost') || databaseUrl.includes('@127.0.0.1');
if (isPostgres && !isLocalhost && !databaseUrl.includes('sslmode=')) {
  databaseUrl += databaseUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
}

let storage: LibSQLStore | PostgresStore;

if (isPostgres) {
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
  // Explicitly disable deprecated OTEL tracing to prevent memory issues
  // The old telemetry system captures full span data including agent messages,
  // which causes "Invalid string length" errors and heap exhaustion
  telemetry: {
    enabled: false,
  },
});

// Initialize RAG collections at startup
initializeRAGCollections()
  .then(() => console.log('✅ RAG collections initialized'))
  .catch((err) => console.error('❌ RAG init failed', err));
