import 'dotenv/config';
import { db } from '../src/shared/db/drizzle.js';
import { sql } from 'drizzle-orm';

async function checkSessions() {
  try {
    console.log('Checking sessions table structure...');

    const result = await db.execute(sql`
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default
      FROM information_schema.columns
      WHERE table_name = 'sessions'
      ORDER BY ordinal_position;
    `);

    console.log('\nSessions table structure:');
    for (const row of result) {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
    }

    // Check if there are any sessions
    const sessionCount = await db.execute(sql`SELECT COUNT(*) as count FROM sessions`);
    console.log('\nTotal sessions:', sessionCount[0]?.count || 0);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkSessions();
