import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./drizzle/schema.js";

let _db: PostgresJsDatabase<typeof schema> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Make sure to load environment variables before importing this module.");
  }
  return databaseUrl;
}

function getClient() {
  if (!_client) {
    _client = postgres(getDatabaseUrl());
  }
  return _client;
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    if (!_db) {
      _db = drizzle(getClient(), { schema });
    }
    return (_db as any)[prop];
  }
});

// Re-export schema for convenience
export * as schema from "./drizzle/schema.js";

