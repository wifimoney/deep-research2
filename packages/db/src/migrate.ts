import 'dotenv/config';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './drizzle.js';

async function runMigrations() {
    console.log('Running migrations...');
    try {
        // This will run migrations from the "drizzle" directory
        await migrate(db, { migrationsFolder: './drizzle' });
        console.log('Migrations completed successfully');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigrations();
