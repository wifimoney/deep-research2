import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { breachIntelMemory, RAG_COLLECTIONS } from '../config/rag';

const collectionEnum = z.nativeEnum(RAG_COLLECTIONS);

export const storeBreachIntelTool = createTool({
  id: 'store-breach-intel',
  description: 'Store security intelligence content into the RAG knowledge base',
  inputSchema: z.object({
    collection: collectionEnum.describe('Target collection to store the document'),
    content: z.string().min(1, 'Content is required'),
    metadata: z
      .record(z.string(), z.any())
      .optional()
      .describe('Metadata describing the document (e.g., identifier, type, severity, tags)'),
  }),
  execute: async ({ context }) => {
    const { collection, content, metadata } = context;

    const ids = await breachIntelMemory.add({
      collection,
      documents: [
        {
          content,
          metadata: {
            ...metadata,
            dateAdded: metadata?.dateAdded || new Date().toISOString(),
          },
        },
      ],
    });

    return { success: true, ids };
  },
});

export const retrieveBreachIntelTool = createTool({
  id: 'retrieve-breach-intel',
  description: 'Retrieve relevant breach intelligence documents using semantic search',
  inputSchema: z.object({
    query: z.string().min(1, 'Query is required'),
    collections: z
      .array(collectionEnum)
      .nonempty()
      .optional()
      .describe('Collections to search (defaults to all)'),
    topK: z.number().int().positive().optional().describe('Number of results to return'),
    minScore: z.number().min(0).max(1).optional().describe('Minimum similarity score'),
    filter: z.record(z.string(), z.any()).optional().describe('Metadata filter'),
  }),
  execute: async ({ context }) => {
    const {
      query,
      collections = Object.values(RAG_COLLECTIONS),
      topK,
      minScore,
      filter,
    } = context;

    const allResults = [];
    for (const collection of collections) {
      const results = await breachIntelMemory.search({
        collection,
        query,
        topK,
        minScore,
        filter,
      });

      allResults.push(
        ...results.map((res) => ({
          ...res,
          collection,
        })),
      );
    }

    const sorted = allResults.sort((a, b) => b.score - a.score);
    const limited = typeof topK === 'number' ? sorted.slice(0, topK) : sorted;

    return {
      results: limited,
      total: sorted.length,
    };
  },
});

export const findSimilarThreatsTool = createTool({
  id: 'find-similar-threats',
  description: 'Find similar threats based on description and characteristics',
  inputSchema: z.object({
    currentThreat: z.object({
      description: z.string().min(1, 'Threat description is required'),
      type: z.string().optional().describe('Type of threat (e.g., breach, cve, malware)'),
      characteristics: z.array(z.string()).optional().describe('List of characteristics/keywords'),
    }),
    topK: z.number().int().positive().optional(),
  }),
  execute: async ({ context }) => {
    const { currentThreat, topK } = context;
    const queryParts = [
      currentThreat.description,
      currentThreat.type ? `Type: ${currentThreat.type}` : '',
      currentThreat.characteristics?.length
        ? `Characteristics: ${currentThreat.characteristics.join(', ')}`
        : '',
    ].filter(Boolean);

    const query = queryParts.join('\n');

    const collections = [
      RAG_COLLECTIONS.BREACH_REPORTS,
      RAG_COLLECTIONS.CVE_INTELLIGENCE,
      RAG_COLLECTIONS.SECURITY_ADVISORIES,
      RAG_COLLECTIONS.THREAT_ACTORS,
    ];

    const results = await breachIntelMemory.search({
      collection: RAG_COLLECTIONS.BREACH_REPORTS,
      query,
      topK: topK ?? 5,
    });

    // Also search CVE and advisories for broader similarity
    const additional = [];
    for (const col of collections.slice(1)) {
      const res = await breachIntelMemory.search({
        collection: col,
        query,
        topK: topK ?? 3,
      });
      additional.push(
        ...res.map((r) => ({
          ...r,
          collection: col,
        })),
      );
    }

    const merged = [
      ...results.map((r) => ({ ...r, collection: RAG_COLLECTIONS.BREACH_REPORTS })),
      ...additional,
    ].sort((a, b) => b.score - a.score);

    return {
      results: merged.slice(0, topK ?? 5),
      total: merged.length,
    };
  },
});
