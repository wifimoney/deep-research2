
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  username: text("username"), // Legacy field for form-based auth
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  hashedPassword: text("hashed_password"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
  }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
  }).notNull().defaultNow(),
});

export const oauthAccounts = pgTable("oauth_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
    mode: "date",
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
    mode: "date",
  }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
  }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
  }).notNull().defaultNow(),
});

// Note: These tables reference Mastra's actual tables (mastra_threads, mastra_messages)
// Mastra auto-creates and manages these tables, so we map to them here
// Column names match Mastra's actual schema (mix of camelCase and snake_case)
export const memoryThreads = pgTable("mastra_threads", {
  id: text("id").primaryKey(),
  resourceId: text("resourceId").notNull(), // Mastra uses camelCase: resourceId
  title: text("title"),
  metadata: text("metadata"), // JSON string stored as text
  createdAt: timestamp("createdAtZ", { withTimezone: true, mode: "date" }), // Mastra uses createdAtZ for timezone-aware
  updatedAt: timestamp("updatedAtZ", { withTimezone: true, mode: "date" }), // Mastra uses updatedAtZ for timezone-aware
});

export const memoryMessages = pgTable("mastra_messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(), // Mastra uses snake_case: thread_id
  role: text("role").notNull(), // user, assistant, system
  content: text("content").notNull(),
  userId: text("resourceId"), // Map to Mastra's resourceId column (user context)
  createdAt: timestamp("createdAtZ", { withTimezone: true, mode: "date" }), // Mastra uses createdAtZ for timezone-aware
  // Note: Mastra's table also has: type, embedding, metadata columns, but we don't need them for our queries
});

export const userDashboardPreferences = pgTable("user_dashboard_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  refreshInterval: text("refresh_interval").default("5m"),
  favoriteContacts: text("favorite_contacts"), // JSON string of contact IDs
  emailFilters: text("email_filters"), // JSON string of filter queries
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
  }).notNull().defaultNow(),
});
