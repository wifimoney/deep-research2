import { betterAuth } from "better-auth";
import { db } from "../db/drizzle.js";
import { users, sessions, oauthAccounts } from "../db/schema.js";

export const auth = betterAuth({
  database: {
    type: "drizzle",
    db,
    tables: {
      users,
      sessions,
      accounts: oauthAccounts,
    },
  },
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  cookies: {
    secure: process.env.NODE_ENV === "production",
  },
});

// Better Auth v1 exports
export const handleRequest = auth.handler;

// Helper function to get session from request
export async function getSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}
