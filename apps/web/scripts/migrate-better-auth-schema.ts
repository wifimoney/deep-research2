import 'dotenv/config';
import { db } from '../src/db/drizzle.js';
import { sql } from 'drizzle-orm';

async function migrateBetterAuthSchema() {
  try {
    console.log('Migrating database schema for Better Auth...');

    // Add missing fields to users table
    console.log('Adding fields to users table...');
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS name TEXT,
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS image TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
    `);

    // Add missing fields to sessions table
    console.log('Adding fields to sessions table...');
    await db.execute(sql`
      ALTER TABLE sessions 
      ADD COLUMN IF NOT EXISTS token TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS ip_address TEXT,
      ADD COLUMN IF NOT EXISTS user_agent TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
    `);

    // Recreate oauth_accounts table with correct schema
    console.log('Recreating oauth_accounts table...');
    await db.execute(sql`
      DROP TABLE IF EXISTS oauth_accounts CASCADE;
    `);
    
    await db.execute(sql`
      CREATE TABLE oauth_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        access_token_expires_at TIMESTAMP WITH TIME ZONE,
        refresh_token_expires_at TIMESTAMP WITH TIME ZONE,
        scope TEXT,
        id_token TEXT,
        password TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    console.log('✅ Successfully migrated database schema for Better Auth');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error migrating schema:', error);
    process.exit(1);
  }
}

migrateBetterAuthSchema();

