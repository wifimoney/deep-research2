import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'

// Salt rounds for bcrypt (higher = more secure but slower)
const SALT_ROUNDS = 12

// Session duration in milliseconds (default: 7 days)
export const SESSION_DURATION_MS = 
  (parseInt(process.env.SESSION_DURATION_DAYS || '7', 10)) * 24 * 60 * 60 * 1000

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return uuidv4()
}

/**
 * Calculate session expiry date
 */
export function getSessionExpiry(): Date {
  return new Date(Date.now() + SESSION_DURATION_MS)
}

/**
 * Cookie options for session cookie
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DURATION_MS / 1000, // Convert to seconds
}
