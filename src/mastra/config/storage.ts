/**
 * Shared Storage Configuration
 * 
 * Single source of truth for PostgreSQL database connection.
 * All modules (memory, RAG, Mastra) use these shared instances.
 * 
 * Architecture:
 * - ONE PostgreSQL database (via DATABASE_URL)
 * - ONE PostgresStore instance (for Mastra storage)
 * - ONE PgVector instance (for semantic recall + RAG vectors)
 * 
 * No fragmented storage - everything in one database.
 */

import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { PostgresStore, PgVector } from '@mastra/pg';

// Read DATABASE_URL - single source of truth
let databaseUrl = process.env.DATABASE_URL?.trim() || 'file:./storage.db';

// Fix malformed DATABASE_URL if it contains the key as part of the value
if (databaseUrl.startsWith('DATABASE_URL=')) {
  databaseUrl = databaseUrl.replace('DATABASE_URL=', '');
}

const isPostgres = databaseUrl.startsWith('postgresql://');

console.log(`[Storage] Using ${isPostgres ? 'PostgreSQL' : 'LibSQL'} backend`);
console.log(`[Storage] Database URL: ${databaseUrl.substring(0, 50)}...`);

// Shared storage and vector instances - used by ALL modules
export let storage: LibSQLStore | PostgresStore;
export let vector: LibSQLVector | PgVector;

try {
  if (isPostgres) {
    // PostgreSQL for production - single connection for everything
    // Only add SSL for remote connections (not localhost/127.0.0.1)
    let connectionString = databaseUrl;
    const isLocalhost = databaseUrl.includes('@localhost') || databaseUrl.includes('@127.0.0.1');
    if (!isLocalhost && !connectionString.includes('sslmode=')) {
      connectionString += connectionString.includes('?') ? '&sslmode=require' : '?sslmode=require';
    }
    
    console.log('[Storage] Creating shared PostgresStore...');
    storage = new PostgresStore({
      id: 'mastra-storage',
      connectionString,
    });
    console.log('[Storage] PostgresStore created:', !!storage);
    
    console.log('[Storage] Creating shared PgVector...');
    vector = new PgVector({
      id: 'mastra-vector',
      connectionString,
    });
    console.log('[Storage] PgVector created:', !!vector);
  } else {
    // LibSQL for local development - single connection for everything
    console.log('[Storage] Creating shared LibSQLStore...');
    storage = new LibSQLStore({
      url: databaseUrl,
    });
    console.log('[Storage] LibSQLStore created:', !!storage);
    
    console.log('[Storage] Creating shared LibSQLVector...');
    vector = new LibSQLVector({
      connectionUrl: databaseUrl,
    });
    console.log('[Storage] LibSQLVector created:', !!vector);
  }
  console.log('[Storage] Shared storage initialization complete');
} catch (error) {
  console.error('[Storage] Failed to initialize shared storage:', error);
  throw error;
}

// Initialize storage - PostgresStore requires explicit init() when used directly
let initPromise: Promise<void> | null = null;

export async function ensureStorageInitialized() {
  // If already initialized or initialization in progress, wait for it
  if (initPromise) {
    return initPromise;
  }
  
  // Create initialization promise
  initPromise = (async () => {
    if (isPostgres && 'init' in storage && typeof storage.init === 'function') {
      console.log('[Storage] Initializing PostgreSQL storage...');
      await storage.init();
      console.log('[Storage] PostgreSQL storage initialized');
    }
  })();
  
  try {
    await initPromise;
  } catch (error) {
    console.error('[Storage] Failed to initialize storage:', error);
    // Reset promise so initialization can be retried
    initPromise = null;
    throw error;
  }
  
  return initPromise;
}

// Start initialization on module load (don't await - let it happen in background)
ensureStorageInitialized().catch((error) => {
  console.error('[Storage] Background initialization failed:', error);
  // Will be retried on first use
});

// Export connection info for debugging
export const isPostgresBackend = isPostgres;
export const databaseUrlInfo = databaseUrl.substring(0, 50) + '...';

