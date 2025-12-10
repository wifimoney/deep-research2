import { randomUUID } from 'crypto';
import { embedMany } from 'ai';
import { LibSQLVector } from '@mastra/libsql';
import { PgVector } from '@mastra/pg';
import { openai } from '@ai-sdk/openai';

export const RAG_COLLECTIONS = {
  BREACH_REPORTS: 'breach_reports',
  CVE_INTELLIGENCE: 'cve_intelligence',
  THREAT_ACTORS: 'threat_actors',
  SECURITY_ADVISORIES: 'security_advisories',
  MITRE_ATTACK_TTPS: 'mitre_attack_ttps',
  INDICATORS_OF_COMPROMISE: 'indicators_of_compromise',
} as const;

type RAGCollection = (typeof RAG_COLLECTIONS)[keyof typeof RAG_COLLECTIONS];

type DocumentMetadata = Record<string, unknown>;

export type RAGDocument = {
  id?: string;
  content: string;
  metadata?: DocumentMetadata;
};

export type RAGSearchResult = {
  id: string;
  score: number;
  content: string;
  metadata?: DocumentMetadata;
};

// Use DATABASE_URL for PostgreSQL, or VECTOR_DB_URL/fallback for LibSQL
let databaseUrl = process.env.DATABASE_URL?.trim();

// Fix malformed DATABASE_URL if it contains the key as part of the value
if (databaseUrl?.startsWith('DATABASE_URL=')) {
  databaseUrl = databaseUrl.replace('DATABASE_URL=', '');
}

let VECTOR_DB_URL = databaseUrl || process.env.VECTOR_DB_URL || 'file:../breach-intel-vectors.db';
const isPostgres = VECTOR_DB_URL.startsWith('postgresql://');

// Only add SSL for remote connections (not localhost/127.0.0.1)
const isLocalhost = VECTOR_DB_URL.includes('@localhost') || VECTOR_DB_URL.includes('@127.0.0.1');
if (isPostgres && !isLocalhost && !VECTOR_DB_URL.includes('sslmode=')) {
  VECTOR_DB_URL += VECTOR_DB_URL.includes('?') ? '&sslmode=require' : '?sslmode=require';
}

const EMBEDDINGS_MODEL = process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small';
const DEFAULT_EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDINGS_DIMENSIONS || 1536);
const DEFAULT_TOP_K = Number(process.env.RAG_TOP_K || 5);
const DEFAULT_MIN_SCORE = process.env.RAG_MIN_SCORE ? Number(process.env.RAG_MIN_SCORE) : 0;

// Use PostgreSQL for production, LibSQL for local development
let vectorStore: LibSQLVector | PgVector;

if (isPostgres) {
  vectorStore = new PgVector({
    connectionString: VECTOR_DB_URL,
  });
} else {
  vectorStore = new LibSQLVector({
    connectionUrl: VECTOR_DB_URL,
  });
}

async function ensureIndex(indexName: RAGCollection, dimension: number = DEFAULT_EMBEDDING_DIMENSIONS) {
  const existing = await vectorStore.listIndexes();
  if (existing.includes(indexName)) return;

  // Clean up any old indexes with hyphenated names (legacy)
  const oldHyphenatedNames = [
    'breach-reports',
    'cve-intelligence',
    'threat-actors',
    'security-advisories',
    'mitre-attack-ttps',
    'indicators-of-compromise',
  ];
  
  for (const oldName of oldHyphenatedNames) {
    if (existing.includes(oldName)) {
      try {
        await vectorStore.deleteIndex({ indexName: oldName });
        console.log(`✓ Dropped old index: ${oldName}`);
      } catch (err) {
        console.warn(`Failed to drop old index ${oldName}:`, err);
      }
    }
  }

  await vectorStore.createIndex({
    indexName,
    dimension,
    metric: 'cosine',
  });
}

async function embedTexts(texts: string[]) {
  const { embeddings, usage } = await embedMany({
    model: openai.embedding(EMBEDDINGS_MODEL),
    values: texts,
  });

  const dimension = embeddings[0]?.length || DEFAULT_EMBEDDING_DIMENSIONS;
  const totalTokens = usage?.tokens;

  return { embeddings, dimension, totalTokens };
}

export async function initializeRAGCollections() {
  const collections = Object.values(RAG_COLLECTIONS);
  for (const collection of collections) {
    try {
      await ensureIndex(collection);
    } catch (err) {
      console.error(`Failed to initialize collection "${collection}":`, err);
    }
  }
}

async function addDocuments({
  collection,
  documents,
}: {
  collection: RAGCollection;
  documents: RAGDocument[];
}) {
  if (!documents.length) return [];

  const { embeddings, dimension } = await embedTexts(documents.map((doc) => doc.content));
  await ensureIndex(collection, dimension);

  const ids = documents.map((doc) => doc.id || randomUUID());
  const metadata = documents.map((doc, i) => ({
    ...(doc.metadata || {}),
    content: doc.content,
    collection,
    embedding_model: EMBEDDINGS_MODEL,
    embedding_dim: dimension,
    originalId: doc.id,
    position: i,
  }));

  await vectorStore.upsert({
    indexName: collection,
    vectors: embeddings,
    metadata,
    ids,
  });

  return ids;
}

async function searchDocuments({
  collection,
  query,
  topK = DEFAULT_TOP_K,
  minScore = DEFAULT_MIN_SCORE,
}: {
  collection: RAGCollection;
  query: string;
  topK?: number;
  minScore?: number;
}): Promise<RAGSearchResult[]> {
  const { embeddings, dimension } = await embedTexts([query]);
  const [queryVector] = embeddings;
  await ensureIndex(collection, dimension);

  const results = await vectorStore.query({
    indexName: collection,
    queryVector,
    topK,
    minScore,
  });

  return results.map((res) => ({
    id: res.id,
    score: res.score,
    content: (res.metadata?.content as string) || res.document || '',
    metadata: res.metadata || {},
  }));
}

async function getAllDocuments({ collection }: { collection: RAGCollection }) {
  // Without a native "list all" query, approximate by a wide query with a neutral vector.
  // This is primarily for debugging/maintenance.
  const probe = Array(DEFAULT_EMBEDDING_DIMENSIONS).fill(0);
  await ensureIndex(collection, DEFAULT_EMBEDDING_DIMENSIONS);

  const results = await vectorStore.query({
    indexName: collection,
    queryVector: probe,
    topK: 100,
    includeVector: false,
  });

  return results.map((res) => ({
    id: res.id,
    score: res.score,
    content: (res.metadata?.content as string) || res.document || '',
    metadata: res.metadata || {},
  }));
}

export const breachIntelMemory = {
  add: addDocuments,
  search: searchDocuments,
  getAll: getAllDocuments,
  initialize: initializeRAGCollections,
  vectorStore,
  config: {
    model: EMBEDDINGS_MODEL,
    vectorDbUrl: VECTOR_DB_URL,
    defaultTopK: DEFAULT_TOP_K,
    defaultMinScore: DEFAULT_MIN_SCORE,
    defaultEmbeddingDimensions: DEFAULT_EMBEDDING_DIMENSIONS,
  },
};
