import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { mastraThreads } from './db/schema';

const db = drizzle(process.env.DATABASE_URL!);

async function main() {
  // Create a new thread
  const thread: typeof mastraThreads.$inferInsert = {
    id: `thread-${Date.now()}`,
    resourceId: 'user-123',
    title: 'Test Thread',
    metadata: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await db.insert(mastraThreads).values(thread);
  console.log('New thread created!');

  // Read all threads
  const threads = await db.select().from(mastraThreads);
  console.log('Getting all threads from the database: ', threads);
  /*
  const threads: {
    id: string;
    resourceId: string;
    title: string;
    metadata: string | null;
    createdAt: string;
    updatedAt: string;
    createdAtZ: string | null;
    updatedAtZ: string | null;
  }[]
  */

  // Update thread
  await db
    .update(mastraThreads)
    .set({
      title: 'Updated Thread Title',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(mastraThreads.id, thread.id));
  console.log('Thread info updated!');

  // Delete thread
  await db.delete(mastraThreads).where(eq(mastraThreads.id, thread.id));
  console.log('Thread deleted!');
}

main().catch(console.error);

