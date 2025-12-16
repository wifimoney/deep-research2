import { BetterAuth } from "better-auth";
import { db } from "../db/client";
import { users, accounts, sessions } from "../db/schema/auth";

export const auth = new BetterAuth({
  database: {
    type: "drizzle",
    db,
    tables: {
      users,
      accounts,
      sessions,
    },
  },

  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  cookies: {
    secure: process.env.NODE_ENV === "production",
  },
});