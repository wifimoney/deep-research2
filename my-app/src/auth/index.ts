import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/drizzle.js";
import { users, sessions, oauthAccounts, verification } from "../db/schema.js";

// Base URL for the application
const port = Number(process.env.PORT || 3000);
const baseURL = process.env.BASE_URL || `http://localhost:${port}`;

// Debug: Log OAuth configuration
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

console.log('='.repeat(60));
console.log('[Better Auth Config] OAuth Configuration:');
console.log('='.repeat(60));
console.log('[Better Auth Config] Base URL:', baseURL);
console.log('[Better Auth Config] Base Path: /api/auth');
console.log('[Better Auth Config] Callback URL:', `${baseURL}/api/auth/callback/google`);
console.log('[Better Auth Config] Google Client ID:', googleClientId || '❌ MISSING');
console.log('[Better Auth Config] Google Client Secret:', googleClientSecret ? `${googleClientSecret.substring(0, 15)}...` : '❌ MISSING');
console.log('='.repeat(60));

if (!googleClientId || !googleClientSecret) {
  console.error('❌ ERROR: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing from environment variables!');
  console.error('   Make sure your .env file is being loaded correctly.');
  console.error('   Expected Client ID: 347902971048-o6842m0s5d2a4ppkbgnpbjr4uuf236hp.apps.googleusercontent.com');
}

// Verify the exact client ID matches
if (googleClientId && googleClientId !== '347902971048-o6842m0s5d2a4ppkbgnpbjr4uuf236hp.apps.googleusercontent.com') {
  console.warn('⚠️  WARNING: Client ID does not match expected value!');
  console.warn('   Expected: 347902971048-o6842m0s5d2a4ppkbgnpbjr4uuf236hp.apps.googleusercontent.com');
  console.warn('   Actual:  ', googleClientId);
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-change-in-production",
  baseURL,
  basePath: "/api/auth", // Explicitly set basePath (default is /api/auth)
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true, // All tables use plural form
    schema: {
      users,
      sessions,
      accounts: oauthAccounts, // Map 'accounts' to 'oauth_accounts' table
      verifications: verification, // Map 'verifications' to 'verification' table
    }
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Request Gmail and Contacts API scopes
      scope: [
        'openid',
        'profile',
        'email',
        'https://www.googleapis.com/auth/gmail.readonly',           // ✅ Add this
        'https://www.googleapis.com/auth/contacts.readonly'         // ✅ Add this
      ],
      // Ensure we get refresh tokens
      accessType: 'offline',
      prompt: 'consent',
    },
  },
  cookies: {
    secure: process.env.NODE_ENV === "production",
  },
  // Add error handling to capture OAuth errors
  onError: (error: Error, context: { path: string }) => {
    console.error('='.repeat(60));
    console.error('[Better Auth Error] OAuth Error Details:');
    console.error('='.repeat(60));
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Context:', context);
    console.error('Path:', context?.path);
    console.error('='.repeat(60));
  },
});

// Better Auth v1 exports
export const handleRequest = auth.handler;

// Helper function to get session from request
export async function getSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}
