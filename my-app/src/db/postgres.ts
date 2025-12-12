import pg from 'pg'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env file explicitly from the my-app directory
config({ path: resolve(process.cwd(), '.env') })

const { Pool } = pg

// Validate DATABASE_URL is set
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable is not set')
  console.error('Set it in .env file or pass it as an environment variable')
  process.exit(1)
}

// Create connection pool
const pool = new Pool({
  connectionString: databaseUrl,
})

// Test connection on startup
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database')
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})

// Query helper with proper typing
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now()
  const result = await pool.query<T>(text, params)
  const duration = Date.now() - start
  console.log('Executed query', { text: text.substring(0, 50), duration, rows: result.rowCount })
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
