import 'dotenv/config';
import { db } from '../src/shared/db/drizzle.js';
import { sql } from 'drizzle-orm';

async function checkOAuthData() {
  try {
    console.log('Checking OAuth-related data in database...\n');

    // Check users
    const users = await db.execute(sql`SELECT id, email, name, created_at FROM users ORDER BY created_at DESC LIMIT 5`);
    console.log('Recent users:', users.length);
    users.forEach((user: any) => {
      console.log(`  - ${user.email} (${user.id}) - Created: ${user.created_at}`);
    });

    // Check OAuth accounts
    const accounts = await db.execute(sql`SELECT id, user_id, provider_id, account_id, created_at FROM oauth_accounts ORDER BY created_at DESC LIMIT 5`);
    console.log('\nRecent OAuth accounts:', accounts.length);
    accounts.forEach((account: any) => {
      console.log(`  - Provider: ${account.provider_id}, Account ID: ${account.account_id}, User: ${account.user_id}`);
    });

    // Check sessions
    const sessions = await db.execute(sql`SELECT id, user_id, expires_at, created_at FROM sessions ORDER BY created_at DESC LIMIT 5`);
    console.log('\nRecent sessions:', sessions.length);
    sessions.forEach((session: any) => {
      console.log(`  - User: ${session.user_id}, Expires: ${session.expires_at}`);
    });

    // Check for any recent errors in verification table
    const verifications = await db.execute(sql`SELECT id, identifier, expires_at, created_at FROM verification ORDER BY created_at DESC LIMIT 5`);
    console.log('\nRecent verifications:', verifications.length);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkOAuthData();
