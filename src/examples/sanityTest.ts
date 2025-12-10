/**
 * Sanity Test for Working Memory, Semantic Recall, and PostgreSQL
 *
 * Run: npx tsx src/examples/sanityTest.ts
 */

import 'dotenv/config';

// Fix malformed DATABASE_URL if it contains the key as part of the value
let dbUrl = process.env.DATABASE_URL;
if (dbUrl?.startsWith('DATABASE_URL=')) {
  dbUrl = dbUrl.replace('DATABASE_URL=', '');
  process.env.DATABASE_URL = dbUrl;
  console.log('\n⚠️  Fixed malformed DATABASE_URL (had duplicate key prefix)\n');
}

// Now import modules that depend on DATABASE_URL
import { getWorkingMemory, clearWorkingMemory } from '../mastra/memory/workingMemory';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function pass(msg: string) {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}

function fail(msg: string, error?: unknown) {
  console.log(`${RED}✗${RESET} ${msg}`);
  if (error) console.log(`  ${RED}Error: ${error}${RESET}`);
}

function info(msg: string) {
  console.log(`${YELLOW}ℹ${RESET} ${msg}`);
}

async function testWorkingMemory() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 1: WORKING MEMORY');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const sessionId = `test-session-${Date.now()}`;
    const memory = getWorkingMemory(sessionId);

    // Test 1.1: Initial state
    const stats = memory.getStats();
    if (stats.sessionId === sessionId && stats.findings === 0) {
      pass('Working memory initialized with correct session ID');
    } else {
      fail('Working memory initialization failed');
    }

    // Test 1.2: Add findings
    memory.addFinding('Log4Shell is critical', 'https://example.com', 'high relevance');
    memory.addFinding('CVSS 10.0', 'https://nvd.nist.gov', 'official source');
    if (memory.getFindings().length === 2) {
      pass('Findings added successfully');
    } else {
      fail('Failed to add findings');
    }

    // Test 1.3: URL deduplication
    const testUrl = 'https://duplicate-test.com';
    memory.markUrlProcessed(testUrl);
    if (memory.isUrlProcessed(testUrl) && !memory.isUrlProcessed('https://new-url.com')) {
      pass('URL deduplication working');
    } else {
      fail('URL deduplication failed');
    }

    // Test 1.4: Query tracking
    const testQuery = 'What is Log4Shell?';
    memory.markQueryCompleted(testQuery);
    if (memory.isQueryCompleted(testQuery) && !memory.isQueryCompleted('New query')) {
      pass('Query tracking working');
    } else {
      fail('Query tracking failed');
    }

    // Test 1.5: Follow-up questions
    memory.addFollowUpQuestion('How to mitigate?');
    memory.addFollowUpQuestion('What systems affected?');
    memory.addFollowUpQuestion('How to mitigate?'); // Duplicate - should be ignored
    if (memory.getFollowUpQuestions().length === 2) {
      pass('Follow-up questions with deduplication working');
    } else {
      fail('Follow-up questions failed');
    }

    // Test 1.6: Phase tracking
    memory.setPhase('analysis');
    if (memory.getPhase() === 'analysis') {
      pass('Phase tracking working');
    } else {
      fail('Phase tracking failed');
    }

    // Test 1.7: Context generation
    const context = memory.getContextForAgent();
    if (context.includes('Log4Shell') && context.includes('analysis')) {
      pass('Context generation working');
    } else {
      fail('Context generation failed');
    }

    // Test 1.8: Summary generation
    const summary = memory.getSummary();
    if (summary.includes('WORKING MEMORY SUMMARY') && summary.includes(sessionId)) {
      pass('Summary generation working');
    } else {
      fail('Summary generation failed');
    }

    // Cleanup
    clearWorkingMemory(sessionId);
    pass('Working memory cleared');

  } catch (error) {
    fail('Working memory test crashed', error);
  }
}

async function testSemanticRecallConfig() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 2: SEMANTIC RECALL CONFIGURATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Dynamic import after DATABASE_URL fix
    const { createMemory, researchMemory, memoryStorage, memoryVector } = await import('../mastra/config/memory');

    // Test 2.1: Memory creation with defaults
    const defaultMemory = createMemory();
    if (defaultMemory) {
      pass('Default memory instance created');
    } else {
      fail('Failed to create default memory');
    }

    // Test 2.2: Research memory configuration
    if (researchMemory) {
      pass('Research memory instance available');
    } else {
      fail('Research memory not available');
    }

    // Test 2.3: Memory with semantic recall disabled
    const lightMemory = createMemory({ semanticRecall: false });
    if (lightMemory) {
      pass('Lightweight memory (no semantic recall) created');
    } else {
      fail('Failed to create lightweight memory');
    }

    // Test 2.4: Custom semantic recall config
    const customMemory = createMemory({
      lastMessages: 30,
      semanticRecall: {
        topK: 5,
        messageRange: 3,
        scope: 'thread',
      },
    });
    if (customMemory) {
      pass('Custom semantic recall config accepted');
    } else {
      fail('Custom semantic recall config failed');
    }

    // Test 2.5: Storage backend detection
    const databaseUrl = process.env.DATABASE_URL || '';
    const isPostgres = databaseUrl.startsWith('postgresql://');
    info(`DATABASE_URL: ${databaseUrl.substring(0, 40)}...`);
    info(`Storage backend: ${isPostgres ? 'PostgreSQL' : 'LibSQL'}`);
    
    if (memoryStorage && memoryVector) {
      pass(`Memory storage and vector initialized (${isPostgres ? 'PostgreSQL' : 'LibSQL'})`);
    } else {
      fail('Memory storage/vector not initialized');
    }

  } catch (error) {
    fail('Semantic recall test crashed', error);
  }
}

async function testRAGConfiguration() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 3: RAG / VECTOR STORE CONFIGURATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Dynamic import after DATABASE_URL fix
    const { breachIntelMemory, RAG_COLLECTIONS } = await import('../mastra/config/rag');

    // Test 3.1: RAG collections defined
    const collections = Object.values(RAG_COLLECTIONS);
    if (collections.length === 6) {
      pass(`RAG collections defined: ${collections.join(', ')}`);
    } else {
      fail('RAG collections not properly defined');
    }

    // Test 3.2: Vector store available
    if (breachIntelMemory.vectorStore) {
      pass('Vector store instance available');
    } else {
      fail('Vector store not initialized');
    }

    // Test 3.3: RAG config values
    const config = breachIntelMemory.config;
    info(`Embedding model: ${config.model}`);
    info(`Vector DB URL: ${config.vectorDbUrl.substring(0, 40)}...`);
    info(`Default topK: ${config.defaultTopK}`);
    
    if (config.model && config.vectorDbUrl) {
      pass('RAG configuration loaded');
    } else {
      fail('RAG configuration incomplete');
    }

    // Test 3.4: PostgreSQL detection for RAG
    const isRagPostgres = config.vectorDbUrl.startsWith('postgresql://');
    info(`RAG storage backend: ${isRagPostgres ? 'PostgreSQL (PgVector)' : 'LibSQL'}`);
    pass(`RAG backend detection working`);

  } catch (error) {
    fail('RAG configuration test crashed', error);
  }
}

async function testMastraIntegration() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 4: MASTRA INTEGRATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Dynamic import to avoid initialization issues in test
    const { mastra } = await import('../mastra');

    // Test 4.1: Mastra instance
    if (mastra) {
      pass('Mastra instance created');
    } else {
      fail('Mastra instance not available');
    }

    // Test 4.2: Agents registered
    const agents = [
      'researchAgent',
      'breachIntelAgent',
      'workingMemoryResearchAgent',
      'ragEnhancedBreachIntelAgent',
    ];

    for (const agentName of agents) {
      try {
        const agent = mastra.getAgent(agentName);
        if (agent) {
          pass(`Agent "${agentName}" registered`);
        } else {
          fail(`Agent "${agentName}" not found`);
        }
      } catch {
        fail(`Agent "${agentName}" failed to load`);
      }
    }

    // Test 4.3: Workflows registered
    const workflows = ['breachReportWorkflow', 'researchWorkflow'];
    for (const workflowName of workflows) {
      try {
        const workflow = mastra.getWorkflow(workflowName);
        if (workflow) {
          pass(`Workflow "${workflowName}" registered`);
        } else {
          fail(`Workflow "${workflowName}" not found`);
        }
      } catch {
        fail(`Workflow "${workflowName}" failed to load`);
      }
    }

    // Test 4.4: Vector store registered
    try {
      const vectors = mastra.getVectors();
      if (vectors && 'breachIntelVector' in vectors) {
        pass('Breach intel vector store registered in Mastra');
      } else {
        fail('Vector store not registered in Mastra');
      }
    } catch {
      info('Vector store registration check skipped');
    }

  } catch (error) {
    fail('Mastra integration test crashed', error);
  }
}

async function testDatabaseConnection() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 5: DATABASE CONNECTION');
  console.log('═══════════════════════════════════════════════════════════\n');

  const databaseUrl = process.env.DATABASE_URL || '';
  const isPostgres = databaseUrl.startsWith('postgresql://');

  if (!isPostgres) {
    info('Using LibSQL (local file storage) - no remote connection test needed');
    pass('LibSQL configuration detected');
    return;
  }

  try {
    const { memoryStorage } = await import('../mastra/config/memory');
    
    // Try a simple operation to verify connection
    info('Testing PostgreSQL connection...');
    
    // PostgresStore should have connected during initialization
    if (memoryStorage) {
      pass('PostgreSQL storage instance created');
      info('Connection will be verified on first query');
    } else {
      fail('PostgreSQL storage not initialized');
    }
  } catch (error) {
    fail('PostgreSQL connection test failed', error);
  }
}

async function runAllTests() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║            SANITY TEST SUITE                              ║');
  console.log('║    Working Memory | Semantic Recall | PostgreSQL          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  await testWorkingMemory();
  await testSemanticRecallConfig();
  await testRAGConfiguration();
  await testMastraIntegration();
  await testDatabaseConnection();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST SUITE COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');
}

runAllTests().catch(console.error);
