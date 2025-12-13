/**
 * Quick PostgreSQL Connection Test
 * Run: npx tsx src/examples/testDbConnection.ts
 */

import 'dotenv/config';

// Fix malformed DATABASE_URL if needed
let dbUrl = process.env.DATABASE_URL;
console.log('\n[DEBUG] Raw DATABASE_URL from env:', dbUrl?.substring(0, 60));

if (dbUrl?.startsWith('DATABASE_URL=')) {
  dbUrl = dbUrl.replace('DATABASE_URL=', '');
  process.env.DATABASE_URL = dbUrl;
  console.log('[DEBUG] Fixed malformed URL, removed duplicate prefix');
}

console.log('[DEBUG] Final DATABASE_URL:', dbUrl?.substring(0, 60));
console.log('[DEBUG] Starts with postgresql://:', dbUrl?.startsWith('postgresql://'));

async function testConnection() {
  console.log('\n🔌 Testing PostgreSQL Connection...\n');
  
  const finalUrl = process.env.DATABASE_URL;
  const isPostgres = finalUrl?.startsWith('postgresql://');
  console.log('Backend:', isPostgres ? 'PostgreSQL' : 'LibSQL');
  console.log('');

  try {
    const storageModule = await import('../mastra/config/storage');
    const ragModule = await import('../mastra/config/rag');
    
    console.log('[DEBUG] storageModule exports:', Object.keys(storageModule));
    console.log('[DEBUG] storage from module:', storageModule.storage);
    console.log('[DEBUG] typeof storage:', typeof storageModule.storage);
    
    const { storage: memoryStorage } = storageModule;
    const { breachIntelMemory } = ragModule;

    if (!memoryStorage) {
      console.log('❌ memoryStorage is undefined - module may have failed to initialize');
      console.log('   Check if DATABASE_URL is correctly formatted');
      return;
    }

    // Test 1: Memory Storage
    console.log('1. Testing Memory Storage...');
    try {
      // PostgresStore may need initialization
      if ('init' in memoryStorage && typeof memoryStorage.init === 'function') {
        console.log('   Initializing storage...');
        await memoryStorage.init();
      }
      
      const threads = await memoryStorage.getThreadsByResourceId({ resourceId: 'test-connection' });
      console.log('   ✅ Memory storage connected! Found', threads.length, 'threads\n');
    } catch (e: any) {
      console.log('   ❌ Memory storage failed:', e.message || e);
      console.log('   Error details:', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
      if (e.cause) {
        console.log('   Cause:', e.cause.message || e.cause);
      }
      return;
    }

    // Test 2: Vector Store
    console.log('2. Testing Vector Store...');
    try {
      const indexes = await breachIntelMemory.vectorStore.listIndexes();
      console.log('   ✅ Vector store connected! Indexes:', indexes.join(', ') || '(none yet)', '\n');
    } catch (e: any) {
      console.log('   ❌ Vector store failed:', e.message, '\n');
      return;
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ PostgreSQL connection successful!');
    console.log('   - Memory (PostgresStore): Connected');
    console.log('   - Vectors (PgVector): Connected');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (e: any) {
    console.log('❌ Failed to import modules:', e.message);
  }
}

testConnection().catch(console.error);
