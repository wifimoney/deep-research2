/**
 * Conversation Demo with Semantic Recall
 *
 * Demonstrates multi-turn conversation with PostgreSQL-backed memory.
 * Based on "Principles of Building AI Agents" Chapter 7.
 *
 * This shows how semantic recall works:
 * 1. User messages are embedded and stored in the vector DB
 * 2. On subsequent turns, similar past messages are retrieved
 * 3. Context from previous conversations is automatically included
 *
 * Run: npx tsx src/examples/conversationDemo.ts
 */

import { mastra } from '../mastra';

async function runConversationDemo() {
  console.log('='.repeat(60));
  console.log('CONVERSATION DEMO WITH SEMANTIC RECALL');
  console.log('='.repeat(60));
  console.log();

  // Get the breach intel agent (has semantic recall enabled)
  const agent = mastra.getAgent('breachIntelAgent');

  if (!agent) {
    console.error('Agent not found. Make sure breachIntelAgent is registered.');
    process.exit(1);
  }

  // Create unique identifiers for this conversation
  const threadId = `demo-thread-${Date.now()}`;
  const resourceId = 'demo-user-123';

  console.log(`Thread ID: ${threadId}`);
  console.log(`Resource ID: ${resourceId}`);
  console.log();

  // Turn 1: Initial question
  console.log('-'.repeat(60));
  console.log('TURN 1: Initial Question');
  console.log('-'.repeat(60));
  const question1 = 'What is Log4Shell (CVE-2021-44228) and why was it so critical?';
  console.log(`User: ${question1}`);
  console.log();

  const response1 = await agent.generate(question1, {
    threadId,
    resourceId,
  });
  console.log(`Assistant: ${response1.text.substring(0, 500)}...`);
  console.log();

  // Turn 2: Follow-up question (relies on context from Turn 1)
  console.log('-'.repeat(60));
  console.log('TURN 2: Follow-up Question (uses memory from Turn 1)');
  console.log('-'.repeat(60));
  const question2 = 'What specific mitigations would you recommend for it?';
  console.log(`User: ${question2}`);
  console.log();

  const response2 = await agent.generate(question2, {
    threadId,
    resourceId,
  });
  console.log(`Assistant: ${response2.text.substring(0, 500)}...`);
  console.log();

  // Turn 3: Reference earlier context
  console.log('-'.repeat(60));
  console.log('TURN 3: Reference Earlier Context');
  console.log('-'.repeat(60));
  const question3 = 'How does this compare to other critical vulnerabilities we discussed?';
  console.log(`User: ${question3}`);
  console.log();

  const response3 = await agent.generate(question3, {
    threadId,
    resourceId,
  });
  console.log(`Assistant: ${response3.text.substring(0, 500)}...`);
  console.log();

  // Summary
  console.log('='.repeat(60));
  console.log('DEMO COMPLETE');
  console.log('='.repeat(60));
  console.log();
  console.log('Key observations:');
  console.log('1. Turn 2 understood "it" referred to Log4Shell from Turn 1');
  console.log('2. Turn 3 could reference earlier discussion context');
  console.log('3. Semantic recall enabled cross-turn memory automatically');
  console.log();
  console.log(`All messages stored in thread: ${threadId}`);
}

// Cross-conversation semantic recall demo
async function runSemanticRecallDemo() {
  console.log();
  console.log('='.repeat(60));
  console.log('SEMANTIC RECALL ACROSS CONVERSATIONS');
  console.log('='.repeat(60));
  console.log();

  const agent = mastra.getAgent('breachIntelAgent');
  if (!agent) return;

  const resourceId = 'demo-user-456';

  // Conversation A
  const threadA = `thread-a-${Date.now()}`;
  console.log(`Conversation A (${threadA}):`);
  await agent.generate(
    'Tell me about the SolarWinds supply chain attack and its impact.',
    { threadId: threadA, resourceId }
  );
  console.log('  -> Discussed SolarWinds attack');
  console.log();

  // Conversation B (same user, different thread)
  const threadB = `thread-b-${Date.now()}`;
  console.log(`Conversation B (${threadB}):`);
  const response = await agent.generate(
    'What are common patterns in supply chain attacks like we discussed before?',
    { threadId: threadB, resourceId }
  );
  console.log('  -> Asked about supply chain patterns');
  console.log();

  console.log('With semantic recall (scope: "resource"), the agent can recall');
  console.log('relevant context from Conversation A when answering in Conversation B.');
  console.log();
  console.log(`Response preview: ${response.text.substring(0, 300)}...`);
}

// Main execution
async function main() {
  try {
    await runConversationDemo();
    await runSemanticRecallDemo();
  } catch (error) {
    console.error('Demo failed:', error);
    process.exit(1);
  }
}

main();



