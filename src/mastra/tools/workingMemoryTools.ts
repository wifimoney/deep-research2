import { createTool } from '@mastra/core/tools';
import Exa from 'exa-js';
import { z } from 'zod';
import 'dotenv/config';
import { getWorkingMemory } from '../memory/workingMemory';

const getExaApiKey = () => process.env.EXASEARCH_API_KEY || process.env.EXA_API_KEY;

export const workingMemoryWebSearchTool = createTool({
  id: 'working-memory-web-search',
  description: 'Search the web with working-memory deduping and tracking',
  inputSchema: z.object({
    query: z.string().describe('Search query to run'),
    sessionId: z.string().describe('Working memory session ID'),
    maxResults: z.number().min(1).max(5).optional(),
  }),
  execute: async ({ context, mastra }) => {
    const { query, sessionId, maxResults = 3 } = context;
    const memory = getWorkingMemory(sessionId);

    if (memory.isQueryCompleted(query)) {
      return {
        query,
        results: [],
        skipped: true,
        reason: 'Query already completed in working memory',
        workingMemory: memory.getStats(),
      };
    }

    const exaApiKey = getExaApiKey();
    if (!exaApiKey) {
      return {
        results: [],
        error: 'Missing EXASEARCH_API_KEY or EXA_API_KEY',
      };
    }

    try {
      const exa = new Exa(exaApiKey);
      const { results } = await exa.searchAndContents(query, {
        livecrawl: 'always',
        numResults: maxResults,
      });

      const summaryAgent = mastra?.getAgent('webSummarizationAgent');
      const processed: Array<{ title: string; url: string; content: string }> = [];
      const skippedUrls: string[] = [];

      for (const result of results ?? []) {
        const url = result.url;
        if (!url || memory.isUrlProcessed(url)) {
          if (url) skippedUrls.push(url);
          continue;
        }

        let summarized = result.text || '';
        if (summaryAgent && result.text && result.text.length > 100) {
          try {
            const summary = await summaryAgent.generate([
              {
                role: 'user',
                content: `Summarize this content for query "${query}"\n\n${result.text.substring(0, 8000)}`,
              },
            ]);
            summarized = summary.text;
          } catch (err) {
            summarized = result.text.substring(0, 500);
          }
        }

        processed.push({
          title: result.title || '',
          url,
          content: summarized || result.text || '',
        });

        memory.markUrlProcessed(url);
      }

      memory.markQueryCompleted(query);

      return {
        query,
        results: processed,
        skippedUrls,
        workingMemory: memory.getStats(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        results: [],
        error: message,
      };
    }
  },
});

export const workingMemoryEvaluateTool = createTool({
  id: 'working-memory-evaluate',
  description: 'Evaluate a search result while updating working memory',
  inputSchema: z.object({
    query: z.string(),
    sessionId: z.string(),
    result: z.object({
      title: z.string(),
      url: z.string(),
      content: z.string(),
    }),
  }),
  execute: async ({ context, mastra }) => {
    const { query, sessionId, result } = context;
    const memory = getWorkingMemory(sessionId);

    if (memory.isUrlProcessed(result.url)) {
      return {
        isRelevant: false,
        reason: 'URL already processed',
        skipped: true,
        workingMemory: memory.getStats(),
      };
    }

    const evaluationAgent = mastra?.getAgent('evaluationAgent');
    let evaluation = {
      isRelevant: true,
      reason: 'Assumed relevant (fallback)',
    };

    if (evaluationAgent) {
      try {
        const response = await evaluationAgent.generate(
          [
            {
              role: 'user',
              content: `Evaluate whether this search result is relevant to "${query}". Respond with JSON { isRelevant, reason }.\n\nTitle: ${result.title}\nURL: ${result.url}\nContent: ${result.content.substring(0, 600)}...`,
            },
          ],
          {
            output: z.object({
              isRelevant: z.boolean(),
              reason: z.string(),
            }),
          },
        );

        evaluation = response.object ?? { isRelevant: false, reason: 'No response' };
      } catch (err) {
        evaluation = {
          isRelevant: false,
          reason: 'Evaluation failed',
        };
      }
    }

    memory.markUrlProcessed(result.url);
    if (evaluation.isRelevant) {
      memory.addFinding(result.title || result.content.substring(0, 120), result.url, evaluation.reason);
    }

    return {
      ...evaluation,
      workingMemory: memory.getStats(),
    };
  },
});

export const workingMemoryExtractLearningsTool = createTool({
  id: 'working-memory-extract-learnings',
  description: 'Extract learnings and follow-ups while updating working memory',
  inputSchema: z.object({
    query: z.string(),
    sessionId: z.string(),
    result: z.object({
      title: z.string(),
      url: z.string(),
      content: z.string(),
    }),
  }),
  execute: async ({ context, mastra }) => {
    const { query, sessionId, result } = context;
    const memory = getWorkingMemory(sessionId);

    if (memory.isUrlProcessed(result.url)) {
      return {
        learning: 'Skipped duplicate URL',
        followUpQuestions: [],
        workingMemory: memory.getStats(),
      };
    }

    const extractionAgent = mastra?.getAgent('learningExtractionAgent');
    let learningPayload = {
      learning: '',
      followUpQuestions: [] as string[],
    };

    if (extractionAgent) {
      try {
        const response = await extractionAgent.generate(
          [
            {
              role: 'user',
              content: `Research query: "${query}"\nExtract a key learning and follow-up questions from this result:\nTitle: ${result.title}\nURL: ${result.url}\nContent: ${result.content.substring(0, 1500)}...`,
            },
          ],
          {
            output: z.object({
              learning: z.string(),
              followUpQuestions: z.array(z.string()).max(3),
            }),
          },
        );
        learningPayload = response.object ?? { learning: '', followUpQuestions: [] };
      } catch (err) {
        learningPayload = {
          learning: 'Extraction failed',
          followUpQuestions: [],
        };
      }
    }

    if (learningPayload.learning) {
      memory.addFinding(learningPayload.learning, result.url, 'learning');
      memory.addInsight(learningPayload.learning);
    }

    for (const question of learningPayload.followUpQuestions) {
      memory.addFollowUpQuestion(question);
    }

    memory.markUrlProcessed(result.url);

    return {
      ...learningPayload,
      workingMemory: memory.getStats(),
    };
  },
});

export const getWorkingMemoryContextTool = createTool({
  id: 'get-working-memory-context',
  description: 'Retrieve current working memory context and statistics',
  inputSchema: z.object({
    sessionId: z.string(),
  }),
  execute: async ({ context }) => {
    const { sessionId } = context;
    const memory = getWorkingMemory(sessionId);

    return {
      summary: memory.getSummary(),
      context: memory.getContextForAgent(),
      stats: memory.getStats(),
      processedUrls: memory.getProcessedUrls(),
      findings: memory.getFindings(),
      followUpQuestions: memory.getFollowUpQuestions(),
    };
  },
});
