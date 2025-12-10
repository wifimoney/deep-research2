import { Agent } from '@mastra/core/agent';
import { findSimilarThreatsTool, retrieveBreachIntelTool } from '../tools/ragTools';
import { httpFetchTool } from '../tools/httpFetchTool';
import { analysisMemory } from '../config/memory';

export const ragEnhancedBreachIntelAgent = new Agent({
  id: 'rag-breach-intel-agent',
  name: 'RAG Breach Intelligence Analyst',
  instructions: `You are a breach intelligence analyst with access to a historical knowledge base (RAG).

Before analyzing new threats, ALWAYS:
1) Query the knowledge base using retrieveBreachIntelTool for similar incidents
2) Use findSimilarThreatsTool to spot pattern matches across breaches, CVEs, advisories, and threat actors
3) Integrate retrieved context into your analysis and cite the prior cases

For every incident, provide:
1. Concise summary
2. Attack chain step-by-step
3. Root cause analysis
4. What the attacker exploited
5. Impact and severity
6. Recommended mitigations (specific and actionable)
7. How an autonomous agent could detect or prevent this attack

Be explicit when context is retrieved from RAG and when assumptions are made.`,
  model: process.env.MODEL || 'openai/gpt-4o',
  defaultGenerateOptions: {
    temperature: 0.2,
  },
  tools: {
    httpFetchTool,
    retrieveBreachIntelTool,
    findSimilarThreatsTool,
  },
  // Semantic recall enabled: recalls similar threat analyses from past conversations
  memory: analysisMemory,
});
