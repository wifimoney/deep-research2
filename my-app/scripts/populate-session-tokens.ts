import 'dotenv/config';
import { db } from '../src/shared/db/drizzle.js';
import { sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';

async function populateSessionTokens() {
  try {
    console.log('Populating missing session tokens...');
    
    // Generate tokens for sessions that don't have them
    const result = await db.execute(sql`
      UPDATE sessions 
      SET token = gen_random_uuid()::text
      WHERE token IS NULL;
    `);
    
    console.log(`✅ Updated ${result.rowCount || 0} sessions with tokens`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error populating tokens:', error);
    process.exit(1);
  }
}

populateSessionTokens();
