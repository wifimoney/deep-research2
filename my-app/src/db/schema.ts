
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  hashedPassword: text("hashed_password"),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export const oauthAccounts = pgTable("oauth_accounts", {
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id),
});
