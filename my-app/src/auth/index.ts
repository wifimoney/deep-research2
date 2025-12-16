import { betterAuth } from "better-auth";
import { db } from "../db/drizzle.js";
import { users, sessions, oauthAccounts } from "../db/schema.js";

// Base URL for the application
const port = Number(process.env.PORT || 3000);
const baseURL = process.env.BASE_URL || `http://localhost:${port}`;

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-change-in-production",
  baseURL,
  basePath: "/api/auth", // Explicitly set basePath (default is /api/auth)
  database: {
    type: "drizzle",
    db,
    tables: {
      users,
      sessions,
      accounts: oauthAccounts,
    },
  },
  socialProviders: {
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
