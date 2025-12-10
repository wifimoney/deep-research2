import { Agent } from '@mastra/core/agent';
import { httpFetchTool } from '../tools/httpFetchTool';
import {
  storeBreachIntelTool,
  retrieveBreachIntelTool,
  findSimilarThreatsTool,
} from '../tools/ragTools';
import { analysisMemory } from '../config/memory';

export const breachIntelAgent = new Agent({
  id: 'breach-intel-agent',
  name: 'BreachIntelAgent',
  instructions: `You are BreachIntelAgent — an autonomous security research agent.

Your job is to analyze recent hacks, breaches, and CVEs.

Before analysis, query the RAG knowledge base for similar incidents and incorporate those findings into your response.

For every incident you receive, you must output:

	1.	A concise summary

	2.	The attack chain step-by-step

	3.	Root cause analysis

	4.	What the attacker exploited

	5.	Impact and severity

	6.	Recommended mitigations

	7.	How an autonomous agent could detect or prevent this attack

Always respond in structured sections. No filler.

If information is missing, state assumptions clearly.`,
  model: 'openai/gpt-4.1',
  defaultGenerateOptions: {
    temperature: 0.2,
  },
  tools: {
    httpFetchTool,
    storeBreachIntelTool,
    retrieveBreachIntelTool,
    findSimilarThreatsTool,
  },
  // Semantic recall enabled: recalls similar security incidents from past conversations
  memory: analysisMemory,
});
