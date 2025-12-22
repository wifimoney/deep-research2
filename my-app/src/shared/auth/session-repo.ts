import { query } from '@repo/db'
import { generateSessionId, getSessionExpiry } from './utils.js'

// Session with user type
export interface SessionWithUser {
    session_id: string
    user_id: string
    expires_at: Date
    username: string
    email: string
}

/**
 * Create a new session for a user
 */
export async function createSession(userId: string): Promise<string> {
    const sessionId = generateSessionId()
    const expiresAt = getSessionExpiry()

    await query(
        `INSERT INTO sessions (id, user_id, expires_at)
     VALUES ($1, $2, $3)`,
        [sessionId, userId, expiresAt]
    )

    return sessionId
}

/**
 * Get session with user data (for auth middleware)
 */
export async function getSessionWithUser(
    sessionId: string
): Promise<SessionWithUser | null> {
    const result = await query<SessionWithUser>(
        `SELECT 
       s.id as session_id,
       s.user_id,
       s.expires_at,
       u.username,
       u.email
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
        [sessionId]
    )

    return result.rows[0] || null
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(sessionId: string): Promise<void> {
    await query(
        `DELETE FROM sessions WHERE id = $1`,
        [sessionId]
    )
}

/**
 * Delete all sessions for a user (logout everywhere)
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
    await query(
        `DELETE FROM sessions WHERE user_id = $1`,
        [userId]
    )
}

/**
 * Clean up expired sessions (can be called periodically)
 */
export async function cleanExpiredSessions(): Promise<number> {
    const result = await query(
        `DELETE FROM sessions WHERE expires_at < NOW()`
    )

    return result.rowCount || 0
}
