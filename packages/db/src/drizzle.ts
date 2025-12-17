
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;
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

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    if (!_db) {
      _db = drizzle(getClient(), { schema });
    }
    return (_db as any)[prop];
  }
});
