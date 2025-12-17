/**
 * Centralized Configuration
 * 
 * Single source of truth for all application configuration.
 * All environment variables are read here and exported as typed constants.
 * 
 * Usage:
 *   import { config } from './config.js';
 *   const model = config.models.default;
 */

/**
 * Database Configuration
 */
export const databaseConfig = {
  /** Database connection URL - single PostgreSQL database for everything */
  url: (() => {
    let url = process.env.DATABASE_URL?.trim() || 'file:./storage.db';
    // Fix malformed DATABASE_URL if it contains the key as part of the value
    if (url.startsWith('DATABASE_URL=')) {
      url = url.replace('DATABASE_URL=', '');
    }
    return url;
  })(),
  
  /** Whether using PostgreSQL backend */
  get isPostgres() {
    return this.url.startsWith('postgresql://');
  },
  
  /** Whether connection is to localhost */
  get isLocalhost() {
    return this.url.includes('@localhost') || this.url.includes('@127.0.0.1');
  },
  
  /** Get connection string with SSL if needed */
  get connectionString() {
    let connStr = this.url;
    if (this.isPostgres && !this.isLocalhost && !connStr.includes('sslmode=')) {
      connStr += connStr.includes('?') ? '&sslmode=require' : '?sslmode=require';
    }
    return connStr;
  },
};

/**
 * Model Configuration
 */
export const modelConfig = {
  /** Default model for agents */
  default: process.env.MODEL || 'openai/gpt-4o',
  
  /** Embeddings model */
  embeddings: process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small',
  
  /** Embeddings dimensions */
  embeddingsDimensions: Number(process.env.EMBEDDINGS_DIMENSIONS || 1536),
  
  /** Model-specific defaults */
  models: {
    research: process.env.MODEL || 'openai/gpt-4o',
    report: process.env.MODEL || 'openai/gpt-4.1',
    evaluation: process.env.MODEL || 'openai/gpt-4.1',
    learning: process.env.MODEL || 'openai/gpt-4.1',
    summarization: process.env.MODEL || 'openai/gpt-4.1-mini',
  },
};

/**
 * RAG Configuration
 */
export const ragConfig = {
  /** Number of top results to return */
  topK: Number(process.env.RAG_TOP_K || 5),
  
  /** Minimum similarity score threshold */
  minScore: process.env.RAG_MIN_SCORE ? Number(process.env.RAG_MIN_SCORE) : 0,
  
  /** Embedding dimensions */
  dimensions: Number(process.env.EMBEDDINGS_DIMENSIONS || 1536),
};

/**
 * API Keys Configuration
 */
export const apiKeysConfig = {
  /** OpenAI API key */
  openai: process.env.OPENAI_API_KEY,
  
  /** OpenRouter API key (alternative to OpenAI) */
  openrouter: process.env.OPENROUTER_API_KEY,
  
  /** Exa/Search API key */
  exa: process.env.EXASEARCH_API_KEY || process.env.EXA_API_KEY,
  
  /** Get primary AI API key (OpenRouter preferred, fallback to OpenAI) */
  get primary() {
    return this.openrouter || this.openai;
  },
  
  /** Check if any AI API key is available */
  get hasAiKey() {
    return !!(this.openrouter || this.openai);
  },
};

/**
 * Server Configuration
 */
export const serverConfig = {
  /** Main application port */
  port: Number(process.env.PORT || 3000),
  
  /** Mastra API server port */
  mastraPort: Number(process.env.MASTRA_PORT || 4111),
  
  /** Environment */
  env: process.env.NODE_ENV || 'development',
  
  /** Whether running in production */
  get isProduction() {
    return this.env === 'production';
  },
};

/**
 * Authentication Configuration
 */
export const authConfig = {
  /** Session duration in days */
  sessionDurationDays: Number(process.env.SESSION_DURATION_DAYS || 7),
  
  /** Session duration in milliseconds */
  get sessionDurationMs() {
    return this.sessionDurationDays * 24 * 60 * 60 * 1000;
  },
  
  /** Whether cookies should be secure (HTTPS only) */
  get cookieSecure() {
    return serverConfig.isProduction;
  },
  
  /** Bcrypt salt rounds */
  saltRounds: 12,
};

/**
 * Storage Configuration
 */
export const storageConfig = {
  /** Storage instance IDs */
  ids: {
    storage: 'mastra-storage',
    vector: 'mastra-vector',
  },
};

/**
 * Export all config as a single object for convenience
 */
export const config = {
  database: databaseConfig,
  model: modelConfig,
  rag: ragConfig,
  apiKeys: apiKeysConfig,
  server: serverConfig,
  auth: authConfig,
  storage: storageConfig,
};

// Default export
export default config;

