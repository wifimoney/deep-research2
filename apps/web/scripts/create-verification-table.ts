import 'dotenv/config';
import { db } from '../src/db/drizzle.js';
import { sql } from 'drizzle-orm';

async function createVerificationTable() {
  try {
    console.log('Creating verification table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Successfully created verification table');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating table:', error);
    process.exit(1);
  }
}

createVerificationTable();

