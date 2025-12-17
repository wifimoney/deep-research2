/**
 * PostgreSQL Client
 * 
 * Single source of truth for raw PostgreSQL queries.
 * Used by user/session management (not Mastra storage).
 * 
 * Note: Mastra storage uses PostgresStore from @mastra/pg (see config/storage.ts)
 * This pool is for application-level queries (users, sessions, etc.)
 */

import pg from 'pg'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env file
config({ path: resolve(process.cwd(), '.env') })

const { Pool } = pg

// Centralized database configuration (Inline for @repo/db)
const databaseConfig = {
    url: (() => {
        let url = process.env.DATABASE_URL?.trim() || 'file:./storage.db';
        // Fix malformed DATABASE_URL if it contains the key as part of the value
        if (url.startsWith('DATABASE_URL=')) {
            url = url.replace('DATABASE_URL=', '');
        }
        return url;
    })(),

    get isPostgres() {
        return this.url.startsWith('postgresql://');
    },

    get isLocalhost() {
        return this.url.includes('@localhost') || this.url.includes('@127.0.0.1');
    },

    get connectionString() {
        let connStr = this.url;
        if (this.isPostgres && !this.isLocalhost && !connStr.includes('sslmode=')) {
            connStr += connStr.includes('?') ? '&sslmode=require' : '?sslmode=require';
        }
        return connStr;
    },
};

const databaseUrl = databaseConfig.url;
if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set')
    console.error('Set it in .env file or pass it as an environment variable')
    // Don't exit process in library, just log error or throw
}

// Create connection pool
const pool = new Pool({
    connectionString: databaseConfig.isPostgres ? databaseConfig.connectionString : databaseUrl,
})

// Test connection on startup
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database')
})

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err)
    // process.exit(-1) // Don't exit in library
})

// Query helper with proper typing
export async function query<T extends pg.QueryResultRow = any>(
    text: string,
    params?: any[]
): Promise<pg.QueryResult<T>> {
    const start = Date.now()
    const result = await pool.query<T>(text, params)
    const duration = Date.now() - start
    //   console.log('Executed query', { text: text.substring(0, 50), duration, rows: result.rowCount })
    return result
}

// Get a client from the pool for transactions
export async function getClient() {
    const client = await pool.connect()
    return client
}

// Close the pool (for graceful shutdown)
export async function closePool() {
    await pool.end()
}

export default pool
