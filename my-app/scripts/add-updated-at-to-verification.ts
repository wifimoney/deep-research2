import 'dotenv/config';
import { db } from '../src/db/drizzle.js';
import { sql } from 'drizzle-orm';

async function addUpdatedAtColumn() {
  try {
    console.log('Adding updated_at column to verification table...');
    await db.execute(sql`
      ALTER TABLE verification 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
    `);
    console.log('✅ Successfully added updated_at column to verification table');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding column:', error);
    process.exit(1);
  }
}

addUpdatedAtColumn();

