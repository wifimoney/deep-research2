import 'dotenv/config';
import { db } from '../src/db/drizzle.js';
import { sql } from 'drizzle-orm';

async function checkConstraints() {
  try {
    console.log('Checking database constraints...');
    
    // Check users table structure
    const usersInfo = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    console.log('\nUsers table columns:');
    console.table(usersInfo.rows);
    
    // Check oauth_accounts table structure
    const accountsInfo = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'oauth_accounts'
      ORDER BY ordinal_position;
    `);
    console.log('\nOAuth accounts table columns:');
    console.table(accountsInfo.rows);
    
    // Check for any NOT NULL constraints that might cause issues
    const constraints = await db.execute(sql`
      SELECT 
        tc.table_name, 
        tc.constraint_name, 
        kcu.column_name,
        tc.constraint_type
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name IN ('users', 'oauth_accounts', 'sessions')
        AND tc.constraint_type = 'NOT NULL'
      ORDER BY tc.table_name, kcu.column_name;
    `);
    console.log('\nNOT NULL constraints:');
    console.table(constraints.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking constraints:', error);
    process.exit(1);
  }
}

checkConstraints();
