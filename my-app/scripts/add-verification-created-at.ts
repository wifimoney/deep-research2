import 'dotenv/config';
import { db } from '../src/db/drizzle.js';
import { sql } from 'drizzle-orm';

async function addCreatedAtColumn() {
  try {
    console.log('Adding created_at column to verification table...');
    await db.execute(sql`
      ALTER TABLE verification 
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
    `);
    console.log('✅ Successfully added created_at column to verification table');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding column:', error);
    process.exit(1);
  }
}

addCreatedAtColumn();

