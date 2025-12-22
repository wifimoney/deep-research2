import { createUser, findUserByEmail, findUserByUsername } from '../../data/user-repo.js'
import { hashPassword } from '../../../../shared/auth/utils.js'
import { createSession } from '../../../../shared/auth/session-repo.js'

export async function registerUser(username: string, email: string, password: string): Promise<{ success: boolean; error?: string; session_id?: string; user?: any }> {
    // Basic validation checked by controller (length etc), but we can double check or rely on controller.
    // Implementing business logic checks here.

    // Check if email exists
    const existingEmail = await findUserByEmail(email)
    if (existingEmail) {
        return { success: false, error: 'Email is already registered' }
    }

    // Check if username exists
    const existingUsername = await findUserByUsername(username)
    if (existingUsername) {
        return { success: false, error: 'Username is already taken' }
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const user = await createUser(username, email, passwordHash)

    // Create session
    const sessionId = await createSession(user.id)

    return {
        success: true,
        session_id: sessionId,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
        },
    }
}
