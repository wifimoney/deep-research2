import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, users, sessions, oauthAccounts, verification } from "@repo/db";
import { serverConfig } from "../mastra/config/config.js";

// Base URL for the application - CRITICAL for OAuth to work correctly
// This MUST match the redirect URI registered in Google OAuth Console
const baseURL = serverConfig.baseURL;

// Validate BASE_URL configuration in production
if (serverConfig.isProduction) {
  if (!process.env.BASE_URL) {
    console.error('⚠️  WARNING: BASE_URL environment variable is not set in production!');
    console.error('   OAuth callbacks will likely fail with "invalid_code" error.');
    console.error('   Please set BASE_URL to match your production domain (e.g., https://yourdomain.com)');
    console.error('   Current baseURL (fallback):', baseURL);
  } else if (baseURL.includes('localhost') || baseURL.includes('127.0.0.1')) {
    console.error('⚠️  WARNING: BASE_URL is set to localhost in production environment!');
    console.error('   OAuth callbacks will fail. BASE_URL must match your production domain.');
    console.error('   Current BASE_URL:', baseURL);
  } else if (!baseURL.startsWith('https://')) {
    console.error('⚠️  WARNING: BASE_URL should use HTTPS in production!');
    console.error('   Current BASE_URL:', baseURL);
  } else {
    console.log('✅ BASE_URL correctly configured for production:', baseURL);
  }
}

console.log(`Better Auth initialized with baseURL: ${baseURL}`);

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
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/contacts.readonly'
      ],
      // Ensure we get refresh tokens
      accessType: 'offline',
      prompt: 'consent',
    },
  },
  cookies: {
    secure: process.env.NODE_ENV === "production",
  },
  // Add error handling configuration
  onError: (error, context) => {
    console.error('Better Auth error:', error)
    console.error('Context:', context)
    
    // Log to Sentry if available
    if (typeof Sentry !== 'undefined') {
      const Sentry = require('@sentry/node')
      Sentry.captureException(error, {
        extra: {
          context: context?.path || 'unknown',
        }
      })
    }
  },
  // Configure callback URL explicitly
  redirects: {
    signIn: '/dashboard',
    signUp: '/dashboard',
    afterSignIn: '/dashboard',
    afterSignUp: '/dashboard',
    onError: '/auth/login',
  },
});

// Better Auth v1 exports
export const handleRequest = auth.handler;

// Helper function to get session from request
export async function getSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}
